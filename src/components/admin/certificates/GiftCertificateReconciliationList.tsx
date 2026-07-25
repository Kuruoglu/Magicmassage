"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdminRoleId } from "@/admin/config";
import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";

export type GiftCertificateReconciliationOrder = {
  amountEurCents: number;
  canReconcile: boolean;
  certificateCode: string;
  createdAt: string;
  hasCertificate: boolean;
  hasPaymentReference: boolean;
  orderId: string;
  reason: string;
  status: string;
};

const reasonLabels: Record<string, string> = {
  certificate_missing: "Оплата требует проверки, сертификат ещё не создан.",
  fulfillment_incomplete: "Сертификат создан не полностью — требуется сверка доставки.",
  legacy_order_requires_review: "Старый заказ требует ручной проверки данных.",
  payment_reference_missing: "Нет безопасной ссылки на оплату — автоматическое восстановление недоступно.",
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "EUR" }).format(value / 100);
}

function certificateHref(code: string, role: AdminRoleId) {
  return `/admin?section=certificates&role=${role}&certificate=${encodeURIComponent(code)}`;
}

export function GiftCertificateReconciliationList({ role }: { role: AdminRoleId }) {
  const [orders, setOrders] = useState<GiftCertificateReconciliationOrder[]>([]);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">("loading");
  const [reconcilingId, setReconcilingId] = useState<string>();
  const [notice, setNotice] = useState("");
  const [reconciledCode, setReconciledCode] = useState<string>();

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/gift-certificates/reconciliation", {
        headers: authorization ? { Authorization: authorization } : undefined,
        signal,
      });
      const result = (await response.json().catch(() => null)) as {
        orders?: GiftCertificateReconciliationOrder[];
      } | null;
      if (!response.ok || !Array.isArray(result?.orders)) throw new Error("reconciliation_unavailable");
      setOrders(result.orders);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadOrders(controller.signal));
    return () => controller.abort();
  }, [loadOrders]);

  async function reconcile(order: GiftCertificateReconciliationOrder) {
    setReconcilingId(order.orderId);
    setNotice("");
    setReconciledCode(undefined);

    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/gift-certificates/reconciliation", {
        body: JSON.stringify({ orderId: order.orderId }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        certificateCode?: string;
        ok?: boolean;
      } | null;
      if (!response.ok || !result?.ok || !result.certificateCode) {
        throw new Error("reconciliation_failed");
      }

      setOrders((current) => current.filter((item) => item.orderId !== order.orderId));
      setReconciledCode(result.certificateCode);
      setNotice("Оплата подтверждена. Сертификат и необходимые письма восстановлены.");
    } catch {
      setNotice("Не удалось безопасно подтвердить оплату. Заказ оставлен в списке для сверки.");
    } finally {
      setReconcilingId(undefined);
    }
  }

  if (loadState === "loading") {
    return <p className="admin-muted-text">Проверяем незавершённые покупки сертификатов…</p>;
  }

  if (loadState === "error") {
    return (
      <div className="admin-email-status-error" role="alert">
        <p>Не удалось загрузить покупки, требующие сверки.</p>
        <button className="admin-outline-action" onClick={() => void loadOrders()} type="button">
          Повторить
        </button>
      </div>
    );
  }

  if (orders.length === 0 && !notice) return null;

  return (
    <section className="admin-client-section" aria-labelledby="gift-reconciliation-title">
      <div className="admin-client-section-head">
        <div>
          <h3 id="gift-reconciliation-title">Требуют сверки</h3>
          <p>Незавершённые онлайн-покупки. Действие сначала повторно проверяет оплату в Stripe.</p>
        </div>
        {orders.length > 0 ? <span className="admin-status admin-status-warning">{orders.length}</span> : null}
      </div>

      {orders.length > 0 ? (
        <ul className="admin-email-status-list">
          {orders.map((order) => (
            <li key={order.orderId}>
              <div>
                <strong>{order.certificateCode}</strong>
                <span>{formatAmount(order.amountEurCents)} · Требует сверки</span>
                <small>{reasonLabels[order.reason] ?? "Требуется проверка состояния заказа."}</small>
              </div>
              <div className="admin-email-status-actions">
                {order.hasCertificate ? (
                  <a className="admin-outline-action" href={certificateHref(order.certificateCode, role)}>
                    Открыть сертификат
                  </a>
                ) : null}
                {order.canReconcile ? (
                  <button
                    className="admin-outline-action"
                    disabled={reconcilingId === order.orderId}
                    onClick={() => void reconcile(order)}
                    type="button"
                  >
                    {reconcilingId === order.orderId
                      ? "Проверяем оплату…"
                      : "Проверить оплату и восстановить"}
                  </button>
                ) : (
                  <span className="admin-muted-text">Только ручная сверка</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? (
        <p className="admin-export-notice" role={notice.startsWith("Не удалось") ? "alert" : "status"}>
          {notice}
          {reconciledCode ? (
            <a className="admin-client-inline-link" href={certificateHref(reconciledCode, role)}>
              Открыть восстановленный сертификат
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
