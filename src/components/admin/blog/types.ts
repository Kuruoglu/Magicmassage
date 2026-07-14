export const BLOG_LOCALES = ["bg", "ru", "ua", "en"] as const;
export const BLOG_STATUSES = ["draft", "review", "scheduled", "published"] as const;

export type BlogLocale = (typeof BLOG_LOCALES)[number];
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export function isBlogPublicationStatus(status: BlogStatus): status is "scheduled" | "published" {
  return status === "published" || status === "scheduled";
}

export type BlogArticleDraft = {
  author: string;
  canonicalUrl?: string;
  category: string;
  content: string;
  editorJson?: Record<string, unknown>;
  coverAlt: string;
  coverUrl: string;
  excerpt: string;
  hreflang?: Partial<Record<BlogLocale, string>>;
  locale: BlogLocale;
  ogDescription?: string;
  ogTitle?: string;
  publishedAt?: string;
  robotsDirectives?: string;
  scheduledAt: string;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  status: BlogStatus;
  tags: string[];
  title: string;
  updatedAt?: string;
};

export type BlogArticleValidationErrors = Partial<Record<keyof BlogArticleDraft, string>>;

export type BlogArticlePatch = Partial<BlogArticleDraft>;
export type BlogArticlePatchHandler = (patch: BlogArticlePatch) => void;

export type BlogMediaOption = {
  alt: string;
  label: string;
  url: string;
};

export type BlogArticleCancelContext = {
  hasUnsavedChanges: boolean;
  value: BlogArticleDraft;
};

export function createEmptyBlogArticle(locale: BlogLocale = "bg"): BlogArticleDraft {
  return {
    author: "",
    canonicalUrl: "",
    category: "",
    content: "<p></p>",
    editorJson: {},
    coverAlt: "",
    coverUrl: "",
    excerpt: "",
    hreflang: {},
    locale,
    ogDescription: "",
    ogTitle: "",
    publishedAt: "",
    robotsDirectives: "noindex,nofollow",
    scheduledAt: "",
    seoDescription: "",
    seoTitle: "",
    slug: "",
    status: "draft",
    tags: [],
    title: "",
    updatedAt: "",
  };
}
