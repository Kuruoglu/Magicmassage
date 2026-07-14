"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminModule } from "@/admin/config";

import { AdminMobileMenuButton } from "./AdminMobileMenuButton";

export type AdminMobileHeaderProps = {
  activeModule: Pick<AdminModule, "id" | "title">;
  brandHref: string;
  brandLabel?: string;
  brandMark?: ReactNode;
  brandName?: string;
  className?: string;
  closeMenuLabel?: string;
  isNavigationOpen: boolean;
  navigationId: string;
  onMenuToggle: () => void;
  openMenuLabel?: string;
};

export function AdminMobileHeader({
  activeModule,
  brandHref,
  brandLabel,
  brandMark = "MMN",
  brandName = "Magic Massage Natali",
  className = "",
  closeMenuLabel,
  isNavigationOpen,
  navigationId,
  onMenuToggle,
  openMenuLabel,
}: AdminMobileHeaderProps) {
  const headerClassName = ["admin-mobile-header", className].filter(Boolean).join(" ");

  return (
    <header className={headerClassName} data-section={activeModule.id}>
      <Link
        aria-label={brandLabel ?? `${brandName} admin home`}
        className="admin-mobile-header-brand"
        href={brandHref}
      >
        <span aria-hidden="true" className="admin-mobile-header-brand-mark">
          {brandMark}
        </span>
        <span className="admin-mobile-header-brand-name">{brandName}</span>
      </Link>

      <strong className="admin-mobile-header-section">{activeModule.title}</strong>

      <AdminMobileMenuButton
        closeLabel={closeMenuLabel}
        controlsId={navigationId}
        isOpen={isNavigationOpen}
        onClick={onMenuToggle}
        openLabel={openMenuLabel}
      />
    </header>
  );
}
