import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloneBusinessHoursSchedule } from "@/lib/business-hours";

import { AdminShell } from "./admin-shell";

const blogVisibilitySettings = {
  auditLogRetentionDays: 365,
  blogEnabled: true,
  bookingBufferMinutes: 30,
  businessName: "Magic Massage Natali",
  cookiePrivacyMode: "External embeds load only when needed.",
  currency: "EUR" as const,
  dailySlotCapacity: 6,
  defaultLocale: "bg",
  defaultSeoTitle: "Magic Massage Natali Burgas",
  emailSender: "info@magicmassage.bg",
  googleCalendarId: "",
  googleCalendarMode: "Внутренний календарь главный" as const,
  publicBookingDailyLimit: 8,
  publicBookingEnabled: false,
  reminderTemplate: "Reminder",
  rolesPolicy: "Role policy",
  stripeMode: "Тестовый" as const,
  timezone: "Europe/Sofia",
  updatedAt: "2026-07-18",
  workingDays: "Пн-Сб",
  workingHours: "10:00-19:00",
};

describe("AdminShell", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the operational owner dashboard without a marketing hero", () => {
    render(<AdminShell activeSection="dashboard" role="owner" />);

    expect(screen.getByRole("heading", { level: 1, name: "Дашборд" })).toBeInTheDocument();
    expect(screen.getAllByText("Magic Massage Natali").length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Клиенты" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner",
    );
    expect(screen.queryByText(/hero/i)).not.toBeInTheDocument();
  });

  it("derives owner dashboard metrics from the supplied operational data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00.000Z"));

    render(
      <AdminShell
        activeSection="dashboard"
        initialData={{
          financeRows: [
            { gross: 100, refund: 0, stripeFee: 3 },
            { gross: 50.5, refund: 10, stripeFee: 2 },
          ],
          records: {
            appointments: [
              {
                client: "Confirmed Client",
                date: "2026-07-29",
                id: "appointment-confirmed",
                note: "",
                service: "Massage",
                status: "Подтверждена",
                time: "10:00",
              },
              {
                client: "Pending Client",
                date: "2026-07-29",
                id: "appointment-pending",
                note: "",
                service: "Massage",
                status: "Ожидает",
                time: "11:00",
              },
              {
                client: "Cancelled Client",
                date: "2026-07-29",
                id: "appointment-cancelled",
                note: "",
                service: "Massage",
                status: "Отменена",
                time: "12:00",
              },
              {
                client: "Request Client",
                date: "2026-07-30",
                id: "appointment-request",
                note: "",
                service: "Massage",
                status: "Новая заявка",
                time: "13:00",
              },
            ],
            certificates: [
              {
                amount: "100 €",
                buyer: "Paid Buyer",
                clientName: "Paid Client",
                code: "CERT-PAID",
                expiresAt: "2027-01-01",
                history: [],
                note: "",
                paymentDate: "2026-07-10",
                recipient: "Paid Client",
                status: "Оплачено",
                stripeId: "pi_paid",
              },
              {
                amount: "80 €",
                buyer: "Sent Buyer",
                clientName: "Sent Client",
                code: "CERT-SENT",
                expiresAt: "2027-01-02",
                history: [],
                note: "",
                paymentDate: "2026-07-11",
                recipient: "Sent Client",
                status: "Отправлен",
                stripeId: "pi_sent",
              },
              {
                amount: "90 €",
                buyer: "Refunded Buyer",
                clientName: "Refunded Client",
                code: "CERT-REFUNDED",
                expiresAt: "2027-01-03",
                history: [],
                note: "",
                paymentDate: "2026-07-12",
                recipient: "Refunded Client",
                status: "Возвращён",
                stripeId: "pi_refunded",
              },
            ],
            clients: [],
          },
          settings: blogVisibilitySettings,
          source: "supabase",
        }}
        role="owner"
      />,
    );

    const metrics = screen.getByLabelText("Ключевые показатели");
    expect(metrics).toHaveTextContent("2 записи");
    expect(metrics).toHaveTextContent("2 заявки");
    expect(metrics).toHaveTextContent("2 оплачено");
    expect(metrics).toHaveTextContent("150,50 €");
    expect(metrics).not.toHaveTextContent("8 записей");
    expect(metrics).not.toHaveTextContent("5 оплачено");
    expect(metrics).not.toHaveTextContent("1 240 €");
  });

  it("does not show unavailable financial metrics as zero to read-only roles", () => {
    const { rerender } = render(<AdminShell activeSection="dashboard" role="viewer" />);

    expect(screen.getByLabelText("Ключевые показатели")).not.toHaveTextContent("Stripe за месяц");

    rerender(<AdminShell activeSection="dashboard" role="editor" />);

    expect(screen.queryByLabelText("Ключевые показатели")).not.toBeInTheDocument();
  });

  it("keeps dashboard shortcut links inside the current role view", () => {
    render(<AdminShell activeSection="dashboard" role="specialist" />);

    expect(screen.getByRole("link", { name: "Открыть календарь" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=specialist",
    );
    expect(screen.queryByRole("link", { name: "Финансы" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Комментарии после визита" })).not.toBeInTheDocument();
  });

  it("shows the owner an oldest-first queue of past visits without comments", async () => {
    const user = userEvent.setup();
    render(
      <AdminShell
        activeSection="dashboard"
        initialData={{
          financeRows: [],
          records: {
            appointments: [
              {
                client: "Анна Петрова",
                clientId: "client-anna",
                date: "2026-07-04",
                id: "visit-anna",
                note: "",
                service: "Классический массаж",
                status: "Завершена",
                time: "10:00",
              },
            ],
            certificates: [],
            clients: [
              {
                email: "anna@example.com",
                history: [],
                id: "client-anna",
                language: "ru",
                name: "Анна Петрова",
                next: "—",
                note: "",
                phone: "+359 88 111 2233",
                preferredContact: "Телефон",
                status: "Активный клиент",
                tags: [],
                telegram: "",
                totalSpend: "0 €",
                visits: 1,
              },
            ],
          },
          source: "demo",
        }}
        role="owner"
      />,
    );

    const queue = screen.getByRole("region", { name: "Комментарии после визита" });
    expect(within(queue).getByText("1 визит без комментария")).toBeInTheDocument();
    expect(within(queue).getByRole("link", { name: "Анна Петрова" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-anna",
    );

    await user.click(within(queue).getByRole("button", { name: /Заполнить комментарий: Анна Петрова/ }));
    await user.type(
      within(queue).getByLabelText("Комментарий после визита"),
      "Клиент хорошо перенёс массаж.",
    );
    await user.click(within(queue).getByRole("button", { name: "Сохранить комментарий" }));

    expect(
      await within(queue).findByText("Все комментарии после прошедших визитов заполнены."),
    ).toBeInTheDocument();
  });

  it.each([
    ["administrator", true],
    ["viewer", false],
  ] as const)("applies post-visit queue access for the %s role", (role, isVisible) => {
    render(<AdminShell activeSection="dashboard" role={role} />);

    const queueHeading = screen.queryByRole("heading", {
      name: "Комментарии после визита",
    });
    expect(Boolean(queueHeading)).toBe(isVisible);
  });

  it("links dashboard operational rows to the connected workspaces", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T09:00:00.000Z"));

    render(<AdminShell activeSection="dashboard" role="owner" />);

    expect(screen.queryByRole("heading", { name: "Операционная очередь" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Создать запись" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Создать запись/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Выгрузить Stripe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Пользователи и роли/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть календарь" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner",
    );
    expect(screen.getAllByRole("link", { name: "Анна Петрова" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining(
            "/admin?section=clients&role=owner&client=client-359881112233",
          ),
        }),
      ]),
    );
    expect(within(screen.getByRole("row", { name: /10:00 Анна Петрова/ })).getByRole("link", { name: "Календарь" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-06&client=client-359881112233&appointment=demo-1",
    );
    expect(screen.getByRole("link", { name: "MMN-2407-1023" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
  });

  it("shows only future appointments in chronological order on the dashboard", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T08:00:30.000Z"));

    render(
      <AdminShell
        activeSection="dashboard"
        initialData={{
          financeRows: [],
          records: {
            appointments: [
              {
                client: "Прошедшая запись",
                date: "2026-07-25",
                id: "past-today",
                note: "",
                service: "Классический массаж",
                status: "Новая заявка",
                time: "10:30",
              },
              {
                client: "Завтрашняя запись",
                date: "2026-07-26",
                id: "future-tomorrow",
                note: "",
                service: "Классический массаж",
                status: "Подтверждена",
                time: "09:00",
              },
              {
                client: "Ближайшая запись",
                date: "2026-07-25",
                id: "future-today",
                note: "",
                service: "Классический массаж",
                status: "Новая заявка",
                time: "11:30",
              },
              {
                client: "Отменённая запись",
                date: "2026-07-25",
                id: "cancelled-future",
                note: "",
                service: "Классический массаж",
                status: "Отменена",
                time: "12:00",
              },
            ],
            certificates: [],
            clients: [],
          },
          settings: blogVisibilitySettings,
          source: "demo",
        }}
        role="owner"
      />,
    );

    const upcomingSection = screen.getByRole("heading", { name: "Ближайшие записи" }).closest("section");
    expect(upcomingSection).not.toBeNull();

    const rows = within(upcomingSection as HTMLElement).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("Ближайшая запись");
    expect(rows[2]).toHaveTextContent("Завтрашняя запись");
    expect(within(upcomingSection as HTMLElement).queryByText("Прошедшая запись")).not.toBeInTheDocument();
    expect(within(upcomingSection as HTMLElement).queryByText("Отменённая запись")).not.toBeInTheDocument();
  });

  it("shows an explicit empty state when there are no future appointments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T08:00:30.000Z"));

    render(
      <AdminShell
        activeSection="dashboard"
        initialData={{
          financeRows: [],
          records: {
            appointments: [
              {
                client: "Прошедшая запись",
                date: "2026-07-24",
                id: "past-only",
                note: "",
                service: "Классический массаж",
                status: "Новая заявка",
                time: "15:00",
              },
            ],
            certificates: [],
            clients: [],
          },
          settings: blogVisibilitySettings,
          source: "demo",
        }}
        role="owner"
      />,
    );

    expect(screen.getByText("Будущих записей пока нет.")).toBeInTheDocument();
    expect(screen.queryByText("Прошедшая запись")).not.toBeInTheDocument();
  });

  it("hides restricted dashboard operation links for a specialist", () => {
    render(<AdminShell activeSection="dashboard" role="specialist" />);

    expect(screen.queryByRole("heading", { name: "Операционная очередь" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Создать запись/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Открыть клиентов/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть календарь" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=specialist",
    );
    expect(screen.queryByRole("link", { name: /Выгрузить Stripe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Пользователи и роли/ })).not.toBeInTheDocument();
  });

  it("keeps specialist calendar appointment creation read-only", () => {
    render(<AdminShell activeSection="calendar" calendarAction="create" role="specialist" />);

    expect(screen.queryByRole("button", { name: "Создать запись" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Заблокировать время" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Клиент сейчас" })).toBeInTheDocument();
  });

  it("keeps specialist dashboard data inside the calendar scope", () => {
    render(<AdminShell activeSection="dashboard" role="specialist" />);

    expect(screen.queryByRole("heading", { name: "Сертификаты" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Анна Петрова" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ключевые показатели")).toHaveTextContent("Мои записи");
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveAttribute(
      "placeholder",
      "Клиент, услуга, время",
    );
  });

  it("preserves specialist records from server data in the calendar shell", () => {
    render(
      <AdminShell
        activeSection="calendar"
        initialData={{
          currentSpecialistId: "specialist-codex",
          financeRows: [],
          records: {
            appointments: [],
            calendarBlocks: [],
            certificates: [],
            clients: [],
            specialists: [
              {
                color: "#3f7d6c",
                displayName: "Codex Specialist",
                displayOrder: 1,
                id: "specialist-codex",
                publicBookingEnabled: true,
                scheduleVersion: 1,
                status: "active",
                weeklySchedule: Array.from({ length: 7 }, (_, index) => ({
                  endsAt: "19:00",
                  isWorking: index < 6,
                  startsAt: "10:00",
                  weekday: index + 1,
                })),
              },
            ],
          },
          source: "supabase",
        }}
        role="specialist"
        selectedCalendarDate="2026-07-20"
      />,
    );

    expect(screen.getByLabelText("Текущий календарь специалиста")).toHaveTextContent(
      "Мой календарьCodex Specialist",
    );
  });

  it("shows the strict finance workspace for the accountant role only", () => {
    render(<AdminShell activeSection="finances" role="accountant" />);

    const navigation = screen.getByRole("navigation", { name: "Admin sections" });
    expect(within(navigation).getByRole("link", { name: "Финансы" })).toHaveAttribute(
      "href",
      "/admin?section=finances&role=accountant",
    );
    expect(within(navigation).queryByRole("link", { name: "Клиенты" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Календарь" })).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 1, name: "Финансы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выгрузить отчет" })).toBeInTheDocument();
    expect(screen.getByText("Stripe fees")).toBeInTheDocument();
    expect(screen.getByText("550,00 €")).toBeInTheDocument();
    expect(screen.getByText("audit log")).toBeInTheDocument();
  });

  it("renders supplied initial admin data instead of only demo records", () => {
    render(
      <AdminShell
        activeSection="finances"
        initialData={{
          financeRows: [
            {
              buyer: "Supabase Buyer",
              certificateCode: "MMN-SB-1",
              date: "2026-07-02",
              gross: 400,
              id: "pi_supabase_1",
              refund: 25,
              status: "Частичный возврат",
              stripeFee: 12.5,
            },
          ],
          records: {
            appointments: [
              {
                client: "Supabase Client",
                clientId: "client-supabase",
                date: "2026-07-02",
                id: "appointment-supabase",
                note: "Loaded from Supabase",
                service: "Deep tissue massage",
                status: "Подтверждена",
                time: "11:00",
              },
            ],
            certificates: [],
            clients: [
              {
                email: "supabase@example.com",
                history: [],
                id: "client-supabase",
                language: "en",
                name: "Supabase Client",
                next: "2026-07-02 11:00",
                note: "Loaded from Supabase",
                phone: "+359 88 000 0000",
                preferredContact: "Email",
                status: "Активный клиент",
                tags: ["EN"],
                telegram: "",
                totalSpend: "400 €",
                visits: 1,
              },
            ],
          },
          source: "supabase",
        }}
        role="accountant"
      />,
    );

    expect(screen.getByText("pi_supabase_1")).toBeInTheDocument();
    expect(screen.getByText("Supabase Buyer")).toBeInTheDocument();
    expect(screen.queryByText("pi_3QMMN1021")).not.toBeInTheDocument();
  });

  it("renders supplied initial blog posts instead of demo blog records", () => {
    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [
            {
              author: "Supabase Natali",
              body: "Loaded blog body.",
              category: "Supabase",
              coverImage: "/media/blog/supabase.jpg",
              excerpt: "Loaded excerpt.",
              id: "blog-supabase",
              locales: ["ru", "bg"],
              publishedAt: "",
              seoTitle: "Supabase Blog SEO",
              slug: "supabase-blog",
              status: "Запланирована",
              tags: ["supabase", "blog"],
              title: "Supabase Blog",
              translationKey: "blog-supabase",
              updatedAt: "2026-07-09",
            },
          ],
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    expect(within(screen.getByRole("table")).getByRole("link", { name: "Supabase Blog" })).toHaveAttribute(
      "href",
      "/admin?section=blog&role=owner&blog=blog-supabase",
    );
    expect(screen.queryByText("Подготовка к первому массажу")).not.toBeInTheDocument();
  });

  it("toggles public blog visibility through the narrow admin record", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [],
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          settings: blogVisibilitySettings,
          source: "supabase",
        }}
        role="editor"
      />,
    );

    const toggle = screen.getByRole("switch", { name: "Показывать блог на сайте" });
    expect(toggle).toBeChecked();
    await user.click(toggle);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(toggle).not.toBeChecked();
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      audit: { action: "site.blog_visibility" },
      record: { enabled: false },
      type: "blogVisibility",
    });
    expect(screen.getByText("Блог скрыт на сайте; статьи сохранены в админке.")).toBeInTheDocument();
  });

  it("keeps blog visibility read-only for a viewer", () => {
    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [],
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          settings: blogVisibilitySettings,
          source: "supabase",
        }}
        role="viewer"
      />,
    );

    expect(screen.getByRole("switch", { name: "Показывать блог на сайте" })).toBeDisabled();
  });

  it("restores blog visibility when persistence fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ message: "write failed", ok: false }), { status: 500 }),
    ));

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [],
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          settings: blogVisibilitySettings,
          source: "supabase",
        }}
        role="owner"
      />,
    );

    const toggle = screen.getByRole("switch", { name: "Показывать блог на сайте" });
    await user.click(toggle);

    expect(await screen.findByText("Не удалось изменить видимость блога. Исходное состояние восстановлено.")).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it("renders supplied initial settings instead of demo settings", () => {
    render(
      <AdminShell
        activeSection="settings"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          settings: {
            auditLogRetentionDays: 540,
            bookingBufferMinutes: 15,
            businessName: "Supabase Magic Massage",
            cookiePrivacyMode: "Supabase privacy text.",
            currency: "EUR",
            dailySlotCapacity: 5,
            defaultLocale: "bg",
            defaultSeoTitle: "Supabase SEO",
            emailSender: "admin@magicmassage.bg",
            googleCalendarId: "natali@example.com",
            googleCalendarMode: "Односторонняя",
            reminderTemplate: "Supabase reminder.",
            rolesPolicy: "Supabase roles.",
            stripeMode: "Live после подтверждения",
            timezone: "Europe/Sofia",
            updatedAt: "2026-07-09",
            workingDays: "Пн-Сб",
            workingHours: "10:00-19:00",
          },
          source: "supabase",
        }}
        role="owner"
        selectedSettingsGroupId="booking"
      />,
    );

    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(within(details).getByText("15 минут")).toBeInTheDocument();
    expect(within(details).getByText("5 записей; вручную можно больше")).toBeInTheDocument();
    expect(within(details).getByText("Односторонняя")).toBeInTheDocument();
    expect(within(details).getByText("natali@example.com")).toBeInTheDocument();
    expect(within(details).queryByText("30 минут")).not.toBeInTheDocument();
  });

  it("renders supplied initial admin users instead of demo user records", () => {
    render(
      <AdminShell
        activeSection="users"
        initialData={{
          adminUsers: [
            {
              accessNote: "Профиль Supabase Auth управляется владельцем.",
              email: "accountant@example.com",
              history: ["2026-07-08 09:15: последний успешный вход"],
              id: "00000000-0000-0000-0000-000000000002",
              lastLogin: "2026-07-08 09:15",
              name: "Supabase Accountant",
              role: "accountant",
              status: "Активен",
              twoFactor: false,
            },
          ],
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
        selectedAdminUserId="00000000-0000-0000-0000-000000000002"
      />,
    );

    expect(within(screen.getByRole("table")).getByRole("link", { name: "Supabase Accountant" })).toHaveAttribute(
      "href",
      "/admin?section=users&role=owner&user=00000000-0000-0000-0000-000000000002",
    );
    expect(screen.getAllByText("accountant@example.com")).toHaveLength(2);
    expect(screen.queryByText("Natali Ivanova")).not.toBeInTheDocument();
  });

  it("renders supplied initial services instead of demo service records", () => {
    render(
      <AdminShell
        activeSection="services"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          services: [
            {
              category: "SPA",
              coverImage: "/media/services/supabase-massage.jpg",
              duration: "75 мин",
              locales: ["ru", "bg"],
              name: "Supabase Massage",
              order: 7,
              seoTitle: "Supabase Massage SEO",
              slug: "supabase-massage",
              status: "Опубликована",
              summary: "Loaded service summary.",
            },
          ],
          source: "supabase",
        }}
        role="owner"
      />,
    );

    expect(within(screen.getByRole("table")).getByRole("link", { name: "Supabase Massage" })).toHaveAttribute(
      "href",
      "/admin?section=services&role=owner&service=supabase-massage",
    );
    expect(screen.queryByText("Классический массаж")).not.toBeInTheDocument();
  });

  it("renders supplied initial prices with supplied service names", () => {
    render(
      <AdminShell
        activeSection="price"
        initialData={{
          financeRows: [],
          prices: [
            {
              durationMinutes: 75,
              id: "price-supabase-massage-75",
              note: "Loaded price note.",
              order: 3,
              priceEur: 120,
              serviceSlug: "supabase-massage",
              status: "Активна",
              updatedAt: "2026-07-09",
            },
          ],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          services: [
            {
              category: "SPA",
              coverImage: "/media/services/supabase-massage.jpg",
              duration: "75 мин",
              locales: ["ru", "bg"],
              name: "Supabase Massage",
              order: 7,
              seoTitle: "Supabase Massage SEO",
              slug: "supabase-massage",
              status: "Опубликована",
              summary: "Loaded service summary.",
            },
          ],
          source: "supabase",
        }}
        role="owner"
      />,
    );

    expect(within(screen.getByRole("table")).getByRole("link", { name: "Supabase Massage · 75 мин" })).toHaveAttribute(
      "href",
      "/admin?section=price&role=owner&price=price-supabase-massage-75",
    );
    expect(screen.getByText("120 €")).toBeInTheDocument();
    expect(screen.queryByText("Классический массаж · 60 мин")).not.toBeInTheDocument();
  });

  it("renders supplied initial media instead of demo media records", () => {
    render(
      <AdminShell
        activeSection="media"
        initialData={{
          financeRows: [],
          media: [
            {
              altText: "Supabase studio photo",
              dimensions: "1600x1100",
              folder: "services",
              id: "media-supabase-studio",
              name: "Supabase Studio Photo",
              size: "420 KB",
              status: "Готово",
              type: "Фото",
              uploadedAt: "2026-07-09",
              url: "/media/services/supabase-studio.jpg",
              usage: ["Service: Supabase Massage"],
            },
          ],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    expect(within(screen.getByLabelText("Галерея медиа")).getByRole("link", { name: /Supabase Studio Photo/ })).toHaveAttribute(
      "href",
      "/admin?section=media&role=owner&media=media-supabase-studio",
    );
    expect(screen.queryByText("Фото кабинета")).not.toBeInTheDocument();
  });

  it("renders supplied initial contacts and contact settings instead of demo contact records", () => {
    render(
      <AdminShell
        activeSection="contacts"
        initialData={{
          contactChannels: [
            {
              id: "contact-supabase-viber",
              name: "Supabase Viber",
              note: "Loaded contact note.",
              status: "Активен",
              type: "Мессенджер",
              usage: ["Contacts", "Fast replies"],
              value: "viber://chat?number=359880001122",
            },
          ],
          contactSettings: {
            address: "Supabase Street 1, Burgas",
            bookingUrl: "https://studio24.bg/supabase",
            businessName: "Supabase Magic Massage",
            email: "supabase@example.com",
            mapUrl: "https://maps.google.com/?q=supabase",
            phone: "+359 88 000 1122",
            seoArea: "Burgas",
            workingHours: "Пн-Сб 10:00-19:00",
            workingSchedule: cloneBusinessHoursSchedule(),
          },
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    expect(screen.getByText("Supabase Magic Massage")).toBeInTheDocument();
    expect(screen.getByText("+359 88 000 1122")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Supabase Viber" })).toHaveAttribute(
      "href",
      "/admin?section=contacts&role=owner&contact=contact-supabase-viber",
    );
    expect(screen.queryByText("Телефон салона")).not.toBeInTheDocument();
  });

  it("filters clients from the global admin search", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" />);

    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "Olena");

    expect(within(screen.getByRole("table")).getByRole("link", { name: "Olena K." })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
    expect(screen.queryByText("Maria Georgieva")).not.toBeInTheDocument();
  });

  it("keeps a client phone search useful after switching to the calendar", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminShell activeSection="clients" role="owner" />);
    const search = screen.getByRole("searchbox", { name: "Поиск" });

    await user.type(search, "+359 87 333 4411");
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Olena K." })).toBeInTheDocument();

    rerender(
      <AdminShell
        activeSection="calendar"
        role="owner"
        selectedCalendarDate="2026-07-08"
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("+359 87 333 4411");
    expect(screen.getByRole("button", { name: /Olena K\..*Deep tissue massage/ })).toBeInTheDocument();
  });

  it("filters clients with segmented controls", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" />);

    const filters = screen.getByLabelText("Фильтры клиентов");
    const table = screen.getByRole("table");
    await user.click(within(filters).getByRole("button", { name: "BG" }));

    expect(within(filters).getByRole("button", { name: "BG" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("link", { name: "Maria Georgieva" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359895550099",
    );
    expect(within(table).queryByRole("link", { name: "Анна Петрова" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Olena K." })).not.toBeInTheDocument();

    const mariaLink = within(table).getByRole("link", { name: "Maria Georgieva" });
    mariaLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(mariaLink);
    expect(within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("heading", { name: "Maria Georgieva" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("button", { name: "Закрыть" }));

    expect(within(table).getByRole("columnheader", { name: "Статус" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Активность" })).not.toBeInTheDocument();
    expect(within(filters).queryByRole("button", { name: "Активные" })).not.toBeInTheDocument();
  });

  it("does not render an artificial active client filter", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    const filters = screen.getByLabelText("Фильтры клиентов");
    expect(within(filters).queryByRole("button", { name: "Активные" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Смысл фильтра активных клиентов")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByRole("columnheader", { name: "Активность" })).not.toBeInTheDocument();
  });

  it("can open the create-client form when Supabase has no clients yet", async () => {
    const user = userEvent.setup();

    render(
      <AdminShell
        activeSection="clients"
        initialData={{
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    expect(screen.getByText("Клиенты не найдены.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Добавить клиента" }));

    expect(screen.getByRole("dialog", { name: "Новый клиент" })).toBeInTheDocument();
  });

  it("renders mobile client summaries with natural visit labels", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    const mobileList = screen.getByRole("list", { name: "Мобильный список клиентов" });
    expect(within(mobileList).getByText("3 визита")).toBeInTheDocument();
    expect(within(mobileList).getByText("5 визитов")).toBeInTheDocument();
    expect(within(mobileList).getByText("7 визитов")).toBeInTheDocument();
    expect(within(mobileList).getByRole("link", { name: /Olena K./ })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
  });

  it("shows the selected client detail card from the client query", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(card).toHaveClass("admin-drawer-panel");
    expect(within(card).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(card).getByText("+359 87 333 4411")).toBeInTheDocument();
    expect(within(card).getByText("olena.k@example.com")).toBeInTheDocument();
    expect(within(card).getAllByText("UA").length).toBeGreaterThan(0);
    expect(within(card).queryByLabelText("Активность клиента")).not.toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Контактные данные" })).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Ключевые показатели" })).toBeInTheDocument();
    expect(within(card).getByLabelText("Показатели клиента")).toHaveTextContent("5");
    expect(within(card).getByLabelText("Показатели клиента")).toHaveTextContent("15 Jul 11:30");
    const historySection = within(card)
      .getByRole("heading", { name: "История визитов" })
      .closest("section");
    expect(historySection).not.toBeNull();
    expect(within(card).getAllByText("Deep tissue massage").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("8 июля, 15:00").length).toBeGreaterThan(0);
    expect(
      within(historySection as HTMLElement).getByRole("link", { name: "Открыть запись 8 июля, 15:00" }),
    ).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=client-359873334411&appointment=demo-3",
    );
    expect(within(card).getAllByText(/Предпочитает вечерние слоты/).length).toBeGreaterThan(0);
  });

  it("keeps right drawer clicks scoped to the panel and closes from backdrop or Escape", () => {
    const { unmount } = render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: "Карточка клиента" })).toBeInTheDocument();

    fireEvent.click(card.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Карточка клиента" })).not.toBeInTheDocument();

    unmount();
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const reopenedCard = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.keyDown(reopenedCard, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Карточка клиента" })).not.toBeInTheDocument();
  });

  it("protects edited client notes when the drawer header close button is used", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(within(card).getByRole("button", { name: "Редактировать заметку" }));
    fireEvent.change(within(card).getByLabelText("Заметка клиента"), { target: { value: "Несохраненная заметка клиента." } });
    fireEvent.click(within(card).getByRole("button", { name: "Закрыть" }));

    expect(confirmSpy).toHaveBeenCalledWith("Есть несохраненные изменения. Закрыть без сохранения?");
    expect(screen.getByRole("dialog", { name: "Карточка клиента" })).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(within(card).getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByRole("dialog", { name: "Карточка клиента" })).not.toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it("protects an unsaved visit comment with the parent client drawer guard", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(within(card).getByRole("button", { name: "Добавить комментарий" }));
    fireEvent.change(within(card).getByLabelText("Комментарий после визита"), {
      target: { value: "Несохраненный результат визита." },
    });
    fireEvent.click(within(card).getByRole("button", { name: "Закрыть" }));

    expect(confirmSpy).toHaveBeenCalledWith("Есть несохраненные изменения. Закрыть без сохранения?");
    expect(screen.getByRole("dialog", { name: "Карточка клиента" })).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it("shows certificates linked to the selected client", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Сертификаты" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "MMN-2407-1023" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
    expect(within(card).getByText("Oksana → Self")).toBeInTheDocument();
    expect(within(card).getByText("250 €")).toBeInTheDocument();
    expect(within(card).getAllByText("Ожидает PDF").length).toBeGreaterThan(0);
  });

  it("opens certificate details from the certificate query", () => {
    render(<AdminShell activeSection="certificates" role="owner" selectedCertificateCode="MMN-2407-1023" />);

    const details = screen.getByRole("dialog", { name: "Детали сертификата" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1023" })).toBeInTheDocument();
    expect(within(details).getByText("Oksana → Self")).toBeInTheDocument();
    expect(within(details).getByText("Ожидает PDF")).toBeInTheDocument();
    const linkedActions = within(details).getByLabelText("Связанные действия клиента");
    expect(within(linkedActions).getByRole("link", { name: "Карточка клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все записи клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359873334411",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все сертификаты клиента" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&client=client-359873334411",
    );
    expect(within(linkedActions).getByRole("link", { name: "Записать клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359873334411&action=create",
    );
  });

  it("opens service details from the service query", () => {
    render(<AdminShell activeSection="services" role="owner" selectedServiceSlug="classic-massage" />);

    const details = screen.getByRole("dialog", { name: "Детали услуги" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Классический массаж" })).toBeInTheDocument();
    expect(within(details).getByText("classic-massage")).toBeInTheDocument();
  });

  it("opens price details from the price query", () => {
    render(<AdminShell activeSection="price" role="owner" selectedPriceId="price-classic-60" />);

    const details = screen.getByRole("dialog", { name: "Детали цены" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Классический массаж · 60 мин" })).toBeInTheDocument();
    expect(within(details).getByText("70 €")).toBeInTheDocument();
    expect(within(details).getByText("EUR")).toBeInTheDocument();
  });

  it("opens media details from the media query", () => {
    render(<AdminShell activeSection="media" role="owner" selectedMediaId="media-classic-cover" />);

    const details = screen.getByRole("dialog", { name: "Детали медиа" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Классический массаж" })).toBeInTheDocument();
    expect(within(details).getByText("/media/services/classic-massage.jpg")).toBeInTheDocument();
    expect(within(details).getByText("Услуга: Классический массаж")).toBeInTheDocument();
  });

  it("opens contact details from the contact query", () => {
    render(<AdminShell activeSection="contacts" role="owner" selectedContactId="contact-phone" />);

    const details = screen.getByRole("dialog", { name: "Детали контакта" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Телефон салона" })).toBeInTheDocument();
    expect(within(details).getByText("+359 89 677 8308")).toBeInTheDocument();
    expect(within(details).getByText("LocalBusiness SEO")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));
    expect(within(screen.getByRole("dialog", { name: "Редактировать контакт" })).getByLabelText("Тип")).toBeDisabled();
  });

  it("posts saved contact settings when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="contacts"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Контактные настройки" });
    fireEvent.change(within(dialog).getByLabelText("Название"), { target: { value: "Magic Massage Natali" } });
    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 87 333 4411" } });
    fireEvent.change(within(dialog).getByLabelText("Адрес"), { target: { value: "ул. Места 49, Бургас, Болгария" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "info@magicmassage.bg" } });
    fireEvent.change(within(dialog).getByLabelText("Суббота: закрытие"), { target: { value: "17:00" } });
    fireEvent.change(within(dialog).getByLabelText("Studio24 URL"), {
      target: { value: "https://studio24.bg/magic-massage-natali" },
    });
    fireEvent.change(within(dialog).getByLabelText("Map URL"), {
      target: { value: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas" },
    });
    fireEvent.change(within(dialog).getByLabelText("LocalBusiness area"), {
      target: { value: "Burgas, Bulgaria" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить контакты" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [[url, requestInit]] = fetchMock.mock.calls;
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual(
      expect.objectContaining({
        record: expect.objectContaining({
          address: "ул. Места 49, Бургас, Болгария",
          bookingUrl: "https://studio24.bg/magic-massage-natali",
          businessName: "Magic Massage Natali",
          email: "info@magicmassage.bg",
          mapUrl: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
          phone: "+359 87 333 4411",
          seoArea: "Burgas, Bulgaria",
          workingSchedule: expect.arrayContaining([
            expect.objectContaining({ closesAt: "17:00", isOpen: true, weekday: 6 }),
            expect.objectContaining({ isOpen: false, weekday: 7 }),
          ]),
        }),
        type: "contactSettings",
      }),
    );
  });

  it("posts saved contact channels when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="contacts"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
        selectedContactId="contact-telegram"
      />,
    );

    const details = screen.getByRole("dialog", { name: "Детали контакта" });
    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать контакт" });
    fireEvent.change(within(dialog).getByLabelText("Название"), { target: { value: "Viber" } });
    fireEvent.change(within(dialog).getByLabelText("Тип"), { target: { value: "Мессенджер" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Активен" } });
    fireEvent.change(within(dialog).getByLabelText("Значение"), { target: { value: "viber://chat?number=359887771122" } });
    fireEvent.change(within(dialog).getByLabelText("Места использования"), { target: { value: "Контакты, Быстрая связь" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), {
      target: { value: "Быстрая связь после подтверждения номера клиента." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/records",
      expect.objectContaining({ method: "POST" }),
    ));

    const [url, requestInit] = fetchMock.mock.calls.find(([requestUrl]) => requestUrl === "/api/admin/records")!;
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        id: "contact-telegram",
        name: "Viber",
        note: "Быстрая связь после подтверждения номера клиента.",
        status: "Активен",
        type: "Мессенджер",
        usage: ["Контакты", "Быстрая связь"],
        value: "viber://chat?number=359887771122",
      },
      type: "contactChannel",
    });
  });

  it("opens blog details from the blog query", () => {
    render(<AdminShell activeSection="blog" role="owner" selectedBlogPostId="blog-first-massage-preparation" />);

    const details = screen.getByRole("dialog", { name: "Детали статьи" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Подготовка к первому массажу" })).toBeInTheDocument();
    expect(within(details).getByText("first-massage-preparation")).toBeInTheDocument();
    expect(within(details).getByText("Подготовка к первому массажу в Бургасе")).toBeInTheDocument();
  });

  it("opens settings details from the settings query", () => {
    render(<AdminShell activeSection="settings" role="owner" selectedSettingsGroupId="booking" />);

    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Запись и календарь" })).toBeInTheDocument();
    expect(within(details).getByText("30 минут")).toBeInTheDocument();
    expect(within(details).getByText("Внутренний календарь главный")).toBeInTheDocument();
  });

  it("opens user details from the user query", () => {
    render(<AdminShell activeSection="users" role="owner" selectedAdminUserId="admin-user-owner" />);

    const details = screen.getByRole("dialog", { name: "Детали пользователя" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Natali Ivanova" })).toBeInTheDocument();
    expect(within(details).getByText("natali@magicmassage.bg")).toBeInTheDocument();
    expect(within(details).getByText("Владелец")).toBeInTheDocument();
  });

  it.each([
    {
      activeSection: "certificates" as const,
      drawerLabel: "Детали сертификата",
      heading: "MMN-2407-1023",
      rowHref: "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
      rowButton: "MMN-2407-1023",
      subtitle: "Oksana → Self · Ожидает PDF",
    },
    {
      activeSection: "services" as const,
      drawerLabel: "Детали услуги",
      heading: "Классический массаж",
      rowHref: "/admin?section=services&role=owner&service=classic-massage",
      rowButton: "Классический массаж",
      subtitle: "classic-massage · Опубликована",
    },
    {
      activeSection: "price" as const,
      drawerLabel: "Детали цены",
      heading: "Классический массаж · 60 мин",
      rowHref: "/admin?section=price&role=owner&price=price-classic-60",
      rowButton: "Классический массаж · 60 мин",
      subtitle: "70 € · Активна",
    },
    {
      activeSection: "media" as const,
      drawerLabel: "Детали медиа",
      heading: "Классический массаж",
      rowHref: "/admin?section=media&role=owner&media=media-classic-cover",
      rowButton: "Классический массаж",
      subtitle: "Фото · Готово",
    },
    {
      activeSection: "contacts" as const,
      drawerLabel: "Детали контакта",
      heading: "Телефон салона",
      rowHref: "/admin?section=contacts&role=owner&contact=contact-phone",
      rowButton: "Телефон салона",
      subtitle: "Телефон · Активен",
    },
    {
      activeSection: "blog" as const,
      drawerLabel: "Детали статьи",
      heading: "Подготовка к первому массажу",
      rowHref: "/admin?section=blog&role=owner&blog=blog-first-massage-preparation",
      rowButton: "Подготовка к первому массажу",
      subtitle: "first-massage-preparation · Опубликована",
    },
    {
      activeSection: "settings" as const,
      drawerLabel: "Детали настроек",
      heading: "Запись и календарь",
      rowHref: "/admin?section=settings&role=owner&settings=booking",
      rowButton: "Запись и календарь",
      subtitle: "Рабочие часы, слоты, буфер между сеансами и Google Calendar.",
    },
    {
      activeSection: "users" as const,
      drawerLabel: "Детали пользователя",
      heading: "Natali Ivanova",
      rowHref: "/admin?section=users&role=owner&user=admin-user-owner",
      rowButton: "Natali Ivanova",
      subtitle: "natali@magicmassage.bg · Владелец · Активен",
    },
  ])("opens $drawerLabel as a full-height drawer after selecting a row", ({ activeSection, drawerLabel, heading, rowButton, rowHref, subtitle }) => {
    render(<AdminShell activeSection={activeSection} role="owner" />);

    expect(screen.queryByLabelText(drawerLabel)).not.toBeInTheDocument();

    const collection = activeSection === "media" ? screen.getByLabelText("Галерея медиа") : screen.getByRole("table");
    const rowControl = rowHref
      ? within(collection).getByRole("link", { name: activeSection === "media" ? new RegExp(rowButton) : rowButton })
      : within(collection).getByRole("button", { name: rowButton });
    if (rowHref) {
      expect(rowControl).toHaveAttribute("href", rowHref);
      rowControl.addEventListener("click", (event) => event.preventDefault(), { once: true });
    }

    fireEvent.click(rowControl);

    const details = screen.getByRole("dialog", { name: drawerLabel });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(details.parentElement).toHaveClass("admin-drawer-backdrop");
    const drawerHeader = details.querySelector<HTMLElement>(".admin-drawer-header");
    expect(drawerHeader).not.toBeNull();
    expect(within(drawerHeader!).getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(within(drawerHeader!).getByText(subtitle, { exact: true })).toBeInTheDocument();
    expect(within(drawerHeader!).queryByRole("heading", { name: drawerLabel })).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Закрыть" }));

    expect(screen.queryByRole("dialog", { name: drawerLabel })).not.toBeInTheDocument();
  });

  it("creates a manual certificate and opens its details", () => {
    render(<AdminShell activeSection="certificates" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Выдать вручную" }));

    const dialog = screen.getByRole("dialog", { name: "Новый сертификат" });
    fireEvent.change(within(dialog).getByLabelText("Код"), { target: { value: "MMN-2407-1999" } });
    fireEvent.change(within(dialog).getByLabelText("Покупатель"), { target: { value: "Ирина Тестова" } });
    fireEvent.change(within(dialog).getByLabelText("Клиент"), { target: { value: "Ирина Тестова" } });
    fireEvent.change(within(dialog).getByLabelText("Получатель"), { target: { value: "Self" } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "90 €" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Оплачено" } });
    fireEvent.change(within(dialog).getByLabelText("Stripe ID"), { target: { value: "manual" } });
    fireEvent.change(within(dialog).getByLabelText("Дата оплаты"), { target: { value: "2026-07-07" } });
    fireEvent.change(within(dialog).getByLabelText("Действителен до"), { target: { value: "2027-01-07" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), { target: { value: "Ручная выдача после оплаты в салоне." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить сертификат" }));

    expect(screen.queryByRole("dialog", { name: "Новый сертификат" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "MMN-2407-1999" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1999",
    );

    const details = screen.getByLabelText("Детали сертификата");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1999" })).toBeInTheDocument();
    expect(within(details).getByText("Ирина Тестова → Self")).toBeInTheDocument();
    expect(within(details).getByText("90 €")).toBeInTheDocument();
    expect(within(details).getByText("manual")).toBeInTheDocument();
    expect(within(details).getByText("Ручная выдача после оплаты в салоне.")).toBeInTheDocument();
  });

  it("posts saved certificates when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="certificates"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [
              {
                amount: "120 €",
                buyer: "Existing Buyer",
                clientId: "client-existing",
                clientName: "Existing Client",
                code: "MMN-2407-1000",
                expiresAt: "2027-01-07",
                history: ["2026-07-07: Loaded from Supabase."],
                note: "Existing certificate.",
                paymentDate: "2026-07-07",
                recipient: "Existing Client",
                status: "Оплачено",
                stripeId: "manual-existing",
              },
            ],
            clients: [
              {
                email: "existing@example.com",
                history: [],
                id: "client-existing",
                language: "en",
                name: "Existing Client",
                next: "Not scheduled",
                note: "",
                phone: "+359 88 000 0000",
                preferredContact: "Email",
                status: "Новый клиент",
                tags: ["EN"],
                telegram: "",
                totalSpend: "0 €",
                visits: 0,
              },
            ],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Выдать вручную" }));

    const dialog = screen.getByRole("dialog", { name: "Новый сертификат" });
    fireEvent.change(within(dialog).getByLabelText("Код"), { target: { value: "MMN-2407-1999" } });
    fireEvent.change(within(dialog).getByLabelText("Покупатель"), { target: { value: "Irina Persist" } });
    fireEvent.change(within(dialog).getByLabelText("Клиент"), { target: { value: "Irina Persist" } });
    fireEvent.change(within(dialog).getByLabelText("Получатель"), { target: { value: "Self" } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "90 €" } });
    fireEvent.change(within(dialog).getByLabelText("Stripe ID"), { target: { value: "manual" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), { target: { value: "Manual certificate persisted." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить сертификат" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/records",
      expect.objectContaining({ method: "POST" }),
    ));

    const [url, requestInit] = fetchMock.mock.calls.find(([requestUrl]) => requestUrl === "/api/admin/records")!;
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        amount: "90 €",
        buyer: "Irina Persist",
        clientName: "Irina Persist",
        code: "MMN-2407-1999",
        note: "Manual certificate persisted.",
        recipient: "Self",
        stripeId: "manual",
      },
      type: "certificate",
    });
  });

  it("updates certificate delivery, redemption, and editable details", () => {
    render(<AdminShell activeSection="certificates" role="owner" />);

    const certificateLink = within(screen.getByRole("table")).getByRole("link", { name: "MMN-2407-1023" });
    expect(certificateLink).toHaveAttribute("href", "/admin?section=certificates&role=owner&certificate=MMN-2407-1023");
    certificateLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(certificateLink);

    const details = screen.getByLabelText("Детали сертификата");
    expect(within(details).getByRole("heading", { name: "MMN-2407-1023" })).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Отправить PDF" }));
    expect(within(details).getByText("Отправлен")).toBeInTheDocument();
    expect(within(details).getByRole("status")).toHaveTextContent("PDF отмечен как отправленный.");

    fireEvent.click(within(details).getByRole("button", { name: "Погасить" }));
    expect(within(details).getByText("Погашен")).toBeInTheDocument();
    expect(within(details).getByRole("status")).toHaveTextContent("Сертификат погашен.");

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));
    const dialog = screen.getByRole("dialog", { name: "Редактировать сертификат" });
    fireEvent.change(within(dialog).getByLabelText("Получатель"), { target: { value: "Olena K." } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "260 €" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), { target: { value: "Погашен после записи клиента." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать сертификат" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "MMN-2407-1023" })).toHaveLength(1);
    expect(within(details).getByText("Oksana → Olena K.")).toBeInTheDocument();
    expect(within(details).getByText("260 €")).toBeInTheDocument();
    expect(within(details).getByText("Погашен после записи клиента.")).toBeInTheDocument();
  });

  it("keeps refunded certificates inactive and disables fulfillment actions", () => {
    render(
      <AdminShell
        activeSection="certificates"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [
              {
                amount: "90 €",
                buyer: "Refunded Buyer",
                clientName: "Refunded Client",
                code: "CERT-REFUNDED",
                expiresAt: "2027-01-03",
                history: ["2026-07-12: Payment refunded."],
                note: "",
                paymentDate: "2026-07-12",
                recipient: "Refunded Client",
                status: "Возвращён",
                stripeId: "pi_refunded",
              },
            ],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
        selectedCertificateCode="CERT-REFUNDED"
      />,
    );

    const details = screen.getByLabelText("Детали сертификата");
    expect(within(details).getByText("Возвращён")).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Отправить PDF" })).toBeDisabled();
    expect(within(details).getByRole("button", { name: "Погасить" })).toBeDisabled();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));
    const editDialog = screen.getByRole("dialog", { name: "Редактировать сертификат" });
    expect(within(editDialog).getByLabelText("Статус")).toBeDisabled();
    expect(within(editDialog).getByRole("option", { name: "Возвращён" })).toBeDisabled();
  });

  it("creates and edits a massage service from the services workspace", () => {
    render(<AdminShell activeSection="services" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить услугу" }));

    const createDialog = screen.getByRole("dialog", { name: "Новая услуга" });
    expect(createDialog.querySelector("form")).toHaveClass("admin-drawer-form");
    expect(createDialog.querySelector(".admin-action-body")).toBeInTheDocument();
    fireEvent.change(within(createDialog).getByLabelText("Название"), { target: { value: "Арома массаж" } });
    fireEvent.change(within(createDialog).getByLabelText("Slug"), { target: { value: "aroma-massage" } });
    fireEvent.change(within(createDialog).getByLabelText("Категория"), { target: { value: "SPA" } });
    fireEvent.change(within(createDialog).getByLabelText("Статус"), { target: { value: "Черновик" } });
    fireEvent.change(within(createDialog).getByLabelText("Длительность"), { target: { value: "75 мин" } });
    fireEvent.change(within(createDialog).getByLabelText("Порядок"), { target: { value: "9" } });
    fireEvent.change(within(createDialog).getByLabelText("SEO title"), { target: { value: "Арома массаж в Бургасе" } });
    fireEvent.change(within(createDialog).getByLabelText("URL обложки"), { target: { value: "/media/services/aroma-massage.jpg" } });
    fireEvent.change(within(createDialog).getByLabelText("Краткое описание"), { target: { value: "Расслабляющая SPA-услуга с ароматическими маслами." } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Сохранить услугу" }));

    expect(screen.queryByRole("dialog", { name: "Новая услуга" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Арома массаж" })).toHaveAttribute(
      "href",
      "/admin?section=services&role=owner&service=aroma-massage",
    );

    const details = screen.getByLabelText("Детали услуги");
    expect(within(details).getByRole("heading", { name: "Арома массаж" })).toBeInTheDocument();
    expect(within(details).getByText("aroma-massage")).toBeInTheDocument();
    expect(within(details).getByText("Расслабляющая SPA-услуга с ароматическими маслами.")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    expect(screen.queryByRole("dialog", { name: "Детали услуги" })).not.toBeInTheDocument();
    const editDialog = screen.getByRole("dialog", { name: "Редактировать: Арома массаж" });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Скрыта" } });
    fireEvent.change(within(editDialog).getByLabelText("Краткое описание"), { target: { value: "Обновленное описание услуги для сайта." } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить услугу" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать: Арома массаж" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Арома массаж" })).toHaveLength(1);
    const updatedDetails = screen.getByRole("dialog", { name: "Детали услуги" });
    expect(within(updatedDetails).getByText("Скрыта")).toBeInTheDocument();
    expect(within(updatedDetails).getByText("Обновленное описание услуги для сайта.")).toBeInTheDocument();
  });

  it("posts saved massage services when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="services"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Добавить услугу" }));

    const dialog = screen.getByRole("dialog", { name: "Новая услуга" });
    fireEvent.change(within(dialog).getByLabelText("Название"), { target: { value: "Арома массаж" } });
    fireEvent.change(within(dialog).getByLabelText("Slug"), { target: { value: "aroma-massage" } });
    fireEvent.change(within(dialog).getByLabelText("Категория"), { target: { value: "SPA" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Черновик" } });
    fireEvent.change(within(dialog).getByLabelText("Длительность"), { target: { value: "75 мин" } });
    fireEvent.change(within(dialog).getByLabelText("Порядок"), { target: { value: "9" } });
    fireEvent.change(within(dialog).getByLabelText("SEO title"), { target: { value: "Арома массаж в Бургасе" } });
    fireEvent.change(within(dialog).getByLabelText("URL обложки"), { target: { value: "/media/services/aroma-massage.jpg" } });
    fireEvent.change(within(dialog).getByLabelText("Краткое описание"), { target: { value: "SPA-услуга с ароматическими маслами." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить услугу" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        category: "SPA",
        coverImage: "/media/services/aroma-massage.jpg",
        duration: "75 мин",
        locales: ["bg"],
        name: "Арома массаж",
        order: 9,
        seoTitle: "Арома массаж в Бургасе",
        slug: "aroma-massage",
        status: "Черновик",
        summary: "SPA-услуга с ароматическими маслами.",
      },
      type: "service",
    });
  });

  it("keeps price variants attached when a service is edited", () => {
    render(<AdminShell activeSection="services" role="owner" />);

    const serviceLink = within(screen.getByRole("table")).getByRole("link", { name: "Классический массаж" });
    serviceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(serviceLink);

    const details = screen.getByLabelText("Детали услуги");
    expect(within(details).getByText("70 €")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать: Классический массаж" });
    expect(within(editDialog).getByRole("textbox", { name: /Slug/ })).toHaveAttribute("readonly");
    expect(within(editDialog).getByRole("textbox", { name: /Slug/ })).toHaveValue("classic-massage");
    fireEvent.change(within(editDialog).getByLabelText("Категория"), { target: { value: "Классика" } });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Черновик" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить услугу" }));

    const updatedDetails = screen.getByLabelText("Детали услуги");
    expect(within(updatedDetails).getByText("classic-massage")).toBeInTheDocument();
    expect(within(updatedDetails).getByText("70 €")).toBeInTheDocument();
  });

  it("filters service rows by publication status", () => {
    render(<AdminShell activeSection="services" role="owner" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Классический массаж" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Черновики" }));

    expect(screen.getByRole("button", { name: "Черновики" })).toHaveAttribute("aria-pressed", "true");
    const draftServiceLink = within(table).getByRole("link", { name: "Deep tissue massage" });
    expect(draftServiceLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Классический массаж" })).not.toBeInTheDocument();
    draftServiceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(draftServiceLink);
    expect(within(screen.getByRole("dialog", { name: "Детали услуги" })).getByRole("heading", { name: "Deep tissue massage" })).toBeInTheDocument();
  });

  it("creates and edits a price variant from the price workspace", () => {
    render(<AdminShell activeSection="price" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить цену" }));

    const createDialog = screen.getByRole("dialog", { name: "Новая цена" });
    fireEvent.change(within(createDialog).getByLabelText("Услуга"), { target: { value: "classic-massage" } });
    fireEvent.change(within(createDialog).getByLabelText("Длительность"), { target: { value: "90" } });
    fireEvent.change(within(createDialog).getByLabelText("Цена"), { target: { value: "110" } });
    fireEvent.change(within(createDialog).getByLabelText("Статус"), { target: { value: "Активна" } });
    fireEvent.change(within(createDialog).getByLabelText("Порядок"), { target: { value: "4" } });
    fireEvent.change(within(createDialog).getByLabelText("Заметка"), { target: { value: "Новый длинный вариант для постоянных клиентов." } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Сохранить цену" }));

    expect(screen.queryByRole("dialog", { name: "Новая цена" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Классический массаж · 90 мин" })).toHaveAttribute(
      "href",
      "/admin?section=price&role=owner&price=price-classic-massage-90",
    );

    const details = screen.getByLabelText("Детали цены");
    expect(within(details).getByRole("heading", { name: "Классический массаж · 90 мин" })).toBeInTheDocument();
    expect(within(details).getByText("110 €")).toBeInTheDocument();
    expect(within(details).getByText("Новый длинный вариант для постоянных клиентов.")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать цену" });
    fireEvent.change(within(editDialog).getByLabelText("Цена"), { target: { value: "115" } });
    fireEvent.change(within(editDialog).getByLabelText("Статус"), { target: { value: "Скрыта" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать цену" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Классический массаж · 90 мин" })).toHaveLength(1);
    expect(within(details).getByText("115 €")).toBeInTheDocument();
    expect(within(details).getByText("Скрыта")).toBeInTheDocument();
  });

  it("posts saved price variants when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="price"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Добавить цену" }));

    const dialog = screen.getByRole("dialog", { name: "Новая цена" });
    fireEvent.change(within(dialog).getByLabelText("Услуга"), { target: { value: "classic-massage" } });
    fireEvent.change(within(dialog).getByLabelText("Длительность"), { target: { value: "90" } });
    fireEvent.change(within(dialog).getByLabelText("Цена"), { target: { value: "110" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Активна" } });
    fireEvent.change(within(dialog).getByLabelText("Порядок"), { target: { value: "4" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка"), { target: { value: "Длинный вариант для постоянных клиентов." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить цену" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        durationMinutes: 90,
        id: "price-classic-massage-90",
        note: "Длинный вариант для постоянных клиентов.",
        order: 4,
        priceEur: 110,
        serviceSlug: "classic-massage",
        status: "Активна",
      },
      type: "price",
    });
  });

  it("filters price rows by active and hidden status", () => {
    render(<AdminShell activeSection="price" role="owner" />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Классический массаж · 60 мин" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Скрытые" }));

    expect(screen.getByRole("button", { name: "Скрытые" })).toHaveAttribute("aria-pressed", "true");
    const hiddenPriceLink = within(table).getByRole("link", { name: "Deep tissue massage · 60 мин" });
    expect(hiddenPriceLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Классический массаж · 60 мин" })).not.toBeInTheDocument();
    hiddenPriceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(hiddenPriceLink);
    expect(within(screen.getByRole("dialog", { name: "Детали цены" })).getByRole("heading", { name: "Deep tissue massage · 60 мин" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Активные" }));

    const activePriceLink = within(table).getByRole("link", { name: "Классический массаж · 60 мин" });
    expect(activePriceLink).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Deep tissue massage · 60 мин" })).not.toBeInTheDocument();
    activePriceLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(activePriceLink);
    expect(within(screen.getByRole("dialog", { name: "Детали цены" })).getByRole("heading", { name: "Классический массаж · 60 мин" })).toBeInTheDocument();
  });

  it("uploads and edits a media asset from the media workspace", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      height: 1100,
      mimeType: "image/webp",
      publicUrl: "/media/services/relaxing-massage.jpg",
      size: 419840,
      width: 1600,
    }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<AdminShell activeSection="media" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Загрузить медиа" }));

    const createDialog = screen.getByRole("dialog", { name: "Новое медиа" });
    await user.upload(within(createDialog).getByLabelText(/^Файл/), new File(["image"], "aroma-cover.webp", { type: "image/webp" }));
    fireEvent.change(within(createDialog).getByLabelText("Название"), { target: { value: "Арома обложка" } });
    fireEvent.change(within(createDialog).getByLabelText("Alt-текст или описание документа"), { target: { value: "Арома массаж в кабинете Magic Massage Natali" } });
    fireEvent.change(within(createDialog).getByLabelText("Права на публикацию"), { target: { value: "granted" } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Загрузить" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Новое медиа" })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(within(screen.getByLabelText("Галерея медиа")).getByRole("link", { name: /Арома обложка/ })).toHaveAttribute(
      "href",
      `/admin?section=media&role=owner&media=${encodeURIComponent("media-арома-обложка")}`,
    );

    const details = screen.getByLabelText("Детали медиа");
    expect(within(details).getByRole("heading", { name: "Арома обложка" })).toBeInTheDocument();
    expect(within(details).getByText("/media/services/relaxing-massage.jpg")).toBeInTheDocument();
    expect(within(details).getByText("Файл пока не привязан к страницам.")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать медиа" });
    fireEvent.change(within(editDialog).getByLabelText("Alt-текст"), { target: { value: "" } });
    expect(within(editDialog).getByLabelText("Статус")).toHaveValue("Требует alt");
    fireEvent.change(within(editDialog).getByLabelText("Alt-текст"), { target: { value: "Нужно уточнить alt перед публикацией" } });
    expect(within(editDialog).getByLabelText("Статус")).toHaveValue("Готово");
    fireEvent.click(within(editDialog).getByRole("button", { name: "Сохранить изменения" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Редактировать медиа" })).not.toBeInTheDocument(),
    );
    expect(within(details).getByText("Готово")).toBeInTheDocument();
    expect(within(details).getAllByText("Нужно уточнить alt перед публикацией").length).toBeGreaterThan(0);
  });

  it("posts saved media assets when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      if (String(input) === "/api/admin/media") {
        return new Response(JSON.stringify({
          height: 1100,
          mimeType: "image/webp",
          publicUrl: "/media/services/aroma-massage.jpg",
          size: 419840,
          width: 1600,
        }), { status: 201 });
      }

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <AdminShell
        activeSection="media"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Загрузить медиа" }));

    const dialog = screen.getByRole("dialog", { name: "Новое медиа" });
    await user.upload(within(dialog).getByLabelText(/^Файл/), new File(["image"], "aroma-cover.webp", { type: "image/webp" }));
    fireEvent.change(within(dialog).getByLabelText("Название"), { target: { value: "Арома обложка" } });
    fireEvent.change(within(dialog).getByLabelText("Alt-текст или описание документа"), {
      target: { value: "Арома массаж в кабинете Magic Massage Natali" },
    });
    fireEvent.change(within(dialog).getByLabelText("Права на публикацию"), { target: { value: "granted" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Загрузить" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [url, requestInit] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        altText: "Арома массаж в кабинете Magic Massage Natali",
        dimensions: "1600x1100",
        folder: "services",
        id: "media-арома-обложка",
        name: "Арома обложка",
        publicationConsent: "granted",
        size: "419840 B",
        status: "Готово",
        type: "Фото",
        url: "/media/services/aroma-massage.jpg",
        usage: [],
      },
      type: "media",
    });
  });

  it("filters media rows by type and missing alt state", () => {
    render(<AdminShell activeSection="media" role="owner" />);

    const gallery = screen.getByLabelText("Галерея медиа");
    expect(within(gallery).getByRole("link", { name: /Классический массаж/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Документы" }));

    expect(screen.getByRole("button", { name: "Документы" })).toHaveAttribute("aria-pressed", "true");
    const certificateMediaLink = within(gallery).getByRole("link", { name: /Сертификат Natali/ });
    expect(certificateMediaLink).toBeInTheDocument();
    expect(within(gallery).queryByRole("link", { name: /Классический массаж/ })).not.toBeInTheDocument();
    certificateMediaLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(certificateMediaLink);
    expect(within(screen.getByRole("dialog", { name: "Детали медиа" })).getByRole("heading", { name: "Сертификат Natali" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Требует alt" }));

    const needsAltMediaLink = within(gallery).getByRole("link", { name: /Фото кабинета/ });
    expect(needsAltMediaLink).toBeInTheDocument();
    expect(within(gallery).queryByRole("link", { name: /Сертификат Natali/ })).not.toBeInTheDocument();
    needsAltMediaLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(needsAltMediaLink);
    expect(within(screen.getByRole("dialog", { name: "Детали медиа" })).getByRole("heading", { name: "Фото кабинета" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Детали медиа" })).getByText("Требует alt")).toBeInTheDocument();
  });

  it("shows quick contact actions in the selected client card", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("link", { name: "Позвонить" })).toHaveAttribute("href", "tel:+359873334411");
    expect(within(card).getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:olena.k@example.com");
    expect(within(card).getByRole("link", { name: "Telegram" })).toHaveAttribute(
      "href",
      "https://t.me/olena_k_demo",
    );
  });

  it("links from the selected client card to prefilled appointment creation", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("link", { name: "Записать клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359873334411&action=create",
    );
  });

  it("shows the next calendar appointment in the selected client card", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T09:00:00.000Z"));

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAppointment = within(card).getByLabelText("Ближайшая запись клиента");

    expect(within(nextAppointment).getByRole("heading", { name: "Ближайшая запись" })).toBeInTheDocument();
    expect(within(nextAppointment).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(nextAppointment).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(nextAppointment).getByText("Уточнить шею и плечи перед началом сеанса.")).toBeInTheDocument();
    expect(within(nextAppointment).getByRole("link", { name: "Открыть запись" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=client-359873334411&appointment=demo-3",
    );
  });

  it("summarizes the selected client working profile with related records", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T09:00:00.000Z"));

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const profile = within(card).getByLabelText("Рабочий профиль клиента");

    expect(within(profile).getByRole("heading", { name: "Рабочий профиль" })).toBeInTheDocument();
    expect(within(profile).getByText("Последний завершенный визит")).toBeInTheDocument();
    expect(within(profile).getByText("24 июня, 18:30")).toBeInTheDocument();
    expect(within(profile).getByText("Ближайшая запись")).toBeInTheDocument();
    expect(within(profile).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(profile).getByText("Активный сертификат")).toBeInTheDocument();
    expect(within(profile).getByText("MMN-2407-1023 · 250 €")).toBeInTheDocument();
    expect(within(profile).getByText(/вечерние слоты и сильное давление/)).toBeInTheDocument();
    expect(within(profile).getByRole("link", { name: "Открыть ближайшую запись" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=client-359873334411&appointment=demo-3",
    );
    expect(within(profile).getByRole("link", { name: "Открыть активный сертификат" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
    expect(within(profile).getByRole("link", { name: "Все записи клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359873334411",
    );
    expect(within(profile).getByRole("link", { name: "Все сертификаты клиента" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&client=client-359873334411",
    );
  });

  it("highlights the next operational client action", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAction = within(card).getByLabelText("Следующее действие клиента");

    expect(within(nextAction).getByRole("heading", { name: "Подготовить PDF сертификата" })).toBeInTheDocument();
    expect(within(nextAction).getByText("MMN-2407-1023 · 250 €")).toBeInTheDocument();
    expect(within(nextAction).getByText("Ожидает PDF")).toBeInTheDocument();
    expect(within(nextAction).getByRole("link", { name: "Открыть сертификат" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );
  });

  it("offers appointment creation when the selected client has no upcoming appointment", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Maria Georgieva" />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAction = within(card).getByLabelText("Следующее действие клиента");

    expect(within(nextAction).getByRole("heading", { name: "Записать клиента" })).toBeInTheDocument();
    expect(within(nextAction).getByText("В календаре нет будущей записи для этого клиента.")).toBeInTheDocument();
    expect(within(nextAction).getByRole("link", { name: "Создать запись" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359895550099&action=create",
    );
  });

  it("shows the real next appointment in the client table instead of a stale stored label", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T04:00:00.000Z"));

    render(
      <AdminShell
        activeSection="clients"
        initialData={{
          financeRows: [],
          records: {
            appointments: [
              {
                client: "Andrey Kuruohlu",
                clientId: "client-andrey",
                date: "2026-07-20",
                id: "appointment-andrey-completed",
                note: "",
                service: "Классический массаж",
                status: "Завершена",
                time: "11:00",
              },
              {
                client: "Andrey Kuruohlu",
                clientId: "client-andrey",
                date: "2026-07-25",
                id: "appointment-andrey-completed-latest",
                note: "",
                service: "Классический массаж",
                status: "Завершена",
                time: "12:00",
              },
              {
                client: "Andrey Kuruohlu",
                clientId: "client-andrey",
                date: "2026-07-29",
                id: "appointment-andrey",
                note: "",
                service: "Классический массаж",
                status: "Подтверждена",
                time: "10:00",
              },
            ],
            certificates: [],
            clients: [
              {
                email: "andrey@example.com",
                history: [],
                id: "client-andrey",
                language: "ru",
                name: "Andrey Kuruohlu",
                next: "Not scheduled",
                note: "",
                phone: "0877888457",
                preferredContact: "Telegram",
                status: "new",
                tags: [],
                telegram: "",
                totalSpend: "0 EUR",
                visits: 0,
              },
            ],
          },
          settings: blogVisibilitySettings,
          source: "supabase",
        }}
        role="administrator"
        selectedClientName="client-andrey"
      />,
    );

    const row = screen.getByRole("row", { name: /Andrey Kuruohlu/ });
    expect(within(row).getByText("29 июля, 10:00")).toBeInTheDocument();
    expect(within(row).queryByText("Not scheduled")).not.toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const nextAppointment = within(card).getByRole("region", { name: "Ближайшая запись клиента" });
    expect(within(nextAppointment).getByText("29 июля, 10:00")).toBeInTheDocument();
    const profile = within(card).getByRole("region", { name: "Рабочий профиль клиента" });
    expect(within(profile).getByText("2026-07-25 12:00")).toBeInTheDocument();
    expect(within(card).getAllByText("2026-07-20 11:00").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("2026-07-25 12:00").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("2026-07-29 10:00").length).toBeGreaterThan(0);
    expect(within(card).getAllByRole("link", { name: "Открыть запись" }).length).toBeGreaterThan(0);
  });

  it("filters the selected client working activity feed", async () => {
    const user = userEvent.setup();

    const { rerender } = render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    const feed = within(card).getByLabelText("Рабочая лента клиента");

    expect(within(feed).getByRole("heading", { name: "Рабочая лента" })).toBeInTheDocument();
    expect(within(feed).getByText("8 июля, 15:00")).toBeInTheDocument();
    expect(within(feed).getByText("MMN-2407-1023")).toBeInTheDocument();
    expect(within(feed).getByText(/Предпочитает вечерние слоты/)).toBeInTheDocument();
    expect(within(feed).getByRole("link", { name: "Открыть запись 8 июля, 15:00" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&date=2026-07-08&client=client-359873334411&appointment=demo-3",
    );
    expect(within(feed).getByRole("link", { name: "Открыть сертификат MMN-2407-1023" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1023",
    );

    await user.click(within(feed).getByRole("button", { name: "Сертификаты" }));

    expect(within(feed).getByText("MMN-2407-1023")).toBeInTheDocument();
    expect(within(feed).queryByText("8 июля, 15:00")).not.toBeInTheDocument();
    expect(within(feed).queryByText(/Предпочитает вечерние слоты/)).not.toBeInTheDocument();

    await user.click(within(feed).getByRole("button", { name: "Заметки" }));

    expect(within(feed).getByText(/Предпочитает вечерние слоты/)).toBeInTheDocument();
    expect(within(feed).queryByText("MMN-2407-1023")).not.toBeInTheDocument();

    rerender(<AdminShell activeSection="clients" role="owner" selectedClientName="Maria Georgieva" />);

    const updatedFeed = within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByLabelText("Рабочая лента клиента");
    await waitFor(() => expect(within(updatedFeed).getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true"));
    expect(within(updatedFeed).getByText("2 июля, 14:00")).toBeInTheDocument();
    expect(within(updatedFeed).getByText("MMN-2407-1022")).toBeInTheDocument();
  });

  it("opens the calendar scoped to the selected client", () => {
    render(
      <AdminShell
        activeSection="calendar"
        role="owner"
        selectedCalendarDate="2026-07-08"
        selectedClientName="Olena K."
      />,
    );

    const context = screen.getByLabelText("Фильтр календаря по клиенту");
    expect(within(context).getByText("Показаны записи клиента Olena K.")).toBeInTheDocument();
    expect(within(context).getByRole("link", { name: "Сбросить фильтр" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner",
    );
    expect(within(context).getByRole("link", { name: "Открыть карточку клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
    expect(screen.getByRole("heading", { name: "8 июля" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Olena K.*Deep tissue massage/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Анна Петрова/ })).not.toBeInTheDocument();
  });

  it("opens the certificate workspace scoped to the selected client", () => {
    render(<AdminShell activeSection="certificates" role="owner" selectedClientName="Olena K." />);

    const context = screen.getByLabelText("Фильтр сертификатов по клиенту");
    const table = screen.getByRole("table");
    expect(within(context).getByText("Показаны сертификаты клиента Olena K.")).toBeInTheDocument();
    expect(within(context).getByRole("link", { name: "Сбросить фильтр" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner",
    );
    expect(within(context).getByRole("link", { name: "Открыть карточку клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
    expect(within(table).getByRole("row", { name: /MMN-2407-1023/ })).toBeInTheDocument();
    expect(within(table).queryByRole("row", { name: /MMN-2407-1021/ })).not.toBeInTheDocument();
  });

  it("issues a prefilled certificate from the selected client card", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(within(card).getByRole("button", { name: "Выдать сертификат" }));

    const dialog = screen.getByRole("dialog", { name: "Новый сертификат" });
    expect(within(dialog).getByLabelText("Код")).toHaveValue("MMN-2407-1024");
    expect(within(dialog).getByLabelText("Покупатель")).toHaveValue("Olena K.");
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
    expect(within(dialog).getByLabelText("Получатель")).toHaveValue("Olena K.");
    expect(within(dialog).getByLabelText("Заметка")).toHaveValue("Выдано из карточки клиента Olena K.");

    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "95 €" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить сертификат" }));

    expect(screen.queryByRole("dialog", { name: "Новый сертификат" })).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "MMN-2407-1024" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1024",
    );
    expect(within(card).getByText("95 €")).toBeInTheDocument();
    expect(within(card).getAllByText("Оплачено").length).toBeGreaterThan(0);
  });

  it("edits and saves the selected client note", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    await user.click(within(card).getByRole("button", { name: "Редактировать заметку" }));

    const noteEditor = within(card).getByLabelText("Заметка клиента");
    await user.clear(noteEditor);
    await user.type(noteEditor, "Клиентка просит напоминать за 2 часа и готовит плечи к deep tissue.");
    await user.click(within(card).getByRole("button", { name: "Сохранить заметку" }));

    expect(within(card).getByRole("status")).toHaveTextContent("Заметка сохранена.");
    expect(within(card).getAllByText(/напоминать за 2 часа/).length).toBeGreaterThan(0);
    expect(within(card).queryByLabelText("Заметка клиента")).not.toBeInTheDocument();
  }, 15_000);

  it("creates a client from the client primary action and opens its card", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });
    fireEvent.change(within(dialog).getByLabelText("Имя"), { target: { value: "Ирина Тестова" } });
    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 88 777 1122" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "irina@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Язык"), { target: { value: "bg" } });
    fireEvent.change(within(dialog).getByLabelText("Канал связи"), { target: { value: "Telegram" } });
    fireEvent.change(within(dialog).getByLabelText("Статус"), { target: { value: "Новый клиент" } });
    fireEvent.change(within(dialog).getByLabelText("Telegram"), { target: { value: "https://t.me/irina_demo" } });
    fireEvent.change(within(dialog).getByLabelText("Следующий визит"), { target: { value: "Не назначен" } });
    fireEvent.change(within(dialog).getByLabelText("Визиты"), { target: { value: "0" } });
    fireEvent.change(within(dialog).getByLabelText("Сумма"), { target: { value: "0 €" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Добавить заметку" }));
    fireEvent.change(within(dialog).getByLabelText("Заметка клиента"), { target: { value: "Новая клиентка, предпочитает дневные слоты." } });
    fireEvent.change(within(dialog).getByLabelText("Теги"), { target: { value: "BG, new" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(screen.queryByRole("dialog", { name: "Новый клиент" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Ирина Тестова" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359887771122",
    );

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(card).getByText("+359 88 777 1122")).toBeInTheDocument();
    expect(within(card).getByText("irina@example.com")).toBeInTheDocument();
    expect(within(card).getByText("BG · Новый клиент")).toBeInTheDocument();
    expect(within(card).getAllByText(/предпочитает дневные слоты/).length).toBeGreaterThan(0);
    expect(within(card).getByText("new")).toBeInTheDocument();
  });

  it("posts saved clients when the admin shell is backed by Supabase", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="clients"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [
              {
                email: "existing@example.com",
                history: [],
                id: "client-existing",
                language: "en",
                name: "Existing Client",
                next: "Not scheduled",
                note: "",
                phone: "+359 88 000 0000",
                preferredContact: "Email",
                status: "Новый клиент",
                tags: ["EN"],
                telegram: "",
                totalSpend: "0 €",
                visits: 0,
              },
            ],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });
    fireEvent.change(within(dialog).getByLabelText("Имя"), { target: { value: "Irina Persist" } });
    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 88 777 1122" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "irina.persist@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/records");
    expect(requestInit).toMatchObject({
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        email: "irina.persist@example.com",
        id: "client-359887771122",
        name: "Irina Persist",
        phone: "+359 88 777 1122",
      },
      type: "client",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Изменение сохранено в Supabase.");
  });

  it("validates required client fields before saving", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));
    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });

    expect(within(dialog).getByRole("group", { name: "Контакты клиента" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Профиль клиента" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Заметки и теги" })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Заметка клиента")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Добавить заметку" })).toBeInTheDocument();
    expect(within(dialog).getByText("Имя и телефон нужны для записи и связи с клиентом.")).toBeInTheDocument();
    expect(within(dialog).getByText("Статус выбирается вручную и не скрывает клиента из базы.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Укажите имя и телефон клиента.");
    expect(within(dialog).getByText("Укажите имя клиента.")).toBeInTheDocument();
    expect(within(dialog).getByText("Укажите телефон клиента.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Имя")).toHaveFocus();
    expect(within(dialog).getByLabelText("Имя")).toHaveAttribute("aria-describedby", expect.stringContaining("client-name-error"));
    expect(within(dialog).getByLabelText("Телефон")).toHaveAttribute("aria-describedby", expect.stringContaining("client-phone-error"));
    expect(within(screen.getByRole("table")).queryByRole("button", { name: "" })).not.toBeInTheDocument();
  });

  it("keeps the create client form open when the phone matches an existing client", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });
    fireEvent.change(within(dialog).getByLabelText("Имя"), { target: { value: "Новая Olena" } });
    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359873334411" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Клиент с таким телефоном уже есть: Olena K.");
    const existingClientLink = within(dialog).getByRole("link", { name: "Открыть карточку существующего клиента" });
    expect(existingClientLink).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
    fireEvent.click(existingClientLink);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Новый клиент" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Карточка клиента" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByRole("link", { name: "Новая Olena" })).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("allows a new client with the same name when the phone is different", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Новый клиент" });
    fireEvent.change(within(dialog).getByLabelText("Имя"), { target: { value: "Olena K." } });
    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 88 777 1122" } });

    expect(within(dialog).getByRole("status")).toHaveTextContent("Имя уже есть в базе: Olena K.");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Если телефон другой, можно сохранить нового клиента.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить клиента" }));

    expect(screen.queryByRole("dialog", { name: "Новый клиент" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Olena K." })).toHaveLength(2);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(card).getByText("+359 88 777 1122")).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Записать клиента" })).toBeInTheDocument();
    expect(within(card).queryByText("MMN-2407-1023")).not.toBeInTheDocument();
    expect(within(card).queryByText("Deep tissue massage")).not.toBeInTheDocument();
  });

  it("keeps issued certificates attached to the exact same-name client", () => {
    render(<AdminShell activeSection="clients" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить клиента" }));

    const clientDialog = screen.getByRole("dialog", { name: "Новый клиент" });
    fireEvent.change(within(clientDialog).getByLabelText("Имя"), { target: { value: "Olena K." } });
    fireEvent.change(within(clientDialog).getByLabelText("Телефон"), { target: { value: "+359 88 777 1122" } });
    fireEvent.click(within(clientDialog).getByRole("button", { name: "Сохранить клиента" }));

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(card).getByText("+359 88 777 1122")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Выдать сертификат" }));

    const certificateDialog = screen.getByRole("dialog", { name: "Новый сертификат" });
    expect(within(certificateDialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
    fireEvent.change(within(certificateDialog).getByLabelText("Сумма"), { target: { value: "95 €" } });
    fireEvent.click(within(certificateDialog).getByRole("button", { name: "Сохранить сертификат" }));

    expect(screen.queryByRole("dialog", { name: "Новый сертификат" })).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "MMN-2407-1024" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-2407-1024",
    );
    expect(within(card).getByText("95 €")).toBeInTheDocument();
    expect(within(card).queryByText("MMN-2407-1023")).not.toBeInTheDocument();
  });

  it("edits an existing client from the right drawer without creating a duplicate", () => {
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);

    const card = screen.getByRole("dialog", { name: "Карточка клиента" });
    fireEvent.click(within(card).getByRole("button", { name: "Редактировать клиента" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать клиента" });
    expect(within(dialog).getByLabelText("Имя")).toHaveValue("Olena K.");

    fireEvent.change(within(dialog).getByLabelText("Телефон"), { target: { value: "+359 87 333 4499" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "olena.updated@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Канал связи"), { target: { value: "Email" } });
    fireEvent.change(within(dialog).getByLabelText("Заметка клиента"), { target: { value: "Обновленная заметка из формы клиента." } });
    fireEvent.change(within(dialog).getByLabelText("Теги"), { target: { value: "UA, вечер, email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать клиента" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("link", { name: "Olena K." })).toHaveLength(1);
    const updatedCard = screen.getByRole("dialog", { name: "Карточка клиента" });
    expect(within(updatedCard).getByText("+359 87 333 4499")).toBeInTheDocument();
    expect(within(updatedCard).getByText("olena.updated@example.com")).toBeInTheDocument();
    expect(within(updatedCard).getAllByText("Email").length).toBeGreaterThan(0);
    expect(within(updatedCard).getAllByText(/Обновленная заметка/).length).toBeGreaterThan(0);
    expect(within(updatedCard).getByText("email")).toBeInTheDocument();
  });

  it("opens selected appointment details in a right drawer", async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminShell activeSection="calendar" role="owner" />);

    expect(container.querySelector(".admin-calendar-workspace")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Детали выбранной записи" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    const details = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    expect(details).toHaveClass("admin-drawer-panel");
    expect(within(details).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(details).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(details).getByText(/Уточнить шею и плечи/)).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Закрыть" }));

    expect(screen.queryByRole("dialog", { name: "Детали выбранной записи" })).not.toBeInTheDocument();
  });

  it("opens route-focused appointment details from the appointment query", () => {
    render(
      <AdminShell
        activeSection="calendar"
        role="owner"
        selectedAppointmentKey="demo-3"
        selectedCalendarDate="2026-07-08"
        selectedClientName="Olena K."
      />,
    );

    expect(screen.getByRole("heading", { name: "8 июля" })).toBeInTheDocument();
    expect(screen.getByLabelText("Фильтр календаря по клиенту")).toHaveTextContent("Показаны записи клиента Olena K.");
    const details = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    expect(within(details).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(details).getByText("Deep tissue massage")).toBeInTheDocument();
    expect(within(details).getByText(/15:00/)).toBeInTheDocument();
  });

  it("links from a calendar appointment to the matching client card", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    expect(
      within(screen.getByLabelText("Детали выбранной записи")).getByRole("link", { name: "Открыть клиента" }),
    ).toHaveAttribute("href", "/admin?section=clients&role=owner&client=client-359873334411");
    const linkedActions = within(screen.getByLabelText("Детали выбранной записи")).getByLabelText("Связанные действия клиента");
    expect(within(linkedActions).getByRole("link", { name: "Карточка клиента" })).toHaveAttribute(
      "href",
      "/admin?section=clients&role=owner&client=client-359873334411",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все записи клиента" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359873334411",
    );
    expect(within(linkedActions).getByRole("link", { name: "Все сертификаты клиента" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&client=client-359873334411",
    );
    expect(within(linkedActions).getByRole("link", { name: "Записать снова" })).toHaveAttribute(
      "href",
      "/admin?section=calendar&role=owner&client=client-359873334411&action=create",
    );
  });

  it("switches the calendar to a month view with selectable days", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-06" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));

    expect(screen.getByRole("heading", { name: /Июль 2026/ })).toBeInTheDocument();
    const monthGrid = screen.getByRole("grid", { name: /Месяц Июль 2026/ });
    expect(monthGrid).toBeInTheDocument();
    expect(within(monthGrid).queryByText("Классический массаж")).not.toBeInTheDocument();
    expect(within(monthGrid).getByText("2 записи")).toBeInTheDocument();
    expect(within(monthGrid).getAllByText("6 свободных слотов").length).toBeGreaterThan(0);
    expect(within(monthGrid).getAllByText("2 зап.").length).toBeGreaterThan(0);
    expect(within(monthGrid).getAllByText("6 св.").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /6 июля.*2 записи/ }));

    expect(screen.getByRole("heading", { name: "6 июля" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "День" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Анна Петрова/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Мария Иванова/ })).toBeInTheDocument();
  });

  it("shows a real weekly calendar view", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-06" />);

    await user.click(screen.getByRole("button", { name: "Неделя" }));

    const weekGrid = screen.getByLabelText(/Неделя 6 июл.*12 июл/);
    expect(screen.getByRole("heading", { name: /6 июл.*12 июл/ })).toBeInTheDocument();
    expect(within(weekGrid).getByText(/6 июл/)).toBeInTheDocument();
    expect(within(weekGrid).getByText(/10 июл/)).toBeInTheDocument();
    expect(within(weekGrid).getByText("Анна Петрова")).toBeInTheDocument();
    expect(within(weekGrid).getByText("SPA процедура")).toBeInTheDocument();
    expect(weekGrid.querySelector(".admin-week-time-columns")).toBeInTheDocument();
    expect(within(weekGrid).getByText("Анна Петрова").closest(".admin-timed-appointment")).toBeInTheDocument();
  });

  it("shows an empty state when a month day has no appointments", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-06" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    await user.click(screen.getByRole("button", { name: /^7 июля.*0 записей/ }));

    expect(screen.getByRole("heading", { name: "7 июля" })).toBeInTheDocument();
    expect(screen.getByText("Записи не найдены.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Детали выбранной записи" })).not.toBeInTheDocument();
    expect(screen.queryByText("Анна Петрова")).not.toBeInTheDocument();
  });

  it("keeps day mode focused on one day and list mode on all appointments", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-06" />);

    expect(screen.getByRole("heading", { name: "6 июля" })).toBeInTheDocument();
    const daySchedule = screen.getByLabelText("Расписание 6 июля");
    expect(daySchedule.parentElement).toHaveClass("admin-day-time-grid");
    expect(screen.queryByLabelText("Сводка дня 6 июля")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Olena K./ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Список" }));

    expect(screen.getByRole("heading", { name: "Список записей" })).toBeInTheDocument();
    expect(screen.getByLabelText("Лента всех записей")).toHaveClass("admin-appointment-feed");
    expect(screen.getByText("Всего записей")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Olena K./ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Расписание 6 июля")).not.toBeInTheDocument();
  });

  it("opens the calendar on the selected date from the date query", () => {
    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-10" />);

    expect(screen.getByRole("heading", { name: "10 июля" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "День" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Светлана/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Анна Петрова/ })).not.toBeInTheDocument();
  });

  it("prefills appointment creation with the calendar date query", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-10" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Дата")).toHaveValue("2026-07-10");
  });

  it("prefills appointment creation with the day selected in month view", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-06" />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    await user.click(screen.getByRole("button", { name: /^7 июля.*0 записей/ }));
    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Дата")).toHaveValue("2026-07-07");
  });

  it("opens a quick action panel from the primary action", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="finances" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Выгрузить отчет" }));

    const dialog = screen.getByRole("dialog", { name: "Быстрое действие" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Выгрузить отчет")).toBeInTheDocument();
  });

  it("creates a calendar appointment from the primary action", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "Ирина Тестова");
    await user.selectOptions(within(dialog).getByLabelText("Услуга"), "SPA процедура");
    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.type(within(dialog).getByLabelText("Дата"), "2026-07-12");
    await user.clear(within(dialog).getByLabelText("Время"));
    await user.type(within(dialog).getByLabelText("Время"), "11:15");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Подтверждена");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();
    const createdDetails = screen.getByRole("dialog", { name: "Детали выбранной записи" });
    expect(within(createdDetails).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    await user.click(within(createdDetails).getByRole("button", { name: "Закрыть" }));

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Ирина Тестова/ }));

    expect(screen.getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Детали выбранной записи")).getByText("SPA процедура")).toBeInTheDocument();
  });

  it("selects a newly created appointment immediately after saving", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "Ирина Тестова");
    await user.selectOptions(within(dialog).getByLabelText("Услуга"), "SPA процедура");
    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.type(within(dialog).getByLabelText("Дата"), "2026-07-12");
    await user.clear(within(dialog).getByLabelText("Время"));
    await user.type(within(dialog).getByLabelText("Время"), "11:15");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Подтверждена");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    const details = screen.getByLabelText("Детали выбранной записи");
    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "12 июля" })).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Ирина Тестова" })).toBeInTheDocument();
    expect(within(details).getByText("SPA процедура")).toBeInTheDocument();
    expect(within(details).getByText(/11:15/)).toBeInTheDocument();
  });

  it("opens primary appointment creation with an empty client after a prefilled dialog was closed", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />);

    await user.click(within(screen.getByRole("dialog", { name: "Новая запись" })).getByRole("button", { name: "Закрыть" }));
    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("");
  });

  it("filters existing clients while creating an appointment", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "ole");

    const suggestions = within(dialog).getByRole("listbox", { name: "Найденные клиенты" });
    expect(within(suggestions).getByRole("option", { name: /Olena K./ })).toBeInTheDocument();
    expect(within(suggestions).queryByRole("option", { name: /Анна Петрова/ })).not.toBeInTheDocument();

    await user.click(within(suggestions).getByRole("option", { name: /Olena K./ }));

    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
  });

  it("opens a prefilled calendar appointment dialog from the action query", () => {
    render(<AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />);

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
  });

  it("reopens the prefilled appointment dialog after leaving and returning to the action link", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />,
    );

    await user.click(within(screen.getByRole("dialog", { name: "Новая запись" })).getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByRole("dialog", { name: "Новая запись" })).not.toBeInTheDocument();

    rerender(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);
    const calendarCreateLink = within(screen.getByRole("dialog", { name: "Карточка клиента" })).getByRole("link", {
      name: "Записать клиента",
    });
    calendarCreateLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(calendarCreateLink);
    rerender(<AdminShell activeSection="calendar" calendarAction="create" role="owner" selectedClientName="Olena K." />);

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");
  });

  it("keeps the calendar appointment dialog open when required fields are missing", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Создать запись" }));

    const dialog = screen.getByRole("dialog", { name: "Новая запись" });
    await user.type(within(dialog).getByLabelText("Клиент"), "Ирина Тестова");
    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.click(within(dialog).getByRole("button", { name: "Сохранить запись" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Укажите клиента, специалиста, дату и время.");
    expect(screen.getByRole("dialog", { name: "Новая запись" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ирина Тестова/ })).not.toBeInTheDocument();
  });

  it("edits and reschedules the selected calendar appointment", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));
    await user.click(within(screen.getByLabelText("Детали выбранной записи")).getByRole("button", { name: "Редактировать" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать запись" });
    expect(within(dialog).getByLabelText("Клиент")).toHaveValue("Olena K.");

    await user.clear(within(dialog).getByLabelText("Дата"));
    await user.type(within(dialog).getByLabelText("Дата"), "2026-07-13");
    await user.clear(within(dialog).getByLabelText("Время"));
    await user.type(within(dialog).getByLabelText("Время"), "16:45");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Ожидает");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    const details = screen.getByLabelText("Детали выбранной записи");
    expect(screen.queryByRole("dialog", { name: "Редактировать запись" })).not.toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Olena K." })).toBeInTheDocument();
    expect(within(details).getByText("13 июля")).toBeInTheDocument();
    expect(within(details).getByText(/16:45 · 60 мин/)).toBeInTheDocument();
    expect(within(details).getByText("Ожидает")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /15:00Olena K./ })).not.toBeInTheDocument();
  });

  it("cancels the selected calendar appointment after confirmation", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));

    const details = screen.getByLabelText("Детали выбранной записи");
    await user.click(within(details).getByRole("button", { name: "Отменить запись" }));

    const firstDialog = screen.getByRole("dialog", { name: "Отменить запись" });
    expect(within(firstDialog).getByText("Olena K.")).toBeInTheDocument();
    await user.click(within(firstDialog).getByRole("button", { name: "Оставить запись" }));

    expect(screen.queryByRole("dialog", { name: "Отменить запись" })).not.toBeInTheDocument();
    expect(within(details).getByText("Подтверждена")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Отменить запись" }));
    const confirmationDialog = screen.getByRole("dialog", { name: "Отменить запись" });
    await user.click(within(confirmationDialog).getByRole("button", { name: "Отменить запись" }));

    const updatedDetails = screen.getByLabelText("Детали выбранной записи");
    const cancelledAppointment = screen.getByRole("button", { name: /Olena K./ });
    expect(screen.queryByRole("dialog", { name: "Отменить запись" })).not.toBeInTheDocument();
    expect(within(updatedDetails).getByText("Отменена")).toBeInTheDocument();
    expect(within(cancelledAppointment).getByText("Отменена")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "День" }));
    expect(screen.queryByRole("button", { name: /Olena K./ })).not.toBeInTheDocument();
  });

  it("permanently deletes a calendar appointment only after a separate confirmation", async () => {
    const user = userEvent.setup();
    render(<AdminShell activeSection="calendar" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Список" }));
    await user.click(screen.getByRole("button", { name: /Olena K./ }));
    const details = screen.getByLabelText("Детали выбранной записи");
    await user.click(within(details).getByRole("button", { name: "Удалить запись" }));

    const dialog = screen.getByRole("alertdialog", { name: "Удалить запись?" });
    expect(within(dialog).getByText(/Это не отмена/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Удалить запись" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Удалить запись?" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Olena K./ })).not.toBeInTheDocument();
  });

  it("blocks client deletion while calendar records are still linked", async () => {
    const user = userEvent.setup();
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Olena K." />);
    const details = screen.getByRole("dialog", { name: "Карточка клиента" });

    await user.click(within(details).getByRole("button", { name: "Удалить клиента" }));
    const dialog = screen.getByRole("alertdialog", { name: "Удалить клиента?" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Сначала удалите их из календаря/);
    expect(within(dialog).queryByRole("button", { name: "Удалить клиента" })).not.toBeInTheDocument();
  });

  it("requires the exact name before deleting a client without calendar records", async () => {
    const user = userEvent.setup();
    render(<AdminShell activeSection="clients" role="owner" selectedClientName="Maria Georgieva" />);
    const details = screen.getByRole("dialog", { name: "Карточка клиента" });
    await user.click(within(details).getByRole("button", { name: "Удалить клиента" }));

    const dialog = screen.getByRole("alertdialog", { name: "Удалить клиента?" });
    const confirm = within(dialog).getByRole("button", { name: "Удалить клиента" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Maria Georgieva");
    await user.click(confirm);

    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Удалить клиента?" })).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Maria Georgieva" })).not.toBeInTheDocument();
  });

  it("acknowledges CSV exports in the accountant finance workspace", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      new Response('"date"\r\n"2026-07-01"', {
        headers: {
          "content-disposition": 'attachment; filename="magic-massage-stripe-sales.csv"',
          "content-type": "text/csv",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminShell activeSection="finances" role="accountant" />);

    await user.click(screen.getByRole("button", { name: "CSV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/finance/export",
      expect.objectContaining({
        body: JSON.stringify({
          format: "csv",
          periodEnd: "2026-07-03",
          periodStart: "2026-07-01",
        }),
      }),
    );
    expect(screen.getByText("CSV отчет за 2026-07-01 - 2026-07-03 готов к скачиванию.")).toBeInTheDocument();
  });

  it("filters accountant Stripe rows by selected period", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      new Response('"date"\r\n"2026-07-02"', {
        headers: {
          "content-disposition": 'attachment; filename="magic-massage-stripe-sales.csv"',
          "content-type": "text/csv",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminShell activeSection="finances" role="accountant" />);

    await user.clear(screen.getByLabelText("Начало периода"));
    await user.type(screen.getByLabelText("Начало периода"), "2026-07-02");
    await user.clear(screen.getByLabelText("Конец периода"));
    await user.type(screen.getByLabelText("Конец периода"), "2026-07-02");

    const summary = screen.getByLabelText("Finance summary");
    expect(within(summary).getByText("180,00 €")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();

    expect(screen.getByText("pi_3QMMN1022")).toBeInTheDocument();
    expect(screen.queryByText("pi_3QMMN1021")).not.toBeInTheDocument();
    expect(screen.queryByText("pi_3QMMN1023")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "CSV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/finance/export",
      expect.objectContaining({
        body: JSON.stringify({
          format: "csv",
          periodEnd: "2026-07-02",
          periodStart: "2026-07-02",
        }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("CSV отчет за 2026-07-02 - 2026-07-02 готов к скачиванию.");
  });

  it("edits public contact settings from the contacts workspace", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="contacts" role="owner" />);

    expect(screen.getByRole("heading", { name: "Контактные настройки сайта" })).toBeInTheDocument();
    const phoneLink = within(screen.getByRole("table")).getByRole("link", { name: "Телефон салона" });
    phoneLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(phoneLink);
    const details = screen.getByRole("dialog", { name: "Детали контакта" });
    expect(details).toHaveTextContent("Телефон салона");

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Контактные настройки" });
    await user.clear(within(dialog).getByLabelText("Телефон"));
    await user.type(within(dialog).getByLabelText("Телефон"), "+359 87 555 0000");
    await user.clear(within(dialog).getByLabelText("Адрес"));
    await user.type(within(dialog).getByLabelText("Адрес"), "ул. Места 49, Бургас");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить контакты" }));

    expect(screen.queryByRole("dialog", { name: "Контактные настройки" })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Контактные настройки")).getByText("+359 87 555 0000")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Контактные настройки")).getByText("ул. Места 49, Бургас")).toBeInTheDocument();
    expect(within(details).getByText("+359 87 555 0000")).toBeInTheDocument();
  });

  it("filters contact channels and edits the selected channel", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="contacts" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Мессенджеры" }));

    const table = screen.getByRole("table");
    expect(screen.getByRole("button", { name: "Мессенджеры" })).toHaveAttribute("aria-pressed", "true");
    const telegramLink = within(table).getByRole("link", { name: "Telegram" });
    expect(telegramLink).toHaveAttribute("href", "/admin?section=contacts&role=owner&contact=contact-telegram");
    expect(within(table).queryByRole("link", { name: "Google Maps" })).not.toBeInTheDocument();

    telegramLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(telegramLink);
    const details = screen.getByLabelText("Детали контакта");
    expect(within(details).getByRole("heading", { name: "Telegram" })).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Редактировать" }));

    const dialog = screen.getByRole("dialog", { name: "Редактировать контакт" });
    await user.clear(within(dialog).getByLabelText("Значение"));
    await user.type(within(dialog).getByLabelText("Значение"), "https://t.me/magicmassage_burgas");
    await user.selectOptions(within(dialog).getByLabelText("Статус"), "Активен");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить изменения" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать контакт" })).not.toBeInTheDocument();
    expect(within(details).getByText("https://t.me/magicmassage_burgas")).toBeInTheDocument();
    expect(within(details).getByText("Активен")).toBeInTheDocument();
  });

  it("opens the full-page blog editor and edits an existing article", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="blog" role="owner" />);

    expect(screen.getByRole("heading", { name: "Контент-план блога" })).toBeInTheDocument();
    const firstPostLink = within(screen.getByRole("table")).getByRole("link", { name: "Подготовка к первому массажу" });
    expect(firstPostLink).toHaveAttribute("href", "/admin?section=blog&role=owner&blog=blog-first-massage-preparation");
    firstPostLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(firstPostLink);
    expect(screen.getByRole("dialog", { name: "Детали статьи" })).toHaveTextContent("Подготовка к первому массажу");

    await user.click(screen.getByRole("button", { name: "Новая статья" }));

    const createEditor = screen.getByRole("form", { name: "Редактор статьи" });
    expect(createEditor).toHaveClass("admin-blog-editor-page");
    expect(within(createEditor).getByRole("heading", { name: "Новая статья" })).toBeInTheDocument();
    await user.click(within(createEditor).getByRole("button", { name: "К списку" }));

    expect(screen.queryByRole("form", { name: "Редактор статьи" })).not.toBeInTheDocument();
    const details = screen.getByLabelText("Детали статьи");
    expect(within(details).getByRole("heading", { name: "Подготовка к первому массажу" })).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editEditor = screen.getByRole("form", { name: "Редактор статьи" });
    expect(within(editEditor).getByRole("textbox", { name: "Текст статьи" })).toHaveTextContent(
      "Короткая памятка помогает клиенту подготовиться к первому визиту, прийти вовремя и заранее выбрать комфортную одежду.",
    );
    fireEvent.change(within(editEditor).getByLabelText("Статус"), { target: { value: "review" } });
    fireEvent.change(within(editEditor).getByLabelText("Краткое описание"), {
      target: { value: "Обновленная памятка перед визитом." },
    });
    fireEvent.change(within(editEditor).getByLabelText("SEO-описание"), {
      target: { value: "Отдельное SEO-описание после редактирования." },
    });
    await user.click(within(editEditor).getByRole("button", { name: "Сохранить RU" }));

    expect(screen.getByRole("form", { name: "Редактор статьи" })).toBeInTheDocument();
    await user.click(within(editEditor).getByRole("button", { name: "К списку" }));
    expect(screen.queryByRole("form", { name: "Редактор статьи" })).not.toBeInTheDocument();
    const updatedDetails = screen.getByRole("dialog", { name: "Детали статьи" });
    expect(within(updatedDetails).getByText("На проверке")).toBeInTheDocument();
    expect(within(updatedDetails).getByText("Обновленная памятка перед визитом.")).toBeInTheDocument();
  });

  it("renders twelve locale rows as three articles and preserves drafts between language tabs", async () => {
    const user = userEvent.setup();
    const locales = ["bg", "ru", "ua", "en"] as const;
    const articleKeys = ["massage-guide", "first-visit", "desk-recovery"];
    const blogPosts = articleKeys.flatMap((translationKey) =>
      locales.map((locale) => ({
        author: "Natali",
        body: `<p>${locale} body for ${translationKey}</p>`,
        category: `${locale} category`,
        coverAlt: `${locale} cover`,
        coverImage: "/media/blog/first-massage-preparation.jpg",
        excerpt: `${locale} excerpt`,
        id: `blog-${translationKey}-${locale}`,
        locales: [locale],
        publishedAt: "2026-07-18",
        seoDescription: `${locale} SEO description`,
        seoTitle: `${locale} SEO title`,
        slug: `${translationKey}-${locale}`,
        status: "Опубликована" as const,
        tags: [locale],
        title: `${locale.toUpperCase()} ${translationKey}`,
        translationKey,
        updatedAt: "2026-07-18",
      })),
    );

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts,
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText(/3 опубликованных статей доступны посетителям/)).toBeInTheDocument();

    const articleLink = within(table).getByRole("link", { name: "RU massage-guide" });
    articleLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(articleLink);
    await user.click(within(screen.getByRole("dialog", { name: "Детали статьи" })).getByRole("button", { name: "Редактировать" }));

    let editor = screen.getByRole("form", { name: "Редактор статьи" });
    expect(within(editor).getByLabelText("Заголовок")).toHaveValue("RU massage-guide");
    await user.click(within(editor).getByRole("tab", { name: /English\. Опубликована/ }));
    editor = screen.getByRole("form", { name: "Редактор статьи" });
    expect(within(editor).getByLabelText("Заголовок")).toHaveValue("EN massage-guide");
    fireEvent.change(within(editor).getByLabelText("Заголовок"), { target: { value: "Edited English title" } });

    await user.click(within(editor).getByRole("tab", { name: /Русский\. Опубликована/ }));
    editor = screen.getByRole("form", { name: "Редактор статьи" });
    expect(within(editor).getByLabelText("Заголовок")).toHaveValue("RU massage-guide");
    await user.click(within(editor).getByRole("tab", { name: /English\. Опубликована/ }));
    expect(within(screen.getByRole("form", { name: "Редактор статьи" })).getByLabelText("Заголовок")).toHaveValue("Edited English title");
  });

  it("posts saved blog posts when the admin shell is backed by Supabase", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [
            {
              author: "Natali",
              body: "Исходный текст статьи.",
              category: "Советы",
              coverImage: "/media/blog/first-massage-preparation.jpg",
              excerpt: "Исходный анонс.",
              id: "blog-first-massage-preparation",
              locales: ["bg"],
              publishedAt: "2026-07-05",
              seoDescription: "Исходное SEO-описание.",
              seoTitle: "Подготовка к первому массажу в Бургасе",
              slug: "first-massage-preparation",
              status: "Черновик",
              tags: ["подготовка"],
              title: "Подготовка к первому массажу",
              translationKey: "first-massage-preparation",
              updatedAt: "2026-07-07",
            },
          ],
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    const postLink = within(screen.getByRole("table")).getByRole("link", { name: "Подготовка к первому массажу" });
    postLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(postLink);
    await user.click(within(screen.getByRole("dialog", { name: "Детали статьи" })).getByRole("button", { name: "Редактировать" }));

    const editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("SEO-описание"), {
      target: { value: "Обновленное SEO-описание." },
    });
    fireEvent.change(within(editor).getByLabelText("Краткое описание"), { target: { value: "Обновленный анонс." } });
    expect(within(editor).getByRole("button", { name: "Сохранить BG" })).toBeEnabled();
    fireEvent.submit(editor);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        author: "Natali",
        body: expect.stringContaining("Исходный текст статьи."),
        category: "Советы",
        coverImage: "/media/blog/first-massage-preparation.jpg",
        excerpt: "Обновленный анонс.",
        id: "blog-first-massage-preparation",
        locales: ["bg"],
        seoDescription: "Обновленное SEO-описание.",
        seoTitle: "Подготовка к первому массажу в Бургасе",
        slug: "first-massage-preparation",
        status: "Черновик",
        tags: ["подготовка"],
        title: "Подготовка к первому массажу",
        translationKey: "first-massage-preparation",
      },
      type: "blogPost",
    });
  });

  it("keeps one stable record identity while autosaving a new draft slug", async () => {
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [],
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Новая статья" }));
    let editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("Заголовок"), { target: { value: "Рабочий черновик" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    const firstPayload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(firstPayload.record.id).toMatch(/^blog-[0-9a-f-]{36}$/);
    expect(firstPayload.record.slug).toBe(`draft-${firstPayload.record.id.replace(/^blog-/, "")}`);

    editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("Slug"), { target: { value: "working-draft" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });

    const secondPayload = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(secondPayload.record.id).toBe(firstPayload.record.id);
    expect(secondPayload.record.slug).toBe("working-draft");
  }, 10_000);

  it("keeps newer local text when an older autosave response completes", async () => {
    let resolveRequest: (() => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = () => resolve(new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 }));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts: [],
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Новая статья" }));
    let editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("Заголовок"), { target: { value: "Первый снимок" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("Заголовок"), { target: { value: "Более свежий текст" } });
    resolveRequest?.();

    await waitFor(() =>
      expect(within(screen.getByRole("form", { name: "Редактор статьи" })).getByLabelText("Заголовок")).toHaveValue(
        "Более свежий текст",
      ),
    );
  }, 10_000);

  it("does not roll back a successfully saved locale when another locale save fails", async () => {
    const user = userEvent.setup();
    const responses: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          responses.push(resolve);
        }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", fetchMock);
    const blogPosts = (["ru", "en"] as const).map((locale) => ({
      author: "Natali",
      body: `<p>${locale} body</p>`,
      category: "Советы",
      coverImage: "/media/blog/first-massage-preparation.jpg",
      excerpt: `${locale} excerpt`,
      id: `blog-massage-guide-${locale}`,
      locales: [locale],
      publishedAt: "2026-07-18",
      seoDescription: `${locale} SEO description`,
      seoTitle: `${locale} SEO title`,
      slug: `massage-guide-${locale}`,
      status: "Черновик" as const,
      tags: [locale],
      title: `${locale.toUpperCase()} massage-guide`,
      translationKey: "massage-guide",
      updatedAt: "2026-07-18",
    }));

    render(
      <AdminShell
        activeSection="blog"
        initialData={{
          blogPosts,
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    const ruLink = within(screen.getByRole("table")).getByRole("link", {
      name: "RU massage-guide",
    });
    ruLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(ruLink);
    await user.click(
      within(screen.getByRole("dialog", { name: "Детали статьи" })).getByRole(
        "button",
        { name: "Редактировать" },
      ),
    );

    let editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("Заголовок"), {
      target: { value: "RU pending update" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    await user.click(within(editor).getByRole("tab", { name: /English/ }));
    editor = screen.getByRole("form", { name: "Редактор статьи" });
    fireEvent.change(within(editor).getByLabelText("Заголовок"), {
      target: { value: "EN saved update" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });

    await act(async () => {
      responses[1](
        new Response(JSON.stringify({ mode: "supabase", ok: true }), {
          status: 200,
        }),
      );
    });
    await waitFor(() =>
      expect(within(editor).getByRole("status")).toHaveTextContent(
        "Все изменения сохранены",
      ),
    );
    await act(async () => {
      responses[0](
        new Response(JSON.stringify({ error: "save failed" }), { status: 500 }),
      );
    });

    await user.click(within(editor).getByRole("button", { name: "К списку" }));
    const reopenedLink = within(screen.getByRole("table")).getByRole("link", {
      name: "RU massage-guide",
    });
    reopenedLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    await user.click(reopenedLink);
    await user.click(
      within(screen.getByRole("dialog", { name: "Детали статьи" })).getByRole(
        "button",
        { name: "Редактировать" },
      ),
    );
    editor = screen.getByRole("form", { name: "Редактор статьи" });
    await user.click(within(editor).getByRole("tab", { name: /English/ }));
    expect(
      within(screen.getByRole("form", { name: "Редактор статьи" })).getByLabelText(
        "Заголовок",
      ),
    ).toHaveValue("EN saved update");
    confirmSpy.mockRestore();
  }, 15_000);

  it("keeps blog write controls hidden from viewer roles", async () => {
    const user = userEvent.setup();
    render(<AdminShell activeSection="blog" role="viewer" />);

    expect(screen.queryByRole("button", { name: "Новая статья" })).not.toBeInTheDocument();
    const articleLink = within(screen.getByRole("table")).getByRole("link", { name: "Подготовка к первому массажу" });
    articleLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(articleLink);

    expect(within(screen.getByRole("dialog", { name: "Детали статьи" })).queryByRole("button", { name: "Редактировать" })).not.toBeInTheDocument();
  });

  it("filters blog posts by status and global search", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="blog" role="owner" />);

    const filters = screen.getByLabelText("Фильтры блога");
    const table = screen.getByRole("table");

    await user.click(within(filters).getByRole("button", { name: "Черновики" }));

    expect(within(filters).getByRole("button", { name: "Черновики" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("link", { name: "Лимфодренаж: когда он уместен" })).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Подготовка к первому массажу" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск" }), { target: { value: "сертификат" } });

    expect(within(table).queryByRole("link", { name: "Лимфодренаж: когда он уместен" })).not.toBeInTheDocument();

    await user.click(within(filters).getByRole("button", { name: "Запланированные" }));
    expect(within(table).getByRole("link", { name: "Подарочный сертификат без стресса" })).toHaveAttribute(
      "href",
      "/admin?section=blog&role=owner&blog=blog-gift-certificate",
    );
  });

  it("edits booking and Google Calendar settings from the settings workspace", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    expect(screen.getByRole("heading", { name: "Настройки админки" })).toBeInTheDocument();
    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    expect(bookingLink).toHaveAttribute("href", "/admin?section=settings&role=owner&settings=booking");
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(within(details).getByRole("heading", { name: "Запись и календарь" })).toBeInTheDocument();
    expect(within(details).getByText("30 минут")).toBeInTheDocument();
    expect(within(details).getByText("Внутренний календарь главный")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    expect(dialog).toHaveClass("admin-drawer-panel", "admin-settings-drawer");
    expect(dialog.querySelector("form")).toHaveClass("admin-drawer-form");
    expect(within(dialog).getByLabelText("Название бизнеса")).toHaveAttribute("autocomplete", "off");
    expect(within(dialog).getByLabelText("Google Calendar ID")).toHaveAttribute("autocomplete", "off");
    expect(within(dialog).getByLabelText("Проверенный отправитель")).toHaveTextContent("RESEND_FROM_EMAIL не настроен");
    expect(within(dialog).getByLabelText("Тип письма")).toHaveValue("booking_confirmed");
    expect(within(dialog).getByLabelText("Язык письма")).toHaveValue("ru");
    expect(await within(dialog).findByText(/admin-сессию/)).toBeVisible();
    expect(within(dialog).queryByText(/HTML и текстовые версии хранятся/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "15 минут" }));
    fireEvent.change(within(dialog).getByLabelText("Лимит онлайн-записей в день"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Google Calendar"), { target: { value: "Односторонняя" } });
    fireEvent.change(within(dialog).getByLabelText("Google Calendar ID"), { target: { value: "natali@example.com" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    expect(screen.queryByRole("dialog", { name: "Настройки админки" })).not.toBeInTheDocument();
    expect(within(details).getByText("15 минут")).toBeInTheDocument();
    expect(within(details).getByText("5 записей; вручную можно больше")).toBeInTheDocument();
    expect(within(details).getByText("Односторонняя")).toBeInTheDocument();
    expect(within(details).getByText("natali@example.com")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Настройки сохранены.");
  });

  it("posts saved settings when the admin shell is backed by Supabase", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ mode: "supabase", ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="settings"
        initialData={{
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    fireEvent.change(within(dialog).getByLabelText("Название бизнеса"), { target: { value: "Magic Massage Natali" } });
    fireEvent.change(within(dialog).getByLabelText("Часовой пояс"), { target: { value: "Europe/Sofia" } });
    expect(within(dialog).getByLabelText("График специалистов")).toHaveTextContent(
      "Изменяется в календаре отдельно для каждого специалиста",
    );
    await user.click(within(dialog).getByRole("button", { name: "15 минут" }));
    fireEvent.change(within(dialog).getByLabelText("Лимит онлайн-записей в день"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Google Calendar"), { target: { value: "Односторонняя" } });
    fireEvent.change(within(dialog).getByLabelText("Google Calendar ID"), { target: { value: "natali@example.com" } });
    await user.click(within(dialog).getByRole("checkbox", { name: "Письма клиентам о записях" }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Письма Натали/ }));
    fireEvent.change(within(dialog).getByLabelText("Email Натали для уведомлений"), {
      target: { value: "natali@magicmassage.bg" },
    });
    await user.click(within(dialog).getByRole("checkbox", { name: /Письмо после визита/ }));
    fireEvent.change(within(dialog).getByLabelText("HTTPS-ссылка для отзыва"), {
      target: { value: "https://example.com/review" },
    });
    fireEvent.change(within(dialog).getByLabelText("Хранение audit log"), { target: { value: "365" } });
    fireEvent.change(within(dialog).getByLabelText("SEO title"), { target: { value: "Magic Massage Natali Burgas" } });
    fireEvent.change(within(dialog).getByLabelText("Cookie/privacy"), {
      target: { value: "Stripe и Google Maps загружаются только по назначению." },
    });
    fireEvent.change(within(dialog).getByLabelText("Политика ролей"), {
      target: { value: "Бухгалтер: только Stripe-отчеты." },
    });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/records");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toMatchObject({
      record: {
        auditLogRetentionDays: 365,
        bookingCustomerEmailsEnabled: true,
        bookingBufferMinutes: 15,
        businessName: "Magic Massage Natali",
        cookiePrivacyMode: "Stripe и Google Maps загружаются только по назначению.",
        currency: "EUR",
        dailySlotCapacity: 5,
        defaultSeoTitle: "Magic Massage Natali Burgas",
        emailSender: "info@magicmassage.bg",
        emailReviewUrl: "https://example.com/review",
        googleCalendarId: "natali@example.com",
        googleCalendarMode: "Односторонняя",
        careEmailsEnabled: true,
        ownerNotificationEmail: "natali@magicmassage.bg",
        ownerNotificationsEnabled: true,
        rolesPolicy: "Бухгалтер: только Stripe-отчеты.",
        timezone: "Europe/Sofia",
        workingDays: "Пн-Сб",
        workingHours: "10:00-19:00",
      },
      type: "settings",
    });
  });

  it("keeps care emails disabled until a public HTTPS review URL is valid", async () => {
    const user = userEvent.setup();
    render(<AdminShell activeSection="settings" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    await user.click(within(dialog).getByRole("checkbox", { name: /Письмо после визита/ }));
    fireEvent.change(within(dialog).getByLabelText("HTTPS-ссылка для отзыва"), {
      target: { value: "http://example.com/review" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("публичную HTTPS-ссылку");
    expect(within(dialog).getByLabelText("HTTPS-ссылка для отзыва")).toHaveFocus();
  });

  it("restores settings when Supabase rejects the mutation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Settings write failed.", mode: "supabase", ok: false }), { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="settings"
        initialData={{
          financeRows: [],
          records: { appointments: [], certificates: [], clients: [] },
          source: "supabase",
        }}
        role="owner"
        selectedSettingsGroupId="booking"
      />,
    );

    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(within(details).getByText("30 минут")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    await user.click(within(dialog).getByRole("button", { name: "15 минут" }));
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(details).getByText("30 минут")).toBeInTheDocument());
    expect(within(details).queryByText("15 минут")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Settings write failed.");
  });

  it("uses saved booking settings for calendar slot availability", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminShell activeSection="settings" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    await user.click(within(dialog).getByRole("button", { name: "15 минут" }));
    fireEvent.change(within(dialog).getByLabelText("Лимит онлайн-записей в день"), { target: { value: "5" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    rerender(<AdminShell activeSection="calendar" role="owner" selectedCalendarDate="2026-07-06" />);
    await user.click(screen.getByRole("button", { name: "Месяц" }));

    const monthGrid = screen.getByRole("grid", { name: /Месяц Июль 2026/ });
    expect(within(monthGrid).getByRole("button", { name: /6 июля.*2 записи.*3 свободных слота/ })).toBeInTheDocument();

    const monthPlan = screen.getByLabelText("План месяца");
    expect(within(monthPlan).getByText("5 слотов в день")).toBeInTheDocument();
    expect(within(monthPlan).getByText(/15 минут/)).toBeInTheDocument();
  });

  it("keeps settings details synchronized with search results", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "Stripe");

    const details = screen.getByRole("dialog", { name: "Детали настроек" });
    expect(within(details).getByRole("heading", { name: "Платежи" })).toBeInTheDocument();
    expect(within(details).getByText("EUR")).toBeInTheDocument();
    expect(within(details).getByText("Тестовый")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Поиск" }));
    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "нет такого раздела");

    expect(screen.getByText("Настройки не найдены.")).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: "Ничего не найдено" })).toBeInTheDocument();
  });

  it("moves keyboard focus into the settings dialog", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    const trigger = screen.getByRole("button", { name: "Сохранить" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    await waitFor(() => expect(within(dialog).getByRole("heading", { name: "Настройки админки" })).toHaveFocus());

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Отмена" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Закрыть" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Настройки админки" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("guards backdrop and Escape closing when settings have unsaved changes", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<AdminShell activeSection="settings" role="owner" />);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    fireEvent.change(within(dialog).getByLabelText("Название бизнеса"), { target: { value: "Magic Massage Updated" } });
    fireEvent.click(dialog.parentElement!);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Настройки админки" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Отмена" }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Настройки админки" })).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Настройки админки" })).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("rejects invalid numeric settings", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const bookingLink = within(screen.getByRole("table")).getByRole("link", { name: "Запись и календарь" });
    bookingLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(bookingLink);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = screen.getByRole("dialog", { name: "Настройки админки" });
    fireEvent.change(within(dialog).getByLabelText("Лимит онлайн-записей в день"), { target: { value: "9" } });
    await user.click(within(dialog).getByRole("button", { name: "Сохранить настройки" }));

    expect(screen.getByRole("dialog", { name: "Настройки админки" })).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите название, буфер 15 или 30 минут, публичный лимит до 8 записей и срок хранения audit log.");
    const invalidLimit = within(dialog).getByLabelText("Лимит онлайн-записей в день");
    expect(invalidLimit).toHaveAttribute("aria-invalid", "true");
    expect(invalidLimit).toHaveAttribute("aria-describedby", "settings-form-error");
    expect(invalidLimit).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Детали настроек" })).toHaveTextContent("30 минут");
  });

  it("switches settings groups and confirms dangerous settings actions", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="settings" role="owner" />);

    const rolesAuditLink = within(screen.getByRole("table")).getByRole("link", { name: "Роли и аудит" });
    expect(rolesAuditLink).toHaveAttribute("href", "/admin?section=settings&role=owner&settings=rolesAudit");
    rolesAuditLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(rolesAuditLink);

    const details = screen.getByLabelText("Детали настроек");
    expect(within(details).getByRole("heading", { name: "Роли и аудит" })).toBeInTheDocument();
    expect(within(details).getByText("Бухгалтер: только Stripe-отчеты")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Сбросить демо-данные" }));

    const confirmDialog = screen.getByRole("dialog", { name: "Подтвердить действие" });
    expect(within(confirmDialog).getByText("Опасное действие не выполняется без подтверждения владельца.")).toBeInTheDocument();
    await user.click(within(confirmDialog).getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog", { name: "Подтвердить действие" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Действие записано в audit log.");
  });

  it("invites and edits an admin user with the accountant role", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="users" role="owner" />);

    expect(screen.getByRole("heading", { name: "Пользователи админки" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Детали пользователя")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Пригласить" }));

    const createDialog = screen.getByRole("dialog", { name: "Пригласить пользователя" });
    fireEvent.change(within(createDialog).getByLabelText("Имя"), { target: { value: "Елена Бухгалтер" } });
    fireEvent.change(within(createDialog).getByLabelText("Email"), { target: { value: "accountant@example.com" } });
    await user.selectOptions(within(createDialog).getByLabelText("Роль"), "accountant");
    fireEvent.change(within(createDialog).getByLabelText("Комментарий доступа"), {
      target: { value: "Доступ только для налоговой выгрузки Stripe." },
    });
    await user.click(within(createDialog).getByRole("button", { name: "Отправить приглашение" }));

    expect(screen.queryByRole("dialog", { name: "Пригласить пользователя" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Елена Бухгалтер" })).toHaveAttribute(
      "href",
      "/admin?section=users&role=owner&user=admin-user-accountant-example-com",
    );

    const details = screen.getByLabelText("Детали пользователя");
    expect(within(details).getByRole("heading", { name: "Елена Бухгалтер" })).toBeInTheDocument();
    expect(within(details).getByText("Бухгалтер")).toBeInTheDocument();
    expect(within(details).getByText("Stripe-продажи за период")).toBeInTheDocument();
    expect(within(details).getByText("Экспорт CSV/XLSX/PDF")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Редактировать" }));

    const editDialog = screen.getByRole("dialog", { name: "Редактировать пользователя" });
    await user.selectOptions(within(editDialog).getByLabelText("Статус"), "Активен");
    fireEvent.change(within(editDialog).getByLabelText("Комментарий доступа"), {
      target: { value: "Доступ подтвержден владельцем для налоговой отчетности." },
    });
    await user.click(within(editDialog).getByRole("button", { name: "Сохранить пользователя" }));

    expect(screen.queryByRole("dialog", { name: "Редактировать пользователя" })).not.toBeInTheDocument();
    expect(within(details).getByText("Активен")).toBeInTheDocument();
    expect(within(details).getByText("Доступ подтвержден владельцем для налоговой отчетности.")).toBeInTheDocument();
  });

  it("posts admin user invites when the admin shell is backed by Supabase", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(
        JSON.stringify({
          message: "Admin user invitation saved in Supabase.",
          mode: "supabase",
          ok: true,
          userId: "00000000-0000-0000-0000-000000000002",
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminShell
        activeSection="users"
        initialData={{
          adminUsers: [],
          financeRows: [],
          records: {
            appointments: [],
            certificates: [],
            clients: [],
          },
          source: "supabase",
        }}
        role="owner"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Пригласить" }));

    const dialog = screen.getByRole("dialog", { name: "Пригласить пользователя" });
    fireEvent.change(within(dialog).getByLabelText("Имя"), { target: { value: "Accountant Example" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "accountant@example.com" } });
    await user.selectOptions(within(dialog).getByLabelText("Роль"), "accountant");
    fireEvent.change(within(dialog).getByLabelText("Комментарий доступа"), { target: { value: "Tax exports only." } });
    await user.click(within(dialog).getByRole("button", { name: "Отправить приглашение" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/users");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      action: "invite",
      user: {
        accessNote: "Tax exports only.",
        email: "accountant@example.com",
        name: "Accountant Example",
        role: "accountant",
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Accountant Example" })).toHaveAttribute(
        "href",
        "/admin?section=users&role=owner&user=00000000-0000-0000-0000-000000000002",
      ),
    );
  });

  it("rejects an invalid admin user email", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="users" role="owner" />);

    await user.click(screen.getByRole("button", { name: "Пригласить" }));

    const dialog = screen.getByRole("dialog", { name: "Пригласить пользователя" });
    await user.type(within(dialog).getByLabelText("Имя"), "Bad Email");
    await user.type(within(dialog).getByLabelText("Email"), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Отправить приглашение" }));

    expect(screen.getByRole("dialog", { name: "Пригласить пользователя" })).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Укажите имя и корректный email пользователя.");
    expect(within(dialog).getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("filters admin users by accountant access and global search", async () => {
    const user = userEvent.setup();

    render(<AdminShell activeSection="users" role="owner" />);

    const filters = screen.getByLabelText("Фильтры пользователей");
    const table = screen.getByRole("table");

    await user.click(within(filters).getByRole("button", { name: "Бухгалтеры" }));

    expect(within(filters).getByRole("button", { name: "Бухгалтеры" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("link", { name: "Ирина Finance" })).toHaveAttribute(
      "href",
      "/admin?section=users&role=owner&user=admin-user-accountant",
    );
    expect(within(table).queryByRole("link", { name: "Natali Ivanova" })).not.toBeInTheDocument();
    const accountantLink = within(table).getByRole("link", { name: "Ирина Finance" });
    accountantLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(accountantLink);
    expect(screen.getByRole("dialog", { name: "Детали пользователя" })).toHaveTextContent("Stripe-продажи за период");

    await user.type(screen.getByRole("searchbox", { name: "Поиск" }), "stripe");

    expect(within(table).getByRole("link", { name: "Ирина Finance" })).toBeInTheDocument();
    expect(within(table).queryByRole("link", { name: "Мария Контент" })).not.toBeInTheDocument();
  });
});
