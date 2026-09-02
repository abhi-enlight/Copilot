import { useState, useRef, useEffect } from 'react';
import { Tenant } from '@/types';
import { DEFAULT_WORKSPACE } from '@/lib/constants';
import { apiClient } from '@/lib/api-client';

export function useTenantContext() {
  const [activeTenant, setActiveTenant] = useState<Tenant>(DEFAULT_WORKSPACE);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showConsentSuccess, setShowConsentSuccess] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  const tenantDropdownRef = useRef<HTMLDivElement>(null);

  // Restore authenticated session and dynamic tenant info from storage or callback params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isConnected = urlParams.get('connected');
      const emailParam = urlParams.get('email');
      const nameParam = urlParams.get('name') || urlParams.get('tenant');
      const driveParam = urlParams.get('drive');
      const orgParam = urlParams.get('org');
      const hasCrmParam = urlParams.get('has_crm');
      const hasStoredAuth = sessionStorage.getItem('copilot_auth') === 'true';

      const storedTenantStr = sessionStorage.getItem('copilot_tenant');
      if (storedTenantStr) {
        try {
          const parsed = JSON.parse(storedTenantStr);
          setActiveTenant(parsed);
        } catch {
          // ignore parsing error
        }
      }

      const cookieEmail = typeof document !== 'undefined' 
        ? (document.cookie.match(/(?:^|;\s*)ms_user_email=([^;]+)/)?.[1] ? decodeURIComponent(document.cookie.match(/(?:^|;\s*)ms_user_email=([^;]+)/)![1]) : null)
        : null;
      const cookieName = typeof document !== 'undefined'
        ? (document.cookie.match(/(?:^|;\s*)ms_user_name=([^;]+)/)?.[1] ? decodeURIComponent(document.cookie.match(/(?:^|;\s*)ms_user_name=([^;]+)/)![1]) : null)
        : null;

      const effectiveEmail = emailParam || cookieEmail;
      const effectiveName = nameParam || cookieName;

      if (isConnected || hasStoredAuth || effectiveEmail) {
        setIsAuthenticated(true);
        sessionStorage.setItem('copilot_auth', 'true');

        if (effectiveEmail || effectiveName || driveParam || orgParam || hasCrmParam !== null) {
          setActiveTenant((prev) => {
            const isPersonal = effectiveEmail ? /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(effectiveEmail) : false;
            const hasCrm = hasCrmParam !== null ? hasCrmParam === '1' : Boolean(orgParam && !isPersonal);

            const updated: Tenant = {
              ...prev,
              userEmail: effectiveEmail || prev.userEmail,
              name: effectiveName ? (effectiveName.includes('Workspace') ? effectiveName : `${effectiveName}'s Workspace`) : (effectiveEmail ? `${effectiveEmail.split('@')[0]}'s Workspace` : prev.name),
              sharepointDrive: driveParam || (isPersonal ? 'OneDrive (/me/drive)' : (prev.sharepointDrive || '/sites/root/drive')),
              dynamicsOrg: hasCrm ? (orgParam || prev.dynamicsOrg) : undefined,
              m365Connected: Boolean(effectiveEmail || isConnected),
              crmConnected: hasCrm
            };
            sessionStorage.setItem('copilot_tenant', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tenantDropdownRef.current && !tenantDropdownRef.current.contains(e.target as Node)) {
        setIsTenantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('copilot_auth');
        sessionStorage.removeItem('copilot_tenant');
        localStorage.removeItem('copilot_auth');
        localStorage.removeItem('copilot_tenant');
      }
      await apiClient.logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    setIsAuthenticated(false);
    setIsTenantDropdownOpen(false);
  };

  const handleLogin = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('copilot_auth', 'true');
    }
    setIsAuthenticated(true);
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setActiveTenant(tenant);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('copilot_tenant', JSON.stringify(tenant));
    }
  };

  return {
    activeTenant,
    setActiveTenant,
    handleSelectTenant,
    isAuthenticated,
    setIsAuthenticated,
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
  };
}
