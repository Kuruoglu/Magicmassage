import type { ClientRecord } from "@/admin/domain";

export function ClientContacts({ client }: { client: ClientRecord }) {
  return (
    <dl className="admin-client-contact-list">
      <div>
        <dt>Телефон</dt>
        <dd className="admin-tabular">{client.phone || "Не указан"}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{client.email || "Не указан"}</dd>
      </div>
      <div>
        <dt>Канал связи</dt>
        <dd>{client.preferredContact || "Не указан"}</dd>
      </div>
    </dl>
  );
}
