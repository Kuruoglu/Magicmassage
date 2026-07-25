"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createMfaFriendlyName, normalizeMfaQrCodeSrc } from "./admin-login-form-utils";

export function AdminLoginForm() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [stage, setStage] = useState<"credentials" | "enroll" | "verify">("credentials");

  async function createAdminSession() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase login is not configured.");
      return;
    }

    const { data } = await client.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setError("Unauthorized");
      return;
    }

    const sessionResponse = await fetch("/api/admin/auth/session", {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "POST",
    });
    if (!sessionResponse.ok) {
      const result = (await sessionResponse.json().catch(() => null)) as { error?: string } | null;
      setError(result?.error ?? "Forbidden");
      return;
    }

    window.location.assign("/admin");
  }

  async function prepareMfa() {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();
    if (factorError) {
      setError("Не удалось проверить двухфакторную защиту.");
      return;
    }

    const verifiedFactor = factorData.totp.find((factor) => factor.status === "verified");
    if (verifiedFactor) {
      setFactorId(verifiedFactor.id);
      setStage("verify");
      return;
    }

    for (const pendingFactor of factorData.totp.filter((factor) => factor.status !== "verified")) {
      await client.auth.mfa.unenroll({ factorId: pendingFactor.id });
    }

    const { data: enrollment, error: enrollmentError } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: createMfaFriendlyName(),
    });
    if (enrollmentError || !enrollment) {
      setError("Не удалось включить двухфакторную защиту.");
      return;
    }

    setFactorId(enrollment.id);
    setQrCode(normalizeMfaQrCodeSrc(enrollment.totp.qr_code));
    setSecret(enrollment.totp.secret);
    setStage("enroll");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const client = getSupabaseBrowserClient();

      if (!client) {
        setError("Supabase login is not configured.");
        return;
      }

      const { data, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.session?.access_token) {
        setError("Unauthorized");
        return;
      }

      if (stage === "credentials") {
        await prepareMfa();
        return;
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const client = getSupabaseBrowserClient();
      if (!client || !factorId) {
        setError("Unauthorized");
        return;
      }

      const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
        code: code.replace(/\D/g, ""),
        factorId,
      });
      if (verifyError) {
        setError("Неверный код из приложения-аутентификатора.");
        return;
      }

      await createAdminSession();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (stage !== "credentials") {
    return (
      <form className="admin-login-form" onSubmit={handleMfaSubmit}>
        <h1>Двухфакторная защита</h1>
        {stage === "enroll" ? (
          <>
            <p>Добавьте Magic Massage Admin в приложение-аутентификатор.</p>
            {qrCode ? (
              <Image alt="QR-код для приложения-аутентификатора" height={192} src={qrCode} unoptimized width={192} />
            ) : null}
            <label>
              Ключ для ручного ввода
              <input readOnly value={secret} />
            </label>
          </>
        ) : (
          <p>Введите одноразовый код из приложения-аутентификатора.</p>
        )}
        <label>
          Код
          <input
            autoComplete="one-time-code"
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
          {isSubmitting ? "Проверка" : stage === "enroll" ? "Включить и войти" : "Войти"}
        </button>
      </form>
    );
  }

  return (
    <form className="admin-login-form" onSubmit={handleSubmit}>
      <h1>Admin login</h1>
      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          spellCheck={false}
          type="email"
          value={email}
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="button primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in" : "Sign in"}
      </button>
      <Link className="admin-auth-link" href="/admin/forgot-password">
        Забыли пароль?
      </Link>
    </form>
  );
}
