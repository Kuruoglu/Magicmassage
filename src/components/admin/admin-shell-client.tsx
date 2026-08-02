"use client";

import dynamic from "next/dynamic";

import type { AdminShellProps } from "./admin-shell";

const AdminShell = dynamic(
  () => import("./admin-shell").then((module) => module.AdminShell),
  {
    loading: () => (
      <main aria-busy="true" className="admin-load-state" role="status">
        <h1>Загружаем админ-панель</h1>
        <p>Подготавливаем выбранный раздел.</p>
      </main>
    ),
    ssr: false,
  },
);

export function AdminShellClient(props: AdminShellProps) {
  const key = props.initialData?.source === "supabase"
    ? `${props.role}:${props.activeSection}`
    : props.role;

  return <AdminShell {...props} key={key} />;
}
