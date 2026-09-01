import { useState, useRef, useEffect } from 'react';
import { Tenant } from '@/types';
import { DEFAULT_WORKSPACE } from '@/lib/constants';
import { apiClient } from '@/lib/api-client';

export function useTenantContext() {
  const [activeTenant, setActiveTenant] = useState<Tenant>(DEFAULT_WORKSPACE);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showConsentSuccess, setShowConsentSuccess] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  const tenantDropdownRef = useRef<HTMLDivElement>(null);

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
      await apiClient.logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    setIsAuthenticated(false);
    setIsTenantDropdownOpen(false);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return {
    activeTenant,
    setActiveTenant,
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
