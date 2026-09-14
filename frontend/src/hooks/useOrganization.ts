"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, type Organization } from "@/components/providers/AuthProvider";

export interface OrgMember {
  userId: string;
  orgRole: "owner" | "admin" | "member";
  joinedAt: string;
  email: string;
  displayName: string | null;
  appRole: string;
}

export function useOrganization() {
  const { user, activeOrg, userOrgs, switchOrg, refreshOrgs } = useAuth();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!activeOrg?.id) {
      setMembers([]);
      setCallerRole(null);
      return;
    }

    setIsLoadingMembers(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${activeOrg.id}/members`, {
        headers: {
          "x-active-org-id": activeOrg.id,
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
  }, [activeOrg?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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
    if (!activeOrg?.id) return { ok: false, error: "No active organization" };

    try {
      const res = await fetch(`/api/organizations/${activeOrg.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-org-id": activeOrg.id,
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
    if (!activeOrg?.id) return { ok: false, error: "No active organization" };

    try {
      const res = await fetch(
        `/api/organizations/${activeOrg.id}/members?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: {
            "x-active-org-id": activeOrg.id,
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

  return {
    activeOrg,
    userOrgs,
    members,
    callerRole,
    isLoadingMembers,
    error,
    switchOrg,
    createOrg,
    inviteMember,
    removeMember,
    refreshMembers: fetchMembers,
  };
}
