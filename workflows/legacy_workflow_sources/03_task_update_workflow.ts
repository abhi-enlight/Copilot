import { workflow, trigger, node, newCredential } from '@n8n/workflow-sdk';

const incomingTaskUpdateWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Incoming Task Update Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'bcp-task-update',
      responseMode: 'responseNode',
      options: {}
    }
  }
});

const setTaskPayload = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Set Task Update Payload',
    parameters: {
      assignments: {
        assignments: [
          { id: 'campaignId', name: 'campaignId', value: '={{ $json.body?.campaignId || "" }}', type: 'string' },
          { id: 'taskId', name: 'taskId', value: '={{ $json.body?.taskId || "" }}', type: 'string' },
          { id: 'newStatus', name: 'newStatus', value: '={{ $json.body?.newStatus || "" }}', type: 'string' },
          { id: 'zohoCrmTaskId', name: 'zohoCrmTaskId', value: '={{ $json.body?.zohoCrmTaskId || "" }}', type: 'string' },
          { id: 'crmStatus', name: 'crmStatus', value: '={{ $json.body?.newStatus === "COMPLETED" ? "Closed" : ($json.body?.newStatus === "IN_PROGRESS" ? "In Progress" : "Open") }}', type: 'string' }
        ]
      },
      includeOtherFields: true
    }
  }
});

const respondToUpdateWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Task Update Webhook',
    parameters: {
      respondWith: 'json',
      responseBody: '={\n  "success": true,\n  "status": "updated",\n  "taskId": "{{ $json.taskId }}",\n  "newStatus": "{{ $json.newStatus }}",\n  "timestamp": "{{ new Date().toISOString() }}"\n}',
      options: {}
    }
  }
});

export default workflow('bcp-task-update', 'BCP Assist - Task Status Sync & Zoho Updater')
  .add(incomingTaskUpdateWebhook)
  .to(setTaskPayload)
  .to(respondToUpdateWebhook);
