import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminForgotPasswordForm } from "./admin-forgot-password-form";
import { AdminLoginForm } from "./admin-login-form";
import { AdminResetPasswordForm } from "./admin-reset-password-form";

type AuthStateListener = (
  event: string,
  session: { access_token?: string } | null,
) => void;

const authMocks = vi.hoisted(() => ({
  challengeAndVerify: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  listener: undefined as AuthStateListener | undefined,
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabasePasswordRecoveryClient: vi.fn(() => ({
    auth: {
      mfa: {
        challengeAndVerify: authMocks.challengeAndVerify,
        getAuthenticatorAssuranceLevel: authMocks.getAuthenticatorAssuranceLevel,
        listFactors: authMocks.listFactors,
      },
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
      signOut: authMocks.signOut,
      updateUser: authMocks.updateUser,
    },
  })),
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      mfa: {
        challengeAndVerify: authMocks.challengeAndVerify,
        getAuthenticatorAssuranceLevel: authMocks.getAuthenticatorAssuranceLevel,
        listFactors: authMocks.listFactors,
      },
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
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      signOut: authMocks.signOut,
      updateUser: authMocks.updateUser,
    },
  })),
}));

function startRecovery() {
  act(() => {
    authMocks.listener?.("PASSWORD_RECOVERY", { access_token: "recovery-access-token" });
  });
}

describe("admin password recovery", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin/reset-password");
    authMocks.challengeAndVerify.mockReset();
    authMocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    authMocks.getAuthenticatorAssuranceLevel.mockReset();
    authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    authMocks.listFactors.mockReset();
    authMocks.listFactors.mockResolvedValue({
      data: {
        all: [],
        phone: [],
        totp: [{ id: "verified-factor", status: "verified" }],
      },
      error: null,
    });
    authMocks.listener = undefined;
    authMocks.resetPasswordForEmail.mockReset();
    authMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    authMocks.signOut.mockReset();
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.unsubscribe.mockReset();
    authMocks.updateUser.mockReset();
    authMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("links the login screen to password recovery", () => {
    render(<AdminLoginForm />);

    expect(screen.getByRole("link", { name: "Забыли пароль?" }))
      .toHaveAttribute("href", "/admin/forgot-password");
  });

  it("requests a same-origin recovery link and always shows a generic acknowledgement", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/admin/forgot-password");
    authMocks.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new Error("rate limit details must stay private"),
    });

    render(<AdminForgotPasswordForm />);

    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("autocomplete", "email");

    await user.type(email, "admin@example.com");
    await user.click(screen.getByRole("button", { name: "Отправить ссылку" }));

    await waitFor(() => {
      expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
        "admin@example.com",
        { redirectTo: "http://localhost:3000/admin/reset-password" },
      );
    });
    expect(screen.getByRole("heading", { name: "Проверьте почту" })).toBeInTheDocument();
    expect(screen.queryByText(/rate limit details/i)).not.toBeInTheDocument();
  });

  it("does not accept an ordinary persisted session as a recovery event", () => {
    vi.useFakeTimers();
    render(<AdminResetPasswordForm />);

    act(() => {
      authMocks.listener?.("INITIAL_SESSION", { access_token: "ordinary-session" });
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByRole("heading", { name: "Ссылка недействительна" })).toBeInTheDocument();
    expect(authMocks.listFactors).not.toHaveBeenCalled();
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("blocks recovery when the account has no verified TOTP factor", async () => {
    authMocks.listFactors.mockResolvedValueOnce({
      data: {
        all: [],
        phone: [],
        totp: [{ id: "unverified-factor", status: "unverified" }],
      },
      error: null,
    });
    render(<AdminResetPasswordForm />);

    startRecovery();

    expect(await screen.findByRole("heading", { name: "Нужна помощь владельца" }))
      .toBeInTheDocument();
    expect(authMocks.challengeAndVerify).not.toHaveBeenCalled();
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("requires verified TOTP and aal2 before changing the password", async () => {
    const user = userEvent.setup();
    render(<AdminResetPasswordForm />);

    startRecovery();

    const totpInput = await screen.findByRole("textbox", { name: "Код из приложения" });
    await user.type(totpInput, "12a3456");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(authMocks.challengeAndVerify).toHaveBeenCalledWith({
      code: "123456",
      factorId: "verified-factor",
    });

    const passwordInput = await screen.findByLabelText("Новый пароль");
    const confirmationInput = screen.getByLabelText("Повторите пароль");
    await user.type(passwordInput, "new-admin-password");
    await user.type(confirmationInput, "new-admin-password");
    await user.click(screen.getByRole("button", { name: "Сохранить новый пароль" }));

    await waitFor(() => {
      expect(authMocks.updateUser).toHaveBeenCalledWith({
        password: "new-admin-password",
      });
    });
    expect(authMocks.getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(2);
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(fetch).toHaveBeenCalledWith("/api/admin/auth/logout", { method: "POST" });
    expect(await screen.findByRole("heading", { name: "Пароль изменён" })).toBeInTheDocument();
  });

  it("keeps the password hidden when TOTP verification does not reach aal2", async () => {
    const user = userEvent.setup();
    authMocks.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    render(<AdminResetPasswordForm />);

    startRecovery();
    await user.type(
      await screen.findByRole("textbox", { name: "Код из приложения" }),
      "123456",
    );
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось подтвердить второй фактор",
    );
    expect(screen.queryByLabelText("Новый пароль")).not.toBeInTheDocument();
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling Supabase", async () => {
    const user = userEvent.setup();
    render(<AdminResetPasswordForm />);

    startRecovery();
    await user.type(
      await screen.findByRole("textbox", { name: "Код из приложения" }),
      "123456",
    );
    await user.click(screen.getByRole("button", { name: "Продолжить" }));
    await user.type(await screen.findByLabelText("Новый пароль"), "new-admin-password");
    await user.type(screen.getByLabelText("Повторите пароль"), "different-password");
    await user.click(screen.getByRole("button", { name: "Сохранить новый пароль" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Пароли не совпадают");
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });
});
