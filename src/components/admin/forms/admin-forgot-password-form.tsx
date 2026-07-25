"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AdminForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setSent(true);
        return;
      }

      const redirectTo = new URL("/admin/reset-password", window.location.origin).toString();
      await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <section className="admin-login-form" aria-labelledby="password-recovery-title">
        <h1 id="password-recovery-title">Проверьте почту</h1>
        <p role="status">
          Если такой аккаунт существует, мы отправили ссылку для создания нового пароля.
        </p>
        <p className="admin-auth-hint">
          Ссылка действует ограниченное время. Проверьте также папку «Спам».
        </p>
        <Link className="button primary" href="/admin/login">
          Вернуться ко входу
        </Link>
      </section>
    );
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="admin-login-form"
      onSubmit={handleSubmit}
    >
      <h1>Восстановление пароля</h1>
      <p className="admin-auth-hint">
        Укажите email администратора. Мы отправим ссылку для создания нового пароля.
      </p>
      <label>
        Email
        <input
          autoComplete="email"
          id="admin-recovery-email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          spellCheck={false}
          type="email"
          value={email}
        />
      </label>
      <button className="button primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Отправляем…" : "Отправить ссылку"}
      </button>
      <Link className="admin-auth-link" href="/admin/login">
        Вернуться ко входу
      </Link>
    </form>
  );
}
