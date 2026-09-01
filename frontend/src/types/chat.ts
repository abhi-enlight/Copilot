export type MessageRole = 'user' | 'assistant' | 'system';

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  sourceBadges?: string[];
  timestamp?: string;
};

export type ChatPayload = {
  chatInput: string;
  sessionId: string;
  tenantId: string;
  tenantSlug: string;
  userEmail?: string;
  crmConnected?: boolean;
  dynamicsOrg?: string;
  m365Connected?: boolean;
  sharepointDrive?: string;
};

export type N8nChatResponse = {
  output?: string;
  response?: string;
  message?: string;
  text?: string;
};
