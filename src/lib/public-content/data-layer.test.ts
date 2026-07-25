import { describe, expect, it, vi } from "vitest";

import { createPublicContentDataLayer } from "./data-layer";
import type {
  PublicContentQuery,
  PublicContentQueryResponse,
  PublicContentSupabaseClient,
} from "./types";

type QueryCall = {
  args: unknown[];
  method: "eq" | "in" | "limit" | "order" | "select";
  table: string;
};

function createMockClient(
  responses: Record<string, PublicContentQueryResponse | PublicContentQueryResponse[]>,
) {
  const calls: QueryCall[] = [];
  const queues = new Map(
    Object.entries(responses).map(([table, response]) => [
      table,
      Array.isArray(response) ? [...response] : [response],
    ]),
  );

  const client: PublicContentSupabaseClient = {
    from(table) {
      return {
        select(columns) {
          calls.push({ args: [columns], method: "select", table });
          const response = queues.get(table)?.shift() ?? { data: [], error: null };
          const query: PublicContentQuery = {
            eq(column: string, value: unknown) {
              calls.push({ args: [column, value], method: "eq", table });
              return query;
            },
            in(column: string, values: readonly unknown[]) {
              calls.push({ args: [column, values], method: "in", table });
              return query;
            },
            limit(count: number) {
              calls.push({ args: [count], method: "limit", table });
              return query;
            },
            order(column: string, options?: { ascending?: boolean }) {
              calls.push({ args: [column, options], method: "order", table });
              return query;
            },
            then<TResult1 = PublicContentQueryResponse, TResult2 = never>(
              onfulfilled?: ((value: PublicContentQueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ) {
              return Promise.resolve(response).then(onfulfilled, onrejected);
            },
          } satisfies PublicContentQuery;

          return query;
        },
      };
    },
  };

  return { calls, client };
}

const mediaAsset = {
  alt_text: "Legacy alt",
  alt_text_localized: { bg: "Bulgarian alt", ru: "Russian alt" },
  byte_size: 1200,
  height_pixels: 800,
  id: "media-cover",
  mime_type: "image/webp",
  updated_at: "2026-07-02T10:00:00Z",
  url: "/media/cover.webp",
  width_pixels: 1200,
};

const blogRow = {
  author: "Natali",
  canonical_url: "https://magicmassage.bg/ru/blog/care-guide",
  category: "Care",
  cover_alt_text: "Massage preparation guide cover",
  cover_media_id: "media-cover",
  hreflang: { bg: "https://magicmassage.bg/bg/blog/care-guide" },
  id: "post-1",
  locale: "ru",
  meta_description: "A safe summary",
  og_description: "OG description",
  og_image_media_id: "media-cover",
  og_title: "OG title",
  published_at: "2026-07-10T09:00:00Z",
  robots_directives: "index,follow",
  sanitized_html:
    '<h2>Care</h2><script>alert(1)</script><p><a href="javascript:alert(2)">Read</a></p>',
  slug: "care-guide",
  tag_labels: ["care", "massage"],
  title: "Care guide",
  translation_key: "care-guide",
  updated_at: "2026-07-11T09:00:00Z",
};

describe("public content data layer", () => {
  it("returns an explicit static fallback when Supabase is not configured", async () => {
    const layer = createPublicContentDataLayer(null);

    await expect(layer.listServices("bg")).resolves.toEqual({
      data: null,
      fallback: "static-content",
      reason: "public_supabase_not_configured",
      source: "supabase",
      status: "not_configured",
    });
  });

  it("maps services with per-service locale fallback, prices, media, and deterministic order", async () => {
    const { calls, client } = createMockClient({
      admin_media_assets: { data: [mediaAsset], error: null },
      admin_published_price_variants: {
        data: [
          {
            currency: "EUR",
            display_order: 2,
            duration_minutes: 90,
            id: "price-90",
            price_cents: 9000,
            service_slug: "classic-massage",
            updated_on: "2026-07-09",
          },
          {
            currency: "EUR",
            display_order: 1,
            duration_minutes: 60,
            id: "price-60",
            price_cents: 6500,
            service_slug: "classic-massage",
            updated_on: "2026-07-08",
          },
        ],
        error: null,
      },
      admin_published_media_placements: {
        data: [
          {
            ...mediaAsset,
            caption_localized: { bg: "Studio", ru: "Studio RU" },
            id: "placement-ru",
            locale: "ru",
            media_asset_id: "media-cover",
            page_key: "service:classic-massage",
            placement_key: "service:classic-massage:cover",
            slot_key: "cover",
            sort_order: 1,
          },
          {
            ...mediaAsset,
            caption_localized: { bg: "Global studio" },
            id: "placement-global",
            locale: null,
            media_asset_id: "media-cover",
            page_key: "service:classic-massage",
            placement_key: "service:classic-massage:cover",
            slot_key: "cover",
            sort_order: 0,
          },
          {
            ...mediaAsset,
            caption_localized: { en: "Ignored" },
            id: "placement-en",
            locale: "en",
            media_asset_id: "media-cover",
            page_key: "classic-massage",
            placement_key: "classic-en",
            slot_key: "hero",
            sort_order: 0,
          },
        ],
        error: null,
      },
      admin_published_service_translations: {
        data: [
          {
            body: "Bulgarian fallback body",
            canonical_url: "/bg/services/lymphatic-massage",
            locale: "bg",
            og_description: "",
            og_image_media_id: null,
            og_title: "",
            robots_directives: "index,follow",
            seo_description: "BG description",
            seo_title: "BG SEO",
            service_slug: "lymphatic-massage",
            short_description: "BG short",
            title: "BG lymphatic",
            updated_at: "2026-07-04T10:00:00Z",
          },
          {
            body: "Russian body",
            canonical_url: "/ru/services/classic-massage",
            locale: "ru",
            og_description: "OG description",
            og_image_media_id: "media-cover",
            og_title: "OG title",
            robots_directives: "index,follow",
            seo_description: "RU description",
            seo_title: "RU SEO",
            service_slug: "classic-massage",
            short_description: "RU short",
            title: "RU classic",
            updated_at: "2026-07-03T10:00:00Z",
          },
          {
            body: "Bulgarian body",
            canonical_url: "/bg/services/classic-massage",
            locale: "bg",
            og_description: "",
            og_image_media_id: null,
            og_title: "",
            robots_directives: "index,follow",
            seo_description: "BG description",
            seo_title: "BG SEO",
            service_slug: "classic-massage",
            short_description: "BG short",
            title: "BG classic",
            updated_at: "2026-07-02T10:00:00Z",
          },
        ],
        error: null,
      },
      admin_published_services: {
        data: [
          {
            category: "Therapy",
            cover_media_id: null,
            default_duration_minutes: 75,
            display_order: 2,
            slug: "lymphatic-massage",
            updated_at: "2026-07-01T10:00:00Z",
          },
          {
            category: "Classic",
            cover_media_id: "media-cover",
            default_duration_minutes: 60,
            display_order: 1,
            slug: "classic-massage",
            updated_at: "2026-07-01T10:00:00Z",
          },
        ],
        error: null,
      },
    });

    const result = await createPublicContentDataLayer(client).listServices("ru");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.services.map((service) => service.slug)).toEqual([
      "classic-massage",
      "lymphatic-massage",
    ]);
    expect(result.data.services[0]).toMatchObject({
      coverMedia: {
        altText: "Russian alt",
        id: "media-cover",
        localizedAltText: { bg: "Bulgarian alt", ru: "Russian alt" },
        url: "/media/cover.webp",
      },
      locale: "ru",
      prices: [
        { durationMinutes: 60, priceCents: 6500 },
        { durationMinutes: 90, priceCents: 9000 },
      ],
      title: "RU classic",
      usedLocaleFallback: false,
    });
    expect(result.data.services[1]).toMatchObject({
      locale: "bg",
      title: "BG lymphatic",
      usedLocaleFallback: true,
    });
    expect(result.data.mediaPlacements).toHaveLength(1);
    expect(result.data.mediaPlacements[0]).toMatchObject({
      caption: "Studio RU",
      locale: "ru",
      placementKey: "service:classic-massage:cover",
    });
    expect(calls).not.toContainEqual(expect.objectContaining({
      args: ["status", "active"],
      method: "eq",
      table: "admin_published_price_variants",
    }));
  });

  it("loads global media placements when no services are published", async () => {
    const { calls, client } = createMockClient({
      admin_published_media_placements: {
        data: [{
          ...mediaAsset,
          caption_localized: { bg: "Studio entrance" },
          id: "placement-home-hero",
          locale: null,
          media_asset_id: "media-cover",
          page_key: "global",
          placement_key: "global.home.hero",
          slot_key: "home-hero",
          sort_order: 0,
        }],
        error: null,
      },
      admin_published_services: { data: [], error: null },
    });

    const result = await createPublicContentDataLayer(client).listServices("bg");

    expect(result).toEqual({
      data: {
        mediaPlacements: [expect.objectContaining({
          caption: "Studio entrance",
          placementKey: "global.home.hero",
        })],
        requestedLocale: "bg",
        services: [],
      },
      source: "supabase",
      status: "ok",
    });
    expect(calls).not.toContainEqual(expect.objectContaining({
      table: "admin_published_service_translations",
    }));
  });

  it("sanitizes published blog HTML for list and detail reads", async () => {
    const listClient = createMockClient({
      admin_media_assets: { data: [mediaAsset], error: null },
      admin_published_blog_posts: {
        data: [
          { ...blogRow, locale: "bg", slug: "care-guide-bg", title: "Fallback guide" },
          blogRow,
        ],
        error: null,
      },
    }).client;
    const listResult = await createPublicContentDataLayer(listClient).listBlogPosts("ru");

    expect(listResult.status).toBe("ok");
    if (listResult.status !== "ok") return;
    expect(listResult.data.posts).toHaveLength(1);
    expect(listResult.data.posts[0]).not.toHaveProperty("html");
    expect(listResult.data.posts[0]).toMatchObject({
      coverAlt: "Massage preparation guide cover",
      coverMedia: { altText: "Massage preparation guide cover", id: "media-cover" },
      locale: "ru",
      title: "Care guide",
      usedLocaleFallback: false,
    });

    const detailClient = createMockClient({
      admin_media_assets: { data: [mediaAsset], error: null },
      admin_published_blog_posts: { data: [blogRow], error: null },
    }).client;
    const detailResult = await createPublicContentDataLayer(detailClient).getBlogPost(
      "care-guide",
      "ru",
    );

    expect(detailResult.status).toBe("ok");
    if (detailResult.status !== "ok" || !detailResult.data) return;
    expect(detailResult.data.html).toContain("<h2>Care</h2>");
    expect(detailResult.data.html).not.toContain("script");
    expect(detailResult.data.html).not.toContain("javascript:");
    expect(detailResult.data.seo.ogImage?.altText).toBe("Massage preparation guide cover");
  });

  it("returns null for a published blog detail that does not exist", async () => {
    const { client } = createMockClient({
      admin_published_blog_posts: { data: [], error: null },
    });

    await expect(
      createPublicContentDataLayer(client).getBlogPost("missing-post", "en"),
    ).resolves.toEqual({ data: null, source: "supabase", status: "ok" });
  });

  it("falls back to the configured blog locale when the requested locale is absent", async () => {
    const { client } = createMockClient({
      admin_published_blog_posts: {
        data: [
          {
            ...blogRow,
            canonical_url: "/bg/blog/care-guide",
            cover_media_id: null,
            locale: "bg",
            og_image_media_id: null,
          },
        ],
        error: null,
      },
    });

    const result = await createPublicContentDataLayer(client).getBlogPost("care-guide", "ua");

    expect(result.status).toBe("ok");
    if (result.status !== "ok" || !result.data) return;
    expect(result.data).toMatchObject({ locale: "bg", usedLocaleFallback: true });
  });

  it("loads public site feature flags and handles a missing singleton", async () => {
    const configured = createMockClient({
      admin_public_site_flags: {
        data: [{ blog_enabled: false, gift_certificates_enabled: false, id: "site", public_booking_enabled: true }],
        error: null,
      },
    }).client;
    const missing = createMockClient({
      admin_public_site_flags: { data: [], error: null },
    }).client;

    await expect(createPublicContentDataLayer(configured).getSiteFeatures()).resolves.toEqual({
      data: { blogEnabled: false, giftCertificatesEnabled: false, publicBookingEnabled: true },
      source: "supabase",
      status: "ok",
    });
    await expect(createPublicContentDataLayer(missing).getSiteFeatures()).resolves.toEqual({
      data: null,
      fallback: "static-content",
      reason: "public_content_row_missing",
      source: "supabase",
      status: "not_configured",
    });
  });

  it("loads the public business details through the narrow public view", async () => {
    const workingSchedule = [
      { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 1 },
      { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 2 },
      { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 3 },
      { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 4 },
      { closesAt: "19:00", isOpen: true, opensAt: "10:00", weekday: 5 },
      { closesAt: "17:00", isOpen: true, opensAt: "10:00", weekday: 6 },
      { closesAt: "18:00", isOpen: false, opensAt: "10:00", weekday: 7 },
    ];
    const { calls, client } = createMockClient({
      admin_public_business_details: {
        data: [{
          address: "ул. Места 50, Бургас",
          business_name: "Magic Massage Natali",
          id: "site",
          phone: "+359 89 677 8308",
          seo_area: "Burgas, Bulgaria",
          updated_at: "2026-07-18T10:00:00.000Z",
          working_schedule: workingSchedule,
        }],
        error: null,
      },
    });

    await expect(createPublicContentDataLayer(client).getBusinessDetails()).resolves.toEqual({
      data: {
        address: "ул. Места 50, Бургас",
        businessName: "Magic Massage Natali",
        phone: "+359 89 677 8308",
        seoArea: "Burgas, Bulgaria",
        updatedAt: "2026-07-18T10:00:00.000Z",
        workingSchedule,
      },
      source: "supabase",
      status: "ok",
    });
    expect(calls).toContainEqual(expect.objectContaining({ table: "admin_public_business_details" }));
  });

  it("rejects malformed public business schedules", async () => {
    const logger = { error: vi.fn() };
    const { client } = createMockClient({
      admin_public_business_details: {
        data: [{
          address: "Burgas",
          business_name: "Magic Massage Natali",
          id: "site",
          phone: "+359 89 677 8308",
          seo_area: "Burgas, Bulgaria",
          updated_at: "2026-07-18T10:00:00.000Z",
          working_schedule: [],
        }],
        error: null,
      },
    });

    await expect(createPublicContentDataLayer(client, logger).getBusinessDetails()).resolves.toMatchObject({
      reason: "public_content_query_failed",
      status: "query_failed",
    });
    expect(logger.error).toHaveBeenCalledWith("Public Supabase content read failed", {
      cause: "invalid_data",
      operation: "getBusinessDetails",
    });
  });

  it("returns a generic query fallback without exposing Supabase errors", async () => {
    const logger = { error: vi.fn() };
    const { client } = createMockClient({
      admin_published_services: {
        data: null,
        error: { code: "42501", message: "permission denied for private row" },
      },
    });

    await expect(createPublicContentDataLayer(client, logger).listServices("bg")).resolves.toEqual({
      data: null,
      fallback: "static-content",
      reason: "public_content_query_failed",
      source: "supabase",
      status: "query_failed",
    });
    expect(logger.error).toHaveBeenCalledWith("Public Supabase content read failed", {
      cause: "query_error",
      operation: "listServices",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("private row");
  });

  it("rejects malformed rows instead of returning partially trusted data", async () => {
    const logger = { error: vi.fn() };
    const { client } = createMockClient({
      admin_published_services: {
        data: [
          {
            category: "Classic",
            cover_media_id: null,
            default_duration_minutes: -1,
            display_order: 1,
            slug: "classic-massage",
            updated_at: "not-a-date",
          },
        ],
        error: null,
      },
    });

    const result = await createPublicContentDataLayer(client, logger).listServices("bg");

    expect(result.status).toBe("query_failed");
    expect(logger.error).toHaveBeenCalledWith("Public Supabase content read failed", {
      cause: "invalid_data",
      operation: "listServices",
    });
  });
});
