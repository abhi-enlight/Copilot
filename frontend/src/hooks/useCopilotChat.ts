import { useState, useRef, useEffect } from 'react';
import { Message, Tenant } from '@/types';
import { apiClient } from '@/lib/api-client';
import { cleanEmoji, extractSourceBadges, copyToClipboard } from '@/lib/utils';
import { getWelcomeMessage } from '@/lib/constants';

export function useCopilotChat(activeTenant: Tenant) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: getWelcomeMessage(activeTenant),
      sourceBadges: ['SharePoint', 'Dynamics 365', 'Outlook'],
      timestamp: 'Just now'
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const rawResponse = await apiClient.sendChatMessage({
        chatInput: query,
        sessionId: `session-${activeTenant.slug}-1`,
        tenantId: activeTenant.id,
        tenantSlug: activeTenant.slug
      });

      const cleanedContent = cleanEmoji(rawResponse);
      const badges = extractSourceBadges(cleanedContent);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: cleanedContent,
          sourceBadges: badges,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (error) {
      console.error('Error in useCopilotChat:', error);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Unable to reach the copilot workflow. Please check endpoint connectivity and credentials.',
            sourceBadges: ['System Fault'],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync welcome message when active tenant changes if chat is clean
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
          {
            ...prev[0],
            content: getWelcomeMessage(activeTenant)
          }
        ];
      }
      return prev;
    });
  }, [activeTenant]);

  const resetMessages = (customWelcome?: string) => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: customWelcome || getWelcomeMessage(activeTenant),
        sourceBadges: ['SharePoint', 'Dynamics 365', 'Outlook'],
        timestamp: 'Just now'
      }
    ]);
  };

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    copiedId,
    messagesEndRef,
    inputRef,
    handleCopy,
    handleQuickAction,
    handleSendMessage,
    resetMessages
  };
}
