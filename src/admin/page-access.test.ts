import { describe, expect, it } from "vitest";

import { resolveAdminShellSelection } from "./page-access";

describe("admin page access selection", () => {
  it("does not allow the role query parameter to elevate access", () => {
    const selection = resolveAdminShellSelection(
      {
        role: "owner",
        section: "users",
      },
      "accountant",
    );

    expect(selection.role).toBe("accountant");
    expect(selection.activeSection).toBe("finances");
  });

  it("lets owners access owner-only sections", () => {
    const selection = resolveAdminShellSelection(
      {
        section: "users",
      },
      "owner",
    );

    expect(selection.role).toBe("owner");
    expect(selection.activeSection).toBe("users");
  });
});
