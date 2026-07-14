import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaPlacementRecord, MediaRecord } from "@/admin/domain";

import { MediaPlacementEditor } from "./MediaPlacementEditor";

vi.mock("@/lib/supabase/browser", () => ({
  getAdminAuthorizationHeader: vi.fn(async () => undefined),
}));

const placement: MediaPlacementRecord = {
  id: "placement-home",
  isPublished: true,
  locale: "ru",
  mediaAssetId: "media-room",
  pageKey: "home",
  placementKey: "home.gallery.main",
  slotKey: "main",
  sortOrder: 0,
};

const assets: MediaRecord[] = [
  {
    altText: "Светлый массажный кабинет",
    dimensions: "1200x800",
    folder: "gallery",
    id: "media-room",
    name: "Кабинет",
    publicationConsent: "granted",
    size: "120 KB",
    status: "Готово",
    type: "Фото",
    uploadedAt: "2026-07-14",
    url: "/media/gallery/room.jpg",
    usage: [],
  },
  {
    altText: "Второй светлый кабинет",
    dimensions: "1200x800",
    folder: "gallery",
    id: "media-room-2",
    name: "Второй кабинет",
    publicationConsent: "granted",
    size: "125 KB",
    status: "Готово",
    type: "Фото",
    uploadedAt: "2026-07-14",
    url: "/media/gallery/room-2.jpg",
    usage: [],
  },
];

function renderEditor() {
  const onClose = vi.fn();
  const onReplaced = vi.fn();
  render(
    <MediaPlacementEditor
      assets={assets}
      onClose={onClose}
      onReplaced={onReplaced}
      placement={placement}
    />,
  );
  return { onClose, onReplaced };
}

describe("MediaPlacementEditor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("routes Cancel through the drawer dirty guard", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderEditor();

    await user.click(screen.getByRole("radio", { name: /Второй кабинет/ }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the draft after a failed save and prevents edits while persistence is pending", async () => {
    const user = userEvent.setup();
    let resolveFetch: ((response: { json: () => Promise<{ error: string }>; ok: boolean }) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ json: () => Promise<{ error: string }>; ok: boolean }>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { onReplaced } = renderEditor();
    const replacement = screen.getByRole("radio", { name: /Второй кабинет/ });

    await user.click(replacement);
    await user.click(screen.getByRole("button", { name: "Применить к этому месту" }));

    expect(screen.getByRole("button", { name: "Замена..." })).toBeDisabled();
    expect(replacement).toBeDisabled();
    resolveFetch?.({ json: async () => ({ error: "Сервер отклонил замену." }), ok: false });

    expect(await screen.findByRole("alert")).toHaveTextContent("Сервер отклонил замену.");
    expect(replacement).toBeChecked();
    expect(replacement).toBeEnabled();
    expect(onReplaced).not.toHaveBeenCalled();
  });

  it("marks the persisted draft clean after the replacement is confirmed", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({}), ok: true })));
    const { onClose, onReplaced } = renderEditor();

    await user.click(screen.getByRole("radio", { name: /Второй кабинет/ }));
    await user.click(screen.getByRole("button", { name: "Применить к этому месту" }));
    await waitFor(() => expect(onReplaced).toHaveBeenCalledWith("placement-home", "media-room-2"));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
