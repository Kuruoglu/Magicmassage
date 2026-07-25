import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailPreferencesForm } from "./EmailPreferencesForm";

describe("EmailPreferencesForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not mutate preferences on render and confirms with POST", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EmailPreferencesForm locale="en" token="signed-token" />);

    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Stop follow-up emails" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/public/email-preferences/unsubscribe", {
      body: JSON.stringify({ token: "signed-token" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(await screen.findByRole("heading", { name: "Preference saved" })).toHaveFocus();
  });

  it("shows an invalid-link message without offering a mutation", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailPreferencesForm locale="ru" token="" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Ссылка недействительна");
    expect(screen.getByRole("button", { name: "Отключить письма после визита" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
