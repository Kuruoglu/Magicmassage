import "server-only";

import { sanitizePublicBlogHtml } from "./sanitize";
import {
  publicContentLocales,
  type PublicBlogPost,
  type PublicBlogPostSummary,
  type PublicContentDataLayer,
  type PublicContentLocale,
  type PublicContentLogger,
  type PublicContentQuery,
  type PublicContentReadOptions,
  type PublicContentResult,
  type PublicContentSupabaseClient,
  type PublicMediaAsset,
  type PublicMediaPlacement,
  type PublicService,
  type PublicServicePrice,
  type PublicSiteFeatures,
} from "./types";

const serviceColumns =
  "slug, category, default_duration_minutes, cover_media_id, display_order, updated_at";
const serviceTranslationColumns =
  "service_slug, locale, title, short_description, body, seo_title, seo_description, canonical_url, robots_directives, og_title, og_description, og_image_media_id, updated_at";
const priceColumns =
  "id, service_slug, duration_minutes, price_cents, currency, display_order, updated_on";
const mediaPlacementColumns =
  "id, placement_key, page_key, slot_key, locale, sort_order, caption_localized, media_asset_id, url, mime_type, byte_size, width_pixels, height_pixels, alt_text, alt_text_localized, updated_at";
const mediaAssetColumns =
  "id, url, mime_type, byte_size, width_pixels, height_pixels, alt_text, alt_text_localized, updated_at";
const blogColumns =
  "id, slug, locale, title, category, author, tag_labels, sanitized_html, canonical_url, meta_description, robots_directives, og_title, og_description, cover_media_id, cover_alt_text, og_image_media_id, hreflang, published_at, updated_at";

class PublicContentReadError extends Error {
  constructor(readonly kind: "invalid_data" | "query_error") {
    super("Public content read failed");
  }
}

const defaultLogger: PublicContentLogger = {
  error(message, context) {
    console.error(message, context);
  },
};

type UnknownRow = Record<string, unknown>;

function notConfigured(
  reason: "public_supabase_not_configured" | "public_content_row_missing",
) {
  return {
    data: null,
    fallback: "static-content",
    reason,
    source: "supabase",
    status: "not_configured",
  } as const;
}

function queryFailed() {
  return {
    data: null,
    fallback: "static-content",
    reason: "public_content_query_failed",
    source: "supabase",
    status: "query_failed",
  } as const;
}

function ok<T>(data: T): PublicContentResult<T> {
  return { data, source: "supabase", status: "ok" };
}

function localeChain(locale: PublicContentLocale, options?: PublicContentReadOptions) {
  const fallbackLocale = options?.fallbackLocale ?? "bg";

  if (!isLocale(locale) || !isLocale(fallbackLocale)) {
    throw new PublicContentReadError("invalid_data");
  }

  return locale === fallbackLocale ? [locale] : [locale, fallbackLocale];
}

function isLocale(value: unknown): value is PublicContentLocale {
  return typeof value === "string" && publicContentLocales.includes(value as PublicContentLocale);
}

function asRow(value: unknown): UnknownRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicContentReadError("invalid_data");
  }

  return value as UnknownRow;
}

function asString(row: UnknownRow, key: string, allowEmpty = false) {
  const value = row[key];

  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new PublicContentReadError("invalid_data");
  }

  return value.trim();
}

function asNullableString(row: UnknownRow, key: string) {
  const value = row[key];

  if (value === null) {
    return null;
  }

  return asString(row, key);
}

function asInteger(row: UnknownRow, key: string, minimum?: number) {
  const value = row[key];

  if (!Number.isInteger(value) || (minimum !== undefined && (value as number) < minimum)) {
    throw new PublicContentReadError("invalid_data");
  }

  return value as number;
}

function asNullableInteger(row: UnknownRow, key: string, minimum?: number) {
  return row[key] === null ? null : asInteger(row, key, minimum);
}

function asBoolean(row: UnknownRow, key: string) {
  if (typeof row[key] !== "boolean") {
    throw new PublicContentReadError("invalid_data");
  }

  return row[key] as boolean;
}

function asIsoDate(row: UnknownRow, key: string) {
  const value = asString(row, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new PublicContentReadError("invalid_data");
  }

  return value;
}

function asStringArray(row: UnknownRow, key: string) {
  const value = row[key];

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new PublicContentReadError("invalid_data");
  }

  return value.map((item) => (item as string).trim());
}

