"use client";

import type { ServiceRecord } from "@/admin/domain";

type ServiceVisibilityToggleProps = {
  onChange: (service: ServiceRecord) => void;
  service: ServiceRecord;
};

export function ServiceVisibilityToggle({ onChange, service }: ServiceVisibilityToggleProps) {
  const isPublished = service.status === "Опубликована";

  return (
    <label className="admin-checkbox-row admin-service-visibility-toggle">
      <input
        aria-label={`${isPublished ? "Скрыть" : "Опубликовать"} услугу ${service.name}`}
        checked={isPublished}
        onChange={(event) =>
          onChange({ ...service, status: event.target.checked ? "Опубликована" : "Скрыта" })
        }
        type="checkbox"
      />
      <span>{isPublished ? "Опубликована" : service.status}</span>
    </label>
  );
}
