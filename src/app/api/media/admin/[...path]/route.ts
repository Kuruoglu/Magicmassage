import { cookies } from "next/headers";

import { adminMediaBucket, getAdminMediaUrl, normalizeAdminMediaPath } from "@/lib/admin-media-path";
import {
  adminAccessTokenCookieName,
  allAdminRoles,
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

type MediaAccessClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>> & {
  storage: {
    from(bucket: string): {
      download(path: string): PromiseLike<{
        data: Blob | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

type MediaAssetAccessRow = {
  id: string;
  publication_consent_status: string;
  status: string;
};

type MediaPlacementAccessRow = {
  id: string;
  publish_at?: string | null;
};

function notFound() {
  return new Response(null, { status: 404 });
}

async function hasPublishedPlacement(client: MediaAccessClient, path: string) {
  const { data: assets, error: assetError } = await client
    .from("admin_media_assets")
    .select("id, publication_consent_status, status")
    .eq("url", getAdminMediaUrl(path));
  const asset = (assets?.[0] ?? null) as MediaAssetAccessRow | null;

  if (
    assetError ||
    !asset ||
    asset.status !== "ready" ||
    !["granted", "not_required"].includes(asset.publication_consent_status)
  ) {
    return false;
  }

  const { data: placements, error: placementError } = await client
    .from("admin_media_placements")
    .select("id, publish_at")
    .eq("media_asset_id", asset.id)
    .eq("is_published", true);

  return !placementError && (placements as MediaPlacementAccessRow[] | null)?.some(
    (placement) => !placement.publish_at || new Date(placement.publish_at).getTime() <= Date.now(),
  ) === true;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = normalizeAdminMediaPath((await context.params).path.join("/"));
  const client = createSupabaseAdminClient() as MediaAccessClient | null;

  if (!path || !client) return notFound();

  const cookieStore = await cookies();
  const token =
    getBearerToken(request.headers.get("authorization")) ??
    cookieStore.get(adminAccessTokenCookieName)?.value;
  const authorization = token
    ? await authorizeSupabaseAdminAccess(client, token, { allowedRoles: allAdminRoles })
    : null;
  const isAdminRequest = authorization?.ok === true;

  if (!isAdminRequest && !(await hasPublishedPlacement(client, path))) {
    return notFound();
  }

  const { data, error } = await client.storage.from(adminMediaBucket).download(path);
  if (error || !data) return notFound();

  return new Response(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(data.size),
      "Content-Type": data.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
