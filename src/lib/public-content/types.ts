import type { BusinessHoursDay } from "@/lib/business-hours";

export const publicContentLocales = ["bg", "ru", "ua", "en"] as const;

export type PublicContentLocale = (typeof publicContentLocales)[number];

export type PublicContentUnavailableReason =
  | "public_supabase_not_configured"
  | "public_content_row_missing"
  | "public_content_query_failed";

export type PublicContentUnavailableResult =
  | {
      data: null;
      fallback: "static-content";
      reason: Exclude<PublicContentUnavailableReason, "public_content_query_failed">;
      source: "supabase";
      status: "not_configured";
    }
  | {
      data: null;
      fallback: "static-content";
      reason: "public_content_query_failed";
      source: "supabase";
      status: "query_failed";
    };

export type PublicContentResult<T> =
  | {
      data: T;
      source: "supabase";
      status: "ok";
    }
  | PublicContentUnavailableResult;

export type PublicMediaAsset = {
  altText: string;
  byteSize: number | null;
  height: number | null;
  id: string;
  localizedAltText: Partial<Record<PublicContentLocale, string>>;
  mimeType: string | null;
  updatedAt: string;
  url: string;
  width: number | null;
};

export type PublicMediaPlacement = {
  caption: string;
  id: string;
  locale: PublicContentLocale | null;
  media: PublicMediaAsset;
  pageKey: string;
  placementKey: string;
  slotKey: string;
  sortOrder: number;
  updatedAt: string;
};

export type PublicServicePrice = {
  currency: "EUR";
  durationMinutes: number;
  id: string;
  priceCents: number;
  sortOrder: number;
  updatedOn: string;
};

export type PublicServiceSeo = {
  canonicalUrl: string | null;
  description: string;
  ogDescription: string;
  ogImage: PublicMediaAsset | null;
  ogTitle: string;
  robots: string;
  title: string;
};

export type PublicService = {
  body: string;
  category: string;
  coverMedia: PublicMediaAsset | null;
  defaultDurationMinutes: number | null;
  locale: PublicContentLocale;
  prices: PublicServicePrice[];
  seo: PublicServiceSeo;
  shortDescription: string;
  slug: string;
  sortOrder: number;
  title: string;
  updatedAt: string;
  usedLocaleFallback: boolean;
};

export type PublicServicesData = {
  mediaPlacements: PublicMediaPlacement[];
  requestedLocale: PublicContentLocale;
  services: PublicService[];
};

export type PublicBlogSeo = {
  canonicalUrl: string | null;
  description: string;
  hreflang: Partial<Record<PublicContentLocale, string>>;
  ogDescription: string;
  ogImage: PublicMediaAsset | null;
  ogTitle: string;
  robots: string;
};

export type PublicBlogPostSummary = {
  author: string;
  category: string;
  coverAlt?: string;
  coverMedia: PublicMediaAsset | null;
  id: string;
  locale: PublicContentLocale;
  publishedAt: string;
  seo: PublicBlogSeo;
  slug: string;
  tags: string[];
  title: string;
  updatedAt: string;
  usedLocaleFallback: boolean;
};

export type PublicBlogPost = PublicBlogPostSummary & {
  html: string;
};

export type PublicBlogListData = {
  posts: PublicBlogPostSummary[];
  requestedLocale: PublicContentLocale;
};

export type PublicSiteFeatures = {
  blogEnabled: boolean;
  giftCertificatesEnabled: boolean;
  publicBookingEnabled: boolean;
};

export type PublicBusinessDetails = {
  address: string;
  businessName: string;
  email: string;
  phone: string;
  seoArea: string;
  updatedAt: string;
  workingSchedule: BusinessHoursDay[];
};

export type PublicContentQueryResponse = {
  data: unknown;
  error: {
    code?: string;
    message?: string;
  } | null;
};

export interface PublicContentQuery extends PromiseLike<PublicContentQueryResponse> {
  eq(column: string, value: unknown): PublicContentQuery;
  in(column: string, values: readonly unknown[]): PublicContentQuery;
  limit(count: number): PublicContentQuery;
  order(column: string, options?: { ascending?: boolean }): PublicContentQuery;
}

export type PublicContentSupabaseClient = {
  from(table: string): {
    select(columns: string): PublicContentQuery;
  };
};

export type PublicContentLogger = {
  error(
    message: string,
    context: {
      cause: "invalid_data" | "query_error" | "unexpected_error";
      operation: string;
    },
  ): void;
};

export type PublicContentReadOptions = {
  fallbackLocale?: PublicContentLocale;
};

export type PublicContentDataLayer = {
  getBusinessDetails(): Promise<PublicContentResult<PublicBusinessDetails>>;
  getBlogPost(
    slug: string,
    locale: PublicContentLocale,
    options?: PublicContentReadOptions,
  ): Promise<PublicContentResult<PublicBlogPost | null>>;
  getSiteFeatures(): Promise<PublicContentResult<PublicSiteFeatures>>;
  listBlogPosts(
    locale: PublicContentLocale,
    options?: PublicContentReadOptions,
  ): Promise<PublicContentResult<PublicBlogListData>>;
  listServices(
    locale: PublicContentLocale,
    options?: PublicContentReadOptions,
  ): Promise<PublicContentResult<PublicServicesData>>;
};
