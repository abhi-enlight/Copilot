import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const manualTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: {
    name: 'Manual Trigger'
  }
});

const listInvoices = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'List Zoho Books Invoices',
    parameters: {
      method: 'GET',
      url: 'https://www.zohoapis.in/books/v3/invoices?organization_id=60085935698',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api'
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const prepareInvoices = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Invoices to Delete',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const invoices = Array.isArray(res.invoices) ? res.invoices : [];
if (invoices.length === 0) return [{ json: { skip: true, message: 'No invoices to delete' } }];
return invoices.map(i => ({ json: { invoice_id: i.invoice_id, invoice_number: i.invoice_number, customer_name: i.customer_name } }));
      `
    }
  }
});

const deleteInvoice = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Delete Zoho Books Invoice',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'DELETE',
      url: expr('{{ "https://www.zohoapis.in/books/v3/invoices/" + $json.invoice_id + "?organization_id=60085935698" }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const summarizeInvoices = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Summarize Invoices Deleted',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const all = $input.all();
return [{ json: { deletedInvoicesCount: all.length, done: true } }];
      `
    }
  }
});

const listProjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'List Zoho Projects',
    parameters: {
      method: 'GET',
      url: 'https://projectsapi.zoho.in/restapi/portal/60085935707/projects/',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api'
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const prepareProjects = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Projects to Delete',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const projects = Array.isArray(res.projects) ? res.projects : [];
if (projects.length === 0) return [{ json: { skip: true, message: 'No projects to delete' } }];
return projects.map(p => ({ json: { project_id: p.id_string || p.id, name: p.name } }));
      `
    }
  }
});

const deleteProject = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Delete Zoho Project',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'DELETE',
      url: expr('{{ "https://projectsapi.zoho.in/restapi/portal/60085935707/projects/" + $json.project_id + "/" }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const summarizeAll = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Summarize Deletions',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const allProjects = $input.all();
const deletedInvoices = $('Prepare Invoices to Delete').all().map(i => i.json);
return [{
  json: {
    success: true,
    deletedInvoices,
    deletedProjects: allProjects.map(p => p.json)
  }
}];
      `
    }
  }
});

export default workflow('cleanup-all-projects-invoices', 'Cleanup All Projects and Invoices')
  .add(manualTrigger)
  .to(listInvoices)
  .to(prepareInvoices)
  .to(deleteInvoice)
  .to(summarizeInvoices)
  .to(listProjects)
  .to(prepareProjects)
  .to(deleteProject)
  .to(summarizeAll);
