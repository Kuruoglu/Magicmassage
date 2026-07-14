import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { BlogArticleEditor } from "./BlogArticleEditor";
import type { BlogArticleCancelContext, BlogArticleDraft } from "./types";

const initialArticle: BlogArticleDraft = {
  author: "Natali",
  category: "Советы",
  content:
    '<h2 style="text-align:center">Подготовка</h2><p><a href="javascript:alert(1)" target="_blank">Опасная ссылка</a></p><script>alert(1)</script>',
  coverAlt: "Светлый массажный кабинет",
  coverUrl: "/media/blog/room.jpg",
  excerpt: "Что важно знать до первого визита.",
  locale: "ru",
  scheduledAt: "",
  seoDescription: "Рекомендации перед первым сеансом массажа.",
  seoTitle: "Как подготовиться к первому массажу",
  slug: "first-massage-preparation",
  status: "draft",
  tags: ["массаж", "советы"],
  title: "Как подготовиться к первому массажу",
};

type HarnessProps = {
  initialValue?: BlogArticleDraft;
  mediaOptions?: readonly { alt: string; label: string; url: string }[];
  onAutosave?: (value: BlogArticleDraft) => Promise<void> | void;
  onCancel?: (context: BlogArticleCancelContext) => void;
  onSave?: (value: BlogArticleDraft) => Promise<void> | void;
};

function EditorHarness({ initialValue = initialArticle, mediaOptions, onAutosave, onCancel = vi.fn(), onSave = vi.fn() }: HarnessProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <BlogArticleEditor
      authorOptions={["Natali", "Редактор"]}
      categoryOptions={["Советы", "Новости"]}
      mediaOptions={mediaOptions}
      onAutosave={onAutosave}
      onCancel={onCancel}
      onChange={setValue}
      onSave={onSave}
      value={value}
    />
  );
}

function ContentValidationHarness() {
  const [value, setValue] = useState({ ...initialArticle, content: "<p></p>" });

  return (
    <>
      <button onClick={() => setValue((current) => ({ ...current, content: "<p>Новый текст статьи</p>" }))} type="button">
        Установить текст
      </button>
      <BlogArticleEditor onCancel={vi.fn()} onChange={setValue} onSave={vi.fn()} value={value} />
    </>
  );
}

