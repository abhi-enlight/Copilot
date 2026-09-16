import { workflow, trigger, node, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const executeTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Execute Workflow Trigger',
    parameters: {
      workflowInputs: {
        values: [
          { name: 'campaignContext', type: 'string' },
          { name: 'dealId', type: 'string' }
        ]
      }
    }
  }
});

const parseScope = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Scope',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const explicitDealId = String(item.dealId || '').trim();
const context = String(item.campaignContext || '');

let targetDealId = explicitDealId;
if (!targetDealId && context) {
  const match = context.match(/(?:CRM Deal ID|dealId|deal_id)[:=\\s]+(\\d+)/i);
  if (match && match[1]) {
    targetDealId = match[1];
  }
}

return [{
  json: {
    dealId: targetDealId,
    isScoped: Boolean(targetDealId),
    campaignContext: context
  }
}];
`
    }
  }
});

const checkScoped = ifElse({
  version: 2.2,
  config: {
    name: 'Check If Scoped',
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

const getScopedDeal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Get Scoped Deal',
    parameters: {
      method: 'GET',
      url: expr('{{ "https://www.zohoapis.in/crm/v2/Deals/" + $json.dealId }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatScopedDeal = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Scoped Deal',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const targetDealId = $('Parse Scope').first()?.json?.dealId || '';

const dealData = Array.isArray(res.data) ? res.data[0] : (res.id ? res : null);

if (!dealData || res.status === 'error' || res.code === 'RECORD_NOT_FOUND' || res.code === 'INVALID_DATA') {
  return [{
    json: {
      scoped: true,
      exists: false,
      deal_id: targetDealId,
      message: 'Deal record with ID ' + targetDealId + ' does not exist or was deleted from Zoho CRM.'
    }
  }];
}

return [{
  json: {
    scoped: true,
    exists: true,
    deal_id: String(dealData.id),
    name: dealData.Deal_Name || dealData.dealName || '',
    stage: dealData.Stage || dealData.stage || 'Qualification',
    amount: dealData.Amount !== undefined && dealData.Amount !== null ? dealData.Amount : 0,
    closing_date: dealData.Closing_Date || dealData.closingDate || '',
    account_name: dealData.Account_Name?.name || (typeof dealData.Account_Name === 'string' ? dealData.Account_Name : 'None'),
    contact_name: dealData.Contact_Name?.name || (typeof dealData.Contact_Name === 'string' ? dealData.Contact_Name : 'None'),
    description: dealData.Description || '',
    raw_deal: dealData
  }
}];
`
    }
  }
});

const listDeals = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'List Active Deals',
    parameters: {
      method: 'GET',
      url: 'https://www.zohoapis.in/crm/v2/Deals?sort_by=Modified_Time&sort_order=desc',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatDealsList = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Deals List',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const dealsList = Array.isArray(res.data) ? res.data : [];

return [{
  json: {
    scoped: false,
    total_deals: dealsList.length,
    deals: dealsList.map(d => ({
      id: String(d.id),
      name: d.Deal_Name || '',
      stage: d.Stage || 'Qualification',
      amount: d.Amount || 0,
      closing_date: d.Closing_Date || '',
      account: d.Account_Name?.name || '',
      contact: d.Contact_Name?.name || ''
    }))
  }
}];
`
    }
  }
});

export default workflow('zoho-crm-deals-service', 'Zoho CRM Deals Service')
  .add(executeTrigger)
  .to(parseScope)
  .to(
    checkScoped
      .onTrue(getScopedDeal.to(formatScopedDeal))
      .onFalse(listDeals.to(formatDealsList))
  );
