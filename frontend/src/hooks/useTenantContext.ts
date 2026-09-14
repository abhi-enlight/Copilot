/**
 * useTenantContext — refactored to use real Supabase Auth
 *
 * Previously relied on sessionStorage + MS OAuth cookies for identity.
 * Now derives auth state from AuthProvider (Supabase Auth) and keeps
 * backward compatibility with legacy consumers that used this hook's
 * return values (activeTenant, isAuthenticated, handleLogout, etc.).
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Tenant } from '@/types';

function buildTenantFromStatus(data: any, base: Tenant): Tenant {
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

const DEFAULT_TENANT: Tenant = {
  id: 'personal',
  name: 'Personal Workspace',
  slug: 'personal',
  role: 'Owner',
  userEmail: undefined,
  userName: undefined,
  m365Connected: false,
  crmConnected: false,
};

export function useTenantContext() {
  const { user, profile, activeOrg, signOut } = useAuth();

  // Derive a Tenant shape from the Supabase auth context
  const [activeTenant, setActiveTenant] = useState<Tenant>(DEFAULT_TENANT);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showConsentSuccess, setShowConsentSuccess] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  const tenantDropdownRef = useRef<HTMLDivElement>(null);

  // isAuthenticated = has a Supabase auth user
  const isAuthenticated = !!user;

  // Sync tenant state from server status (for legacy MS connection info)
  const syncServerStatus = async () => {
    try {
      const res = await fetch('/api/tenant/status');
      if (res.ok) {
        const data = await res.json();
        if (data.m365Connected && data.userEmail) {
          setActiveTenant((prev) => buildTenantFromStatus(data, prev));
        } else {
          setActiveTenant((prev) => ({
            ...prev,
            m365Connected: false,
            crmConnected: false,
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to sync server status:', err);
    }
  };

  // Update activeTenant when the org context changes
  useEffect(() => {
    if (activeOrg) {
      setActiveTenant((prev) => ({
        ...prev,
        id: activeOrg.id,
        name: activeOrg.name,
        slug: activeOrg.slug,
        userName: profile?.displayName ?? undefined,
        userEmail: profile?.email ?? undefined,
      }));
    }
  }, [activeOrg, profile]);

  // Sync MS connection status on mount
  useEffect(() => {
    if (user) syncServerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
      await signOut(); // Supabase signOut + clears legacy cookies
    } catch (e) {
      console.error('Logout error:', e);
    }
    setActiveTenant(DEFAULT_TENANT);
    setIsTenantDropdownOpen(false);
  };

  // Legacy shim: kept for backward compat with pages that call handleLogin
  const handleLogin = () => {
    // no-op: login is now driven by /auth/login page + Supabase
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setActiveTenant(tenant);
  };

  return {
    activeTenant,
    setActiveTenant,
    handleSelectTenant,
    isAuthenticated,
    setIsAuthenticated: () => {}, // no-op: state comes from Supabase
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
    handleLogin,
  };
}
