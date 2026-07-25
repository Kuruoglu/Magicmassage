import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { imageSize } from "image-size";

import { getPublicPagesContent } from "../../src/content/public-pages";
import { giftCertificateSalesConfig } from "../../src/content/gift-certificates";
import { locales, type Locale } from "../../src/i18n/config";
import { mediaStorageStatus } from "./media-alt-status";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type InventoryRecord = {
  alt: string;
  byteSize: number;
  consent: string;
  extension: string;
  fileName: string;
  folder: string;
  height: number;
  id: string;
  mimeType: string;
  placements: Array<{ line: number; placement: string; sourcePath: string }>;
  repoPath: string;
  tags: string[];
  url: string;
  width: number;
};

function mimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".avif") return "image/avif";
  return null;
}

function serviceMediaId(slug: string) {
  return `public-service-${slug}-cover`;
}

function inventoryPlacementIdentity(record: InventoryRecord, index: number) {
  const placement = record.placements[index];
  const source = placement.sourcePath.replaceAll("\\", "/");
  const fileStem = path.parse(record.fileName).name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

  if (record.url === "/media/hero/hero-massage-session.jpg" && source.endsWith("home-page-view.tsx")) {
    return { pageKey: "home", placementKey: "home.hero", slotKey: "hero" };
  }
  if (record.url === "/media/about/natali-at-work.jpg" && source.endsWith("home-page-view.tsx")) {
    const homeUses = record.placements.slice(0, index).filter((item) => item.sourcePath.replaceAll("\\", "/").endsWith("home-page-view.tsx"));
    return homeUses.length === 0
      ? { pageKey: "home", placementKey: "home.practitioner", slotKey: "practitioner" }
      : { pageKey: "home", placementKey: "home.about.primary", slotKey: "about-primary" };
  }
  if (record.url === "/media/services/deep-tissue-massage.jpg" && source.endsWith("home-page-view.tsx")) {
    return { pageKey: "home", placementKey: "home.about.secondary", slotKey: "about-secondary" };
  }
  if (record.url === "/media/about/about-hero-premium.webp") {
    return { pageKey: "about", placementKey: "about.hero", slotKey: "hero" };
  }
  if (record.url === "/media/about/natali-portrait.jpg") {
    return { pageKey: "about", placementKey: "about.portrait", slotKey: "portrait" };
  }
  if (record.url.startsWith("/media/about/certificates/")) {
    return { pageKey: "about", placementKey: `about.certificate.${fileStem}`, slotKey: `certificate-${fileStem}` };
  }
  if (record.url === "/media/gift-certificates/gift-certificate-hero-bow.webp") {
    return { pageKey: "gift-certificates", placementKey: "gift-certificates.hero", slotKey: "hero" };
  }
  if (record.url === "/media/hero/services-gift-hero.jpg" && source.endsWith("services-page-view.tsx")) {
    return { pageKey: "services", placementKey: "services.hero", slotKey: "hero" };
  }
  if (record.url === "/media/hero/hero-massage-session.jpg" && source.endsWith("BlogIndexView.tsx")) {
    return { pageKey: "blog", placementKey: "blog.hero", slotKey: "hero" };
  }
  if (record.url === "/media/logo.png" && source.endsWith("site-header.tsx")) {
    return placement.line < 200
      ? { pageKey: "global", placementKey: "global.logo", slotKey: "header-logo" }
      : { pageKey: "global", placementKey: "global.logo.mobile", slotKey: "mobile-logo" };
  }

  return {
    pageKey: source,
    placementKey: `inventory:${record.id}:${index}`,
    slotKey: placement.placement,
  };
}

async function imageMetadata(publicUrl: string) {
  const filePath = path.join(process.cwd(), "public", ...publicUrl.split("/").filter(Boolean));
  const buffer = await readFile(filePath);
  const dimensions = imageSize(buffer);

  return {
    byteSize: buffer.byteLength,
    extension: path.extname(filePath).slice(1).toLowerCase(),
    fileName: path.basename(filePath),
    height: dimensions.height ?? null,
    mimeType: mimeType(filePath),
    sourcePath: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
    width: dimensions.width ?? null,
  };
}

async function assertQuery(label: string, query: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
}

type ImportedPlacement = {
  caption_localized: Record<string, string>;
  is_published: boolean;
  locale: Locale | null;
  media_asset_id: string;
  page_key: string;
  placement_key: string;
  slot_key: string;
  sort_order: number;
};

