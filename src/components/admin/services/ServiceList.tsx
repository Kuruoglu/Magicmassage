"use client";

import { AdminLink as Link } from "@/components/admin/AdminLink";

import type { AdminRoleId } from "@/admin/config";
import type { ServiceRecord } from "@/admin/domain";
import { serviceDetailHref } from "@/components/admin/lib/links";
import { ServiceVisibilityToggle } from "./ServiceVisibilityToggle";

type ServiceListProps = {
  onOpen: (service: ServiceRecord) => void;
  onSave: (service: ServiceRecord, originalSlug?: string) => void;
  role: AdminRoleId;
  selectedSlug?: string;
  services: ServiceRecord[];
};

export function ServiceList({ onOpen, onSave, role, selectedSlug, services }: ServiceListProps) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-data-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Slug</th>
            <th>Категория</th>
            <th>Длительность</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr aria-selected={service.slug === selectedSlug} key={service.slug}>
              <td>
                <Link
                  className="admin-row-action admin-row-link"
                  href={serviceDetailHref(service.slug, role)}
                  onClick={() => onOpen(service)}
                >
                  {service.name}
                </Link>
              </td>
              <td className="admin-tabular">{service.slug}</td>
              <td>{service.category}</td>
              <td>{service.duration}</td>
              <td>
                <ServiceVisibilityToggle
                  onChange={(nextService) => onSave(nextService, service.slug)}
                  service={service}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
