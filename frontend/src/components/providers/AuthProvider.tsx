"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUserProfile {
  email: string;
  displayName: string | null;
  role: "owner" | "admin" | "member";
  connectorPreferences: Record<string, boolean>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "team" | "enterprise";
  ownerRole: string; // the current user's role in this org
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AppUserProfile | null;
  activeOrg: Organization | null;
  userOrgs: Organization[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load profile + orgs for a given user ──────────────────────────────────
  const loadUserData = useCallback(
    async (u: User) => {
      try {
        // Fetch app_users profile
        const { data: appUser } = await supabase
          .from("app_users")
          .select("email, display_name, role, connector_preferences")
          .eq("auth_user_id", u.id)
          .maybeSingle();

        if (appUser) {
          setProfile({
            email: appUser.email,
            displayName: appUser.display_name || null,
            role: appUser.role ?? "member",
            connectorPreferences: appUser.connector_preferences ?? {},
          });
        }

        // Fetch orgs this user belongs to
        const { data: memberships } = await supabase
          .from("organization_members")
          .select("role, organizations(id, name, slug, type)")
          .eq("user_id", u.id);

        const orgs: Organization[] = (memberships ?? [])
          .filter((m: any) => m.organizations)
          .map((m: any) => ({
            id: m.organizations.id,
            name: m.organizations.name,
            slug: m.organizations.slug,
            type: m.organizations.type,
            ownerRole: m.role,
          }));

        setUserOrgs(orgs);

        // Restore last active org from localStorage (per user)
        const savedOrgId = typeof window !== "undefined"
          ? localStorage.getItem(`activeOrgId_${u.id}`)
          : null;

        const restoredOrg =
          orgs.find((o) => o.id === savedOrgId) ||
          orgs.find((o) => o.type === "personal") ||
          orgs[0] ||
          null;

        setActiveOrg(restoredOrg);
      } catch (err) {
        console.warn("[AuthProvider] loadUserData error:", err);
      }
    },
    [supabase]
  );

  // ── Bootstrap + auth state change listener ─────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Subscribe to auth changes (handles sign-in, sign-out, token refresh, multi-tab sync)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (!mounted) return;
        setSession(s);
        const newUser = s?.user ?? null;
        setUser(newUser);
        if (newUser) {
          loadUserData(newUser);
        } else {
          setProfile(null);
          setUserOrgs([]);
          setActiveOrg(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadUserData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) return { error: error.message };

      if (data.user) {
        // Provision app row + org server-side
        await fetch("/api/auth/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authUserId: data.user.id,
            email,
            displayName,
          }),
        });
        await loadUserData(data.user);
      }
      return { error: null };
    },
    [supabase, loadUserData]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
    // Purge user-scoped and general prism keys from localStorage to prevent data leaks across logins
    if (typeof window !== "undefined") {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("prism_") || key.startsWith("activeOrgId_"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (err) {
        console.warn("[AuthProvider] Failed to clear local storage on signOut:", err);
      }
    }
    // Clear local state
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserOrgs([]);
    setActiveOrg(null);
  }, [supabase]);

  const switchOrg = useCallback(
    (orgId: string) => {
      const org = userOrgs.find((o) => o.id === orgId);
      if (!org) return;
      setActiveOrg(org);
      if (user && typeof window !== "undefined") {
        localStorage.setItem(`activeOrgId_${user.id}`, orgId);
      }
    },
    [userOrgs, user]
  );

  const refreshOrgs = useCallback(async () => {
    if (user) await loadUserData(user);
  }, [user, loadUserData]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        activeOrg,
        userOrgs,
        isLoading,
        signIn,
        signUp,
        signOut,
        switchOrg,
        refreshOrgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
