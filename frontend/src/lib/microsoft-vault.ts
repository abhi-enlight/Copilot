import { adminSupabase } from "@/lib/supabase-admin";
import { encryptToken, decryptToken } from "@/lib/zoho";
import { refreshMicrosoftToken } from "@/lib/microsoft-graph";
import { ensureAppUserByAuthId } from "@/lib/auth-helpers";

export interface MicrosoftVaultRecord {
  accessToken: string | null;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: number | null;
  userEmail: string | null;
  displayName?: string | null;
  accountEmail?: string | null;
  status: string;
}

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before actual expiry

/**
 * Resolves live Microsoft tokens for the authenticated user from user_integrations vault.
 * Automatically refreshes the access token using the stored refresh token if expired.
 * Never reads or relies on insecure/shared cookies.
 */
export async function resolveMicrosoftVaultTokens(
  authUserId: string,
  userEmail?: string | null,
  product?: "mail" | "sharepoint"
): Promise<MicrosoftVaultRecord> {
  if (!authUserId && !userEmail) {
    return {
      accessToken: null,
      refreshToken: null,
      scopes: [],
      expiresAt: null,
      userEmail: null,
      status: "not_connected",
    };
  }

  try {
    let query = adminSupabase
      .from("user_integrations")
      .select("*")
      .eq("provider", "microsoft");

    if (product) {
      query = query.eq("product", product);
    }

    if (authUserId && userEmail) {
      query = query.or(`auth_user_id.eq.${authUserId},user_email.eq.${userEmail.toLowerCase()}`);
    } else if (authUserId) {
      query = query.eq("auth_user_id", authUserId);
    } else if (userEmail) {
      query = query.eq("user_email", userEmail.toLowerCase());
    }

    let { data: records, error } = await query.order("updated_at", { ascending: false }).limit(1);

    // Fall back to any active Microsoft integration if specific product wasn't found
    if ((error || !records || records.length === 0) && product) {
      let fallbackQuery = adminSupabase
        .from("user_integrations")
        .select("*")
        .eq("provider", "microsoft");

      if (authUserId && userEmail) {
        fallbackQuery = fallbackQuery.or(`auth_user_id.eq.${authUserId},user_email.eq.${userEmail.toLowerCase()}`);
      } else if (authUserId) {
        fallbackQuery = fallbackQuery.eq("auth_user_id", authUserId);
      } else if (userEmail) {
        fallbackQuery = fallbackQuery.eq("user_email", userEmail.toLowerCase());
      }
      const fallback = await fallbackQuery.order("updated_at", { ascending: false }).limit(1);
      records = fallback.data;
      error = fallback.error;
    }

    if (error || !records || records.length === 0) {
      return {
        accessToken: null,
        refreshToken: null,
        scopes: [],
        expiresAt: null,
        userEmail: userEmail || null,
        status: "not_connected",
      };
    }

    const row = records[0];
    const decryptedAccessToken = decryptToken(row.access_token_encrypted);
    const decryptedRefreshToken = decryptToken(row.refresh_token_encrypted);
    const expiresAt = row.access_token_expires_at
      ? new Date(row.access_token_expires_at).getTime()
      : null;
    const scopes = Array.isArray(row.scopes) ? row.scopes : [];

    const isExpired = expiresAt != null && Date.now() >= expiresAt - EXPIRY_BUFFER_MS;

    // If token is expiring or expired, and we have a refresh token, perform rotation
    if (isExpired && decryptedRefreshToken) {
      try {
        const refreshed = await refreshMicrosoftToken(decryptedRefreshToken);
        if (refreshed.accessToken) {
          const newExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 3600) * 1000).toISOString();
          const newRefreshToken = refreshed.refreshToken || decryptedRefreshToken;

          await adminSupabase
            .from("user_integrations")
            .update({
              access_token_encrypted: encryptToken(refreshed.accessToken),
              refresh_token_encrypted: encryptToken(newRefreshToken),
              access_token_expires_at: newExpiresAt,
              last_refreshed_at: new Date().toISOString(),
              status: "active",
              last_error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          const userEmailResult = row.account_email || row.user_email;
          return {
            accessToken: refreshed.accessToken,
            refreshToken: newRefreshToken,
            scopes,
            expiresAt: new Date(newExpiresAt).getTime(),
            userEmail: userEmailResult,
            accountEmail: userEmailResult,
            displayName: row.account_name || null,
            status: "active",
          };
        } else {
          // Token refresh failed (revoked or expired refresh token)
          await adminSupabase
            .from("user_integrations")
            .update({
              status: "reauth_required",
              last_error_message: refreshed.error || "Token refresh failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          const userEmailResult = row.account_email || row.user_email;
          return {
            accessToken: null,
            refreshToken: null,
            scopes,
            expiresAt: null,
            userEmail: userEmailResult,
            accountEmail: userEmailResult,
            displayName: row.account_name || null,
            status: "reauth_required",
          };
        }
      } catch (rotateErr) {
        console.error("[microsoft-vault] Token refresh error:", rotateErr);
      }
    }

    const userEmailResult = row.account_email || row.user_email;
    return {
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
      scopes,
      expiresAt,
      userEmail: userEmailResult,
      accountEmail: userEmailResult,
      displayName: row.account_name || null,
      status: row.status || "active",
    };
  } catch (err) {
    console.error("[microsoft-vault] resolveMicrosoftVaultTokens exception:", err);
    return {
      accessToken: null,
      refreshToken: null,
      scopes: [],
      expiresAt: null,
      userEmail: userEmail || null,
      status: "error",
    };
  }
}

/**
 * Persists live Microsoft OAuth tokens to the user_integrations vault.
 * Always ensures the app_users relation exists, encrypts tokens, and writes securely.
 */
export async function upsertMicrosoftIntegration(opts: {
  authUserId: string;
  userEmail: string;
  displayName?: string | null;
  m365UserId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number;
  scopes?: string[];
  product?: "mail" | "sharepoint";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalizedEmail = opts.userEmail.trim().toLowerCase();

    // 1. Ensure app_users record exists so foreign key constraint passes
    await ensureAppUserByAuthId({
      authUserId: opts.authUserId,
      email: normalizedEmail,
      displayName: opts.displayName || null,
      m365UserId: opts.m365UserId || null,
    });

    const expiresAt = new Date(Date.now() + (opts.expiresIn || 3600) * 1000).toISOString();
    const encryptedAccess = encryptToken(opts.accessToken);
    const encryptedRefresh = opts.refreshToken ? encryptToken(opts.refreshToken) : null;
    const scopes = opts.scopes || [];

    // 2. Products supported by Microsoft integration in user_integrations table: 'mail' and 'sharepoint'
    const products: ("mail" | "sharepoint")[] = opts.product ? [opts.product] : ["mail", "sharepoint"];

    for (const product of products) {
      // Prevent downgrading an existing mail integration that already holds Mail.Send
      if (product === "mail" && !scopes.some((s) => /mail\.send/i.test(s))) {
        const { data: existingMail } = await adminSupabase
          .from("user_integrations")
          .select("id, scopes, status, access_token_expires_at")
          .eq("user_email", normalizedEmail)
          .eq("provider", "microsoft")
          .eq("product", "mail")
          .maybeSingle();

        if (
          existingMail &&
          existingMail.status === "active" &&
          Array.isArray(existingMail.scopes) &&
          existingMail.scopes.some((s: string) => /mail\.send/i.test(s))
        ) {
          // Keep existing mail tokens to prevent stripping sendMail privileges
          console.log("[microsoft-vault] Preserving existing mail integration with Mail.Send scope");
          continue;
        }
      }

      const { error } = await adminSupabase.from("user_integrations").upsert(
        {
          auth_user_id: opts.authUserId,
          user_email: normalizedEmail,
          account_email: normalizedEmail,
          account_name: opts.displayName || null,
          provider: "microsoft",
          product,
          access_token_encrypted: encryptedAccess,
          refresh_token_encrypted: encryptedRefresh,
          scopes,
          status: "active",
          access_token_expires_at: expiresAt,
          last_refreshed_at: new Date().toISOString(),
          last_error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email,provider,product" }
      );

      if (error) {
        console.error(`[microsoft-vault] Failed to upsert ${product} integration:`, error);
        return { ok: false, error: error.message };
      }
    }

    return { ok: true };
  } catch (err: any) {
    console.error("[microsoft-vault] upsertMicrosoftIntegration exception:", err);
    return { ok: false, error: err?.message || "Failed to save Microsoft integration" };
  }
}

/**
 * Deletes Microsoft integration tokens from the vault for a given user.
 */
export async function deleteMicrosoftIntegration(
  authUserId: string,
  userEmail?: string | null
): Promise<void> {
  try {
    let query = adminSupabase.from("user_integrations").delete().eq("provider", "microsoft");
    if (authUserId && userEmail) {
      query = query.or(`auth_user_id.eq.${authUserId},user_email.eq.${userEmail.toLowerCase()}`);
    } else if (authUserId) {
      query = query.eq("auth_user_id", authUserId);
    } else if (userEmail) {
      query = query.eq("user_email", userEmail.toLowerCase());
    }
    await query;
  } catch (err) {
    console.error("[microsoft-vault] deleteMicrosoftIntegration error:", err);
  }
}