async function ensurePlacement(label: string, placement: ImportedPlacement) {
  let existingQuery = client
    .from("admin_media_placements")
    .select("id")
    .eq("placement_key", placement.placement_key);

  existingQuery = placement.locale === null
    ? existingQuery.is("locale", null)
    : existingQuery.eq("locale", placement.locale);

  const { data: existing, error } = await existingQuery.maybeSingle();
  if (error) throw new Error(`${label}: ${error.message}`);
  if (existing) return;

  await assertQuery(label, client.from("admin_media_placements").insert(placement));
}

async function importService(slug: string, order: number) {
  const localized = Object.fromEntries(
    locales.map((locale) => [locale, getPublicPagesContent(locale).services.items.find((service) => service.slug === slug)]),
  ) as Record<Locale, ReturnType<typeof getPublicPagesContent>["services"]["items"][number] | undefined>;
  const base = localized.bg ?? localized.ru ?? localized.en ?? localized.ua;

  if (!base) return;

  const { data: existingMedia, error: existingMediaError } = await client
    .from("admin_media_assets")
    .select("id")
    .eq("url", base.image)
    .maybeSingle();
  if (existingMediaError) throw new Error(`existing media ${slug}: ${existingMediaError.message}`);
  const mediaId = existingMedia?.id ?? serviceMediaId(slug);
  const metadata = await imageMetadata(base.image);
  const localizedAlt = Object.fromEntries(
    locales.flatMap((locale) => (localized[locale]?.imageAlt ? [[locale, localized[locale]!.imageAlt]] : [])),
  );

  if (!existingMedia) {
    await assertQuery(
      `media ${slug}`,
      client.from("admin_media_assets").insert(
      {
        alt_text: base.imageAlt,
        alt_text_localized: localizedAlt,
        byte_size: metadata.byteSize,
        dimensions: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : "",
        file_extension: metadata.extension,
        file_size_label: `${metadata.byteSize} B`,
        folder: "services",
        height_pixels: metadata.height,
        id: mediaId,
        media_type: "photo",
        mime_type: metadata.mimeType,
        name: `${base.title} cover`,
        original_filename: metadata.fileName,
        publication_consent_status: "not_required",
        source_path: metadata.sourcePath,
        status: mediaStorageStatus(base.imageAlt),
        uploaded_on: new Date().toISOString().slice(0, 10),
        url: base.image,
        usage_contexts: [`service:${slug}:cover`],
        width_pixels: metadata.width,
      },
      ),
    );
  }

  const { data: existingService, error: existingServiceError } = await client
    .from("admin_services")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existingServiceError) throw new Error(`existing service ${slug}: ${existingServiceError.message}`);

  if (!existingService) {
    await assertQuery(
      `service ${slug}`,
      client.from("admin_services").insert(
      {
        category: base.category,
        cover_image_url: base.image,
        cover_media_id: mediaId,
        default_duration_minutes: 60,
        display_order: order,
        duration_label: "60-90 мин",
        locale_codes: locales,
        name: base.title,
        seo_title: base.title,
        slug,
        status: "published",
        summary: base.description,
      },
      ),
    );
  }

  const translations = locales.flatMap((locale) => {
    const service = localized[locale];
    if (!service) return [];

    return [
      {
        body: service.detailParagraphs.join("\n\n"),
        canonical_url: `/${locale}/services/${slug}`,
        locale,
        og_description: service.description,
        og_image_media_id: mediaId,
        og_title: service.title,
        robots_directives: "index,follow",
        seo_description: service.description,
        seo_title: service.title,
        service_slug: slug,
        short_description: service.description,
        status: "published",
        title: service.title,
      },
    ];
  });

  const { data: existingTranslations, error: existingTranslationsError } = await client
    .from("admin_service_translations")
    .select("locale")
    .eq("service_slug", slug);
  if (existingTranslationsError) {
    throw new Error(`existing translations ${slug}: ${existingTranslationsError.message}`);
  }
  const existingLocales = new Set((existingTranslations ?? []).map((translation) => translation.locale));
  const missingTranslations = translations.filter((translation) => !existingLocales.has(translation.locale));
  if (missingTranslations.length > 0) {
    await assertQuery(
      `translations ${slug}`,
      client.from("admin_service_translations").insert(missingTranslations),
    );
  }

  for (const locale of locales) {
    await ensurePlacement(`placement ${slug}/${locale}`, {
        caption_localized: { [locale]: localized[locale]?.imageAlt ?? "" },
        is_published: true,
        locale,
        media_asset_id: mediaId,
        page_key: `service:${slug}`,
        placement_key: `service:${slug}:cover`,
        slot_key: "cover",
        sort_order: 0,
    });
  }
}

