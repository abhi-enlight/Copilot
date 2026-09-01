import { ChatPayload, N8nChatResponse, TenantHealthResponse } from '@/types';

const N8N_DEFAULT_WEBHOOK = 'https://indigo-pelican-266513.hostingersite.com/webhook/b1c82c64-895a-4c9a-bad9-1b415aefa8dd/chat';

export const apiClient = {
  /**
   * Dispatches chat prompt to n8n AI agent webhook with tenant context.
   */
  async sendChatMessage(payload: ChatPayload): Promise<string> {
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || N8N_DEFAULT_WEBHOOK;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data: N8nChatResponse = await response.json();
    return data.output || data.response || data.message || data.text || JSON.stringify(data);
  },

  /**
   * Fetches tenant health and permission verification status.
   */
  async getTenantHealth(tenantSlug: string): Promise<TenantHealthResponse> {
    const response = await fetch(`/api/tenant/health?tenant=${encodeURIComponent(tenantSlug)}`);
    if (!response.ok) {
      throw new Error('Failed to retrieve tenant health');
    }
    return response.json();
  },

  /**
   * Logs out the user and clears all session cookies.
   */
  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  }
};
