// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";

import { GET } from "./route";

const mediaProxyMock = vi.hoisted(() => ({
  assetRows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      publication_consent_status: "granted",
      status: "ready",
    },
  ],
  authorization: {
    message: "Unauthorized",
    mode: "supabase",
    ok: false,
    statusCode: 401,
  } as unknown,
  cookieToken: undefined as string | undefined,
  download: vi.fn(),
  placementRows: [{ id: "22222222-2222-4222-8222-222222222222", publish_at: null as string | null }],
  queriedTables: [] as string[],
  storageFrom: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => mediaProxyMock.cookieToken ? { value: mediaProxyMock.cookieToken } : undefined,
  })),
}));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async () => mediaProxyMock.authorization),
    createSupabaseAdminClient: vi.fn(() => ({
      auth: { getUser: vi.fn() },
      from: (table: string) => {
        mediaProxyMock.queriedTables.push(table);
        const rows = table === "admin_media_assets" ? mediaProxyMock.assetRows : mediaProxyMock.placementRows;
        const builder = {
          eq: () => builder,
          select: () => builder,
          then: (resolve: (value: unknown) => void) => resolve({ data: rows, error: null }),
        };
        return builder;
      },
      storage: { from: mediaProxyMock.storageFrom },
    })),
  };
});

const path = "gallery/11111111-1111-4111-8111-111111111111.webp";

function mediaRequest(authorization?: string) {
  return new Request(`https://example.com/api/media/admin/${path}`, {
    headers: authorization ? { authorization } : undefined,
  });
}

function context(value = path) {
  return { params: Promise.resolve({ path: value.split("/") }) };
}

describe("private admin media proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaProxyMock.assetRows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        publication_consent_status: "granted",
        status: "ready",
      },
    ];
    mediaProxyMock.authorization = {
      message: "Unauthorized",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };
    mediaProxyMock.cookieToken = undefined;
    mediaProxyMock.placementRows = [{ id: "22222222-2222-4222-8222-222222222222", publish_at: null }];
    mediaProxyMock.queriedTables = [];
    mediaProxyMock.download.mockResolvedValue({
      data: new Blob(["image"], { type: "image/webp" }),
      error: null,
    });
    mediaProxyMock.storageFrom.mockReturnValue({ download: mediaProxyMock.download });
  });

  it("serves any stored asset to an authenticated active admin without public placement lookup", async () => {
    mediaProxyMock.authorization = {
      mode: "supabase",
      ok: true,
      role: "viewer",
      userId: "33333333-3333-4333-8333-333333333333",
    };
    mediaProxyMock.cookieToken = "admin-cookie-token";

    const response = await GET(mediaRequest(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(authorizeSupabaseAdminAccess).toHaveBeenCalledWith(expect.anything(), "admin-cookie-token", {
      allowedRoles: ["owner", "administrator", "specialist", "editor", "accountant", "viewer"],
    });
    expect(mediaProxyMock.queriedTables).toEqual([]);
  });

  it("serves a ready consented asset only when it has a published placement", async () => {
    const response = await GET(mediaRequest(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("cache-control")).not.toContain("s-maxage");
    expect(mediaProxyMock.queriedTables).toEqual(["admin_media_assets", "admin_media_placements"]);
    expect(mediaProxyMock.storageFrom).toHaveBeenCalledWith("admin-media");
  });

  it.each([
    ["denied consent", "denied", "ready", true],
    ["unknown consent", "unknown", "ready", true],
    ["draft status", "granted", "draft", true],
    ["missing placement", "granted", "ready", false],
  ])("returns 404 for %s", async (_label, consent, status, hasPlacement) => {
    mediaProxyMock.assetRows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        publication_consent_status: consent,
        status,
      },
    ];
    mediaProxyMock.placementRows = hasPlacement ? mediaProxyMock.placementRows : [];

    const response = await GET(mediaRequest(), context());

    expect(response.status).toBe(404);
    expect(mediaProxyMock.download).not.toHaveBeenCalled();
  });

  it("keeps a scheduled placement private until its publication instant", async () => {
    mediaProxyMock.placementRows = [
      { id: "22222222-2222-4222-8222-222222222222", publish_at: "2999-01-01T00:00:00Z" },
    ];

    const response = await GET(mediaRequest(), context());

    expect(response.status).toBe(404);
    expect(mediaProxyMock.download).not.toHaveBeenCalled();
  });

  it("rejects non-canonical storage paths before querying or downloading", async () => {
    const response = await GET(mediaRequest(), context("gallery/../secret.webp"));

    expect(response.status).toBe(404);
    expect(mediaProxyMock.queriedTables).toEqual([]);
    expect(mediaProxyMock.download).not.toHaveBeenCalled();
  });
});
