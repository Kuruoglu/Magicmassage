// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";

import { DELETE, POST } from "./route";

vi.mock("image-size", () => ({ imageSize: vi.fn(() => ({ height: 600, width: 800 })) }));

const mediaRouteMock = vi.hoisted(() => ({
  authorization: {
    mode: "supabase",
    ok: true,
    role: "editor",
    userId: "11111111-1111-4111-8111-111111111111",
  } as unknown,
  dataFrom: vi.fn(),
  managedAssetError: null as { message?: string } | null,
  managedAssets: [] as Array<{ id: string }>,
  remove: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async () => mediaRouteMock.authorization),
    createSupabaseAdminClient: vi.fn(() => ({
      from: mediaRouteMock.dataFrom,
      storage: {
        from: mediaRouteMock.storageFrom,
      },
    })),
  };
});

function uploadRequest(
  file: File,
  folder = "services",
  authorization = "Bearer editor-token",
) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("folder", folder);

  return new Request("https://example.com/api/admin/media", {
    body: formData,
    headers: { authorization },
    method: "POST",
  });
}

const fileBytes = {
  avif: new Uint8Array([
    0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00,
    0x00, 0x61, 0x76, 0x69, 0x66,
  ]),
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  pdf: new TextEncoder().encode("%PDF-1.7"),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: new TextEncoder().encode("RIFF\u0004\u0000\u0000\u0000WEBP"),
};

