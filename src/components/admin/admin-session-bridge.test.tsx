import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AdminSessionBridge } from "./admin-session-bridge";

type AuthStateListener = (
  event: string,
  session: { access_token?: string } | null,
) => void;

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listener: undefined as AuthStateListener | undefined,
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: vi.fn((listener: AuthStateListener) => {
        authMocks.listener = listener;
        return {
          data: {
            subscription: {
              unsubscribe: authMocks.unsubscribe,
            },
          },
        };
      }),
    },
  })),
  signOutAdminBrowserSession: authMocks.signOut,
}));

describe("AdminSessionBridge", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin");
    authMocks.getSession.mockReset();
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "initial-access-token",
        },
      },
    });
    authMocks.listener = undefined;
    authMocks.signOut.mockReset();
    authMocks.unsubscribe.mockReset();
    vi.mocked(getSupabaseBrowserClient).mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })));
  });

  it.each([
    "/admin/forgot-password",
    "/admin/reset-password",
  ])("does not touch Supabase or server cookies on the public auth path %s", async (path) => {
    window.history.replaceState({}, "", path);

    render(<AdminSessionBridge />);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(authMocks.getSession).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("synchronizes the current token and every later Supabase token refresh", async () => {
    const view = render(<AdminSessionBridge />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/auth/refresh", expect.objectContaining({
        headers: { Authorization: "Bearer initial-access-token" },
        method: "POST",
      }));
    });

    act(() => {
      authMocks.listener?.("TOKEN_REFRESHED", { access_token: "rotated-access-token" });
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/auth/refresh", expect.objectContaining({
        headers: { Authorization: "Bearer rotated-access-token" },
        method: "POST",
      }));
    });

    view.unmount();
    expect(authMocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it("ignores unrelated auth events", async () => {
    render(<AdminSessionBridge />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    act(() => {
      authMocks.listener?.("USER_UPDATED", { access_token: "same-session-token" });
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("clears the server cookies when Supabase signs the browser session out", async () => {
    render(<AdminSessionBridge />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    window.history.replaceState({}, "", "/admin/login");

    act(() => {
      authMocks.listener?.("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/auth/logout", { method: "POST" });
    });
  });

  it("waits for an in-flight refresh before clearing cookies on sign out", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (input === "/api/admin/auth/refresh") {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminSessionBridge />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/auth/refresh", expect.anything());
    });
    window.history.replaceState({}, "", "/admin/login");

    act(() => {
      authMocks.listener?.("SIGNED_OUT", null);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/auth/logout", expect.anything());

    resolveRefresh?.(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/auth/logout", { method: "POST" });
    });
    expect(fetchMock.mock.calls.findLastIndex(([url]) => url === "/api/admin/auth/logout"))
      .toBeGreaterThan(fetchMock.mock.calls.findLastIndex(([url]) => url === "/api/admin/auth/refresh"));
  });

  it("retries a silent login restore after a temporary network failure", async () => {
    window.history.replaceState({}, "", "/admin/login");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporary" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "aal2 required" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminSessionBridge />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, { timeout: 5_000 });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/auth/refresh", expect.anything());
  });
});
