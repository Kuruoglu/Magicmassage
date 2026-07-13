"use client";

import { type ReactNode } from "react";

import { useAdminDrawerClose } from "./AdminDrawer";

type AdminDrawerHeaderProps = {
  children?: ReactNode;
  kicker?: string;
  onClose: () => void;
  title: string;
  titleId: string;
};

export function AdminDrawerHeader({ children, kicker, onClose, title, titleId }: AdminDrawerHeaderProps) {
  const requestClose = useAdminDrawerClose() ?? onClose;

  return (
    <div className="admin-drawer-header">
      <div>
        {kicker ? <span className="admin-kicker">{kicker}</span> : null}
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
      <button className="admin-icon-button" onClick={requestClose} type="button">
        Закрыть
      </button>
    </div>
  );
}
