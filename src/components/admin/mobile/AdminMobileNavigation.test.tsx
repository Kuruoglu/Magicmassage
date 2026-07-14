import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { adminModules, type AdminSectionId } from "@/admin/config";

import { AdminMobileHeader } from "./AdminMobileHeader";
import { AdminMobileMenuButton } from "./AdminMobileMenuButton";
import { AdminMobileNavigation } from "./AdminMobileNavigation";

const navigation = adminModules.filter((module) => module.id === "dashboard" || module.id === "clients");
const activeModule = navigation.find((module) => module.id === "dashboard")!;
const lastModule = navigation[navigation.length - 1]!;

function NavigationHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AdminMobileHeader
        activeModule={activeModule}
        brandHref="/admin"
        isNavigationOpen={isOpen}
        navigationId="admin-mobile-navigation"
        onMenuToggle={() => setIsOpen((current) => !current)}
      />
      <AdminMobileNavigation
        activeSection="dashboard"
        getHref={(section: AdminSectionId) => `/admin?section=${section}`}
        id="admin-mobile-navigation"
        isOpen={isOpen}
        navigation={navigation}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("AdminMobileMenuButton", () => {
  it("exposes its controlled menu state and accessible action label", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <AdminMobileMenuButton controlsId="mobile-menu" isOpen={false} onClick={onClick} />,
    );

    const openButton = screen.getByRole("button", { name: "Open admin navigation" });
    expect(openButton).toHaveAttribute("aria-controls", "mobile-menu");
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(openButton).toHaveAttribute("data-state", "closed");

    rerender(<AdminMobileMenuButton controlsId="mobile-menu" isOpen onClick={onClick} />);

    const closeButton = screen.getByRole("button", { name: "Close admin navigation" });
    expect(closeButton).toHaveAttribute("aria-expanded", "true");
    expect(closeButton).toHaveAttribute("data-state", "open");
  });
});

describe("AdminMobileHeader", () => {
  it("renders the active section, brand target, and menu relationship", () => {
    render(
      <AdminMobileHeader
        activeModule={activeModule}
        brandHref="/admin"
        isNavigationOpen={false}
        navigationId="mobile-navigation"
        onMenuToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Magic Massage Natali admin home" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByText(activeModule.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open admin navigation" })).toHaveAttribute(
      "aria-controls",
      "mobile-navigation",
    );
  });
});

describe("AdminMobileNavigation", () => {
  it("traps focus, marks the active section, restores focus, and closes after link selection", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "clip";
    render(<NavigationHarness />);

    const trigger = screen.getByRole("button", { name: "Open admin navigation" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Admin navigation" });
    const closeButton = within(dialog).getByRole("button", { name: "Close admin navigation" });
    const activeLink = within(dialog).getByRole("link", { name: activeModule.title });
    const lastLink = within(dialog).getByRole("link", { name: lastModule.title });

    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("is-active");
    expect(lastLink).not.toHaveAttribute("aria-current");

    await user.tab({ shift: true });
    expect(lastLink).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    activeLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(activeLink);

    expect(screen.queryByRole("dialog", { name: "Admin navigation" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe("clip");
  });

  it("closes only for a direct backdrop click and supports Escape", async () => {
    const user = userEvent.setup();
    const { container } = render(<NavigationHarness />);

    await user.click(screen.getByRole("button", { name: "Open admin navigation" }));

    const dialog = screen.getByRole("dialog", { name: "Admin navigation" });
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog", { name: "Admin navigation" })).toBeInTheDocument();

    const backdrop = container.querySelector<HTMLElement>(".admin-mobile-navigation-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole("dialog", { name: "Admin navigation" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open admin navigation" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Admin navigation" })).not.toBeInTheDocument();
  });
});
