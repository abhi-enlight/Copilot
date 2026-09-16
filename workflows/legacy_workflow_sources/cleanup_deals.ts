import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const manualTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: {
    name: 'Manual Trigger'
  }
});

const provideDealIds = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Provide Deal IDs to Delete',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
return [{ json: { dealId: "1418411000000596011" } }];
      `
    }
  }
});

const deleteDeal = node({
  type: 'n8n-nodes-base.zohoCrm',
  version: 1,
  config: {
    name: 'Delete Zoho Deal',
    parameters: {
      resource: 'deal',
      operation: 'delete',
      dealId: expr('{{ $json.dealId }}')
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

export default workflow('cleanup-test-deal', 'Cleanup Test Deal')
  .add(manualTrigger)
  .to(provideDealIds)
  .to(deleteDeal);


