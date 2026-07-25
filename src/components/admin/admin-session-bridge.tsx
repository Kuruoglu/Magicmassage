"use client";

import { useEffect } from "react";

import {
  getSupabaseBrowserClient,
  signOutAdminBrowserSession,
} from "@/lib/supabase/browser";

const adminLoginPath = "/admin/login";
const publicAdminAuthPaths = new Set([
  adminLoginPath,
  "/admin/forgot-password",
  "/admin/reset-password",
]);
const restoreRetryLimit = 3;
const restoreRetryDelayMs = 1_000;

async function refreshAdminServerSession(accessToken: string) {
  return fetch("/api/admin/auth/refresh", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "POST",
  });
}

export function AdminSessionBridge() {
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (
      publicAdminAuthPaths.has(currentPath)
      && currentPath !== adminLoginPath
    ) {
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) return;

    let active = true;
    let lastSyncedToken: string | undefined;
    let restoreRetryCount = 0;
    let restoreRetryTimer: number | undefined;
    let serverMutationChain = Promise.resolve();
    const queuedTokens = new Set<string>();
    const restoreAdminPage = currentPath === adminLoginPath;

    function scheduleRestoreRetry(accessToken: string) {
      if (!active || restoreRetryCount >= restoreRetryLimit) return;

      restoreRetryCount += 1;
      restoreRetryTimer = window.setTimeout(() => {
        restoreRetryTimer = undefined;
        queueTokenSync(accessToken, true);
      }, restoreRetryDelayMs * restoreRetryCount);
    }

    async function syncToken(accessToken: string, restore: boolean) {
      if (!active) {
        queuedTokens.delete(accessToken);
        return;
      }

      try {
        const response = await refreshAdminServerSession(accessToken);
        if (!active) return;

        if (response.ok) {
          lastSyncedToken = accessToken;
          restoreRetryCount = 0;
          if (restore) {
            window.location.replace("/admin");
          }
          return;
        }

        if (restore && (response.status === 429 || response.status >= 500)) {
          scheduleRestoreRetry(accessToken);
        }

        if (!restore && (response.status === 401 || response.status === 403)) {
          active = false;
          await Promise.allSettled([
            signOutAdminBrowserSession(),
            fetch("/api/admin/auth/logout", { method: "POST" }),
          ]);
          window.location.assign(adminLoginPath);
        }
      } catch {
        if (restore) {
          scheduleRestoreRetry(accessToken);
        }
      } finally {
        queuedTokens.delete(accessToken);
      }
    }

    function queueTokenSync(accessToken: string | undefined, restore: boolean) {
      if (
        !active
        || !accessToken
        || accessToken === lastSyncedToken
        || queuedTokens.has(accessToken)
      ) {
        return;
      }

      queuedTokens.add(accessToken);
      serverMutationChain = serverMutationChain
        .catch(() => undefined)
        .then(() => syncToken(accessToken, restore));
    }

    async function clearServerSession(redirectToLogin: boolean) {
      active = false;
      if (restoreRetryTimer !== undefined) {
        window.clearTimeout(restoreRetryTimer);
      }

      await serverMutationChain.catch(() => undefined);
      await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);

      if (redirectToLogin && window.location.pathname !== adminLoginPath) {
        window.location.assign(adminLoginPath);
      }
    }

    void client.auth.getSession()
      .then(({ data }) => queueTokenSync(data.session?.access_token, restoreAdminPage))
      .catch(() => undefined);

    if (restoreAdminPage) {
      return () => {
        active = false;
        if (restoreRetryTimer !== undefined) {
          window.clearTimeout(restoreRetryTimer);
        }
      };
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          queueTokenSync(session?.access_token, false);
        }, 0);
      } else if (event === "SIGNED_OUT") {
        window.setTimeout(() => {
          if (!active) return;
          void clearServerSession(true);
        }, 0);
      }
    });

    return () => {
      active = false;
      if (restoreRetryTimer !== undefined) {
        window.clearTimeout(restoreRetryTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
