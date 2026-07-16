"use client";

import { useEffect, useState } from "react";

import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";

type SecurityAlert = {
  actorName: string;
  alertType: string;
  createdAt: string;
  eventCount: number;
  id: string;
  severity: string;
};

type AdminSecurityAlertsProps = {
  enabled: boolean;
};

function alertDescription(alert: SecurityAlert) {
  if (alert.alertType === "bulk_contact_reveal") {
    return `${alert.actorName}: ${alert.eventCount} просмотров контактов за короткий период.`;
  }

  return `${alert.actorName}: зафиксировано событие безопасности.`;
}

function formatAlertDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

export function AdminSecurityAlerts({ enabled }: AdminSecurityAlertsProps) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState("");

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    async function loadAlerts() {
      try {
        const authorization = await getAdminAuthorizationHeader();
        const response = await fetch("/api/admin/security-alerts", {
          headers: authorization ? { Authorization: authorization } : undefined,
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { alerts?: SecurityAlert[]; error?: string }
          | null;

        if (!response.ok || !result?.alerts) {
          throw new Error(result?.error ?? "Не удалось загрузить предупреждения безопасности.");
        }

        setAlerts(result.alerts);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить предупреждения безопасности.");
        }
      }
    }

    void loadAlerts();
    return () => controller.abort();
  }, [enabled]);

  async function resolveAlert(id: string) {
    setError("");
    setResolvingId(id);

    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/security-alerts", {
        body: JSON.stringify({ id }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const result = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Не удалось закрыть предупреждение безопасности.");
      }

      setAlerts((current) => current.filter((alert) => alert.id !== id));
    } catch (resolveError) {
      setError(resolveError instanceof Error
        ? resolveError.message
        : "Не удалось закрыть предупреждение безопасности.");
    } finally {
      setResolvingId("");
    }
  }

  if (!enabled || (alerts.length === 0 && !error)) return null;

  return (
    <section aria-labelledby="admin-security-alerts-title" className="admin-security-alerts">
      <div className="admin-security-alerts-head">
        <div>
          <span>Безопасность</span>
          <h2 id="admin-security-alerts-title">Требуется проверка активности</h2>
        </div>
        <strong>{alerts.length}</strong>
      </div>
      {error ? <p className="admin-security-alert-error" role="alert">{error}</p> : null}
      {alerts.map((alert) => (
        <div
          className="admin-security-alert-row"
          data-security-alert-id={alert.id}
          key={alert.id}
        >
          <div>
            <p>{alertDescription(alert)}</p>
            <span>{formatAlertDate(alert.createdAt)}</span>
          </div>
          <button
            disabled={resolvingId === alert.id}
            onClick={() => void resolveAlert(alert.id)}
            type="button"
          >
            {resolvingId === alert.id ? "Закрытие..." : "Просмотрено"}
          </button>
        </div>
      ))}
    </section>
  );
}
