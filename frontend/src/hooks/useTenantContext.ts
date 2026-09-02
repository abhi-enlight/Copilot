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

  const syncServerStatus = async () => {
    try {
      const res = await fetch('/api/tenant/status');
      if (res.ok) {
        const data = await res.json();
        if (data.m365Connected && data.userEmail) {
          setIsAuthenticated(true);
          setActiveTenant((prev) => {
            const isPersonal = /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(data.userEmail);
            const name = data.userName 
              ? `${data.userName}'s Workspace` 
              : `${data.userEmail.split('@')[0]}'s Workspace`;

            const updated: Tenant = {
              ...prev,
              userEmail: data.userEmail,
              userName: data.userName || undefined,
              name,
              sharepointDrive: data.sharepointDrive || (isPersonal ? 'OneDrive (/me/drive)' : '/sites/root/drive'),
              m365Connected: true,
              crmConnected: Boolean(data.crmConnected)
            };
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('copilot_tenant', JSON.stringify(updated));
            }
            return updated;
          });
        } else {
          // Disconnected on server: ensure client strictly shows disconnected
          setActiveTenant((prev) => {
            const updated: Tenant = {
              ...prev,
              userEmail: undefined,
              userName: undefined,
              m365Connected: false,
              crmConnected: false
            };
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('copilot_tenant', JSON.stringify(updated));
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to sync server status:', err);
    }
  };

  // Restore authenticated session and sync with live server state
  useEffect(() => {
    syncServerStatus();
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
    setActiveTenant(DEFAULT_WORKSPACE);
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
