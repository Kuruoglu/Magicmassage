import Link from "next/link";

import {
  getAdminModule,
  getAdminNavigationForRole,
  roleLabels,
  type AdminRoleId,
  type AdminSectionId,
} from "@/admin/config";
import {
  certificateRows,
  clientRows,
  dashboardMetrics,
  financeRows,
  financeSummary,
  sectionSamples,
  upcomingAppointments,
} from "@/admin/demo-data";

type AdminShellProps = {
  activeSection: AdminSectionId;
  role: AdminRoleId;
};

const groupedNavigation = ["Операции", "Контент", "Финансы", "Система"] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "EUR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function statusClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes("ожидает") || normalizedStatus.includes("новая")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("отмен") || normalizedStatus.includes("возврат")) {
    return "admin-status admin-status-danger";
  }

  return "admin-status admin-status-success";
}

function DashboardWorkspace({ role }: { role: AdminRoleId }) {
  return (
    <div className="admin-dashboard-grid">
      <section className="admin-metric-row" aria-label="Ключевые показатели">
        {dashboardMetrics.map((metric) => (
          <article className={`admin-metric admin-metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel admin-panel-large" aria-labelledby="appointments-heading">
        <div className="admin-panel-head">
          <h2 id="appointments-heading">Ближайшие записи</h2>
          <Link className="admin-text-action" href={`/admin?section=calendar&role=${role}`}>
            Открыть календарь
          </Link>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Клиент</th>
                <th>Услуга</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAppointments.map((appointment) => (
                <tr key={`${appointment.time}-${appointment.client}`}>
                  <td className="admin-tabular">{appointment.time}</td>
                  <td>{appointment.client}</td>
                  <td>{appointment.service}</td>
                  <td>
                    <span className={statusClass(appointment.status)}>{appointment.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel" aria-labelledby="certificate-heading">
        <div className="admin-panel-head">
          <h2 id="certificate-heading">Сертификаты</h2>
          <Link className="admin-text-action" href={`/admin?section=certificates&role=${role}`}>
            Все
          </Link>
        </div>
        <div className="admin-list">
          {certificateRows.map((certificate) => (
            <article className="admin-list-item" key={certificate.code}>
              <div>
                <strong>{certificate.code}</strong>
                <span>
                  {certificate.buyer} → {certificate.recipient}
                </span>
              </div>
              <span className={statusClass(certificate.status)}>{certificate.status}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClientsWorkspace() {
  return (
    <section className="admin-panel admin-panel-large" aria-labelledby="clients-heading">
      <div className="admin-panel-head">
        <h2 id="clients-heading">Клиентская база</h2>
        <div className="admin-filter-row" aria-label="Фильтры клиентов">
          <span>Все</span>
          <span>Активные</span>
          <span>RU</span>
          <span>BG</span>
        </div>
      </div>
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>Язык</th>
              <th>Визиты</th>
              <th>Следующий визит</th>
            </tr>
          </thead>
          <tbody>
            {clientRows.map((client) => (
              <tr key={client.phone}>
                <td>{client.name}</td>
                <td className="admin-tabular">{client.phone}</td>
                <td>{client.language.toUpperCase()}</td>
                <td className="admin-tabular">{client.visits}</td>
                <td>{client.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CalendarWorkspace() {
  return (
    <div className="admin-split-view">
      <section className="admin-panel admin-calendar-panel" aria-labelledby="calendar-heading">
        <div className="admin-panel-head">
          <h2 id="calendar-heading">День</h2>
          <div className="admin-filter-row" aria-label="Режимы календаря">
            <span>День</span>
            <span>Неделя</span>
            <span>Список</span>
          </div>
        </div>
        <div className="admin-calendar-list">
          {upcomingAppointments.map((appointment) => (
            <article className="admin-calendar-item" key={`${appointment.time}-${appointment.client}`}>
              <time className="admin-tabular">{appointment.time}</time>
              <div>
                <strong>{appointment.client}</strong>
                <span>{appointment.service}</span>
              </div>
              <span className={statusClass(appointment.status)}>{appointment.status}</span>
            </article>
          ))}
        </div>
      </section>

      <aside className="admin-panel admin-detail-panel" aria-label="Детали выбранной записи">
        <span className="admin-kicker">Правая панель</span>
        <h2>Мария Иванова</h2>
        <dl className="admin-detail-list">
          <div>
            <dt>Услуга</dt>
            <dd>Лимфодренажный массаж</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className="admin-status admin-status-warning">Ожидает</span>
            </dd>
          </div>
          <div>
            <dt>Сертификат</dt>
            <dd>MMN-2407-1022</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function FinanceWorkspace() {
  return (
    <section className="admin-panel admin-panel-large" aria-labelledby="finance-heading">
      <div className="admin-panel-head admin-panel-head-finance">
        <div>
          <h2 id="finance-heading">Stripe-продажи за период</h2>
          <p>Период считается по timezone бизнеса Europe/Sofia.</p>
        </div>
        <div className="admin-export-actions" aria-label="Форматы выгрузки">
          <button type="button">CSV</button>
          <button type="button">XLSX</button>
          <button type="button">PDF</button>
        </div>
      </div>

      <div className="admin-finance-summary" aria-label="Finance summary">
        <article>
          <span>Gross</span>
          <strong>{formatCurrency(financeSummary.gross)}</strong>
        </article>
        <article>
          <span>Refunds</span>
          <strong>{formatCurrency(financeSummary.refunds)}</strong>
        </article>
        <article>
          <span>Stripe fees</span>
          <strong>{formatCurrency(financeSummary.stripeFees)}</strong>
        </article>
        <article>
          <span>Net</span>
          <strong>{formatCurrency(financeSummary.net)}</strong>
        </article>
        <article>
          <span>Payments</span>
          <strong>{financeSummary.payments}</strong>
        </article>
      </div>

      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Платеж</th>
              <th>Сертификат</th>
              <th>Покупатель</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Refund</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {financeRows.map((row) => (
              <tr key={row.id}>
                <td className="admin-tabular">{row.date}</td>
                <td className="admin-tabular">{row.id}</td>
                <td>{row.certificateCode}</td>
                <td>{row.buyer}</td>
                <td className="admin-tabular">{formatCurrency(row.gross)}</td>
                <td className="admin-tabular">{formatCurrency(row.stripeFee)}</td>
                <td className="admin-tabular">{formatCurrency(row.refund)}</td>
                <td className="admin-tabular">{formatCurrency(row.gross - row.refund - row.stripeFee)}</td>
                <td>
                  <span className={statusClass(row.status ?? "Оплачено")}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-finance-footer">
        <span>Последняя выгрузка: 2026-07-03 18:20</span>
        <span>Следующая выгрузка будет записана в <strong>audit log</strong></span>
      </div>
    </section>
  );
}

function GenericWorkspace({ section }: { section: AdminSectionId }) {
  const sectionModule = getAdminModule(section);

  return (
    <div className="admin-split-view">
      <section className="admin-panel admin-panel-large" aria-labelledby={`${section}-workspace-heading`}>
        <div className="admin-panel-head">
          <h2 id={`${section}-workspace-heading`}>Рабочий список</h2>
          <div className="admin-filter-row" aria-label="Фильтры раздела">
            <span>Все</span>
            <span>Активные</span>
            <span>Черновики</span>
          </div>
        </div>
        <div className="admin-module-grid">
          {sectionSamples[section].map((item) => (
            <article className="admin-module-tile" key={item}>
              <strong>{item}</strong>
              <span>{sectionModule.title}</span>
            </article>
          ))}
        </div>
      </section>

      <aside className="admin-panel admin-detail-panel" aria-label="Детали выбранного объекта">
        <span className="admin-kicker">Детали</span>
        <h2>{sectionModule.title}</h2>
        <p>{sectionModule.description}</p>
        <dl className="admin-detail-list">
          <div>
            <dt>Публикация</dt>
            <dd>
              <span className="admin-status admin-status-warning">Черновик</span>
            </dd>
          </div>
          <div>
            <dt>Локализации</dt>
            <dd>bg, ru, ua, en</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function Workspace({ role, section }: { role: AdminRoleId; section: AdminSectionId }) {
  if (section === "dashboard") {
    return <DashboardWorkspace role={role} />;
  }

  if (section === "clients") {
    return <ClientsWorkspace />;
  }

  if (section === "calendar") {
    return <CalendarWorkspace />;
  }

  if (section === "finances") {
    return <FinanceWorkspace />;
  }

  return <GenericWorkspace section={section} />;
}

export function AdminShell({ activeSection, role }: AdminShellProps) {
  const navigation = getAdminNavigationForRole(role);
  const activeModule = getAdminModule(activeSection);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href={`/admin?role=${role}`} aria-label="Magic Massage Natali admin home">
          <span>MMN</span>
          <strong>Magic Massage Natali</strong>
        </Link>

        <nav className="admin-nav" aria-label="Admin sections">
          {groupedNavigation.map((group) => {
            const groupItems = navigation.filter((item) => item.group === group);

            if (groupItems.length === 0) {
              return null;
            }

            return (
              <div className="admin-nav-group" key={group}>
                <span>{group}</span>
                {groupItems.map((item) => (
                  <Link
                    aria-current={item.id === activeSection ? "page" : undefined}
                    href={`/admin?section=${item.id}&role=${role}`}
                    key={item.id}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-search" role="search">
            <label htmlFor="admin-search-input">Поиск</label>
            <input id="admin-search-input" placeholder="Клиент, сертификат, платеж" type="search" />
          </div>
          <div className="admin-user-chip" aria-label="Текущая роль и профиль">
            <span>{roleLabels[role]}</span>
            <strong>Профиль</strong>
          </div>
        </header>

        <section className="admin-page-head" aria-labelledby="admin-page-title">
          <div>
            <span className="admin-kicker">{activeModule.group}</span>
            <h1 id="admin-page-title">{activeModule.title}</h1>
            <p>{activeModule.description}</p>
          </div>
          <button type="button">{activeModule.primaryAction}</button>
        </section>

        <Workspace role={role} section={activeSection} />
      </main>
    </div>
  );
}