describe("BlogArticleEditor", () => {
  it("renders the full article surface and an accessible TipTap toolbar", async () => {
    render(<EditorHarness />);

    expect(screen.getByRole("form", { name: "Редактор статьи" })).toHaveClass("admin-blog-editor-page");
    expect(screen.getByLabelText("Заголовок")).toHaveValue(initialArticle.title);
    expect(screen.getByLabelText("Slug")).toHaveValue(initialArticle.slug);
    expect(screen.getByLabelText("Язык")).toHaveValue("ru");
    expect(screen.getByLabelText("Статус")).toHaveValue("draft");
    expect(screen.getByLabelText("Категория")).toHaveValue(initialArticle.category);
    expect(screen.getByLabelText("Теги")).toHaveValue("массаж, советы");
    expect(screen.getByLabelText("Автор")).toHaveValue("Natali");
    expect(screen.getByLabelText("URL изображения")).toHaveValue(initialArticle.coverUrl);
    expect(screen.getByLabelText("SEO-заголовок")).toHaveValue(initialArticle.seoTitle);

    const editor = await screen.findByRole("textbox", { name: "Текст статьи" });
    expect(editor).toHaveAttribute("contenteditable", "true");

    const toolbar = screen.getByRole("toolbar", { name: "Форматирование статьи" });
    expect(within(toolbar).getByRole("combobox", { name: "Стиль абзаца" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Полужирный" })).toHaveAttribute(
      "title",
      "Полужирный",
    );
    expect(within(toolbar).getByRole("button", { name: "Подчеркнутый" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Маркированный список" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Цитата" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Выровнять по центру" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Отменить" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("tracks controlled changes, sanitizes save output, and resets its internal dirty baseline", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (value: BlogArticleDraft) => {
      void value;
    });
    render(<EditorHarness onSave={onSave} />);

    expect(screen.getByRole("status")).toHaveTextContent("Все изменения сохранены");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();

    const title = screen.getByLabelText("Заголовок");
    await user.clear(title);
    await user.type(title, "Обновленная статья");

    expect(screen.getByRole("status")).toHaveTextContent("Есть несохраненные изменения");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedArticle = onSave.mock.calls[0][0];
    expect(savedArticle.title).toBe("Обновленная статья");
    expect(savedArticle.content).not.toContain("<script");
    expect(savedArticle.content).not.toContain("javascript:");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Все изменения сохранены"));
  });

  it("passes the current controlled value and dirty state to cancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<EditorHarness onCancel={onCancel} />);

    await user.type(screen.getByLabelText("Категория"), " и уход");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(onCancel).toHaveBeenCalledWith({
      hasUnsavedChanges: true,
      value: expect.objectContaining({ category: "Советы и уход" }),
    });
  });

  it("autosaves incomplete draft metadata without weakening explicit publish validation", async () => {
    const user = userEvent.setup();
    const onAutosave = vi.fn();
    render(
      <EditorHarness
        initialValue={{ ...initialArticle, author: "", category: "", coverUrl: "", slug: "", title: "" }}
        onAutosave={onAutosave}
      />,
    );

    await user.type(screen.getByLabelText("Заголовок"), "Незавершенный черновик");

    await waitFor(() => expect(onAutosave).toHaveBeenCalledTimes(1), { timeout: 2500 });
    expect(onAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "", status: "draft", title: "Незавершенный черновик" }),
    );
  });

  it("validates required metadata and moves focus to the first invalid field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditorHarness initialValue={{ ...initialArticle, author: "", category: "", slug: "" }} onSave={onSave} />);

    await user.type(screen.getByLabelText("Заголовок"), " обновлено");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Проверьте обязательные поля");
    expect(alert).toHaveTextContent("Slug должен содержать");
    await waitFor(() => expect(screen.getByLabelText("Slug")).toHaveFocus());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("requires a consented media-library cover before publishing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EditorHarness
        initialValue={{ ...initialArticle, status: "published" }}
        mediaOptions={[{ alt: "Approved", label: "Approved cover", url: "/media/blog/approved.jpg" }]}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("Заголовок"), " обновлено");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByRole("alert")).toHaveTextContent("выберите обложку из медиатеки");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks scheduled autosave and save when the cover is not publication-ready", async () => {
    const onAutosave = vi.fn();
    const onSave = vi.fn();
    vi.useFakeTimers();

    try {
      render(
        <EditorHarness
          initialValue={{ ...initialArticle, scheduledAt: "2026-07-20T10:30", status: "scheduled" }}
          mediaOptions={[{ alt: "Approved", label: "Approved cover", url: "/media/blog/approved.jpg" }]}
          onAutosave={onAutosave}
          onSave={onSave}
        />,
      );

      fireEvent.change(screen.getByLabelText("Заголовок"), {
        target: { value: `${initialArticle.title} обновлено` },
      });
      await act(async () => vi.advanceTimersByTimeAsync(1500));
      expect(onAutosave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
      expect(screen.getByRole("alert")).toHaveTextContent("выберите обложку из медиатеки");
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears a body validation error when the TipTap document changes", async () => {
    const user = userEvent.setup();
    render(<ContentValidationHarness />);

    await user.type(screen.getByLabelText("Заголовок"), " обновлено");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getAllByText("Добавьте текст статьи.")).toHaveLength(2);

    const editor = screen.getByRole("textbox", { name: "Текст статьи" });
    await user.click(screen.getByRole("button", { name: "Установить текст" }));

    await waitFor(() => expect(screen.queryAllByText("Добавьте текст статьи.")).toHaveLength(0));
    await waitFor(() => expect(editor).not.toHaveAttribute("aria-invalid"));
  });

  it("shows sanitized HTML in preview and provides an accessible link editor", async () => {
    const user = userEvent.setup();
    render(<EditorHarness />);

    await user.click(screen.getByRole("tab", { name: "Предпросмотр" }));
    const preview = screen.getByRole("tabpanel", { name: "Предпросмотр" });
    expect(preview.innerHTML).toContain("Подготовка");
    expect(preview.innerHTML).not.toContain("<script");
    expect(preview.innerHTML).not.toContain("javascript:");

    await user.click(screen.getByRole("tab", { name: "Редактор" }));
    await user.click(screen.getByRole("button", { name: "Ссылка" }));
    const linkGroup = screen.getByRole("group", { name: "Настройка ссылки" });
    const linkInput = within(linkGroup).getByLabelText("Адрес ссылки");
    await user.type(linkInput, "javascript:alert(1)");
    await user.click(within(linkGroup).getByRole("button", { name: "Применить" }));

    expect(within(linkGroup).getByRole("alert")).toHaveTextContent("Введите внутреннюю ссылку");
    expect(linkInput).toHaveAttribute("aria-invalid", "true");
  });

  it("synchronizes externally controlled HTML into the existing editor instance", async () => {
    const { rerender } = render(
      <BlogArticleEditor
        onCancel={vi.fn()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        value={initialArticle}
      />,
    );
    const editor = await screen.findByRole("textbox", { name: "Текст статьи" });

    rerender(
      <BlogArticleEditor
        onCancel={vi.fn()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        value={{ ...initialArticle, content: "<p>Внешнее обновление</p>" }}
      />,
    );

    await waitFor(() => expect(editor).toHaveTextContent("Внешнее обновление"));
  });

  it("keeps unsaved state visible when server persistence rejects the save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {
      throw new Error("Supabase не подтвердил сохранение статьи.");
    });
    render(<EditorHarness onSave={onSave} />);

    await user.clear(screen.getByLabelText("Заголовок"));
    await user.type(screen.getByLabelText("Заголовок"), "Обновленная статья");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Supabase не подтвердил сохранение статьи");
    expect(screen.getByRole("form", { name: "Редактор статьи" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Есть несохраненные изменения");
  });
});
