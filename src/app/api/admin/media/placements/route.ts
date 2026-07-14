import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

type PlacementUpdatePayload = {
  isPublished?: boolean;
  mediaAssetId: string;
  placementId: string;
};

type PlacementQueryResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type PlacementQuery = {
  eq(column: string, value: unknown): PlacementQuery;
  maybeSingle(): PromiseLike<PlacementQueryResult>;
  select(columns: string): PlacementQuery;
};

type PlacementDataClient = {
  from(table: string): {
    select(columns: string): PlacementQuery;
  };
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): PromiseLike<PlacementQueryResult>;
};

const publicLocales = ["bg", "ru", "ua", "en"] as const;

function isPayload(value: unknown): value is PlacementUpdatePayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).every((key) => ["isPublished", "mediaAssetId", "placementId"].includes(key)) &&
    (record.isPublished === undefined || typeof record.isPublished === "boolean") &&
    typeof record.mediaAssetId === "string" &&
    record.mediaAssetId.trim().length > 0 &&
    typeof record.placementId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.placementId)
  );
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return errorResponse("Forbidden", 403);

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator", "editor"] },
  );
  if (!authorization.ok) return errorResponse(authorization.message, authorization.statusCode);
  const dataClient = client as unknown as PlacementDataClient;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid media placement payload.", 400);
  }
  if (!isPayload(payload)) return errorResponse("Invalid media placement payload.", 400);

  const { data: media, error: mediaError } = await dataClient
    .from("admin_media_assets")
    .select("id, alt_text, media_type, status, publication_consent_status")
    .eq("id", payload.mediaAssetId)
    .maybeSingle();

  if (mediaError) {
    console.error("Admin media placement asset lookup failed", mediaError.message);
    return errorResponse("Unable to replace media placement.", 500);
  }
  if (!media) return errorResponse("Media asset not found.", 404);
  if (
    media.media_type !== "photo" ||
    media.status !== "ready" ||
    !String(media.alt_text ?? "").trim() ||
    !["granted", "not_required"].includes(String(media.publication_consent_status))
  ) {
    return errorResponse("Media must be a ready photo with alt text and publication consent.", 409);
  }

  const { data: placement, error: placementError } = await dataClient.rpc(
    "admin_replace_media_placement_with_audit",
    {
      p_actor_role: authorization.role,
      p_actor_user_id: authorization.userId,
      p_is_published: payload.isPublished ?? null,
      p_media_asset_id: payload.mediaAssetId,
      p_placement_id: payload.placementId,
    },
  );

  if (placementError) {
    console.error("Admin media placement update failed", placementError.message);
    return errorResponse("Unable to replace media placement.", 500);
  }
  if (!placement) return errorResponse("Media placement not found.", 404);

  for (const locale of publicLocales) {
    revalidatePath(`/${locale}`, "layout");
  }

  return NextResponse.json({ placement });
}
