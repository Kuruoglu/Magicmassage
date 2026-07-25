"use client";

import { type ReactNode, type Ref } from "react";

import { useAdminDrawerClose } from "./AdminDrawer";

type AdminDrawerHeaderProps = {
  children?: ReactNode;
  closeDisabled?: boolean;
  kicker?: string;
  onClose: () => void;
  title: string;
  titleId: string;
  titleRef?: Ref<HTMLHeadingElement>;
  titleTabIndex?: number;
};

export function AdminDrawerHeader({
  children,
  closeDisabled = false,
  kicker,
  onClose,
  title,
  titleId,
  titleRef,
  titleTabIndex,
}: AdminDrawerHeaderProps) {
  const requestClose = useAdminDrawerClose() ?? onClose;

  return (
    <div className="admin-drawer-header">
      <div>
        {kicker ? <span className="admin-kicker">{kicker}</span> : null}
        <h2 id={titleId} ref={titleRef} tabIndex={titleTabIndex}>{title}</h2>
        {children}
      </div>
      <button className="admin-icon-button" disabled={closeDisabled} onClick={requestClose} type="button">
        Закрыть
      </button>
    </div>
  );
}
