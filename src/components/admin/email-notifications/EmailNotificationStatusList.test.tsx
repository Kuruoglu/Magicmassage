import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";

import { EmailNotificationStatusList } from "./EmailNotificationStatusList";

vi.mock("@/lib/supabase/browser", () => ({
  getAdminAuthorizationHeader: vi.fn(),
}));

describe("EmailNotificationStatusList", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.mocked(getAdminAuthorizationHeader).mockResolvedValue("Bearer aal2-token");
  });

  it("shows text statuses and retries only retryable notifications", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        notifications: [{
          canRetry: true,
          eventType: "appointment_confirmation",
          id: "notification-1",
          recipientMasked: "a***@example.com",
          status: "failed",
          updatedAt: "2026-07-19T10:00:00.000Z",
        }],
      }), { headers: { "Content-Type": "application/json" }, status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EmailNotificationStatusList aggregateId="appointment-1" aggregateType="appointment" />);

    expect(await screen.findByText("Ошибка")).toBeVisible();
    expect(screen.getByText("a***@example.com")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Повторить отправку" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/email-notifications/retry",
      expect.objectContaining({
        body: JSON.stringify({ notificationId: "notification-1" }),
        method: "POST",
      }),
    ));
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer aal2-token",
    });
  });

  it("clears a suppression only when the server allows it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        notifications: [{
          canClearSuppression: true,
          canRetry: false,
          eventType: "booking_reminder_24h",
          id: "notification-blocked",
          recipientMasked: "b***@example.com",
          status: "bounced",
          updatedAt: "2026-07-19T10:00:00.000Z",
        }],
      }), { headers: { "Content-Type": "application/json" }, status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EmailNotificationStatusList aggregateId="appointment-2" aggregateType="appointment" />);

    expect(await screen.findByText("Заблокировано")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Повторить отправку" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Снять блокировку" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/email-notifications/clear-suppression",
      expect.objectContaining({
        body: JSON.stringify({ notificationId: "notification-blocked" }),
        method: "POST",
      }),
    ));
  });

  it("does not keep the previous aggregate statuses when the next load fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        notifications: [{
          canRetry: false,
          eventType: "booking_confirmed",
          id: "notification-old",
          recipientMasked: "o***@example.com",
          status: "delivered",
          updatedAt: "2026-07-19T10:00:00.000Z",
        }],
      }), { headers: { "Content-Type": "application/json" }, status: 200 }))
      .mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <EmailNotificationStatusList aggregateId="appointment-old" aggregateType="appointment" />,
    );
    expect(await screen.findByText("o***@example.com")).toBeVisible();

    rerender(<EmailNotificationStatusList aggregateId="appointment-new" aggregateType="appointment" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить статусы писем.");
    expect(screen.queryByText("o***@example.com")).not.toBeInTheDocument();
  });

  it("offers correction without replacing audited clearing for a suppressed public appointment", async () => {
    const notificationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const onRecipientCorrected = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        notifications: [{
          canClearSuppression: true,
          canRetry: false,
          eventType: "booking_confirmed",
          id: notificationId,
          recipientMasked: "w***@example.com",
          status: "suppressed",
          updatedAt: "2026-07-19T10:00:00.000Z",
        }],
      }), { headers: { "Content-Type": "application/json" }, status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <EmailNotificationStatusList
        aggregateId="appointment-public"
        aggregateType="appointment"
        allowRecipientCorrection
        onRecipientCorrected={onRecipientCorrected}
        recipientEmail="wrong@example.com"
      />,
    );

    const form = await screen.findByRole("form", { name: "Исправление email: Подтверждение записи" });
    expect(within(form).getByText(/email в карточке клиента не изменится/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Снять блокировку" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Повторить отправку" })).not.toBeInTheDocument();

    await user.type(within(form).getByLabelText("Новый email для online-записи"), "corrected@example.com");
    await user.click(within(form).getByRole("button", { name: "Сохранить адрес и отправить снова" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/email-notifications/retry",
      expect.objectContaining({
        body: JSON.stringify({ correctedEmail: "corrected@example.com", notificationId }),
        method: "POST",
      }),
    ));
    expect(onRecipientCorrected).toHaveBeenCalledWith("corrected@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Адрес online-записи обновлён, письмо снова поставлено в очередь.",
    );
  });

  it("validates a corrected recipient inline and keeps focus in the email field", async () => {
    const notificationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notifications: [{
        canClearSuppression: true,
        canRetry: false,
        eventType: "booking_reminder_24h",
        id: notificationId,
        recipientMasked: "w***@example.com",
        status: "suppressed",
        updatedAt: "2026-07-19T10:00:00.000Z",
      }],
    }), { headers: { "Content-Type": "application/json" }, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <EmailNotificationStatusList
        aggregateId="appointment-public"
        aggregateType="appointment"
        allowRecipientCorrection
        recipientEmail="wrong@example.com"
      />,
    );

    const field = await screen.findByLabelText("Новый email для online-записи");
    await user.type(field, "not-an-email");
    await user.click(screen.getByRole("button", { name: "Сохранить адрес и отправить снова" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Укажите корректный email");
    expect(field).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.clear(field);
    await user.type(field, "wrong@example.com");
    await user.click(screen.getByRole("button", { name: "Сохранить адрес и отправить снова" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Укажите новый email");
    expect(field).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary retry plus the labelled correction form for a failed row at 375px", async () => {
    vi.stubGlobal("innerWidth", 375);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notifications: [{
        canClearSuppression: false,
        canRetry: true,
        eventType: "booking_rescheduled",
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        recipientMasked: "w***@example.com",
        status: "failed",
        updatedAt: "2026-07-19T10:00:00.000Z",
      }],
    }), { headers: { "Content-Type": "application/json" }, status: 200 })));

    render(
      <EmailNotificationStatusList
        aggregateId="appointment-public"
        aggregateType="appointment"
        allowRecipientCorrection
        recipientEmail="wrong@example.com"
      />,
    );

    const form = await screen.findByRole("form", { name: "Исправление email: Перенос записи" });
    const field = within(form).getByLabelText("Новый email для online-записи");
    const helper = within(form).getByText(/Адрес обновится только в снимке/);
    expect(field).toHaveAttribute("type", "email");
    expect(field).toHaveAttribute("autocomplete", "email");
    expect(field).toHaveAttribute("aria-describedby", helper.id);
    expect(screen.getByRole("button", { name: "Повторить отправку" })).toBeVisible();
    expect(within(form).getByRole("button", { name: "Сохранить адрес и отправить снова" })).toBeVisible();
  });
});
