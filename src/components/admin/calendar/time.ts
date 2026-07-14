export const CALENDAR_SNAP_MINUTES = 15;
export const MIN_APPOINTMENT_DURATION_MINUTES = 15;

const TIME_PATTERN = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;

function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
}

function assertPositiveScale(hourHeight: number) {
  assertFiniteNumber(hourHeight, "Hour height");

  if (hourHeight <= 0) {
    throw new RangeError("Hour height must be greater than zero.");
  }
}

export function timeToMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time);

  if (!match) {
    throw new RangeError(`Invalid time: ${time}`);
  }

  if (time === "24:00") {
    return 24 * 60;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  assertFiniteNumber(minutes, "Minutes");

  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) {
    throw new RangeError("Minutes must be a whole number from 0 through 1440.");
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function snapMinutes(minutes: number): number {
  assertFiniteNumber(minutes, "Minutes");

  const snapped = Math.round(minutes / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES;
  return Object.is(snapped, -0) ? 0 : snapped;
}

export function timeToPosition(time: string, dayStart: string, hourHeight: number): number {
  assertPositiveScale(hourHeight);
  return ((timeToMinutes(time) - timeToMinutes(dayStart)) / 60) * hourHeight;
}

export function positionToTime(position: number, dayStart: string, hourHeight: number): string {
  assertFiniteNumber(position, "Position");
  assertPositiveScale(hourHeight);

  const minutes = timeToMinutes(dayStart) + Math.round((position / hourHeight) * 60);
  return minutesToTime(minutes);
}

export function durationToHeight(durationMinutes: number, hourHeight: number): number {
  assertFiniteNumber(durationMinutes, "Duration");
  assertPositiveScale(hourHeight);

  if (durationMinutes < 0) {
    throw new RangeError("Duration must not be negative.");
  }

  return (durationMinutes / 60) * hourHeight;
}

export function clampDuration(durationMinutes: number): number {
  assertFiniteNumber(durationMinutes, "Duration");
  return Math.max(MIN_APPOINTMENT_DURATION_MINUTES, durationMinutes);
}
