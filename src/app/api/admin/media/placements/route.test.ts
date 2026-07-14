// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";

import { POST } from "./route";

const placementRouteMock = vi.hoisted(() => ({
  asset: {
    data: { alt_text: "Massage room", id: "media-2", media_type: "photo", publication_consent_status: "granted", status: "ready" },
    error: null as { message: string } | null,
  },
  authorization: {
    mode: "supabase",
    ok: true,
    role: "editor",
    userId: "11111111-1111-4111-8111-111111111111",
  } as unknown,
  placement: {
    data: { id: "11111111-1111-4111-8111-111111111112", media_asset_id: "media-2", placement_key: "home.hero" },
    error: null as { message: string } | null,
  },
  replacePlacement: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async () => placementRouteMock.authorization),
    createSupabaseAdminClient: vi.fn(() => ({
      from(table: string) {
        if (table === "admin_media_assets") {
          const builder = {
            eq: vi.fn(() => builder),
            maybeSingle: vi.fn(async () => placementRouteMock.asset),
            select: vi.fn(() => builder),
          };
          return builder;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc: placementRouteMock.replacePlacement,
    })),
  };
});

function request(body: unknown) {
  return new Request("https://example.com/api/admin/media/placements", {
    body: JSON.stringify(body),
    headers: { authorization: "Bearer editor-token" },
    method: "POST",
  });
}

const validPayload = {
  mediaAssetId: "media-2",
  placementId: "11111111-1111-4111-8111-111111111112",
};

describe("admin media placement API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    placementRouteMock.authorization = {
      mode: "supabase",
      ok: true,
      role: "editor",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    placementRouteMock.asset = {
      data: { alt_text: "Massage room", id: "media-2", media_type: "photo", publication_consent_status: "granted", status: "ready" },
      error: null,
    };
    placementRouteMock.placement = {
      data: { id: validPayload.placementId, media_asset_id: "media-2", placement_key: "home.hero" },
      error: null,
    };
    placementRouteMock.replacePlacement.mockResolvedValue(placementRouteMock.placement);
  });

  it("requires a content role", async () => {
    placementRouteMock.authorization = { message: "Forbidden", mode: "supabase", ok: false, statusCode: 403 };
    const response = await POST(request(validPayload));
    expect(response.status).toBe(403);
    expect(authorizeSupabaseAdminAccess).toHaveBeenCalledWith(expect.anything(), "editor-token", {
      allowedRoles: ["owner", "administrator", "editor"],
    });
  });

  it("rejects malformed placement identifiers", async () => {
    const response = await POST(request({ ...validPayload, placementId: "../placement" }));
    expect(response.status).toBe(400);
    expect(placementRouteMock.replacePlacement).not.toHaveBeenCalled();
  });

  it("requires a ready asset with alt text and publication consent", async () => {
    placementRouteMock.asset.data = {
      alt_text: "",
      id: "media-2",
      media_type: "photo",
      publication_consent_status: "unknown",
      status: "draft",
    };
    const response = await POST(request(validPayload));
    expect(response.status).toBe(409);
    expect(placementRouteMock.replacePlacement).not.toHaveBeenCalled();
  });

  it("rejects non-photo assets even when they are otherwise publication-ready", async () => {
    placementRouteMock.asset.data = {
      alt_text: "Treatment protocol",
      id: "media-2",
      media_type: "document",
      publication_consent_status: "not_required",
      status: "ready",
    };

    const response = await POST(request(validPayload));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Media must be a ready photo with alt text and publication consent.",
    });
    expect(placementRouteMock.replacePlacement).not.toHaveBeenCalled();
  });

  it("replaces only the requested placement and writes audit history", async () => {
    const response = await POST(request(validPayload));
    expect(response.status).toBe(200);
    expect(placementRouteMock.replacePlacement).toHaveBeenCalledWith(
      "admin_replace_media_placement_with_audit",
      {
        p_actor_role: "editor",
        p_actor_user_id: "11111111-1111-4111-8111-111111111111",
        p_is_published: null,
        p_media_asset_id: "media-2",
        p_placement_id: validPayload.placementId,
      },
    );
  });

  it("fails the request when the atomic placement-and-audit RPC fails", async () => {
    placementRouteMock.replacePlacement.mockResolvedValueOnce({
      data: null,
      error: { message: "audit insert failed" },
    });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to replace media placement." });
  });
});
