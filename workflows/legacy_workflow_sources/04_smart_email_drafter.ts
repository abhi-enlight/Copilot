import { workflow, trigger, node, languageModel, newCredential } from '@n8n/workflow-sdk';

const draftEmailWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Draft Email Request Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'bcp-draft-email',
      options: {}
    }
  }
});

const geminiDrafterModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  version: 1.1,
  config: {
    name: 'Gemini Drafter Model',
    parameters: {
      modelName: 'models/gemini-2.5-flash',
      options: {
        temperature: 0.3
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini(PaLM) Api')
    }
  }
});

const generateClientEmail = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.5,
  config: {
    name: 'Draft Professional SOP Client Email',
    parameters: {
      prompt: `You are the Senior Client Servicing Lead at BigCity Promotions.
Draft an articulate, highly professional client communication email.

Campaign: {{ $json.body?.campaignName || "Campaign" }}
Client: {{ $json.body?.client || "Brand Team" }}
Email Purpose: {{ $json.body?.purpose || "SOW Alignment & Go-Live Readiness" }}
Context & Milestones:
- Legal T&C & Partner IP Clearance status
- 100% Advance Escrow in Zoho Books
- Cryptographic QR bleed specifications
- 72-Hour Staging UAT window

Ensure a warm yet authoritative tone adherence to BigCity quality standards.`
    },
    subnodes: {
      model: geminiDrafterModel
    }
  }
});

export default workflow('bcp-draft-email', 'BCP Assist - Smart Client Email Drafter')
  .add(draftEmailWebhook)
  .to(generateClientEmail);