async function importMediaInventory() {
  const inventoryPath = path.join(process.cwd(), "src/admin/media-inventory/media-inventory.json");
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8")) as { records: InventoryRecord[] };

  for (const record of inventory.records) {
    const { data: existing, error: existingError } = await client
      .from("admin_media_assets")
      .select("alt_text, id, publication_consent_status, status")
      .eq("url", record.url)
      .maybeSingle();
    if (existingError) throw new Error(`existing inventory media ${record.url}: ${existingError.message}`);
    const assetId = existing?.id ?? record.id;

    if (!existing) {
      await assertQuery(
        `inventory media ${record.url}`,
        client.from("admin_media_assets").insert(
        {
          alt_text: record.alt,
          byte_size: record.byteSize,
          dimensions: `${record.width}x${record.height}`,
          file_extension: record.extension.replace(/^\./, ""),
          file_size_label: `${record.byteSize} B`,
          folder: record.folder.replace(/^media\/?/, "") || "media",
          height_pixels: record.height,
          id: assetId,
          media_type: "photo",
          mime_type: record.mimeType,
          name: record.fileName,
          original_filename: record.fileName,
          publication_consent_status: record.consent === "granted" ? "granted" : "not_required",
          source_path: record.repoPath,
          status: mediaStorageStatus(record.alt),
          uploaded_on: new Date().toISOString().slice(0, 10),
          url: record.url,
          usage_contexts: record.placements.map((placement) => `${placement.sourcePath}:${placement.line}`),
          width_pixels: record.width,
        },
        ),
      );
    } else {
      const missingMetadata = {
        ...(!existing.alt_text?.trim() ? { alt_text: record.alt } : {}),
        ...(existing.publication_consent_status === "unknown"
          ? { publication_consent_status: "not_required" }
          : {}),
        ...(existing.status === "needs_alt" && (existing.alt_text?.trim() || record.alt.trim())
          ? { status: "ready" }
          : {}),
      };

      if (Object.keys(missingMetadata).length > 0) {
        await assertQuery(
          `complete inventory media metadata ${record.url}`,
          client.from("admin_media_assets").update(missingMetadata).eq("id", assetId),
        );
      }
    }

    if (record.placements.length > 0) {
      const placements = [...new Map(
        record.placements.map((_, index) => {
          const identity = inventoryPlacementIdentity(record, index);
          return [identity.placementKey, { identity, index }] as const;
        }),
      ).values()];

      for (const { identity, index } of placements) {
        await ensurePlacement(`inventory placement ${record.url}/${identity.placementKey}`, {
              caption_localized: {},
              is_published: true,
              locale: null,
              media_asset_id: assetId,
              page_key: identity.pageKey,
              placement_key: identity.placementKey,
              slot_key: identity.slotKey,
              sort_order: index,
        });
      }
    }
  }

  return inventory.records.length;
}

async function importConfiguredServicePrices() {
  let imported = 0;
  const configuredPrices = Object.values(giftCertificateSalesConfig.sellableServices);

  for (const [index, price] of configuredPrices.entries()) {
    const durationMinutes = 60;
    const { data: existing, error } = await client
      .from("admin_price_variants")
      .select("id")
      .eq("service_slug", price.slug)
      .eq("duration_minutes", durationMinutes)
      .limit(1);
    if (error) throw new Error(`existing price ${price.slug}: ${error.message}`);
    if ((existing ?? []).length > 0) continue;

    await assertQuery(
      `price ${price.slug}`,
      client.from("admin_price_variants").insert({
        currency: giftCertificateSalesConfig.currency,
        display_order: index + 1,
        duration_minutes: durationMinutes,
        id: `imported-${price.slug}-${durationMinutes}`,
        internal_note: giftCertificateSalesConfig.pricesAreFinal
          ? "Imported from the public sales configuration."
          : giftCertificateSalesConfig.priceNote,
        price_cents: price.priceEurCents,
        service_slug: price.slug,
        status: giftCertificateSalesConfig.pricesAreFinal ? "active" : "hidden",
        updated_on: new Date().toISOString().slice(0, 10),
      }),
    );
    imported += 1;
  }

  return imported;
}

async function main() {
  const serviceSlugs = getPublicPagesContent("bg").services.items.map((service) => service.slug);
  const mediaCount = await importMediaInventory();

  for (const [index, slug] of serviceSlugs.entries()) {
    await importService(slug, index + 1);
  }
  const priceCount = await importConfiguredServicePrices();

  console.log(
    `Backfilled up to ${serviceSlugs.length} services in ${locales.length} locales, ${mediaCount} media assets, and ${priceCount} missing configured prices without overwriting editorial state.`,
  );
}

const keepAlive = setInterval(() => undefined, 1_000);

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Public content import failed.");
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
