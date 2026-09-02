import { ChatPayload, TenantHealthResponse } from '@/types';

export const apiClient = {
  /**
   * Dispatches chat prompt to internal live Copilot chat API with user session credentials.
   */
  async sendChatMessage(payload: ChatPayload): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
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
