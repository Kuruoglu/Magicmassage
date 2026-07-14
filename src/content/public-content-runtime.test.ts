import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPublicShellRuntime,
  getRuntimeGiftCertificatesEnabled,
  getRuntimeServices,
} from "./public-content-runtime";

const runtimeMock = vi.hoisted(() => ({
  featuresResult: {
    data: { giftCertificatesEnabled: true },
    source: "supabase",
    status: "ok",
  } as unknown,
  servicesResult: {
    data: { mediaPlacements: [], requestedLocale: "bg", services: [] },
    source: "supabase",
    status: "ok",
  } as unknown,
}));

vi.mock("@/lib/public-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/public-content")>();

  return {
    ...actual,
    createConfiguredPublicContentDataLayer: vi.fn(() => ({
      getBlogPost: vi.fn(),
      getSiteFeatures: vi.fn(async () => runtimeMock.featuresResult),
      listBlogPosts: vi.fn(),
      listServices: vi.fn(async () => runtimeMock.servicesResult),
    })),
  };
});

describe("public content runtime failure policy", () => {
  beforeEach(() => {
    runtimeMock.featuresResult = {
      data: { giftCertificatesEnabled: true },
      source: "supabase",
      status: "ok",
    };
    runtimeMock.servicesResult = {
      data: { mediaPlacements: [], requestedLocale: "bg", services: [] },
      source: "supabase",
      status: "ok",
    };
  });

  it("uses the static catalog only when public Supabase is not configured", async () => {
    runtimeMock.servicesResult = {
      data: null,
      fallback: "static-content",
      reason: "public_supabase_not_configured",
      source: "supabase",
      status: "not_configured",
    };

    const services = await getRuntimeServices("bg");

    expect(services).toHaveLength(19);
  });

  it("fails closed on service query errors instead of republishing hidden static content", async () => {
    runtimeMock.servicesResult = {
      data: null,
      fallback: "static-content",
      reason: "public_content_query_failed",
      source: "supabase",
      status: "query_failed",
    };

    await expect(getRuntimeServices("bg")).resolves.toEqual([]);
    await expect(getPublicShellRuntime("bg")).resolves.toMatchObject({
      mediaPlacements: [],
      services: [],
    });
  });

  it("keeps global media placements available when the published service list is empty", async () => {
    runtimeMock.servicesResult = {
      data: {
        mediaPlacements: [{ placementKey: "global.home.hero" }],
        requestedLocale: "bg",
        services: [],
      },
      source: "supabase",
      status: "ok",
    };

    await expect(getPublicShellRuntime("bg")).resolves.toMatchObject({
      mediaPlacements: [{ placementKey: "global.home.hero" }],
      services: [],
    });
  });

  it("fails closed for gift certificates when the feature query fails", async () => {
    runtimeMock.featuresResult = {
      data: null,
      fallback: "static-content",
      reason: "public_content_query_failed",
      source: "supabase",
      status: "query_failed",
    };

    await expect(getRuntimeGiftCertificatesEnabled()).resolves.toBe(false);
    await expect(getPublicShellRuntime("bg")).resolves.toMatchObject({
      giftCertificatesEnabled: false,
    });
  });
});
