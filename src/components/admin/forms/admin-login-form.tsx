"use client";

import { type FormEvent, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

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

      const sessionResponse = await fetch("/api/admin/auth/session", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
        method: "POST",
      });

      if (!sessionResponse.ok) {
        const result = (await sessionResponse.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? "Forbidden");
        return;
      }

      window.location.assign("/admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={handleSubmit}>
      <h1>Admin login</h1>
      <label>
        Email
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
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
    </form>
  );
}