describe("admin media upload API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaRouteMock.authorization = {
      mode: "supabase",
      ok: true,
      role: "editor",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    mediaRouteMock.upload.mockImplementation(async (path: string) => ({ data: { path }, error: null }));
    mediaRouteMock.managedAssetError = null;
    mediaRouteMock.managedAssets = [];
    mediaRouteMock.remove.mockResolvedValue({ data: [], error: null });
    mediaRouteMock.dataFrom.mockImplementation(() => {
      const builder = {
        eq: vi.fn(async () => ({
          data: mediaRouteMock.managedAssets,
          error: mediaRouteMock.managedAssetError,
        })),
        select: vi.fn(() => builder),
      };
      return builder;
    });
    mediaRouteMock.storageFrom.mockReturnValue({
      remove: mediaRouteMock.remove,
      upload: mediaRouteMock.upload,
    });
  });

  it("removes a newly uploaded object during compensated cleanup", async () => {
    const response = await DELETE(
      new Request("https://example.com/api/admin/media", {
        body: JSON.stringify({ path: "gallery/11111111-1111-4111-8111-111111111111.png" }),
        headers: { authorization: "Bearer editor-token", "content-type": "application/json" },
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(200);
    expect(mediaRouteMock.storageFrom).toHaveBeenCalledWith("admin-media");
    expect(mediaRouteMock.remove).toHaveBeenCalledWith([
      "gallery/11111111-1111-4111-8111-111111111111.png",
    ]);
  });

  it("rejects invalid cleanup paths before reaching storage", async () => {
    const response = await DELETE(
      new Request("https://example.com/api/admin/media", {
        body: JSON.stringify({ path: "../gallery/photo.png" }),
        headers: { authorization: "Bearer editor-token", "content-type": "application/json" },
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid media cleanup payload." });
    expect(mediaRouteMock.remove).not.toHaveBeenCalled();
  });

  it("never removes an object that is already managed by the media library", async () => {
    mediaRouteMock.managedAssets = [{ id: "media-managed" }];

    const response = await DELETE(
      new Request("https://example.com/api/admin/media", {
        body: JSON.stringify({ path: "gallery/11111111-1111-4111-8111-111111111111.png" }),
        headers: { authorization: "Bearer editor-token", "content-type": "application/json" },
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Managed media assets cannot be removed by cleanup.",
    });
    expect(mediaRouteMock.remove).not.toHaveBeenCalled();
  });

  it("authenticates bearer sessions and restricts uploads to content roles", async () => {
    const response = await POST(
      uploadRequest(new File([fileBytes.jpeg], "photo.jpg", { type: "image/jpeg" })),
    );

    expect(response.status).toBe(201);
    expect(authorizeSupabaseAdminAccess).toHaveBeenCalledWith(expect.anything(), "editor-token", {
      allowedRoles: ["owner", "administrator", "editor"],
    });
  });

  it("returns stable authentication failures without reaching storage", async () => {
    mediaRouteMock.authorization = {
      message: "Unauthorized",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };

    const response = await POST(
      uploadRequest(new File([fileBytes.jpeg], "photo.jpg", { type: "image/jpeg" }), "services", ""),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mediaRouteMock.storageFrom).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types and mismatched filename extensions", async () => {
    const unsupported = await POST(uploadRequest(new File(["gif"], "photo.gif", { type: "image/gif" })));
    const mismatched = await POST(
      uploadRequest(new File([fileBytes.png], "photo.pdf", { type: "image/png" })),
    );
    const spoofed = await POST(
      uploadRequest(new File(["not an image"], "photo.png", { type: "image/png" })),
    );

    expect(unsupported.status).toBe(415);
    expect(mismatched.status).toBe(415);
    expect(spoofed.status).toBe(415);
    await expect(unsupported.json()).resolves.toEqual({ error: "Unsupported media type." });
    expect(mediaRouteMock.upload).not.toHaveBeenCalled();
  });

  it.each([
    ["photo.jpg", "image/jpeg", fileBytes.jpeg],
    ["photo.png", "image/png", fileBytes.png],
    ["photo.webp", "image/webp", fileBytes.webp],
    ["photo.avif", "image/avif", fileBytes.avif],
    ["document.pdf", "application/pdf", fileBytes.pdf],
  ])("accepts an allowed %s upload with a valid file signature", async (filename, mimeType, bytes) => {
    const response = await POST(uploadRequest(new File([bytes], filename, { type: mimeType })));

    expect(response.status).toBe(201);
  });

  it("rejects files larger than 10 MB", async () => {
    const oversizedFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    });

    const response = await POST(uploadRequest(oversizedFile));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Media file exceeds the 10 MB limit." });
    expect(mediaRouteMock.upload).not.toHaveBeenCalled();
  });

  it("rejects folder traversal and path-like filenames", async () => {
    const traversal = await POST(
      uploadRequest(new File([fileBytes.webp], "photo.webp", { type: "image/webp" }), "../services"),
    );
    const pathFilename = await POST(
      uploadRequest(new File([fileBytes.webp], "..\\photo.webp", { type: "image/webp" })),
    );

    expect(traversal.status).toBe(400);
    expect(pathFilename.status).toBe(415);
    expect(mediaRouteMock.upload).not.toHaveBeenCalled();
  });

  it("returns a generic storage error without exposing or logging provider details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mediaRouteMock.upload.mockResolvedValue({
      data: null,
      error: { message: "secret provider detail" },
    });

    const response = await POST(
      uploadRequest(new File([fileBytes.pdf], "document.pdf", { type: "application/pdf" })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Media upload failed." });
    expect(consoleError).toHaveBeenCalledWith("Admin media upload failed");
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("secret provider detail"));
    consoleError.mockRestore();
  });

  it("uploads with a server UUID path, never overwrites, and returns public metadata", async () => {
    const file = new File([fileBytes.png], "Massage Photo.PNG", { type: "image/png" });

    const response = await POST(uploadRequest(file, "Gallery"));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(mediaRouteMock.storageFrom).toHaveBeenCalledWith("admin-media");
    expect(mediaRouteMock.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^gallery\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/),
      expect.any(ArrayBuffer),
      { contentType: "image/png", upsert: false },
    );
    expect(result).toEqual({
      height: 600,
      mimeType: "image/png",
      path: expect.stringMatching(/^gallery\/.+\.png$/),
      publicUrl: `/api/media/admin/${result.path}`,
      size: file.size,
      width: 800,
    });
    expect(result.path).not.toContain(file.name);
  });
});
