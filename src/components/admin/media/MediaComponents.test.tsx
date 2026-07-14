import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MediaRecord } from "@/admin/domain";

import { MediaDetail } from "./MediaDetail";
import { MediaGrid } from "./MediaGrid";
import { MediaPicker } from "./MediaPicker";
import { MediaUploader } from "./MediaUploader";

const assets: MediaRecord[] = [
  {
    altText: "Светлый массажный кабинет",
    dimensions: "1200x800",
    folder: "gallery",
    id: "media-room",
    name: "Кабинет",
    placements: [
      {
        id: "placement-home",
        isPublished: true,
        locale: "ru",
        mediaAssetId: "media-room",
        pageKey: "home",
        placementKey: "home.gallery.main",
        slotKey: "main",
        sortOrder: 0,
      },
    ],
    publicationConsent: "granted",
    size: "120 KB",
    status: "Готово",
    type: "Фото",
    uploadedAt: "2026-07-14",
    url: "/media/gallery/room.jpg",
    usage: [],
  },
  {
    altText: "",
    dimensions: "",
    folder: "documents",
    id: "media-document",
    name: "Памятка",
    publicationConsent: "unknown",
    size: "20 KB",
    status: "Черновик",
    type: "Документ",
    uploadedAt: "2026-07-14",
    url: "/media/documents/guide.pdf",
    usage: [],
  },
];

describe("media components", () => {
  it("renders a selectable grid and placement-aware detail actions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onReplacePlacement = vi.fn();
    render(
      <>
        <MediaGrid assets={assets} onSelect={onSelect} selectedAssetId="media-room" />
        <MediaDetail asset={assets[0]} onReplacePlacement={onReplacePlacement} />
      </>,
    );

    await user.click(within(screen.getByRole("region", { name: "Галерея медиа" })).getByRole("button", { name: /Кабинет/ }));
    expect(onSelect).toHaveBeenCalledWith(assets[0]);
    expect(screen.getByText("home.gallery.main")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Заменить в этом месте" }));
    expect(onReplacePlacement).toHaveBeenCalledWith(assets[0].placements![0], assets[0]);
  });

  it("filters the media picker and excludes disabled choices", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MediaPicker
        assets={assets}
        isAssetDisabled={(asset) => asset.type !== "Фото"}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText("Поиск по медиатеке"), "кабинет");
    await user.click(screen.getByRole("radio", { name: /Кабинет/ }));
    expect(onChange).toHaveBeenCalledWith(assets[0]);
    expect(screen.queryByText("Памятка")).not.toBeInTheDocument();
  });

  it("validates publication metadata and emits a typed upload request", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn(async () => undefined);
    render(<MediaUploader onUpload={onUpload} />);

    const file = new File(["image"], "studio.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText(/^Файл/), file);
    await user.type(screen.getByLabelText("Alt-текст или описание документа"), "Массажный кабинет");
    await user.selectOptions(screen.getByLabelText("Права на публикацию"), "granted");
    await user.click(screen.getByRole("button", { name: "Загрузить" }));

    expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
      altText: "Массажный кабинет",
      file,
      folder: "services",
      name: "studio",
      publicationConsent: "granted",
      type: "Фото",
    }));
  });
});
