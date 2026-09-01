'use client';

import React, { useEffect } from 'react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { TelemetrySidebar } from '@/components/cockpit/TelemetrySidebar';
import { IntelligenceStream } from '@/components/cockpit/IntelligenceStream';
import { HardwareInputBar } from '@/components/cockpit/HardwareInputBar';
import { LoginView } from '@/components/cockpit/LoginView';
import { AdminConsentModal } from '@/components/modals/AdminConsentModal';
import { IntegrationsModal } from '@/components/modals/IntegrationsModal';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useCopilotChat } from '@/hooks/useCopilotChat';

export default function OperationsCockpitPage() {
  const {
    activeTenant,
    isAuthenticated,
    isTenantDropdownOpen,
    setIsTenantDropdownOpen,
    showConsentModal,
    setShowConsentModal,
    showConsentSuccess,
    setShowConsentSuccess,
    showIntegrationsModal,
    setShowIntegrationsModal,
    tenantDropdownRef,
    handleLogout,
    handleLogin
  } = useTenantContext();

  const {
    messages,
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
  } = useCopilotChat(activeTenant);

  // Global ⌘K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputRef]);

  const onLogin = () => {
    handleLogin();
    resetMessages();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <div className="min-h-screen bg-[#f6f7fa] text-[#0f172a] font-sans flex flex-col items-center justify-between p-3 sm:p-5 lg:p-7 relative selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Bespoke Ambient Light Aura */}
      <AmbientBackground />

      {/* Top Floating Navigation Capsule */}
      <CockpitHeader
        isAuthenticated={isAuthenticated}
        activeTenant={activeTenant}
        isTenantDropdownOpen={isTenantDropdownOpen}
        tenantDropdownRef={tenantDropdownRef}
        setIsTenantDropdownOpen={setIsTenantDropdownOpen}
        setShowIntegrationsModal={setShowIntegrationsModal}
        setShowConsentModal={setShowConsentModal}
        onLogin={onLogin}
        onLogout={handleLogout}
      />

      {/* Main Hardware Chassis Container (Double-Bezel Light Architecture) */}
      <div className="w-full max-w-7xl h-[calc(100vh-5.75rem)] flex flex-col md:flex-row chassis-outer-light p-2.5 rounded-[2.25rem] relative z-10 overflow-hidden">
        {!isAuthenticated ? (
          <LoginView activeTenant={activeTenant} onEnterDemo={onLogin} />
        ) : (
          <>
            {/* Left HUD: Telemetry & Endpoint Orchestration */}
            <TelemetrySidebar
              onQuickAction={handleQuickAction}
              onOpenConsentModal={() => setShowConsentModal(true)}
              onLogout={handleLogout}
            />

            {/* Right Pane: Intelligence Stream & Hardware Input Bar */}
            <main className="flex-1 flex flex-col chassis-inner-light rounded-[calc(2.25rem-0.625rem)] overflow-hidden relative border border-slate-200/70">
              <IntelligenceStream
                messages={messages}
                isLoading={isLoading}
                activeTenant={activeTenant}
                copiedId={copiedId}
                messagesEndRef={messagesEndRef}
                onCopy={handleCopy}
              />

              <HardwareInputBar
                input={input}
                isLoading={isLoading}
                inputRef={inputRef}
                setInput={setInput}
                onSubmit={onSubmit}
              />
            </main>
          </>
        )}
      </div>

      {/* Enterprise IT Admin Consent Modal */}
      <AdminConsentModal
        isOpen={showConsentModal}
        activeTenant={activeTenant}
        showConsentSuccess={showConsentSuccess}
        setShowConsentSuccess={setShowConsentSuccess}
        onClose={() => setShowConsentModal(false)}
      />

      {/* Connect Data Sources & Integrations Modal */}
      <IntegrationsModal
        isOpen={showIntegrationsModal}
        activeTenant={activeTenant}
        onClose={() => setShowIntegrationsModal(false)}
      />
    </div>
  );
}
