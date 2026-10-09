/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Native Zoho Projects REST API Client & Token Manager for Prism V2.
 * Connects directly to Zoho Projects (projectsapi.zoho.com) with
 * multi-datacenter support, token auto-refresh, and AES-256-GCM vault security.
 */

import { adminSupabase } from "@/lib/supabase-admin";
import {
  encryptIntegrationToken,
  decryptIntegrationToken,
} from "@/lib/agent/crypto";

export interface ZohoPortal {
  id: string;
  name: string;
  is_default?: boolean;
}

export interface ZohoProject {
  id: string;
  name: string;
  key?: string;
  status: string;
  description?: string;
  owner_name?: string;
  start_date?: string;
  end_date?: string;
  percent_complete?: number;
}

export interface ZohoTask {
  id: string;
  name: string;
  status: string;
  priority?: string;
  percent_complete?: number;
  start_date?: string;
  end_date?: string;
  created_person?: string;
  project_id?: string;
  project_name?: string;
}

export interface ZohoMilestone {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

export interface ZohoBug {
  id: string;
  title: string;
  severity?: string;
  status: string;
  assignee?: string;
}

export function getZohoAccountsDomain(dc = "com"): string {
  const norm = (dc || "com").toLowerCase().trim();
  if (norm === "in") return "https://accounts.zoho.in";
  if (norm === "eu") return "https://accounts.zoho.eu";
  if (norm === "com.au" || norm === "au") return "https://accounts.zoho.com.au";
  if (norm === "jp") return "https://accounts.zoho.jp";
  if (norm === "ca") return "https://accounts.zoho.ca";
  return "https://accounts.zoho.com";
}

export function getZohoProjectsApiBase(dc = "com"): string {
  const norm = (dc || "com").toLowerCase().trim();
  if (norm === "in") return "https://projectsapi.zoho.in/restapi";
  if (norm === "eu") return "https://projectsapi.zoho.eu/restapi";
  if (norm === "com.au" || norm === "au") return "https://projectsapi.zoho.com.au/restapi";
  if (norm === "jp") return "https://projectsapi.zoho.jp/restapi";
  if (norm === "ca") return "https://projectsapi.zoho.ca/restapi";
  return "https://projectsapi.zoho.com/restapi";
}

export function getZohoProjectsScopes(): string {
  return [
    "ZohoProjects.portals.READ",
    "ZohoProjects.projects.READ",
    "ZohoProjects.projects.CREATE",
    "ZohoProjects.tasks.ALL",
    "ZohoProjects.milestones.READ",
    "ZohoProjects.bugs.READ",
  ].join(",");
}

/**
 * Retrieves a valid Zoho Projects access token for the given user,
 * automatically handling proactive token refresh if expired.
 */
export async function getValidZohoProjectsToken(userIdentifier: string): Promise<{
  accessToken: string;
  portalId: string;
  dc: string;
  accountName: string;
} | null> {
  try {
    const isEmail = userIdentifier.includes("@");
    const filter = isEmail
      ? `user_email.eq.${userIdentifier.toLowerCase()}`
      : `auth_user_id.eq.${userIdentifier}`;

    const { data: row, error } = await adminSupabase
      .from("user_integrations")
      .select("*")
      .or(filter)
      .eq("provider", "zoho")
      .eq("product", "projects")
      .maybeSingle();

    if (error || !row || row.status !== "active") {
      return null;
    }

    const dc = row.zoho_data_center || process.env.ZOHO_DATACENTER || "com";
    let accessToken: string;
    let refreshToken: string;

    try {
      accessToken = decryptIntegrationToken(row.access_token_encrypted);
      refreshToken = row.refresh_token_encrypted
        ? decryptIntegrationToken(row.refresh_token_encrypted)
        : "";
    } catch (decryptErr) {
      console.error("[zoho-projects] Failed to decrypt tokens:", decryptErr);
      return null;
    }

    // Check expiration
    const expiresAt = row.access_token_expires_at
      ? new Date(row.access_token_expires_at).getTime()
      : 0;
    const isExpired = Date.now() > expiresAt - 5 * 60 * 1000; // Refresh 5 mins before expiry

    if (isExpired && refreshToken) {
      try {
        const refreshed = await refreshZohoProjectsToken(refreshToken, dc);
        if (refreshed?.access_token) {
          accessToken = refreshed.access_token;
          const newExpiresAt = new Date(
            Date.now() + (refreshed.expires_in || 3600) * 1000
          ).toISOString();

          await adminSupabase
            .from("user_integrations")
            .update({
              access_token_encrypted: encryptIntegrationToken(accessToken),
              access_token_expires_at: newExpiresAt,
              last_refreshed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      } catch (refreshErr) {
        console.warn("[zoho-projects] Auto-refresh failed, trying current token:", refreshErr);
      }
    }

    let portalId = row.zoho_portal_id;
    if (!portalId) {
      // Lazy-discover portal ID if not yet cached
      const portals = await fetchPortals(accessToken, dc);
      if (portals.length > 0) {
        portalId = portals[0].id;
        await adminSupabase
          .from("user_integrations")
          .update({
            zoho_portal_id: portalId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }

    return {
      accessToken,
      portalId: portalId || "",
      dc,
      accountName: row.account_name || row.account_email || "Zoho Projects",
    };
  } catch (err) {
    console.error("[zoho-projects] Token resolution failed:", err);
    return null;
  }
}

/**
 * Exchanges a refresh token for a fresh access token from Zoho Accounts.
 */
export async function refreshZohoProjectsToken(
  refreshToken: string,
  dc = "com"
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Zoho OAuth credentials (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET) not set");
  }

  const tokenUrl = `${getZohoAccountsDomain(dc)}/oauth/v2/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[zoho-projects] Token refresh HTTP error:", res.status, errText);
    return null;
  }

  const data = await res.json();
  if (data.error) {
    console.error("[zoho-projects] Token refresh API error:", data.error);
    return null;
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in || 3600,
  };
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 */
export async function exchangeZohoCodeForTokens(
  code: string,
  redirectUri: string,
  dc = "com"
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET in environment");
  }

  const tokenUrl = `${getZohoAccountsDomain(dc)}/oauth/v2/token`;
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zoho token exchange failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Zoho token error: ${data.error}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 3600,
  };
}

// ── REST API Methods ────────────────────────────────────────────────────────

/**
 * Fetches portals available to the authenticated Zoho account.
 */
export async function fetchPortals(
  accessToken: string,
  dc = "com"
): Promise<ZohoPortal[]> {
  const url = `${getZohoProjectsApiBase(dc)}/portals/`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) {
    console.warn("[zoho-projects] fetchPortals error:", res.status);
    return [];
  }

  const data = await res.json();
  const portals = data.portals || [];
  return portals.map((p: any) => ({
    id: String(p.id_string || p.id),
    name: String(p.name || "Default Portal"),
    is_default: Boolean(p.is_default),
  }));
}

/**
 * Fetches projects in a given portal.
 */
export async function fetchProjects(
  portalId: string,
  accessToken: string,
  dc = "com"
): Promise<ZohoProject[]> {
  const url = `${getZohoProjectsApiBase(dc)}/portal/${portalId}/projects/`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) {
    console.warn("[zoho-projects] fetchProjects error:", res.status);
    return [];
  }

  const data = await res.json();
  const projects = data.projects || [];
  return projects.map((p: any) => ({
    id: String(p.id_string || p.id),
    name: String(p.name || "Untitled Project"),
    key: p.key || undefined,
    status: String(p.status || "active"),
    description: p.description || undefined,
    owner_name: p.owner_name || undefined,
    start_date: p.start_date || undefined,
    end_date: p.end_date || undefined,
    percent_complete: typeof p.percent_complete === "number" ? p.percent_complete : 0,
  }));
}

/**
 * Queries tasks for a specific project.
 */
export async function fetchTasks(
  portalId: string,
  projectId: string,
  accessToken: string,
  dc = "com",
  options: { status?: string; limit?: number } = {}
): Promise<ZohoTask[]> {
  const url = new URL(`${getZohoProjectsApiBase(dc)}/portal/${portalId}/projects/${projectId}/tasks/`);
  if (options.status) url.searchParams.set("status", options.status);
  if (options.limit) url.searchParams.set("range", String(options.limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) {
    console.warn("[zoho-projects] fetchTasks error:", res.status);
    return [];
  }

  const data = await res.json();
  const tasks = data.tasks || [];
  return tasks.map((t: any) => ({
    id: String(t.id_string || t.id),
    name: String(t.name || "Untitled Task"),
    status: typeof t.status === "object" ? String(t.status?.name || "Open") : String(t.status || "Open"),
    priority: t.priority || "None",
    percent_complete: typeof t.percent_complete === "number" ? t.percent_complete : 0,
    start_date: t.start_date || undefined,
    end_date: t.end_date || undefined,
    created_person: t.created_person || undefined,
    project_id: projectId,
  }));
}

/**
 * Creates a new task in a Zoho Project.
 */
export async function createZohoTask(
  portalId: string,
  projectId: string,
  taskData: {
    name: string;
    description?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
  },
  accessToken: string,
  dc = "com"
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const url = `${getZohoProjectsApiBase(dc)}/portal/${portalId}/projects/${projectId}/tasks/`;
  const form = new URLSearchParams();
  form.set("name", taskData.name);
  if (taskData.description) form.set("description", taskData.description);
  if (taskData.priority) form.set("priority", taskData.priority);
  if (taskData.startDate) form.set("start_date", taskData.startDate);
  if (taskData.endDate) form.set("end_date", taskData.endDate);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { success: false, error: `Failed to create task (${res.status}): ${errText}` };
  }

  const data = await res.json();
  const created = (data.tasks || [])[0];
  return {
    success: true,
    taskId: created ? String(created.id_string || created.id) : undefined,
  };
}

/**
 * Fetches milestones for a project.
 */
export async function fetchMilestones(
  portalId: string,
  projectId: string,
  accessToken: string,
  dc = "com"
): Promise<ZohoMilestone[]> {
  const url = `${getZohoProjectsApiBase(dc)}/portal/${portalId}/projects/${projectId}/milestones/`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const milestones = data.milestones || [];
  return milestones.map((m: any) => ({
    id: String(m.id_string || m.id),
    name: String(m.name || "Untitled Milestone"),
    status: String(m.status || "active"),
    start_date: m.start_date || undefined,
    end_date: m.end_date || undefined,
  }));
}

/**
 * Fetches bugs/issues for a project.
 */
export async function fetchBugs(
  portalId: string,
  projectId: string,
  accessToken: string,
  dc = "com"
): Promise<ZohoBug[]> {
  const url = `${getZohoProjectsApiBase(dc)}/portal/${portalId}/projects/${projectId}/bugs/`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const bugs = data.bugs || [];
  return bugs.map((b: any) => ({
    id: String(b.id_string || b.id),
    title: String(b.title || "Untitled Bug"),
    severity: b.severity_type || b.severity || "Normal",
    status: typeof b.status === "object" ? String(b.status?.name || "Open") : String(b.status || "Open"),
    assignee: b.assignee_name || undefined,
  }));
}

/**
 * OpenAI-compatible tool specifications for Zoho Projects agent orchestration.
 */
export const ZOHO_PROJECTS_AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "ZOHO_PROJECTS_LIST_PROJECTS",
      description: "List all accessible projects in the organization's Zoho Projects portal.",
      parameters: {
        type: "object",
        properties: {
          portal_id: {
            type: "string",
            description: "Optional Zoho portal ID. Defaults to user's primary connected portal.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ZOHO_PROJECTS_GET_TASKS",
      description: "Retrieve tasks for a specific project in Zoho Projects, including status, priority, and assignees.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "The unique ID of the Zoho project.",
          },
          portal_id: {
            type: "string",
            description: "Optional Zoho portal ID.",
          },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ZOHO_PROJECTS_CREATE_TASK",
      description: "Create a new task within a Zoho Projects project. (Stages an Action Proposal Card requiring executive sign-off).",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "The unique ID of the target Zoho project.",
          },
          name: {
            type: "string",
            description: "The name / title of the new task.",
          },
          description: {
            type: "string",
            description: "Optional description or acceptance criteria for the task.",
          },
          priority: {
            type: "string",
            enum: ["None", "Low", "Medium", "High"],
            description: "Task priority level.",
          },
          start_date: {
            type: "string",
            description: "Task start date (MM-DD-YYYY or YYYY-MM-DD).",
          },
          end_date: {
            type: "string",
            description: "Task due date (MM-DD-YYYY or YYYY-MM-DD).",
          },
          portal_id: {
            type: "string",
            description: "Optional Zoho portal ID.",
          },
        },
        required: ["project_id", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ZOHO_PROJECTS_GET_MILESTONES",
      description: "Retrieve milestones and roadmap phases for a project in Zoho Projects.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "The unique ID of the Zoho project.",
          },
          portal_id: {
            type: "string",
            description: "Optional Zoho portal ID.",
          },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ZOHO_PROJECTS_GET_BUGS",
      description: "Retrieve issue and bug tracker items for a project in Zoho Projects.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "The unique ID of the Zoho project.",
          },
          portal_id: {
            type: "string",
            description: "Optional Zoho portal ID.",
          },
        },
        required: ["project_id"],
      },
    },
  },
];