function isPublicUrl(value: string) {
  if (/\s/.test(value) || value.includes("\\")) {
    return false;
  }

  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function asPublicUrl(row: UnknownRow, key: string, allowEmpty = false) {
  const value = asString(row, key, allowEmpty);

  if (allowEmpty && !value) {
    return null;
  }

  if (!isPublicUrl(value)) {
    throw new PublicContentReadError("invalid_data");
  }

  return value;
}

function asLocalizedStrings(row: UnknownRow, key: string) {
  const value = asRow(row[key]);
  const localized: Partial<Record<PublicContentLocale, string>> = {};

  for (const [locale, text] of Object.entries(value)) {
    if (!isLocale(locale) || typeof text !== "string") {
      throw new PublicContentReadError("invalid_data");
    }

    localized[locale] = text.trim();
  }

  return localized;
}

function asLocale(row: UnknownRow, key: string) {
  const value = row[key];

  if (!isLocale(value)) {
    throw new PublicContentReadError("invalid_data");
  }

  return value;
}

function asNullableLocale(row: UnknownRow, key: string) {
  return row[key] === null ? null : asLocale(row, key);
}

function asSlug(row: UnknownRow, key: string) {
  const value = asString(row, key);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new PublicContentReadError("invalid_data");
  }

  return value;
}

async function readRows(query: PublicContentQuery) {
  const { data, error } = await query;

  if (error) {
    throw new PublicContentReadError("query_error");
  }

  if (!Array.isArray(data)) {
    throw new PublicContentReadError("invalid_data");
  }

  return data;
}

function mapMediaAsset(
  value: unknown,
  localeOrder: readonly PublicContentLocale[],
): PublicMediaAsset {
  const row = asRow(value);
  const legacyAlt = asString(row, "alt_text", true);
  const localizedAltText = asLocalizedStrings(row, "alt_text_localized");

  return {
    altText:
      localeOrder.map((locale) => localizedAltText[locale]).find(Boolean) ?? legacyAlt,
    byteSize: asNullableInteger(row, "byte_size", 0),
    height: asNullableInteger(row, "height_pixels", 1),
    id: asString(row, "id"),
    localizedAltText,
    mimeType: asNullableString(row, "mime_type"),
    updatedAt: asIsoDate(row, "updated_at"),
    url: asPublicUrl(row, "url") as string,
    width: asNullableInteger(row, "width_pixels", 1),
  };
}

function mapMediaPlacement(value: unknown, localeOrder: readonly PublicContentLocale[]): PublicMediaPlacement {
  const row = asRow(value);
  const captions = asLocalizedStrings(row, "caption_localized");
  const media = mapMediaAsset(
    {
      alt_text: row.alt_text,
      alt_text_localized: row.alt_text_localized,
      byte_size: row.byte_size,
      height_pixels: row.height_pixels,
      id: row.media_asset_id,
      mime_type: row.mime_type,
      updated_at: row.updated_at,
      url: row.url,
      width_pixels: row.width_pixels,
    },
    localeOrder,
  );

  return {
    caption: localeOrder.map((locale) => captions[locale]).find(Boolean) ?? "",
    id: asString(row, "id"),
    locale: asNullableLocale(row, "locale"),
    media,
    pageKey: asString(row, "page_key"),
    placementKey: asString(row, "placement_key"),
    slotKey: asString(row, "slot_key"),
    sortOrder: asInteger(row, "sort_order"),
    updatedAt: asIsoDate(row, "updated_at"),
  };
}

function mapPrice(value: unknown) {
  const row = asRow(value);

  if (asString(row, "currency") !== "EUR") {
    throw new PublicContentReadError("invalid_data");
  }

  return {
    price: {
      currency: "EUR",
      durationMinutes: asInteger(row, "duration_minutes", 1),
      id: asString(row, "id"),
      priceCents: asInteger(row, "price_cents", 0),
      sortOrder: asInteger(row, "display_order"),
      updatedOn: asIsoDate(row, "updated_on"),
    } satisfies PublicServicePrice,
    serviceSlug: asSlug(row, "service_slug"),
  };
}

function mapServiceBase(value: unknown) {
  const row = asRow(value);

  return {
    category: asString(row, "category"),
    coverMediaId: asNullableString(row, "cover_media_id"),
    defaultDurationMinutes: asNullableInteger(row, "default_duration_minutes", 1),
    slug: asSlug(row, "slug"),
    sortOrder: asInteger(row, "display_order"),
    updatedAt: asIsoDate(row, "updated_at"),
  };
}

