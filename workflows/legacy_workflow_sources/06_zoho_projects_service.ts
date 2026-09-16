import { workflow, trigger, node, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const executeTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Execute Workflow Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'campaignContext', type: 'string' },
          { name: 'projectId', type: 'string' }
        ]
      }
    }
  }
});

const parseScope = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Projects Scope',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const explicitProjectId = String(item.projectId || '').trim();
const context = String(item.campaignContext || '');

let targetProjectId = explicitProjectId;
if (!targetProjectId && context) {
  const match = context.match(/(?:Projects ID|projectId|project_id)[:=\\s]+(\\w+)/i);
  if (match && match[1]) {
    targetProjectId = match[1];
  }
}

return [{
  json: {
    projectId: targetProjectId,
    isScoped: Boolean(targetProjectId),
    campaignContext: context,
    portalId: '60085935707'
  }
}];
`
    }
  }
});

const checkScoped = ifElse({
  version: 2.2,
  config: {
    name: 'Check If Project Scoped',
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.isScoped }}'),
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const getScopedProject = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Get Scoped Project',
    parameters: {
      method: 'GET',
      url: expr('{{ "https://projectsapi.zoho.in/api/v3/portal/60085935707/projects/" + $json.projectId }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatScopedProject = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Scoped Project',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const targetId = $('Parse Projects Scope').first()?.json?.projectId || '';

let p = null;
if (res.id) p = res;
else if (Array.isArray(res.projects) && res.projects.length > 0) p = res.projects[0];
else if (Array.isArray(res.data) && res.data.length > 0) p = res.data[0];

if (!p || res.error || res.status_code === 404 || (typeof res.message === 'string' && res.message.includes('not exist'))) {
  return [{
    json: {
      scoped: true,
      exists: false,
      project_id: targetId,
      message: 'Project with ID ' + targetId + ' was deleted or does not exist in Zoho Projects portal 60085935707.'
    }
  }];
}

return [{
  json: {
    scoped: true,
    exists: true,
    project_id: String(p.id_string || p.id || targetId),
    name: p.name || p.project_name || 'Untitled',
    key: p.key || '',
    status: p.status?.name || (typeof p.status === 'string' ? p.status : 'active'),
    description: p.description || '',
    open_tasks: p.tasks?.open_count !== undefined ? p.tasks.open_count : (p.open_task_count || 0),
    closed_tasks: p.tasks?.closed_count !== undefined ? p.tasks.closed_count : 0,
    owner: p.owner?.name || p.owner_name || 'Owner',
    created_time: p.created_time || ''
  }
}];
`
    }
  }
});

const listAllProjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch All Portal Projects',
    parameters: {
      method: 'GET',
      url: 'https://projectsapi.zoho.in/api/v3/portal/60085935707/projects',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatAllProjects = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format All Projects',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const allItems = $input.all();
let rawList = [];

for (const item of allItems) {
  const data = item.json || {};
  if (Array.isArray(data.projects)) {
    rawList.push(...data.projects);
  } else if (Array.isArray(data.data)) {
    rawList.push(...data.data);
  } else if (Array.isArray(data)) {
    rawList.push(...data);
  } else if (data && (data.id || data.name || data.key)) {
    rawList.push(data);
  }
}

// Deduplicate by project ID
const seenIds = new Set();
const projectsList = [];
for (const p of rawList) {
  const pid = String(p.id_string || p.id || p.key || '');
  if (pid && seenIds.has(pid)) continue;
  if (pid) seenIds.add(pid);
  projectsList.push(p);
}

return [{
  json: {
    scoped: false,
    portal_id: '60085935707',
    total_projects: projectsList.length,
    projects: projectsList.map(p => ({
      id: String(p.id_string || p.id || ''),
      key: p.key || '',
      name: p.name || p.project_name || 'Untitled',
      status: p.status?.name || (typeof p.status === 'string' ? p.status : 'active'),
      owner_name: p.owner?.name || p.owner_name || 'Owner',
      task_count: p.tasks?.open_count !== undefined ? p.tasks.open_count : (p.open_task_count || 0)
    }))
  }
}];
`
    }
  }
});

export default workflow('zoho-projects-service', 'Zoho Projects Service')
  .add(executeTrigger)
  .to(parseScope)
  .to(
    checkScoped
      .onTrue(getScopedProject.to(formatScopedProject))
      .onFalse(listAllProjects.to(formatAllProjects))
  );
