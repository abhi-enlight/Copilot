import { workflow, trigger, node, languageModel, newCredential } from '@n8n/workflow-sdk';

const dailySchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Daily 09:00 AM Cadence',
    parameters: {
      rule: {
        interval: [
          {
            field: 'cronExpression',
            expression: '0 9 * * 1-5'
          }
        ]
      }
    }
  }
});

const geminiNudgeModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  version: 1.1,
  config: {
    name: 'Gemini Nudge Model',
    parameters: {
      modelName: 'models/gemini-2.5-flash',
      options: {
        temperature: 0.2
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini(PaLM) Api')
    }
  }
});

const fetchActiveCampaigns = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fetch Active Campaigns & 72h Deadlines',
    parameters: {
      jsCode: `
return [
  {
    json: {
      campaign_name: "Amul Kool Summer Bonanza ₹30 Instant PhonePe Cashback",
      client: "Amul India (GCMMF)",
      days_to_golive: 3,
      advance_escrow_status: "100% Verified in Zoho Books",
      dlt_header_status: "Approved",
      staging_uat_status: "PENDING_SIGN_OFF",
      lead_spoc: "Sachin (Tech Team)",
      risk_level: "HIGH",
      reason: "72-hour Pre-launch Staging UAT must complete 48h before TVC airtime."
    }
  }
];
`
    }
  }
});

const generateNudge = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.5,
  config: {
    name: 'Generate SOP Nudge & Risk Matrix',
    parameters: {
      prompt: `Generate an executive proactive morning nudge for BigCity campaign managers.
Campaign: {{ $json.campaign_name }}
Client: {{ $json.client }}
Escrow: {{ $json.advance_escrow_status }}
UAT Status: {{ $json.staging_uat_status }} (Assignee: {{ $json.lead_spoc }})
Highlight strict SOP compliance, remaining TAT, and action required.`
    },
    subnodes: {
      model: geminiNudgeModel
    }
  }
});

export default workflow('bcp-daily-nudge', 'BCP Assist - Proactive Daily Risk & Deadline Nudge')
  .add(dailySchedule)
  .to(fetchActiveCampaigns)
  .to(generateNudge);