function mapServiceTranslation(value: unknown) {
  const row = asRow(value);

  return {
    body: asString(row, "body"),
    canonicalUrl: asPublicUrl(row, "canonical_url", true),
    locale: asLocale(row, "locale"),
    ogDescription: asString(row, "og_description", true),
    ogImageMediaId: asNullableString(row, "og_image_media_id"),
    ogTitle: asString(row, "og_title", true),
    robots: asString(row, "robots_directives"),
    seoDescription: asString(row, "seo_description", true),
    seoTitle: asString(row, "seo_title", true),
    serviceSlug: asSlug(row, "service_slug"),
    shortDescription: asString(row, "short_description"),
    title: asString(row, "title"),
    updatedAt: asIsoDate(row, "updated_at"),
  };
}

function mapBlogRow(value: unknown) {
  const row = asRow(value);
  const sanitizedHtml = sanitizePublicBlogHtml(asString(row, "sanitized_html"));

  if (!sanitizedHtml) {
    throw new PublicContentReadError("invalid_data");
  }

  return {
    author: asString(row, "author", true),
    canonicalUrl: asPublicUrl(row, "canonical_url", true),
    category: asString(row, "category"),
    coverAlt: asString(row, "cover_alt_text"),
    coverMediaId: asNullableString(row, "cover_media_id"),
    hreflang: asLocalizedUrls(row, "hreflang"),
    html: sanitizedHtml,
    id: asString(row, "id"),
    locale: asLocale(row, "locale"),
    metaDescription: asString(row, "meta_description", true),
    ogDescription: asString(row, "og_description", true),
    ogImageMediaId: asNullableString(row, "og_image_media_id"),
    ogTitle: asString(row, "og_title", true),
    publishedAt: asIsoDate(row, "published_at"),
    robots: asString(row, "robots_directives"),
    slug: asSlug(row, "slug"),
    tags: asStringArray(row, "tag_labels"),
    title: asString(row, "title"),
    updatedAt: asIsoDate(row, "updated_at"),
  };
}

function asLocalizedUrls(row: UnknownRow, key: string) {
  const values = asLocalizedStrings(row, key);

  for (const value of Object.values(values)) {
    if (value && !isPublicUrl(value)) {
      throw new PublicContentReadError("invalid_data");
    }
  }

  return values;
}

function newestTimestamp(...values: string[]) {
  return [...values].sort((left, right) => right.localeCompare(left))[0];
}

function byLocale<T extends { locale: PublicContentLocale }>(
  rows: readonly T[],
  localeOrder: readonly PublicContentLocale[],
) {
  return [...rows].sort(
    (left, right) => localeOrder.indexOf(left.locale) - localeOrder.indexOf(right.locale),
  )[0];
}

function sortPrices(prices: PublicServicePrice[]) {
  return prices.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.durationMinutes - right.durationMinutes ||
      left.id.localeCompare(right.id),
  );
}

function collectMediaIds(rows: Array<{ coverMediaId: string | null; ogImageMediaId?: string | null }>) {
  return [...new Set(rows.flatMap((row) => [row.coverMediaId, row.ogImageMediaId].filter(Boolean) as string[]))];
}

async function readMediaAssets(
  client: PublicContentSupabaseClient,
  ids: readonly string[],
  localeOrder: readonly PublicContentLocale[],
) {
  if (ids.length === 0) {
    return new Map<string, PublicMediaAsset>();
  }

  const rows = await readRows(
    client
      .from("admin_media_assets")
      .select(mediaAssetColumns)
      .in("id", ids)
      .eq("status", "ready")
      .order("id", { ascending: true }),
  );
  const media = rows.map((row) => mapMediaAsset(row, localeOrder));

  return new Map(media.map((asset) => [asset.id, asset]));
}

function selectMediaPlacements(
  placements: PublicMediaPlacement[],
  localeOrder: readonly PublicContentLocale[],
) {
  const localeRank = (locale: PublicContentLocale | null) =>
    locale === null ? localeOrder.length : localeOrder.indexOf(locale);
  const selected = new Map<string, PublicMediaPlacement>();

  for (const placement of placements) {
    const current = selected.get(placement.placementKey);

    if (!current || localeRank(placement.locale) < localeRank(current.locale)) {
      selected.set(placement.placementKey, placement);
    }
  }

  return [...selected.values()].sort(
    (left, right) =>
      left.pageKey.localeCompare(right.pageKey) ||
      left.slotKey.localeCompare(right.slotKey) ||
      left.sortOrder - right.sortOrder ||
      left.placementKey.localeCompare(right.placementKey),
  );
}

