import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import { AdminLink } from "./AdminLink";

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | "auto" | null;
  }) => (
    <a
      {...props}
      data-prefetch={prefetch === undefined ? undefined : String(prefetch)}
      href={href}
    />
  ),
}));

describe("AdminLink", () => {
  it("disables Next prefetch even when a caller requests it", () => {
    const { getByRole } = render(
      <AdminLink href="/admin?section=clients" prefetch>
        Клиенты
      </AdminLink>,
    );

    expect(getByRole("link", { name: "Клиенты" })).toHaveAttribute("data-prefetch", "false");
  });
});
