import "server-only";

import sanitizeHtml from "sanitize-html";

const blogSanitizeOptions: sanitizeHtml.IOptions = {
  allowProtocolRelative: false,
  allowedAttributes: {
    a: ["href", "title"],
    img: ["alt", "height", "loading", "src", "title", "width"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowedTags: [
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "figcaption",
    "figure",
    "h2",
    "h3",
    "h4",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "u",
    "ul",
  ],
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: true,
  exclusiveFilter(frame) {
    return frame.tag === "img" && !frame.attribs.src;
  },
};

export function sanitizePublicBlogHtml(html: string) {
  return sanitizeHtml(html, blogSanitizeOptions).trim();
}
