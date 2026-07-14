import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Appointment } from "@/admin/domain";
import { ClientVisitCommentEditor } from "./ClientVisitCommentEditor";

const appointment: Appointment = {
  client: "Test Client",
  date: "2026-07-12",
  id: "appointment-1",
  note: "Original appointment note",
  postVisitComment: "Previous visit comment",
  service: "Massage",
  status: "Завершена",
  time: "12:00",
};

describe("ClientVisitCommentEditor", () => {
  it("saves a visit-scoped comment without overwriting the appointment note", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));
    render(<ClientVisitCommentEditor appointment={appointment} onCancel={vi.fn()} onSave={onSave} />);

    const field = screen.getByLabelText("Комментарий после визита");
    await user.clear(field);
    await user.type(field, "Updated visit result");
    await user.click(screen.getByRole("button", { name: "Сохранить комментарий" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          note: "Original appointment note",
          postVisitComment: "Updated visit result",
          postVisitCommentedAt: expect.any(String),
        }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Комментарий сохранен.");
  });

  it("reports dirty state and waits for persistence before showing success", async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    let resolveSave: ((result: { ok: true }) => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <ClientVisitCommentEditor
        appointment={appointment}
        onDirtyChange={onDirtyChange}
        onSave={onSave}
      />,
    );

    const field = screen.getByLabelText("Комментарий после визита");
    await user.clear(field);
    await user.type(field, "Confirmed result");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(screen.getByRole("button", { name: "Сохранить комментарий" }));

    expect(screen.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
    expect(field).toBeDisabled();
    expect(screen.queryByText("Комментарий сохранен.")).not.toBeInTheDocument();

    resolveSave?.({ ok: true });

    expect(await screen.findByRole("status")).toHaveTextContent("Комментарий сохранен.");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("preserves the failed draft and exposes the persistence error", async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const onSave = vi.fn(async () => ({ message: "Supabase отклонил изменение.", ok: false as const }));
    render(
      <ClientVisitCommentEditor
        appointment={appointment}
        onDirtyChange={onDirtyChange}
        onSave={onSave}
      />,
    );

    const field = screen.getByLabelText("Комментарий после визита");
    await user.clear(field);
    await user.type(field, "Draft that must remain");
    await user.click(screen.getByRole("button", { name: "Сохранить комментарий" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Supabase отклонил изменение.");
    expect(field).toHaveValue("Draft that must remain");
    expect(field).toBeEnabled();
    expect(screen.queryByText("Комментарий сохранен.")).not.toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});
