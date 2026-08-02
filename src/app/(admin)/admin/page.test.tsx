// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const adminPageMocks = vi.hoisted(() => ({
  authorization: {
    message: undefined as string | undefined,
    mode: "supabase",
    ok: true,
    role: "accountant",
    specialistId: undefined as string | undefined,
    statusCode: undefined as 401 | 403 | 503 | undefined,
    userId: "11111111-1111-4111-8111-111111111111",
  },
  client: { from: vi.fn() },
  cookieToken: undefined as string | undefined,
  loadAdminShellData: vi.fn(async () => ({
    financeRows: [],
    records: {
      appointments: [],
      certificates: [],
      clients: [],
    },
    source: "supabase",
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (adminPageMocks.cookieToken ? { value: adminPageMocks.cookieToken } : undefined)),
  })),
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("forbidden");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/admin/data-source", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/data-source")>();

  return {
    ...actual,
    loadAdminShellData: adminPageMocks.loadAdminShellData,
  };
});

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async (_client: unknown, token: string | undefined) =>
      token
        ? adminPageMocks.authorization
        : {
            message: "Unauthorized",
            mode: "supabase",
            ok: false,
            statusCode: 401,
          },
    ),
    createSupabaseAdminClient: vi.fn(() => adminPageMocks.client),
  };
});

vi.mock("@/components/admin/admin-shell-client", () => ({
  AdminShellClient: vi.fn((props: unknown) => ({
    props,
    type: "AdminShellClient",
  })),
}));

describe("/admin page authorization", () => {
  beforeEach(() => {
    adminPageMocks.authorization.message = undefined;
    adminPageMocks.authorization.ok = true;
    adminPageMocks.authorization.role = "accountant";
    adminPageMocks.authorization.specialistId = undefined;
    adminPageMocks.authorization.statusCode = undefined;
    adminPageMocks.cookieToken = undefined;
    adminPageMocks.loadAdminShellData.mockClear();
  });

  it("redirects unauthenticated users to admin login", async () => {
    adminPageMocks.cookieToken = undefined;
    const { default: AdminPage } = await import("./page");

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/admin/login");
  });

  it("uses the authorized profile role instead of the role query", async () => {
    adminPageMocks.cookieToken = "accountant-token";
    adminPageMocks.loadAdminShellData.mockClear();
    const { default: AdminPage } = await import("./page");

    const element = await AdminPage({
      searchParams: Promise.resolve({
        role: "owner",
        section: "users",
      }),
    });

    expect(adminPageMocks.loadAdminShellData).toHaveBeenCalledWith({
      activeSection: "finances",
      role: "accountant",
    });
    expect(element.props).toMatchObject({
      activeSection: "finances",
      role: "accountant",
    });
  });

  it("surfaces temporary authorization infrastructure failures", async () => {
    adminPageMocks.cookieToken = "admin-token";
    adminPageMocks.authorization.message = "Service unavailable";
    adminPageMocks.authorization.ok = false;
    adminPageMocks.authorization.statusCode = 503;
    const { default: AdminPage } = await import("./page");

    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "Admin authorization service is temporarily unavailable.",
    );
    expect(adminPageMocks.loadAdminShellData).not.toHaveBeenCalled();
  });

  it("forwards the authorized profile's linked specialist to the admin data source", async () => {
    adminPageMocks.cookieToken = "administrator-token";
    adminPageMocks.authorization.role = "administrator";
    adminPageMocks.authorization.specialistId = "specialist-natali";
    adminPageMocks.loadAdminShellData.mockClear();
    const { default: AdminPage } = await import("./page");

    const element = await AdminPage({
      searchParams: Promise.resolve({ section: "calendar" }),
    });

    expect(adminPageMocks.loadAdminShellData).toHaveBeenCalledWith({
      activeSection: "calendar",
      role: "administrator",
      specialistId: "specialist-natali",
    });
    expect(element.props).toMatchObject({
      activeSection: "calendar",
      role: "administrator",
    });
  });
});
