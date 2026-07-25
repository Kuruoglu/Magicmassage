import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeGrid, type CalendarTimeSelection } from "./TimeGrid";

function renderGrid({
  activeTimeSelection,
  onSelectTimeRange = vi.fn(),
}: {
  activeTimeSelection?: CalendarTimeSelection;
  onSelectTimeRange?: (selection: CalendarTimeSelection) => void;
} = {}) {
  render(
    <TimeGrid
      activeTimeSelection={activeTimeSelection}
      days={[{
        appointments: [],
        ariaLabel: "Расписание 20 июля",
        date: "2026-07-20",
      }]}
      mode="day"
      onDragOverAppointment={vi.fn()}
      onDropAppointment={vi.fn()}
      onSelectTimeRange={onSelectTimeRange}
      renderAppointment={() => null}
    />,
  );

  const column = screen.getByRole("list", { name: "Расписание 20 июля" });
  vi.spyOn(column, "getBoundingClientRect").mockReturnValue({
    bottom: 1728,
    height: 1728,
    left: 0,
    right: 300,
    toJSON: () => ({}),
    top: 0,
    width: 300,
    x: 0,
    y: 0,
  });

  return { column, onSelectTimeRange };
}

describe("TimeGrid interval selection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects a dragged 15-minute-snapped interval", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });

    fireEvent.pointerDown(column, { button: 0, clientY: 1008, pointerId: 1, pointerType: "mouse" });
    expect(screen.getByText("14:00 - 14:15")).toBeInTheDocument();
    fireEvent.pointerMove(column, { clientY: 1080, pointerId: 1, pointerType: "mouse" });
    expect(screen.getByText("14:00 - 15:00")).toBeInTheDocument();
    fireEvent.pointerUp(column, { button: 0, clientY: 1080, pointerId: 1, pointerType: "mouse" });

    expect(onSelectTimeRange).toHaveBeenCalledWith({
      date: "2026-07-20",
      durationMinutes: 60,
      endsAt: "15:00",
      startsAt: "14:00",
    });
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("uses one hour for a short click and normalizes an upward drag", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });

    fireEvent.pointerDown(column, { button: 0, clientY: 1008, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(column, { button: 0, clientY: 1008, pointerId: 1, pointerType: "mouse" });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({
      durationMinutes: 60,
      endsAt: "15:00",
      startsAt: "14:00",
    }));

    fireEvent.pointerDown(column, { button: 0, clientY: 1080, pointerId: 2, pointerType: "mouse" });
    fireEvent.pointerUp(column, { button: 0, clientY: 1008, pointerId: 2, pointerType: "mouse" });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({
      durationMinutes: 60,
      endsAt: "15:00",
      startsAt: "14:00",
    }));
  });

  it("shows a 30-minute touch selection immediately and submits it on release", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const startTouch = { clientX: 120, clientY: 1008, identifier: 1 };

    fireEvent.touchStart(column, { changedTouches: [startTouch], touches: [startTouch] });
    expect(screen.getByText("14:00 - 14:30")).toBeInTheDocument();
    fireEvent.touchEnd(column, { changedTouches: [startTouch], touches: [] });

    expect(onSelectTimeRange).toHaveBeenCalledWith({
      date: "2026-07-20",
      durationMinutes: 30,
      endsAt: "14:30",
      startsAt: "14:00",
    });
  });

  it("keeps a submitted interval visible and resizes it from the persistent end handle", () => {
    const onSelectTimeRange = vi.fn();
    renderGrid({
      activeTimeSelection: {
        date: "2026-07-20",
        durationMinutes: 30,
        endsAt: "14:30",
        startsAt: "14:00",
      },
      onSelectTimeRange,
    });

    expect(screen.getByText("Выбранное время")).toBeInTheDocument();
    const endHandle = screen.getByRole("slider", { name: "Изменить конец интервала" });
    fireEvent.pointerDown(endHandle, {
      button: 0,
      clientY: 1044,
      pointerId: 9,
      pointerType: "touch",
    });
    fireEvent.pointerMove(endHandle, {
      clientY: 1080,
      pointerId: 9,
      pointerType: "touch",
    });
    expect(screen.getByText("14:00 - 15:00")).toBeInTheDocument();
    fireEvent.pointerUp(endHandle, {
      clientY: 1080,
      pointerId: 9,
      pointerType: "touch",
    });

    expect(onSelectTimeRange).toHaveBeenLastCalledWith({
      date: "2026-07-20",
      durationMinutes: 60,
      endsAt: "15:00",
      startsAt: "14:00",
    });
  });

  it("resizes both persistent boundaries from the keyboard in 15-minute steps", () => {
    const onSelectTimeRange = vi.fn();
    renderGrid({
      activeTimeSelection: {
        date: "2026-07-20",
        durationMinutes: 60,
        endsAt: "15:00",
        startsAt: "14:00",
      },
      onSelectTimeRange,
    });

    fireEvent.keyDown(screen.getByRole("slider", { name: "Изменить начало интервала" }), {
      key: "ArrowDown",
    });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({
      durationMinutes: 45,
      endsAt: "15:00",
      startsAt: "14:15",
    }));

    fireEvent.keyDown(screen.getByRole("slider", { name: "Изменить конец интервала" }), {
      key: "ArrowDown",
    });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({
      durationMinutes: 75,
      endsAt: "15:15",
      startsAt: "14:00",
    }));
  });

  it("restores the original persistent interval when pointer capture is cancelled", () => {
    const onSelectTimeRange = vi.fn();
    renderGrid({
      activeTimeSelection: {
        date: "2026-07-20",
        durationMinutes: 30,
        endsAt: "14:30",
        startsAt: "14:00",
      },
      onSelectTimeRange,
    });
    const endHandle = screen.getByRole("slider", { name: "Изменить конец интервала" });

    fireEvent.pointerDown(endHandle, { button: 0, clientY: 1044, pointerId: 10, pointerType: "touch" });
    fireEvent.pointerMove(endHandle, { clientY: 1080, pointerId: 10, pointerType: "touch" });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({ endsAt: "15:00" }));
    fireEvent.pointerCancel(endHandle, { pointerId: 10, pointerType: "touch" });

    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({
      endsAt: "14:30",
      startsAt: "14:00",
    }));
  });

  it("restores the original interval when a resize handle loses pointer capture", () => {
    const onSelectTimeRange = vi.fn();
    renderGrid({
      activeTimeSelection: {
        date: "2026-07-20",
        durationMinutes: 30,
        endsAt: "14:30",
        startsAt: "14:00",
      },
      onSelectTimeRange,
    });
    const endHandle = screen.getByRole("slider", { name: "Изменить конец интервала" });

    fireEvent.pointerDown(endHandle, { button: 0, clientY: 1044, pointerId: 11, pointerType: "touch" });
    fireEvent.pointerMove(endHandle, { clientY: 1080, pointerId: 11, pointerType: "touch" });
    fireEvent.lostPointerCapture(endHandle, { pointerId: 11, pointerType: "touch" });

    expect(onSelectTimeRange).toHaveBeenLastCalledWith(expect.objectContaining({
      endsAt: "14:30",
      startsAt: "14:00",
    }));
  });

  it("shows the serialized 23:59 endpoint in a persistent day-end selection", () => {
    renderGrid({
      activeTimeSelection: {
        date: "2026-07-20",
        durationMinutes: 14,
        endsAt: "23:59",
        startsAt: "23:45",
      },
    });

    expect(screen.getByText("23:45 - 23:59")).toBeInTheDocument();
    expect(screen.queryByText("23:45 - 24:00")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Изменить конец интервала" })).toHaveAttribute(
      "aria-valuetext",
      "23:59",
    );
  });

  it("resizes an immediate touch selection in 15-minute steps", () => {
    vi.useFakeTimers();
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const startTouch = { clientX: 120, clientY: 1008, identifier: 1 };

    fireEvent.touchStart(column, { changedTouches: [startTouch], touches: [startTouch] });
    expect(screen.getByText("14:00 - 14:30")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(250));

    const endTouch = { ...startTouch, clientY: 1098 };
    fireEvent.touchMove(column, { changedTouches: [endTouch], touches: [endTouch] });
    expect(screen.getByText("14:00 - 15:15")).toBeInTheDocument();
    fireEvent.touchEnd(column, { changedTouches: [endTouch], touches: [] });

    expect(onSelectTimeRange).toHaveBeenCalledWith({
      date: "2026-07-20",
      durationMinutes: 75,
      endsAt: "15:15",
      startsAt: "14:00",
    });
  });

  it("cancels the preview for a quick vertical swipe so the calendar can scroll", () => {
    vi.useFakeTimers();
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const startTouch = { clientX: 120, clientY: 1008, identifier: 1 };
    const swipeTouch = { ...startTouch, clientY: 1032 };

    fireEvent.touchStart(column, { changedTouches: [startTouch], touches: [startTouch] });
    expect(screen.getByText("14:00 - 14:30")).toBeInTheDocument();
    fireEvent.touchMove(column, { changedTouches: [swipeTouch], touches: [swipeTouch] });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.touchEnd(column, { changedTouches: [swipeTouch], touches: [] });

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("always gives a horizontal swipe back to weekly calendar scrolling", () => {
    vi.useFakeTimers();
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const startTouch = { clientX: 120, clientY: 1008, identifier: 1 };
    const swipeTouch = { ...startTouch, clientX: 160, clientY: 1010 };

    fireEvent.touchStart(column, { changedTouches: [startTouch], touches: [startTouch] });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.touchMove(column, { changedTouches: [swipeTouch], touches: [swipeTouch] });
    fireEvent.touchEnd(column, { changedTouches: [swipeTouch], touches: [] });

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("cancels selection when a second finger lands on an interactive calendar item", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const firstTouch = { clientX: 120, clientY: 1008, identifier: 1 };
    const secondTouch = { clientX: 150, clientY: 1020, identifier: 2 };
    const appointmentButton = document.createElement("button");
    column.append(appointmentButton);

    fireEvent.touchStart(column, { changedTouches: [firstTouch], touches: [firstTouch] });
    fireEvent.touchStart(appointmentButton, {
      changedTouches: [secondTouch],
      touches: [firstTouch, secondTouch],
    });

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("cancels selection when a second finger lands outside the active day column", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const firstTouch = { clientX: 120, clientY: 1008, identifier: 1 };
    const secondTouch = { clientX: 280, clientY: 1020, identifier: 2 };
    const anotherCalendarSurface = document.createElement("div");
    document.body.append(anotherCalendarSurface);

    fireEvent.touchStart(column, { changedTouches: [firstTouch], touches: [firstTouch] });
    expect(screen.getByText("14:00 - 14:30")).toBeInTheDocument();
    fireEvent.touchStart(anotherCalendarSurface, {
      changedTouches: [secondTouch],
      touches: [firstTouch, secondTouch],
    });
    fireEvent.touchEnd(column, { changedTouches: [firstTouch], touches: [secondTouch] });
    anotherCalendarSurface.remove();

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("discards an active touch draft when the browser cancels the gesture", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const touch = { clientX: 120, clientY: 1008, identifier: 1 };

    fireEvent.touchStart(column, { changedTouches: [touch], touches: [touch] });
    expect(screen.getByText("14:00 - 14:30")).toBeInTheDocument();

    fireEvent.touchCancel(column, { changedTouches: [touch], touches: [] });
    fireEvent.touchEnd(column, { changedTouches: [touch], touches: [] });

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("does not start a touch selection on an appointment control", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });
    const touch = { clientX: 120, clientY: 1008, identifier: 2 };
    const appointmentButton = document.createElement("button");
    column.append(appointmentButton);

    fireEvent.touchStart(appointmentButton, { changedTouches: [touch], touches: [touch] });
    fireEvent.touchEnd(appointmentButton, { changedTouches: [touch], touches: [] });

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });

  it("normalizes day-end selections to the same persisted endpoint and duration", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });

    fireEvent.pointerDown(column, { button: 0, clientY: 1656, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(column, { clientY: 1728, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(column, { button: 0, clientY: 1728, pointerId: 1, pointerType: "mouse" });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith({
      date: "2026-07-20",
      durationMinutes: 59,
      endsAt: "23:59",
      startsAt: "23:00",
    });

    fireEvent.pointerDown(column, { button: 0, clientY: 1710, pointerId: 2, pointerType: "mouse" });
    fireEvent.pointerUp(column, { button: 0, clientY: 1710, pointerId: 2, pointerType: "mouse" });
    expect(onSelectTimeRange).toHaveBeenLastCalledWith({
      date: "2026-07-20",
      durationMinutes: 14,
      endsAt: "23:59",
      startsAt: "23:45",
    });
  });

  it("discards a pointer selection when the gesture is cancelled", () => {
    const onSelectTimeRange = vi.fn();
    const { column } = renderGrid({ onSelectTimeRange });

    fireEvent.pointerDown(column, { button: 0, clientY: 1008, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerCancel(column, { pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(column, { button: 0, clientY: 1080, pointerId: 1, pointerType: "mouse" });

    expect(onSelectTimeRange).not.toHaveBeenCalled();
    expect(screen.queryByText("Новый интервал")).not.toBeInTheDocument();
  });
});
