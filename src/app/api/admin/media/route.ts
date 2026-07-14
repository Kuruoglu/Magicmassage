import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";

import { NextResponse } from "next/server";

import {
  adminMediaBucket,
  adminMediaFolders,
  getAdminMediaUrl,
  normalizeAdminMediaPath,
} from "@/lib/admin-media-path";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 12_000;

type MediaFolder = (typeof adminMediaFolders)[number];
type SupportedMediaType = keyof typeof EXTENSION_BY_MIME_TYPE;

const EXTENSION_BY_MIME_TYPE = {
  "application/pdf": "pdf",
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const ALLOWED_EXTENSIONS_BY_MIME_TYPE: Record<SupportedMediaType, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/avif": ["avif"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

type StorageUploadResult = {
  data: { path: string } | null;
  error: { message?: string } | null;
};

type StorageRemoveResult = {
  data: unknown;
  error: { message?: string } | null;
};

type MediaStorageClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>> & {
  storage: {
    from(bucket: string): {
      remove(paths: string[]): PromiseLike<StorageRemoveResult>;
      upload(
        path: string,
        body: ArrayBuffer,
        options: { contentType: string; upsert: false },
      ): PromiseLike<StorageUploadResult>;
    };
  };
};

type MediaDeletePayload = {
  path?: unknown;
};

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isSupportedMediaType(value: string): value is SupportedMediaType {
  return Object.hasOwn(EXTENSION_BY_MIME_TYPE, value);
}

function normalizeMediaFolder(value: FormDataEntryValue | null): MediaFolder | null {
  if (typeof value !== "string") return null;

  const rawFolder = value.trim().replaceAll("\\", "/");
  if (
    rawFolder === "" ||
    rawFolder.startsWith("/") ||
    rawFolder.endsWith("/") ||
    rawFolder.split("/").some((segment) => segment === "." || segment === "..") ||
    rawFolder.includes("/")
  ) {
    return null;
  }

  const normalizedFolder = rawFolder.toLowerCase();
  return (adminMediaFolders as readonly string[]).includes(normalizedFolder)
    ? (normalizedFolder as MediaFolder)
    : null;
}

function isValidFilename(filename: string, mimeType: SupportedMediaType) {
  if (
    filename.length === 0 ||
    filename.length > 255 ||
    filename !== filename.trim() ||
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(filename)
  ) {
    return false;
  }

  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined;
  return extension ? ALLOWED_EXTENSIONS_BY_MIME_TYPE[mimeType].includes(extension) : false;
}

function bytesMatch(bytes: Uint8Array, expected: readonly number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function asciiMatches(bytes: Uint8Array, expected: string, offset = 0) {
  return [...expected].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function hasAvifSignature(bytes: Uint8Array) {
  if (bytes.length < 16 || !asciiMatches(bytes, "ftyp", 4)) return false;

  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (boxSize < 16 || boxSize > bytes.length) return false;

  if (asciiMatches(bytes, "avif", 8) || asciiMatches(bytes, "avis", 8)) return true;

  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    if (asciiMatches(bytes, "avif", offset) || asciiMatches(bytes, "avis", offset)) return true;
  }

  return false;
}

function hasSupportedFileSignature(body: ArrayBuffer, mimeType: SupportedMediaType) {
  const bytes = new Uint8Array(body);

  switch (mimeType) {
    case "application/pdf":
      return asciiMatches(bytes, "%PDF-");
    case "image/avif":
      return hasAvifSignature(bytes);
    case "image/jpeg":
      return bytesMatch(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return asciiMatches(bytes, "RIFF") && asciiMatches(bytes, "WEBP", 8);
  }
}

function hasExpectedMultipartFields(formData: FormData) {
  const keys = [...formData.keys()];
  return (
    keys.length === 2 &&
    keys.filter((key) => key === "file").length === 1 &&
    keys.filter((key) => key === "folder").length === 1
  );
}

export async function POST(request: Request) {
  const client = createSupabaseAdminClient() as MediaStorageClient | null;

  if (!client) {
    return errorResponse("Forbidden", 403);
  }

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator", "editor"] },
  );

  if (!authorization.ok) {
    return errorResponse(authorization.message, authorization.statusCode);
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return errorResponse("Invalid media upload payload.", 400);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Invalid media upload payload.", 400);
  }

  if (!hasExpectedMultipartFields(formData)) {
    return errorResponse("Invalid media upload payload.", 400);
  }

  const file = formData.get("file");
  const folder = normalizeMediaFolder(formData.get("folder"));

  if (!(file instanceof File) || file.size === 0 || !folder) {
    return errorResponse("Invalid media upload payload.", 400);
  }

  if (!isSupportedMediaType(file.type) || !isValidFilename(file.name, file.type)) {
    return errorResponse("Unsupported media type.", 415);
  }

  if (file.size > MAX_MEDIA_BYTES) {
    return errorResponse("Media file exceeds the 10 MB limit.", 413);
  }

  try {
    const body = await file.arrayBuffer();
    if (!hasSupportedFileSignature(body, file.type)) {
      return errorResponse("Unsupported media type.", 415);
    }

    let dimensions: { height: number; width: number } | null = null;
    if (file.type !== "application/pdf") {
      try {
        const measured = imageSize(new Uint8Array(body));
        if (!measured.width || !measured.height || measured.width > MAX_IMAGE_DIMENSION || measured.height > MAX_IMAGE_DIMENSION) {
          return errorResponse("Invalid media dimensions.", 422);
        }
        dimensions = { height: measured.height, width: measured.width };
      } catch {
        return errorResponse("Invalid media dimensions.", 422);
      }
    }

    const path = `${folder}/${randomUUID()}.${EXTENSION_BY_MIME_TYPE[file.type]}`;
    const bucket = client.storage.from(adminMediaBucket);
    const { data, error } = await bucket.upload(path, body, {
      contentType: file.type,
      upsert: false,
    });

    if (error || data?.path !== path) {
      console.error("Admin media upload failed");
      return errorResponse("Media upload failed.", 502);
    }

    return NextResponse.json(
      {
        mimeType: file.type,
        path,
        publicUrl: getAdminMediaUrl(path),
        size: file.size,
        ...dimensions,
      },
      { status: 201 },
    );
  } catch {
    console.error("Admin media upload failed");
    return errorResponse("Media upload failed.", 502);
  }
}

export async function DELETE(request: Request) {
  const client = createSupabaseAdminClient() as MediaStorageClient | null;

  if (!client) {
    return errorResponse("Forbidden", 403);
  }

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator", "editor"] },
  );

  if (!authorization.ok) {
    return errorResponse(authorization.message, authorization.statusCode);
  }

  let payload: MediaDeletePayload;

  try {
    payload = (await request.json()) as MediaDeletePayload;
  } catch {
    return errorResponse("Invalid media cleanup payload.", 400);
  }

  const path = typeof payload.path === "string" ? normalizeAdminMediaPath(payload.path) : null;
  if (!path) {
    return errorResponse("Invalid media cleanup payload.", 400);
  }

  try {
    const managedAsset = await client
      .from("admin_media_assets")
      .select("id")
      .eq("url", getAdminMediaUrl(path));

    if (managedAsset.error) {
      console.error("Admin media cleanup reference check failed");
      return errorResponse("Media cleanup failed.", 502);
    }
    if ((managedAsset.data ?? []).length > 0) {
      return errorResponse("Managed media assets cannot be removed by cleanup.", 409);
    }

    const { error } = await client.storage.from(adminMediaBucket).remove([path]);
    if (error) {
      console.error("Admin media cleanup failed");
      return errorResponse("Media cleanup failed.", 502);
    }

    return NextResponse.json({ ok: true });
  } catch {
    console.error("Admin media cleanup failed");
    return errorResponse("Media cleanup failed.", 502);
  }
}
