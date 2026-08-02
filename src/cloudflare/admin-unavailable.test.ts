import { describe, expect, it, vi } from "vitest";

import { createAdminUnavailableResponse, handleCloudflareRequest } from "./admin-unavailable";

describe("Cloudflare admin unavailable response", () => {
  it("returns a non-cacheable 503 response without error details", async () => {
    const response = createAdminUnavailableResponse();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("5");
    expect(body).toContain("Админ-панель временно недоступна");
    expect(body).not.toContain("stack");
  });

  it("replaces failed admin documents with the controlled 503 page", async () => {
    const fetchHandler = vi.fn(async () => new Response("internal details", { status: 500 }));
    const request = new Request("https://magicmassagenatali.bg/admin?section=calendar", {
      headers: { accept: "text/html,application/xhtml+xml" },
    });

    const response = await handleCloudflareRequest(fetchHandler, request, {}, {});

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("internal details");
  });

  it("does not replace RSC, non-admin, or successful responses", async () => {
    const rscFailure = new Response("rsc-error", { status: 500 });
    const publicFailure = new Response("public-error", { status: 500 });
    const success = new Response("admin-ok", { status: 200 });

    await expect(
      handleCloudflareRequest(
        async () => rscFailure,
        new Request("https://magicmassagenatali.bg/admin", { headers: { accept: "text/x-component" } }),
        {},
        {},
      ),
    ).resolves.toBe(rscFailure);
    await expect(
      handleCloudflareRequest(
        async () => publicFailure,
        new Request("https://magicmassagenatali.bg/bg", { headers: { accept: "text/html" } }),
        {},
        {},
      ),
    ).resolves.toBe(publicFailure);
    await expect(
      handleCloudflareRequest(
        async () => success,
        new Request("https://magicmassagenatali.bg/admin", { headers: { accept: "text/html" } }),
        {},
        {},
      ),
    ).resolves.toBe(success);
  });

  it("keeps non-admin thrown errors visible to the generated Worker", async () => {
    const failure = new Error("public failure");

    await expect(
      handleCloudflareRequest(
        async () => {
          throw failure;
        },
        new Request("https://magicmassagenatali.bg/bg", { headers: { accept: "text/html" } }),
        {},
        {},
      ),
    ).rejects.toBe(failure);
  });

  it("replaces thrown admin document errors with the controlled 503 page", async () => {
    const response = await handleCloudflareRequest(
      async () => {
        throw new Error("private provider details");
      },
      new Request("https://magicmassagenatali.bg/admin", { headers: { accept: "text/html" } }),
      {},
      {},
    );

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider details");
  });
});
