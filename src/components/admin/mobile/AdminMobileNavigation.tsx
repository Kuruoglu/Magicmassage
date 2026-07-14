"use client";

import Link from "next/link";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
} from "react";

import type { AdminModule, AdminSectionId } from "@/admin/config";

import { AdminMobileMenuButton } from "./AdminMobileMenuButton";

export type AdminMobileNavigationProps = {
  activeSection: AdminSectionId;
  ariaLabel?: string;
  className?: string;
  closeLabel?: string;
  getHref: (section: AdminSectionId) => string;
  heading?: string;
  id: string;
  isOpen: boolean;
  navigation: readonly AdminModule[];
  onClose: () => void;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = "";

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[inert]"),
  );
}

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock;
    bodyOverflowBeforeLock = "";
  }
}

function groupNavigation(navigation: readonly AdminModule[]) {
  const groups = new Map<AdminModule["group"], AdminModule[]>();

  navigation.forEach((module) => {
    const groupItems = groups.get(module.group) ?? [];
    groupItems.push(module);
    groups.set(module.group, groupItems);
  });

  return Array.from(groups.entries());
}

export function AdminMobileNavigation({
  activeSection,
  ariaLabel = "Admin navigation",
  className = "",
  closeLabel = "Close admin navigation",
  getHref,
  heading = "Admin navigation",
  id,
  isOpen,
  navigation,
  onClose,
}: AdminMobileNavigationProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const panelClassName = ["admin-mobile-navigation-panel", className].filter(Boolean).join(" ");
  const groupedNavigation = groupNavigation(navigation);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const restoreFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockBodyScroll();
    (closeButtonRef.current ?? panelRef.current)?.focus();

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusableElements = getFocusableElements(panelRef.current);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      if (!panelRef.current.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
      unlockBodyScroll();

      if (restoreFocusTarget?.isConnected) {
        restoreFocusTarget.focus();
      }
    };
  }, [isOpen]);

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onCloseRef.current();
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-mobile-navigation-backdrop" data-state="open" onClick={handleBackdropClick}>
      <aside
        aria-label={ariaLabel}
        aria-modal="true"
        className={panelClassName}
        id={id}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="admin-mobile-navigation-header">
          <h2 className="admin-mobile-navigation-heading">{heading}</h2>
          <AdminMobileMenuButton
            closeLabel={closeLabel}
            controlsId={id}
            isOpen
            onClick={() => onCloseRef.current()}
            ref={closeButtonRef}
          />
        </div>

        <nav aria-label={ariaLabel} className="admin-mobile-navigation-nav">
          {groupedNavigation.map(([group, modules]) => (
            <section className="admin-mobile-navigation-group" key={group}>
              <h3 className="admin-mobile-navigation-group-title">{group}</h3>
              <ul className="admin-mobile-navigation-list">
                {modules.map((module) => {
                  const isActive = module.id === activeSection;

                  return (
                    <li className="admin-mobile-navigation-item" key={module.id}>
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "admin-mobile-navigation-link",
                          isActive ? "is-active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        data-section={module.id}
                        href={getHref(module.id)}
                        onClick={() => onCloseRef.current()}
                      >
                        {module.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
    </div>
  );
}
