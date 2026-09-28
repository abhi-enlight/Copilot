/**
 * useTenantContext — refactored to use real Supabase Auth
 *
 * Previously relied on sessionStorage + MS OAuth cookies for identity.
 * Now derives auth state from AuthProvider (Supabase Auth) and keeps
 * backward compatibility with legacy consumers that used this hook's
 * return values (activeTenant, isAuthenticated, handleLogout, etc.).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Tenant } from '@/types';

interface ServerStatusResponse {
  m365Connected?: boolean;
  crmConnected?: boolean;
  userEmail?: string;
  userName?: string;
  sharepointDrive?: string;
}

function buildTenantFromStatus(data: ServerStatusResponse, base: Tenant): Tenant {
  const isPersonal = /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(data.userEmail || '');
  const name = data.userName
    ? `${data.userName}'s Workspace`
    : `${(data.userEmail || '').split('@')[0]}'s Workspace`;

  return {
    ...base,
    userEmail: data.userEmail,
    userName: data.userName || undefined,
    name,
    sharepointDrive: data.sharepointDrive || (isPersonal ? 'OneDrive (/me/drive)' : '/sites/root/drive'),
    m365Connected: true,
    crmConnected: Boolean(data.crmConnected),
  };
}

export function useTenantContext() {
  const { user, profile, activeOrg, signOut } = useAuth();

  const [serverStatus, setServerStatus] = useState<ServerStatusResponse | null>(null);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showConsentSuccess, setShowConsentSuccess] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  const tenantDropdownRef = useRef<HTMLDivElement>(null);

  // isAuthenticated = has a Supabase auth user
  const isAuthenticated = !!user;

  // Sync tenant state from server status (for legacy MS connection info)
  const syncServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tenant/status');
      if (res.ok) {
        const data: ServerStatusResponse = await res.json();
        setServerStatus(data);
      }
    } catch (err) {
      console.warn('Failed to sync server status:', err);
    }
  }, []);

  // Sync MS connection status on mount
  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    async function loadStatus() {
      try {
        const res = await fetch('/api/tenant/status');
        if (res.ok && isMounted) {
          const data: ServerStatusResponse = await res.json();
          setServerStatus(data);
        }
      } catch (err) {
        console.warn('Failed to sync server status:', err);
      }
    }

    void loadStatus();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Derive activeTenant using useMemo to avoid cascading render cycles
  const activeTenant: Tenant = useMemo(() => {
    const base: Tenant = {
      id: activeOrg?.id ?? 'personal',
      name: activeOrg?.name ?? 'Personal Workspace',
      slug: activeOrg?.slug ?? 'personal',
      role: 'Owner',
      userEmail: profile?.email ?? undefined,
      userName: profile?.displayName ?? undefined,
      m365Connected: false,
      crmConnected: false,
    };

    if (serverStatus?.m365Connected && serverStatus?.userEmail) {
      return buildTenantFromStatus(serverStatus, base);
    }

    return base;
  }, [activeOrg, profile, serverStatus]);

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
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleAdminConsentSuccess = () => {
    setShowConsentModal(false);
    setShowConsentSuccess(true);
    void syncServerStatus();
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/integrations/microsoft/disconnect', { method: 'POST' });
      setServerStatus(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  return {
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
    handleAdminConsentSuccess,
    handleDisconnect,
    syncServerStatus,
  };
}
