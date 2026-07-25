"use client";

import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from "react";

type AdminDrawerProps = {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  closeConfirmationMessage?: string;
  hasUnsavedChanges?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
};

const AdminDrawerCloseContext = createContext<(() => boolean) | undefined>(undefined);
let openDrawerCount = 0;

export function useAdminDrawerClose() {
  return useContext(AdminDrawerCloseContext);
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((item) => item.tabIndex >= 0 && !item.hasAttribute("inert"));
}

export function AdminDrawer({
  ariaLabel,
  ariaLabelledBy,
  children,
  className = "",
  closeConfirmationMessage = "Есть несохраненные изменения. Закрыть без сохранения?",
  hasUnsavedChanges = false,
  initialFocusRef,
  onClose,
}: AdminDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const drawerClassName = ["admin-drawer-panel", className].filter(Boolean).join(" ");

  function requestClose() {
    if (hasUnsavedChanges && !window.confirm(closeConfirmationMessage)) {
      return false;
    }

    onClose();
    return true;
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      requestClose();
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(panelRef.current);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!activeElement || !focusableElements.includes(activeElement)) {
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

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDrawerCount += 1;
    document.body.classList.add("admin-drawer-open");

    const focusTarget = initialFocusRef?.current
      ?? (panelRef.current ? getFocusableElements(panelRef.current)[0] ?? panelRef.current : undefined);
    focusTarget?.focus();

    return () => {
      openDrawerCount = Math.max(0, openDrawerCount - 1);

      if (openDrawerCount === 0) {
        document.body.classList.remove("admin-drawer-open");
      }

      restoreFocusRef.current?.focus();
    };
  }, [initialFocusRef]);

  return (
    <div className="admin-drawer-backdrop" onClick={handleBackdropClick}>
      <aside
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={drawerClassName}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <AdminDrawerCloseContext.Provider value={requestClose}>{children}</AdminDrawerCloseContext.Provider>
      </aside>
    </div>
  );
}
