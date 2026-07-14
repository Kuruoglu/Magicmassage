import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ServiceRecord } from "@/admin/domain";
import { ServiceVisibilityToggle } from "./ServiceVisibilityToggle";

const service: ServiceRecord = {
  category: "massage",
  coverImage: "/media/service.jpg",
  duration: "60 мин",
  locales: ["bg", "ru"],
  name: "Classic massage",
  order: 1,
  seoTitle: "Classic massage",
  slug: "classic-massage",
  status: "Опубликована",
  summary: "Summary",
};

describe("ServiceVisibilityToggle", () => {
  it("switches a published service to hidden without changing its content", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ServiceVisibilityToggle onChange={onChange} service={service} />);

    await user.click(screen.getByRole("checkbox", { name: "Скрыть услугу Classic massage" }));
    expect(onChange).toHaveBeenCalledWith({ ...service, status: "Скрыта" });
  });
});
