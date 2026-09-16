import { workflow, trigger, node, languageModel, outputParser, newCredential } from '@n8n/workflow-sdk';

const incomingWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Incoming Campaign & Task Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'bcp-task-ingest',
      options: {}
    }
  }
});

const geminiExtractorModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  version: 1.1,
  config: {
    name: 'Gemini Extractor Model',
    parameters: {
      modelName: 'models/gemini-3.7-flash',
      options: {
        temperature: 0.1
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini(PaLM) Api')
    }
  }
});

const taskStructureParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Task Structure Parser',
    parameters: {
      jsonSchemaExample: JSON.stringify({
        task_title: 'Complete 72-hour UAT testing for FMCG Scratch & Win OTP route',
        task_description: 'Run end-to-end UAT on staging with 50 test mobile numbers before go-live',
        suggested_assignee: 'Sachin (Tech Team)',
        priority: 'high',
        due_date: '2026-09-07',
        campaign_name: 'Amul Kool Summer Bonanza ₹30 Instant PhonePe Cashback',
        client_name: 'Amul India (GCMMF)',
        budget_amount: 3500000,
        source_channel: 'ui_approval',
        requires_human_approval: false,
        policy_reason: 'Standard UAT task following Technical Readiness SOP'
      })
    }
  }
});

const aiTaskExtractor = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AI Task Extractor & Classifier',
    parameters: {
      promptType: 'define',
      text: '={{ $json.body?.message || $json.message || "Approve campaign and sync to Zoho CRM, Zoho Books, and Zoho Projects." }}',
      hasOutputParser: true,
      options: {
        systemMessage: `You are the BCP Assist Passive Task Extractor & Multi-App Sync Agent for BigCity Promotions.
Analyze campaign briefs and extract structured tasks mapped to Zoho CRM, Zoho Books, and Zoho Projects.

BigCity Assignee Roles:
- Operations & QR Codes: Khaleel (Ops Lead)
- Tech, CDN & Staging UAT: Sachin (Tech Lead)
- Client Servicing / Commercials: CS Heads / Rohit Sharma
- Legal & Brand IP Clearance: Prashant Mittal (Legal Head)
- Finance, Advance Escrow & TDS: Sneha Nair (Finance Lead)`
      }
    },
    subnodes: {
      model: geminiExtractorModel,
      outputParser: taskStructureParser
    }
  }
});

const policyGuard = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Policy & Safety Guard',
    parameters: {
      conditions: {
        conditions: [
          {
            leftValue: '={{ Boolean($json.body?.is_approved_by_manager || $json.is_approved_by_manager || $json.output?.requires_human_approval === false) }}',
            operator: { type: 'boolean', operation: 'equals' },
            rightValue: true
          }
        ]
      }
    }
  }
});

const prepareZohoSync = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Zoho Multi-App Payload',
    parameters: {
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'ACTION_QUEUED_FOR_ZOHO', type: 'string' },
          { id: 'dealName', name: 'dealName', value: '={{ $json.body?.campaignName || $json.campaignName || $json.output?.campaign_name || "Campaign Deal" }}', type: 'string' },
          { id: 'client', name: 'client', value: '={{ $json.body?.client || $json.client || $json.output?.client_name || "Enterprise Client" }}', type: 'string' },
          { id: 'amount', name: 'amount', value: '={{ parseInt(String($json.body?.budget || $json.budget || "0").replace(/[^0-9]/g, "")) || 3500000 }}', type: 'number' },
          { id: 'portal', name: 'portal', value: 'enlightlabdotcom', type: 'string' },
          { id: 'organization', name: 'organization', value: 'BCP', type: 'string' },
          { id: 'guardrail', name: 'guardrail', value: 'ALLOWED', type: 'string' }
        ]
      },
      includeOtherFields: true
    }
  }
});

const syncToZohoCrm = node({
  type: 'n8n-nodes-base.zohoCrm',
  version: 1,
  config: {
    name: 'Sync to Zoho CRM (Deals)',
    parameters: {
      resource: 'deal',
      dealName: '={{ $json.dealName }}',
      stage: 'Qualification',
      amount: '={{ $json.amount }}',
      additionalFields: {
        Description: '={{ $json.body?.message || ("Client: " + $json.client + " | Multi-app synchronized campaign in Zoho CRM, Zoho Books & Zoho Projects.") }}',
        Closing_Date: '={{ new Date(Date.now() + 30*86400000).toISOString().split("T")[0] }}'
      }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const escalateToManager = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Escalate to Manager',
    parameters: {
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'PENDING_HUMAN_SIGN_OFF', type: 'string' },
          { id: 'reason', name: 'policyReason', value: '={{ $json.output?.policy_reason }}', type: 'string' },
          { id: 'guardrail', name: 'guardrail', value: 'BLOCKED_PENDING_APPROVAL', type: 'string' }
        ]
      }
    }
  }
});

export default workflow('bcp-task-ingest', 'BCP Assist - Passive Task Extractor & Zoho Multi-App Sync')
  .add(incomingWebhook)
  .to(aiTaskExtractor)
  .to(policyGuard)
  .ifTrue(prepareZohoSync)
  .to(syncToZohoCrm)
  .ifFalse(escalateToManager);
