import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Appointment } from "@/admin/domain";

import { AppointmentBlock, clampAppointmentDurationToDay } from "./AppointmentBlock";

const appointment: Appointment = {
  client: "Test client",
  date: "2026-07-14",
  durationMinutes: 15,
  id: "end-of-day",
  note: "",
  service: "Test service",
  status: "Подтверждена",
  time: "23:45",
};

describe("AppointmentBlock", () => {
  it("clamps resized duration to the snapped time remaining in the day", () => {
    expect(clampAppointmentDurationToDay(appointment, 15)).toBe(15);
    expect(clampAppointmentDurationToDay(appointment, -60)).toBe(15);

    const appointmentAt2330 = { ...appointment, time: "23:30" };
    expect(clampAppointmentDurationToDay(appointmentAt2330, 8)).toBe(30);
    expect(clampAppointmentDurationToDay(appointmentAt2330, 60)).toBe(30);
  });

  it("positions the displayed 23:45 time at 23:45 and applies its overlap column", () => {
    render(
      <AppointmentBlock
        appointment={appointment}
        classification={{ outsideWorkingHours: true, overlap: true }}
        isSelected={false}
        layout={{ column: 1, columnCount: 2, leftPercentage: 50, widthPercentage: 50 }}
        onDragEnd={vi.fn()}
        onDragStart={vi.fn()}
        onResize={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const block = screen.getByRole("listitem");
    expect(block).toHaveTextContent("23:45");
    expect(block).toHaveStyle({ top: "1710px" });
    expect(block.style.left).toBe("calc(50% + 4px)");
    expect(block.style.width).toBe("calc(50% - 8px)");
  });
});
