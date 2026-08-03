import "server-only";

import { businessFacts } from "@/config/business";
import { findBlogPostByLocaleAndSlug, listBlogPostsByLocale } from "@/content/blog";
import { getHomeContent } from "@/content/home";
import { getPublicPagesContent, type ServiceContent } from "./public-pages";
import type { Locale } from "@/i18n/config";
import { cloneBusinessHoursSchedule } from "@/lib/business-hours";
import {
  createConfiguredPublicContentDataLayer,
  type PublicBlogPost,
  type PublicBlogPostSummary,
  type PublicMediaPlacement,
  type PublicService,
} from "@/lib/public-content";

function serviceCategory(value: string, fallback?: ServiceContent["category"]): ServiceContent["category"] {
  return value === "massage" || value === "partial" || value === "spa" ? value : (fallback ?? "massage");
}

function mapService(locale: Locale, service: PublicService, allowStaticImageFallback = false): ServiceContent {
  const fallback = getPublicPagesContent(locale).services.items.find((item) => item.slug === service.slug);
  const body = service.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    category: serviceCategory(service.category, fallback?.category),
    description: service.shortDescription,
    detailParagraphs: body.length > 0 ? body : (fallback?.detailParagraphs ?? [service.shortDescription]),
    image: service.coverMedia?.url ?? (allowStaticImageFallback ? fallback?.image : undefined) ?? "/media/logo.png",
    imageAlt: service.coverMedia?.altText || fallback?.imageAlt || service.title,
    slug: service.slug,
    title: service.title,
  };
}

export async function getRuntimeServices(locale: Locale) {
  const fallback = getPublicPagesContent(locale).services.items;
  const result = await createConfiguredPublicContentDataLayer().listServices(locale);

  if (result.status === "ok") return result.data.services.map((service) => mapService(locale, service));
  return result.status === "not_configured" && result.reason === "public_supabase_not_configured"
    ? fallback
    : [];
}

export async function getRuntimeService(locale: Locale, slug: string) {
  return (await getRuntimeServices(locale)).find((service) => service.slug === slug);
}

export async function getRuntimeServiceData(locale: Locale, slug: string): Promise<PublicService | null> {
  const result = await createConfiguredPublicContentDataLayer().listServices(locale);
  return result.status === "ok"
    ? (result.data.services.find((service) => service.slug === slug) ?? null)
    : null;
}

export async function getRuntimeGiftCertificatesEnabled() {
  const result = await createConfiguredPublicContentDataLayer().getSiteFeatures();
  if (result.status === "ok") return result.data.giftCertificatesEnabled;
  return result.status === "not_configured" && result.reason === "public_supabase_not_configured";
}

export async function getRuntimePublicBookingEnabled() {
  const result = await createConfiguredPublicContentDataLayer().getSiteFeatures();
  return result.status === "ok" ? result.data.publicBookingEnabled : false;
}

export async function getPublicShellRuntime(locale: Locale) {
  const dataLayer = createConfiguredPublicContentDataLayer();
  const [servicesResult, featuresResult, businessDetailsResult] = await Promise.all([
    dataLayer.listServices(locale),
    dataLayer.getSiteFeatures(),
    dataLayer.getBusinessDetails(),
  ]);
  const services = servicesResult.status === "ok"
    ? servicesResult.data.services.map((service) => mapService(locale, service))
    : servicesResult.status === "not_configured" && servicesResult.reason === "public_supabase_not_configured"
      ? getPublicPagesContent(locale).services.items
      : [];
  const mediaPlacements: PublicMediaPlacement[] = servicesResult.status === "ok"
    ? servicesResult.data.mediaPlacements
    : [];
  const giftCertificatesEnabled = featuresResult.status === "ok"
    ? featuresResult.data.giftCertificatesEnabled
    : featuresResult.status === "not_configured" && featuresResult.reason === "public_supabase_not_configured";
  const blogEnabled = featuresResult.status === "ok"
    ? featuresResult.data.blogEnabled
    : featuresResult.status === "not_configured" && featuresResult.reason === "public_supabase_not_configured";
  const publicBookingEnabled = featuresResult.status === "ok"
    ? featuresResult.data.publicBookingEnabled
    : false;
  const fallbackContact = getHomeContent(locale).contact;
  const businessDetails = businessDetailsResult.status === "ok"
    ? businessDetailsResult.data
    : {
        address: fallbackContact.address,
        businessName: businessFacts.name,
        email: businessFacts.email,
        phone: fallbackContact.phone,
        seoArea: `${businessFacts.address.locality}, ${businessFacts.address.countryCode}`,
        updatedAt: "2026-07-18T00:00:00.000Z",
        workingSchedule: cloneBusinessHoursSchedule(),
      };

  return { blogEnabled, businessDetails, giftCertificatesEnabled, mediaPlacements, publicBookingEnabled, services };
}

export async function getRuntimeBlogPosts(locale: Locale): Promise<PublicBlogPostSummary[]> {
  const result = await createConfiguredPublicContentDataLayer().listBlogPosts(locale);
  if (result.status === "ok") return result.data.posts;
  return result.status === "not_configured" && result.reason === "public_supabase_not_configured"
    ? listBlogPostsByLocale(locale)
    : [];
}

export async function getRuntimeBlogPost(locale: Locale, slug: string): Promise<PublicBlogPost | null> {
  const result = await createConfiguredPublicContentDataLayer().getBlogPost(slug, locale);
  if (result.status === "ok") return result.data;
  return result.status === "not_configured" && result.reason === "public_supabase_not_configured"
    ? findBlogPostByLocaleAndSlug(locale, slug)
    : null;
}
