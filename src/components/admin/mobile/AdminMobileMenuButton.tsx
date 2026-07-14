"use client";

import { forwardRef, type MouseEventHandler } from "react";

export type AdminMobileMenuButtonProps = {
  className?: string;
  closeLabel?: string;
  controlsId: string;
  isOpen: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  openLabel?: string;
};

export const AdminMobileMenuButton = forwardRef<HTMLButtonElement, AdminMobileMenuButtonProps>(
  function AdminMobileMenuButton(
    {
      className = "",
      closeLabel = "Close admin navigation",
      controlsId,
      isOpen,
      onClick,
      openLabel = "Open admin navigation",
    },
    ref,
  ) {
    const buttonClassName = ["admin-mobile-menu-button", className].filter(Boolean).join(" ");

    return (
      <button
        aria-controls={controlsId}
        aria-expanded={isOpen}
        aria-label={isOpen ? closeLabel : openLabel}
        className={buttonClassName}
        data-state={isOpen ? "open" : "closed"}
        onClick={onClick}
        ref={ref}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="admin-mobile-menu-button-icon"
          fill="none"
          focusable="false"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="24"
        >
          {isOpen ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </>
          )}
        </svg>
      </button>
    );
  },
);

AdminMobileMenuButton.displayName = "AdminMobileMenuButton";
