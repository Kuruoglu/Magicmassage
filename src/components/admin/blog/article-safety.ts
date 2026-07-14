import sanitizeHtml from "sanitize-html";

import {
  isBlogPublicationStatus,
  type BlogArticleDraft,
  type BlogArticleValidationErrors,
  type BlogMediaOption,
} from "./types";

const ARTICLE_TAGS = [
  "p",
  "br",
  "h2",
  "h3",
  "h4",
  "strong",
  "em",
  "s",
  "u",
  "span",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "hr",
  "img",
] as const;

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const SOFIA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Sofia",
  year: "numeric",
});

export function isSafeArticleLink(value: string): boolean {
  const candidate = value.trim();

  if (!candidate || candidate.startsWith("//")) {
    return false;
  }

  if (candidate.startsWith("/") || candidate.startsWith("#")) {
    return true;
  }

  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(candidate).protocol);
  } catch {
    return false;
  }
}

export function isSafeCoverUrl(value: string): boolean {
  const candidate = value.trim();

  if (!candidate) {
    return true;
  }

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return true;
  }

  try {
    return new URL(candidate).protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeArticleHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      p: ["style"],
      span: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowedStyles: {
      "*": {
        "font-family": [/^(?:Arial|Georgia|Verdana|sans-serif|serif)(?:,\s*(?:Arial|Georgia|Verdana|sans-serif|serif))*$/],
        "font-size": [/^(?:14|16|18|20|24)px$/],
        "text-align": [/^(?:left|center|right|justify)$/],
      },
    },
    allowedTags: [...ARTICLE_TAGS],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    exclusiveFilter: (frame) => frame.tag === "img" && !isSafeCoverUrl(frame.attribs.src ?? ""),
    transformTags: {
      a: (tagName, attributes) => {
        const nextAttributes = { ...attributes };

        if (attributes.target === "_blank") {
          nextAttributes.rel = "noopener noreferrer";
        } else {
          delete nextAttributes.target;
          delete nextAttributes.rel;
        }

        return { attribs: nextAttributes, tagName };
      },
    },
  });
}

export function getArticleText(value: string): string {
  return sanitizeHtml(sanitizeArticleHtml(value), {
    allowedAttributes: {},
    allowedTags: [],
  })
    .replace(/\u00a0/g, " ")
    .trim();
}

function formatSofiaLocalDateTime(value: Date): string {
  const parts = Object.fromEntries(
    SOFIA_DATE_TIME_FORMATTER.formatToParts(value).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`;
}

function isValidSofiaLocalDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return false;

  const desiredUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = desiredUtc;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(
      SOFIA_DATE_TIME_FORMATTER.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    );
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
    );
    instant += desiredUtc - observedUtc;
  }

  return formatSofiaLocalDateTime(new Date(instant)) === value;
}

export function sanitizeArticleDraft(value: BlogArticleDraft): BlogArticleDraft {
  return {
    ...value,
    author: value.author.trim(),
    canonicalUrl: value.canonicalUrl?.trim() ?? "",
    category: value.category.trim(),
    content: sanitizeArticleHtml(value.content),
    coverAlt: value.coverAlt.trim(),
    coverUrl: value.coverUrl.trim(),
    excerpt: value.excerpt.trim(),
    hreflang: Object.fromEntries(
      Object.entries(value.hreflang ?? {})
        .map(([locale, url]) => [locale, url.trim()])
        .filter(([, url]) => Boolean(url)),
    ),
    ogDescription: value.ogDescription?.trim() ?? "",
    ogTitle: value.ogTitle?.trim() ?? "",
    robotsDirectives: value.robotsDirectives?.trim() || "noindex,nofollow",
    scheduledAt: value.status === "scheduled" ? value.scheduledAt : "",
    seoDescription: value.seoDescription.trim(),
    seoTitle: value.seoTitle.trim(),
    slug: value.slug.trim().toLowerCase(),
    tags: [...new Set(value.tags.map((tag) => tag.trim()).filter(Boolean))],
    title: value.title.trim(),
  };
}

export function validateArticleDraft(
  value: BlogArticleDraft,
  publicationMediaOptions?: readonly BlogMediaOption[],
): BlogArticleValidationErrors {
  const errors: BlogArticleValidationErrors = {};
  const requiresPublicationReadiness = isBlogPublicationStatus(value.status);

  if (!value.title.trim()) {
    errors.title = "Укажите заголовок статьи.";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug.trim())) {
    errors.slug = "Slug должен содержать строчные латинские буквы, цифры и дефисы.";
  }

  if (!value.category.trim()) {
    errors.category = "Укажите категорию.";
  }

  if (!value.author.trim()) {
    errors.author = "Укажите автора.";
  }

  if (!getArticleText(value.content)) {
    errors.content = "Добавьте текст статьи.";
  }

  if (value.status === "scheduled" && !isValidSofiaLocalDateTime(value.scheduledAt)) {
    errors.scheduledAt = "Укажите корректные дату и время публикации.";
  }

  if (!isSafeCoverUrl(value.coverUrl)) {
    errors.coverUrl = "Используйте внутренний путь или защищенный HTTPS-адрес.";
  }

  if (value.canonicalUrl && !isSafeCoverUrl(value.canonicalUrl)) {
    errors.canonicalUrl = "Используйте внутренний canonical path или защищенный HTTPS-адрес.";
  }

  if (Object.values(value.hreflang ?? {}).some((url) => Boolean(url) && !isSafeCoverUrl(url))) {
    errors.hreflang = "Используйте внутренние hreflang paths или защищенные HTTPS-адреса.";
  }

  if (requiresPublicationReadiness) {
    if (!value.coverUrl.trim()) errors.coverUrl = "Добавьте обложку перед публикацией.";
    if (!value.seoDescription.trim()) errors.seoDescription = "Добавьте meta description перед публикацией.";
    if (!value.seoTitle.trim()) errors.seoTitle = "Добавьте SEO-заголовок перед публикацией.";

    if (
      publicationMediaOptions !== undefined &&
      !publicationMediaOptions.some((media) => media.url === value.coverUrl)
    ) {
      errors.coverUrl = "Для публикации выберите обложку из медиатеки с заполненным alt-текстом и согласием.";
    }
  }

  if (value.coverUrl.trim() && !value.coverAlt.trim()) {
    errors.coverAlt = "Добавьте описание обложки для доступности.";
  }

  if (value.seoTitle.length > 70) {
    errors.seoTitle = "SEO-заголовок не должен превышать 70 символов.";
  }

  if (value.seoDescription.length > 170) {
    errors.seoDescription = "SEO-описание не должно превышать 170 символов.";
  }

  if ((value.ogTitle?.length ?? 0) > 70) errors.ogTitle = "Open Graph title не должен превышать 70 символов.";
  if ((value.ogDescription?.length ?? 0) > 200) errors.ogDescription = "Open Graph description не должен превышать 200 символов.";

  return errors;
}

export function serializeArticleDraft(value: BlogArticleDraft): string {
  return JSON.stringify(sanitizeArticleDraft(value));
}
