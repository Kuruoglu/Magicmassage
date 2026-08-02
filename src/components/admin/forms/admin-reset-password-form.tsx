"use client";

import { AdminLink as Link } from "@/components/admin/AdminLink";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { createSupabasePasswordRecoveryClient } from "@/lib/supabase/browser";

type RecoveryStage = "checking" | "invalid" | "blocked" | "mfa" | "password" | "success";

const minimumPasswordLength = 12;
const recoveryDetectionTimeoutMs = 8_000;

export function AdminResetPasswordForm() {
  const recoveryClientRef = useRef<SupabaseClient | null>(null);
  const [code, setCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [sessionCleanupIncomplete, setSessionCleanupIncomplete] = useState(false);
  const [stage, setStage] = useState<RecoveryStage>("checking");

  useEffect(() => {
    const client = createSupabasePasswordRecoveryClient();

    if (!client) {
      const missingClientTimer = window.setTimeout(() => {
        setError("Восстановление пароля сейчас недоступно.");
        setStage("invalid");
      }, 0);
      return () => window.clearTimeout(missingClientTimer);
    }
    const recoveryClient = client;
    recoveryClientRef.current = recoveryClient;

    let active = true;
    let recoveryStarted = false;
    const invalidLinkTimer = window.setTimeout(() => {
      if (!active || recoveryStarted) return;
      setStage("invalid");
    }, recoveryDetectionTimeoutMs);

    async function prepareRecovery() {
      try {
        const { data: factorData, error: factorError } =
          await recoveryClient.auth.mfa.listFactors();
        if (!active) return;

        if (factorError) {
          setError("Не удалось проверить двухфакторную защиту. Откройте ссылку ещё раз.");
          setStage("invalid");
          return;
        }

        const verifiedFactor = factorData.totp.find((factor) => factor.status === "verified");
        if (!verifiedFactor) {
          setError(
            "Для этого аккаунта не найден подтверждённый TOTP-фактор. Обратитесь к владельцу системы.",
          );
          setStage("blocked");
          return;
        }

        setFactorId(verifiedFactor.id);
        setStage("mfa");
      } catch {
        if (!active) return;
        setError("Не удалось проверить двухфакторную защиту. Откройте ссылку ещё раз.");
        setStage("invalid");
      }
    }

    function beginRecovery(session: Session | null) {
      if (!session?.access_token || recoveryStarted) return;

      recoveryStarted = true;
      window.clearTimeout(invalidLinkTimer);
      window.setTimeout(() => {
        if (active) {
          void prepareRecovery();
        }
      }, 0);
    }

    const { data: { subscription } } = recoveryClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        beginRecovery(session);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(invalidLinkTimer);
      subscription.unsubscribe();
      if (recoveryClientRef.current === recoveryClient) {
        recoveryClientRef.current = null;
      }
    };
  }, []);

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedCode = code.replace(/\D/g, "");
    if (normalizedCode.length !== 6) {
      setError("Введите 6 цифр.");
      return;
    }

    setIsSubmitting(true);

    try {
      const client = recoveryClientRef.current;
      if (!client || !factorId) {
        setError("Ссылка недействительна или уже истекла.");
        setStage("invalid");
        return;
      }

      const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
        code: normalizedCode,
        factorId,
      });
      if (verifyError) {
        setError("Код не подошёл. Проверьте его и попробуйте ещё раз.");
        return;
      }

      const { data: assurance, error: assuranceError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance.currentLevel !== "aal2") {
        setError("Не удалось подтвердить второй фактор. Введите новый код и попробуйте ещё раз.");
        return;
      }

      setCode("");
      setStage("password");
    } catch {
      setError("Не удалось проверить код. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < minimumPasswordLength) {
      setError(`Пароль должен содержать не менее ${minimumPasswordLength} символов.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);

    try {
      const client = recoveryClientRef.current;
      if (!client) {
        setError("Восстановление пароля сейчас недоступно.");
        return;
      }

      const { data: assurance, error: assuranceError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance.currentLevel !== "aal2") {
        setError("Подтверждение TOTP истекло. Откройте ссылку ещё раз.");
        return;
      }

      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError("Не удалось сохранить новый пароль. Откройте ссылку ещё раз.");
        return;
      }

      const [signOutResult, logoutResult] = await Promise.allSettled([
        client.auth.signOut({ scope: "global" }),
        fetch("/api/admin/auth/logout", { method: "POST" }),
      ]);
      const globalSignOutFailed = (
        signOutResult.status === "rejected"
        || Boolean(signOutResult.value.error)
      );
      const serverLogoutFailed = (
        logoutResult.status === "rejected"
        || !logoutResult.value.ok
      );

      setSessionCleanupIncomplete(globalSignOutFailed || serverLogoutFailed);
      setPassword("");
      setConfirmPassword("");
      setStage("success");
    } catch {
      setError("Не удалось сохранить новый пароль. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (stage === "checking") {
    return (
      <section className="admin-login-form" aria-labelledby="password-reset-title">
        <h1 id="password-reset-title">Проверяем ссылку</h1>
        <p aria-live="polite" role="status">Подождите несколько секунд…</p>
      </section>
    );
  }

  if (stage === "invalid") {
    return (
      <section className="admin-login-form" aria-labelledby="password-reset-title">
        <h1 id="password-reset-title">Ссылка недействительна</h1>
        <p role={error ? "alert" : undefined}>
          {error || "Срок действия ссылки истёк или она уже была использована."}
        </p>
        <Link className="button primary" href="/admin/forgot-password">
          Получить новую ссылку
        </Link>
        <Link className="admin-auth-link" href="/admin/login">
          Вернуться ко входу
        </Link>
      </section>
    );
  }

  if (stage === "blocked") {
    return (
      <section className="admin-login-form" aria-labelledby="password-reset-title">
        <h1 id="password-reset-title">Нужна помощь владельца</h1>
        <p role="alert">{error}</p>
        <Link className="admin-auth-link" href="/admin/login">
          Вернуться ко входу
        </Link>
      </section>
    );
  }

  if (stage === "success") {
    return (
      <section className="admin-login-form" aria-labelledby="password-reset-title">
        <h1 id="password-reset-title">Пароль изменён</h1>
        <p role="status">
          Войдите с новым паролем и подтвердите вход кодом TOTP.
        </p>
        {sessionCleanupIncomplete ? (
          <p role="alert">
            Не удалось подтвердить завершение всех активных сеансов. Сообщите владельцу системы.
          </p>
        ) : null}
        <Link className="button primary" href="/admin/login">
          Войти
        </Link>
      </section>
    );
  }

  if (stage === "mfa") {
    return (
      <form
        aria-busy={isSubmitting}
        className="admin-login-form"
        onSubmit={handleMfaSubmit}
      >
        <h1>Подтвердите личность</h1>
        <p className="admin-auth-hint">
          Введите 6-значный код из приложения-аутентификатора.
        </p>
        <label htmlFor="admin-recovery-totp">
          Код из приложения
          <input
            autoComplete="one-time-code"
            id="admin-recovery-totp"
            inputMode="numeric"
            maxLength={6}
            name="totp"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            pattern="[0-9]{6}"
            required
            spellCheck={false}
            value={code}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button className="button primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Проверяем…" : "Продолжить"}
        </button>
      </form>
    );
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="admin-login-form"
      onSubmit={handlePasswordSubmit}
    >
      <h1>Новый пароль</h1>
      <p className="admin-auth-hint">
        Используйте не менее {minimumPasswordLength} символов.
      </p>
      <label htmlFor="admin-recovery-password">
        Новый пароль
        <input
          autoComplete="new-password"
          id="admin-recovery-password"
          minLength={minimumPasswordLength}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <label htmlFor="admin-recovery-password-confirmation">
        Повторите пароль
        <input
          autoComplete="new-password"
          id="admin-recovery-password-confirmation"
          minLength={minimumPasswordLength}
          name="passwordConfirmation"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="button primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Сохраняем…" : "Сохранить новый пароль"}
      </button>
    </form>
  );
}
