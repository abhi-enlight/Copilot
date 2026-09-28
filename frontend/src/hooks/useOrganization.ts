"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

export interface OrgMember {
  userId: string;
  orgRole: "owner" | "admin" | "member";
  joinedAt: string;
  email: string;
  displayName: string | null;
  appRole: string;
}

export function useOrganization() {
  const { activeOrg, userOrgs, switchOrg, refreshOrgs } = useAuth();
  const activeOrgId = activeOrg?.id ?? null;

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!activeOrgId) {
      return;
    }

    setIsLoadingMembers(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
        headers: {
          "x-active-org-id": activeOrgId,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
        setCallerRole(data.myRole ?? null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || errData.error || "Failed to load members");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load members");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    let isMounted = true;
    if (!activeOrgId) return;

    const orgId = activeOrgId;
    async function initialLoad() {
      try {
        const res = await fetch(`/api/organizations/${orgId}/members`, {
          headers: {
            "x-active-org-id": orgId,
          },
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setMembers(data.members ?? []);
          setCallerRole(data.myRole ?? null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error)?.message || "Failed to load members");
        }
      }
    }

    void initialLoad();
    return () => {
      isMounted = false;
    };
  }, [activeOrgId]);

  const createOrg = async (name: string, type: "team" | "enterprise" = "team") => {
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Failed to create organization");
      }

      const { org } = await res.json();
      await refreshOrgs();
      if (org?.id) {
        switchOrg(org.id);
      }
      return { ok: true, org };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error)?.message || "Creation failed" };
    }
  };

  const inviteMember = async (email: string, role: "owner" | "admin" | "member" = "member") => {
    if (!activeOrgId) return { ok: false, error: "No active organization" };

    try {
      const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-org-id": activeOrgId,
        },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Failed to invite member");
      }

      await fetchMembers();
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error)?.message || "Invitation failed" };
    }
  };

  const removeMember = async (userId: string) => {
    if (!activeOrgId) return { ok: false, error: "No active organization" };

    try {
      const res = await fetch(
        `/api/organizations/${activeOrgId}/members?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: {
            "x-active-org-id": activeOrgId,
          },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Failed to remove member");
      }

      await fetchMembers();
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error)?.message || "Removal failed" };
    }
  };

  const updateMemberRole = async (userId: string, newRole: "owner" | "admin" | "member") => {
    if (!activeOrgId) return { ok: false, error: "No active organization" };

    try {
      const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-active-org-id": activeOrgId,
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Failed to update member role");
      }

      await fetchMembers();
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error)?.message || "Role update failed" };
    }
  };

  return {
    members: activeOrgId ? members : [],
    callerRole: activeOrgId ? callerRole : null,
    isLoadingMembers,
    error,
    activeOrg,
    userOrgs,
    switchOrg,
    createOrg,
    inviteMember,
    removeMember,
    updateMemberRole,
    refreshMembers: fetchMembers,
  };
}
