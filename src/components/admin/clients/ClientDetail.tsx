"use client";

import type { ReactNode } from "react";

import type { ClientRecord } from "@/admin/domain";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerHeader,
} from "@/components/admin/drawer";

export type ClientDetailProps = {
  children: ReactNode;
  client: ClientRecord;
  hasUnsavedChanges?: boolean;
  onClose: () => void;
};

export function ClientDetail({ children, client, hasUnsavedChanges = false, onClose }: ClientDetailProps) {
  return (
    <AdminDrawer
      ariaLabel="Карточка клиента"
      className="admin-client-card"
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <AdminDrawerHeader kicker="Карточка клиента" onClose={onClose} title={client.name} titleId="admin-client-card-title">
        <p>{client.language.toUpperCase()} · {client.status}</p>
      </AdminDrawerHeader>
      <AdminDrawerBody>{children}</AdminDrawerBody>
    </AdminDrawer>
  );
}