function toBlogPost(
  row: ReturnType<typeof mapBlogRow>,
  requestedLocale: PublicContentLocale,
  media: Map<string, PublicMediaAsset>,
): PublicBlogPost {
  const coverMedia = row.coverMediaId ? (media.get(row.coverMediaId) ?? null) : null;
  const ogImage = row.ogImageMediaId ? (media.get(row.ogImageMediaId) ?? null) : null;

  return {
    author: row.author,
    category: row.category,
    coverAlt: row.coverAlt,
    coverMedia: coverMedia ? { ...coverMedia, altText: row.coverAlt } : null,
    html: row.html,
    id: row.id,
    locale: row.locale,
    publishedAt: row.publishedAt,
    seo: {
      canonicalUrl: row.canonicalUrl,
      description: row.metaDescription,
      hreflang: row.hreflang,
      ogDescription: row.ogDescription,
      ogImage: ogImage ? { ...ogImage, altText: row.coverAlt } : null,
      ogTitle: row.ogTitle,
      robots: row.robots,
    },
    slug: row.slug,
    tags: row.tags,
    title: row.title,
    updatedAt: row.updatedAt,
    usedLocaleFallback: row.locale !== requestedLocale,
  };
}

function toBlogSummary(post: PublicBlogPost): PublicBlogPostSummary {
  return {
    author: post.author,
    category: post.category,
    coverAlt: post.coverAlt,
    coverMedia: post.coverMedia,
    id: post.id,
    locale: post.locale,
    publishedAt: post.publishedAt,
    seo: post.seo,
    slug: post.slug,
    tags: post.tags,
    title: post.title,
    updatedAt: post.updatedAt,
    usedLocaleFallback: post.usedLocaleFallback,
  };
}

export function createPublicContentDataLayer(
  client: PublicContentSupabaseClient | null,
  logger: PublicContentLogger = defaultLogger,
): PublicContentDataLayer {
  async function execute<T>(operation: string, read: () => Promise<PublicContentResult<T>>) {
    if (!client) {
      return notConfigured("public_supabase_not_configured");
    }

    try {
      return await read();
    } catch (error) {
      const cause =
        error instanceof PublicContentReadError
          ? error.kind
          : "unexpected_error";

      logger.error("Public Supabase content read failed", { cause, operation });

      return queryFailed();
    }
  }

  async function listServices(
    locale: PublicContentLocale,
    options?: PublicContentReadOptions,
  ) {
    return execute("listServices", async () => {
      const locales = localeChain(locale, options);
      const [serviceRows, placementRows] = await Promise.all([
        readRows(
          client!
            .from("admin_published_services")
            .select(serviceColumns)
            .order("display_order", { ascending: true })
            .order("slug", { ascending: true }),
        ),
        readRows(
          client!
            .from("admin_published_media_placements")
            .select(mediaPlacementColumns)
            .order("page_key", { ascending: true })
            .order("slot_key", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("placement_key", { ascending: true }),
        ),
      ]);
      const bases = serviceRows
        .map(mapServiceBase)
        .sort(
          (left, right) => left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug),
        );
      const slugs = bases.map((service) => service.slug);
      const placements = selectMediaPlacements(
        placementRows
          .map((row) => mapMediaPlacement(row, locales))
          .filter((placement) => placement.locale === null || locales.includes(placement.locale)),
        locales,
      );

      if (slugs.length === 0) {
        return ok({ mediaPlacements: placements, requestedLocale: locale, services: [] });
      }

      const [translationRows, priceRows] = await Promise.all([
        readRows(
          client!
            .from("admin_published_service_translations")
            .select(serviceTranslationColumns)
            .in("service_slug", slugs)
            .in("locale", locales)
            .order("service_slug", { ascending: true })
            .order("locale", { ascending: true }),
        ),
        readRows(
          client!
            .from("admin_published_price_variants")
            .select(priceColumns)
            .in("service_slug", slugs)
            .order("display_order", { ascending: true })
            .order("duration_minutes", { ascending: true })
            .order("id", { ascending: true }),
        ),
      ]);
      const translations = translationRows.map(mapServiceTranslation);
      const prices = priceRows.map(mapPrice);
      const selectedTranslations = bases.flatMap((base) => {
        const selected = byLocale(
          translations.filter((translation) => translation.serviceSlug === base.slug),
          locales,
        );

        return selected ? [{ base, translation: selected }] : [];
      });
      const mediaIds = collectMediaIds(
        selectedTranslations.map(({ translation }) => ({
          coverMediaId: null,
          ogImageMediaId: translation.ogImageMediaId,
        })),
      );
      const media = await readMediaAssets(client!, mediaIds, locales);
      const services: PublicService[] = selectedTranslations.map(({ base, translation }) => {
        const coverPlacement = placements.find(
          (placement) => placement.pageKey === `service:${base.slug}` && placement.slotKey === "cover",
        );

        return {
          body: translation.body,
          category: base.category,
          coverMedia: coverPlacement?.media ?? null,
          defaultDurationMinutes: base.defaultDurationMinutes,
          locale: translation.locale,
          prices: sortPrices(
            prices
              .filter((entry) => entry.serviceSlug === base.slug)
              .map((entry) => entry.price),
          ),
          seo: {
            canonicalUrl: translation.canonicalUrl,
            description: translation.seoDescription,
            ogDescription: translation.ogDescription,
            ogImage: translation.ogImageMediaId
              ? (media.get(translation.ogImageMediaId) ?? null)
              : null,
            ogTitle: translation.ogTitle,
            robots: translation.robots,
            title: translation.seoTitle,
          },
          shortDescription: translation.shortDescription,
          slug: base.slug,
          sortOrder: base.sortOrder,
          title: translation.title,
          updatedAt: newestTimestamp(base.updatedAt, translation.updatedAt),
          usedLocaleFallback: translation.locale !== locale,
        };
      });

      return ok({ mediaPlacements: placements, requestedLocale: locale, services });
    });
  }

  async function listBlogPosts(
    locale: PublicContentLocale,
    options?: PublicContentReadOptions,
  ) {
    return execute("listBlogPosts", async () => {
      const locales = localeChain(locale, options);
      const rows = await readRows(
        client!
          .from("admin_published_blog_posts")
          .select(blogColumns)
          .in("locale", locales)
          .order("published_at", { ascending: false })
          .order("slug", { ascending: true }),
      );
      const mapped = rows.map(mapBlogRow);
      const selected = [...new Set(mapped.map((post) => post.slug))]
        .map((slug) => byLocale(mapped.filter((post) => post.slug === slug), locales))
        .filter((post): post is ReturnType<typeof mapBlogRow> => Boolean(post));
      const media = await readMediaAssets(client!, collectMediaIds(selected), locales);
      const posts = selected
        .map((post) => toBlogSummary(toBlogPost(post, locale, media)))
        .sort(
          (left, right) =>
            right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug),
        );

      return ok({ posts, requestedLocale: locale });
    });
  }

  async function getBlogPost(
    slug: string,
    locale: PublicContentLocale,
    options?: PublicContentReadOptions,
  ) {
    return execute("getBlogPost", async () => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new PublicContentReadError("invalid_data");
      }

      const locales = localeChain(locale, options);
      const rows = await readRows(
        client!
          .from("admin_published_blog_posts")
          .select(blogColumns)
          .eq("slug", slug)
          .in("locale", locales)
          .order("locale", { ascending: true })
          .limit(locales.length),
      );
      const selected = byLocale(rows.map(mapBlogRow), locales);

      if (!selected) {
        return ok(null);
      }

      const media = await readMediaAssets(client!, collectMediaIds([selected]), locales);

      return ok(toBlogPost(selected, locale, media));
    });
  }

  async function getSiteFeatures() {
    return execute<PublicSiteFeatures>("getSiteFeatures", async () => {
      const rows = await readRows(
        client!
          .from("admin_public_site_flags")
          .select("id, gift_certificates_enabled, public_booking_enabled")
          .eq("id", "site")
          .limit(1),
      );

      if (rows.length === 0) {
        return notConfigured("public_content_row_missing");
      }

      const row = asRow(rows[0]);

      if (asString(row, "id") !== "site") {
        throw new PublicContentReadError("invalid_data");
      }

      return ok({
        giftCertificatesEnabled: asBoolean(row, "gift_certificates_enabled"),
        publicBookingEnabled: asBoolean(row, "public_booking_enabled"),
      });
    });
  }

  return { getBlogPost, getSiteFeatures, listBlogPosts, listServices };
}
