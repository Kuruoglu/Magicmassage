"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { externalBookingLinkProps } from "@/config/booking";
import type { Locale } from "@/i18n/config";

import {
  BookingApiError,
  confirmPublicBooking,
  createBookingHold,
  loadBookingAvailability,
  loadBookingOptions,
} from "./api";
import { getPublicBookingCopy } from "./copy";
import styles from "./PublicBooking.module.css";
import type {
  ActiveBookingHold,
  BookingAvailabilityDate,
  BookingConfirmation,
  BookingContact,
  BookingContactPreference,
  BookingOptions,
  BookingService,
  BookingStep,
  BookingVariant,
} from "./types";

const localeTags: Record<Locale, string> = {
  bg: "bg-BG",
  ru: "ru-RU",
  ua: "uk-UA",
  en: "en-GB",
};

const steps: BookingStep[] = ["service", "variant", "specialist", "schedule", "details", "review"];

type PublicBookingFlowProps = {
  initialServiceSlug?: string;
  locale: Locale;
};

type ContactErrors = Partial<Record<"email" | "name" | "phone" | "privacy", string>>;

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatPrice(locale: Locale, variant: Pick<BookingVariant, "currency" | "priceCents">) {
  return new Intl.NumberFormat(localeTags[locale], {
    currency: variant.currency,
    style: "currency",
  }).format(variant.priceCents / 100);
}

function formatDate(locale: Locale, value: string, style: "full" | "long" = "long") {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "numeric",
    month: "long",
    ...(style === "full" ? { weekday: "long", year: "numeric" } : { year: "numeric" }),
  }).format(parseDate(value));
}

function safeReference(value: string, fallback: string) {
  const reference = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(reference) ? reference : fallback;
}

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function isActiveHold(hold: ActiveBookingHold | null) {
  return Boolean(hold && Date.parse(hold.expiresAt) > Date.now());
}

function policyNotice(policy: unknown) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return null;
  const row = policy as Record<string, unknown>;
  const value = typeof row.notice === "string" ? row.notice : row.summary;

  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}

function buildBookingUrl(input: {
  date?: string | null;
  service?: string | null;
  specialist?: string | null;
  step: BookingStep;
  variant?: string | null;
}) {
  const search = new URLSearchParams();
  if (input.service) search.set("service", input.service);
  if (input.variant) search.set("variant", input.variant);
  if (input.specialist !== undefined) search.set("specialist", input.specialist ?? "any");
  if (input.date) search.set("date", input.date);
  search.set("step", input.step);
  return `${window.location.pathname}?${search.toString()}`;
}

function isBookingStep(value: string | null): value is BookingStep {
  return steps.includes(value as BookingStep);
}

function HoldCountdown({ expiresAt, label }: { expiresAt: string; label: string }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)),
  );

  useEffect(() => {
    const update = () =>
      setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <p className={styles.holdCountdown} role="timer">
      <span>{label}</span>
      <strong>{minutes}:{seconds}</strong>
    </p>
  );
}

function DateCalendar({
  dates,
  locale,
  onSelect,
  selectedDate,
}: {
  dates: BookingAvailabilityDate[];
  locale: Locale;
  onSelect: (date: string) => void;
  selectedDate: string | null;
}) {
  const copy = getPublicBookingCopy(locale);
  const monthTitleId = useId();
  const months = useMemo(() => {
    const grouped = new Map<string, BookingAvailabilityDate[]>();
    for (const date of dates) {
      const key = date.date.slice(0, 7);
      grouped.set(key, [...(grouped.get(key) ?? []), date]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [dates]);
  const initialMonthIndex = Math.max(
    0,
    months.findIndex(([month]) => month === selectedDate?.slice(0, 7)),
  );
  const selectedMonth = selectedDate?.slice(0, 7);
  const [calendarView, setCalendarView] = useState({
    selectedMonth,
    visibleMonthIndex: initialMonthIndex,
  });

  if (calendarView.selectedMonth !== selectedMonth) {
    const selectedMonthIndex = months.findIndex(([month]) => month === selectedMonth);
    setCalendarView({
      selectedMonth,
      visibleMonthIndex: selectedMonthIndex >= 0
        ? selectedMonthIndex
        : calendarView.visibleMonthIndex,
    });
  }
  const visibleMonthIndex = calendarView.visibleMonthIndex;
  const weekdayFormatter = new Intl.DateTimeFormat(localeTags[locale], { weekday: "narrow" });
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(2026, 0, 5 + index)),
  );
  const visibleMonth = months[visibleMonthIndex];

  if (!visibleMonth) return null;

  const [month, monthDates] = visibleMonth;
  const firstDate = parseDate(`${month}-01`);
  const firstVisibleDate = parseDate(monthDates[0].date);
  const offset = (firstVisibleDate.getDay() + 6) % 7;
  const monthFormatter = new Intl.DateTimeFormat(localeTags[locale], {
    month: "long",
    year: "numeric",
  });
  const monthTitle = monthFormatter.format(firstDate);
  const previousMonthTitle = visibleMonthIndex > 0
    ? monthFormatter.format(parseDate(`${months[visibleMonthIndex - 1][0]}-01`))
    : null;
  const nextMonthTitle = visibleMonthIndex < months.length - 1
    ? monthFormatter.format(parseDate(`${months[visibleMonthIndex + 1][0]}-01`))
    : null;

  return (
    <div className={styles.calendars}>
      <section className={styles.calendarMonth} aria-labelledby={monthTitleId}>
        <div
          aria-label={copy.monthNavigation}
          className={styles.calendarMonthHeader}
          role="group"
        >
          <button
            aria-label={previousMonthTitle ? `${copy.previousMonth}: ${previousMonthTitle}` : copy.previousMonth}
            className={styles.monthNavigationButton}
            disabled={visibleMonthIndex === 0}
            onClick={() => setCalendarView((current) => ({
              ...current,
              visibleMonthIndex: Math.max(0, current.visibleMonthIndex - 1),
            }))}
            title={copy.previousMonth}
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
          <h3 aria-atomic="true" aria-live="polite" id={monthTitleId}>{monthTitle}</h3>
          <button
            aria-label={nextMonthTitle ? `${copy.nextMonth}: ${nextMonthTitle}` : copy.nextMonth}
            className={styles.monthNavigationButton}
            disabled={visibleMonthIndex === months.length - 1}
            onClick={() => setCalendarView((current) => ({
              ...current,
              visibleMonthIndex: Math.min(months.length - 1, current.visibleMonthIndex + 1),
            }))}
            title={copy.nextMonth}
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className={styles.weekdays} aria-hidden="true">
          {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
        </div>
        <div className={styles.daysGrid}>
          {Array.from({ length: offset }, (_, index) => (
            <span className={styles.emptyDay} key={`empty-${index}`} aria-hidden="true" />
          ))}
          {monthDates.map((date) => {
            const disabled = date.availability === "unavailable";
            const status = copy.availability[date.availability];

            return (
              <button
                className={`${styles.dayButton} ${styles[date.availability]}`}
                type="button"
                key={date.date}
                disabled={disabled}
                aria-label={`${formatDate(locale, date.date, "full")}, ${status}`}
                aria-pressed={date.date === selectedDate}
                onClick={() => onSelect(date.date)}
              >
                <strong>{parseDate(date.date).getDate()}</strong>
                <span>{status}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function PublicBookingFlow({ initialServiceSlug, locale }: PublicBookingFlowProps) {
  const copy = getPublicBookingCopy(locale);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const historyIndexRef = useRef(0);
  const scheduleHistoryIndexRef = useRef(0);
  const pendingScheduleMessageRef = useRef<string | null>(null);
  const formId = useId();
  const [optionsState, setOptionsState] = useState<"error" | "loading" | "ready" | "unavailable">("loading");
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [step, setStep] = useState<BookingStep>("service");
  const [selectedServiceSlug, setSelectedServiceSlug] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availabilityDates, setAvailabilityDates] = useState<BookingAvailabilityDate[]>([]);
  const [loadedAvailabilityKey, setLoadedAvailabilityKey] = useState<string | null>(null);
  const [availabilityState, setAvailabilityState] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [hold, setHold] = useState<ActiveBookingHold | null>(null);
  const [holdBusy, setHoldBusy] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [contact, setContact] = useState<BookingContact>({
    careEmailOptIn: false,
    contactPreference: "phone",
    email: "",
    name: "",
    phone: "",
    privacyAccepted: false,
  });

  const selectedService = useMemo(
    () => options?.services.find((service) => service.slug === selectedServiceSlug) ?? null,
    [options, selectedServiceSlug],
  );
  const selectedVariant = useMemo(
    () => selectedService?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedService, selectedVariantId],
  );
  const selectedSpecialist = useMemo(
    () => selectedService?.specialists.find((specialist) => specialist.id === selectedSpecialistId) ?? null,
    [selectedService, selectedSpecialistId],
  );
  const availabilityKey = selectedVariantId && selectedSpecialistId !== undefined
    ? `${selectedVariantId}:${selectedSpecialistId ?? "any"}`
    : null;
  const selectedAvailabilityDate = availabilityDates.find((date) => date.date === selectedDate) ?? null;
  const summaryQuote = confirmation?.appointment ?? hold ?? selectedVariant;
  const summarySpecialist = confirmation?.appointment.specialistName
    ?? hold?.specialistName
    ?? selectedSpecialist?.displayName
    ?? (selectedSpecialistId === null ? copy.anySpecialist : copy.notSelected);
  const notice = policyNotice(options?.policy);
  const currentStepTitle: Record<BookingStep, string> = {
    service: copy.serviceTitle,
    variant: copy.variantTitle,
    specialist: copy.specialistTitle,
    schedule: copy.scheduleTitle,
    details: copy.detailsTitle,
    review: copy.reviewTitle,
  };
  const currentStepHint: Record<BookingStep, string> = {
    service: copy.serviceHint,
    variant: copy.variantHint,
    specialist: copy.specialistHint,
    schedule: copy.scheduleHint,
    details: copy.detailsHint,
    review: copy.reviewHint,
  };

  const writeHistory = useCallback((nextStep: BookingStep, mode: "push" | "replace", overrides?: {
    date?: string | null;
    service?: string | null;
    specialist?: string | null;
    variant?: string | null;
  }) => {
    const specialist = overrides && Object.prototype.hasOwnProperty.call(overrides, "specialist")
      ? overrides.specialist
      : selectedSpecialistId;
    const url = buildBookingUrl({
      date: overrides?.date === undefined ? selectedDate : overrides.date,
      service: overrides?.service === undefined ? selectedServiceSlug : overrides.service,
      specialist,
      step: nextStep,
      variant: overrides?.variant === undefined ? selectedVariantId : overrides.variant,
    });
    const nextHistoryIndex = mode === "push"
      ? historyIndexRef.current + 1
      : historyIndexRef.current;
    window.history[mode === "push" ? "pushState" : "replaceState"](
      { bookingFlow: true, bookingIndex: nextHistoryIndex, step: nextStep },
      "",
      url,
    );
    historyIndexRef.current = nextHistoryIndex;
    if (nextStep === "schedule") scheduleHistoryIndexRef.current = nextHistoryIndex;
  }, [selectedDate, selectedServiceSlug, selectedSpecialistId, selectedVariantId]);

  const navigateToStep = useCallback((nextStep: BookingStep, mode: "push" | "replace" = "push") => {
    setStatusMessage(null);
    setStep(nextStep);
    writeHistory(nextStep, mode);
  }, [writeHistory]);

  const returnToSchedule = useCallback((message: string) => {
    setHold(null);
    setSelectedTime(null);
    setStatusMessage(message);
    setStep("schedule");

    const historyDistance = historyIndexRef.current - scheduleHistoryIndexRef.current;
    if (historyDistance > 0) {
      pendingScheduleMessageRef.current = message;
      historyIndexRef.current = scheduleHistoryIndexRef.current;
      window.history.go(-historyDistance);
      return;
    }

    writeHistory("schedule", "replace");
  }, [writeHistory]);

  useEffect(() => {
    const controller = new AbortController();
    const recoverConfirmation = new URLSearchParams(window.location.search).get("step") === "review";

    loadBookingOptions(locale, controller.signal, recoverConfirmation)
      .then((result) => {
        setOptions(result);
        if (result.confirmation) {
          setOptionsState("ready");
          setConfirmation(result.confirmation);
          setSelectedServiceSlug(result.confirmation.appointment.serviceSlug);
          setSelectedVariantId(result.confirmation.appointment.priceVariantId);
          setSelectedSpecialistId(result.confirmation.appointment.specialistId ?? null);
          setSelectedDate(result.confirmation.appointment.date);
          setSelectedTime(result.confirmation.appointment.time);
          return;
        }

        if (!result.enabled || result.services.length === 0) {
          setOptionsState("unavailable");
          return;
        }

        setOptionsState("ready");
        const restoredHold = result.activeHold;
        const restoredService = restoredHold
          ? result.services.find((item) => item.slug === restoredHold.serviceSlug) ?? null
          : null;
        const restoredVariant = restoredService?.variants.find(
          (item) => item.id === restoredHold?.priceVariantId,
        ) ?? null;
        const restoredSpecialist = restoredService?.specialists.find(
          (item) => item.id === restoredHold?.specialistId,
        ) ?? null;
        if (restoredHold && restoredService && restoredVariant && restoredSpecialist) {
          setSelectedServiceSlug(restoredService.slug);
          setSelectedVariantId(restoredVariant.id);
          setSelectedSpecialistId(restoredSpecialist.id);
          setSelectedDate(restoredHold.date);
          setSelectedTime(restoredHold.time);
          setHold({ ...restoredHold, idempotencyKey: createIdempotencyKey() });
          setStep("details");
          historyIndexRef.current = 0;
          scheduleHistoryIndexRef.current = 0;
          window.history.replaceState(
            { bookingFlow: true, bookingIndex: 0, step: "details" },
            "",
            buildBookingUrl({
              date: restoredHold.date,
              service: restoredService.slug,
              specialist: restoredSpecialist.id,
              step: "details",
              variant: restoredVariant.id,
            }),
          );
          return;
        }

        const search = new URLSearchParams(window.location.search);
        const requestedService = search.get("service") ?? initialServiceSlug ?? null;
        const service = result.services.find((item) => item.slug === requestedService) ?? null;
        const requestedVariant = service?.variants.find((item) => item.id === search.get("variant")) ?? null;
        const specialistParam = search.get("specialist");
        const requestedSpecialist = specialistParam === "any"
          ? null
          : service?.specialists.find((item) => item.id === specialistParam)?.id;
        const requestedDate = search.get("date");
        const requestedStep = isBookingStep(search.get("step")) ? search.get("step") as BookingStep : null;
        let initialStep: BookingStep = requestedStep
          ?? (requestedVariant
            ? requestedSpecialist === undefined ? "specialist" : "schedule"
            : service ? "variant" : "service");
        if (!service) initialStep = "service";
        else if (!requestedVariant && steps.indexOf(initialStep) > steps.indexOf("variant")) initialStep = "variant";
        else if (requestedVariant && requestedSpecialist === undefined && steps.indexOf(initialStep) > steps.indexOf("specialist")) {
          initialStep = "specialist";
        } else if ((initialStep === "details" || initialStep === "review") && !restoredHold) {
          initialStep = "schedule";
        }

        setSelectedServiceSlug(service?.slug ?? null);
        setSelectedVariantId(requestedVariant?.id ?? null);
        setSelectedSpecialistId(requestedVariant ? requestedSpecialist : undefined);
        setSelectedDate(requestedVariant && requestedSpecialist !== undefined && requestedDate ? requestedDate : null);
        setStep(initialStep);
        historyIndexRef.current = 0;
        scheduleHistoryIndexRef.current = 0;
        window.history.replaceState(
          { bookingFlow: true, bookingIndex: 0, step: initialStep },
          "",
          buildBookingUrl({
            date: requestedVariant && requestedSpecialist !== undefined && requestedDate ? requestedDate : null,
            service: service?.slug ?? null,
            specialist: requestedVariant ? requestedSpecialist : undefined,
            step: initialStep,
            variant: requestedVariant?.id ?? null,
          }),
        );
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setOptionsState("error");
      });

    return () => controller.abort();
  }, [initialServiceSlug, locale]);

  useEffect(() => {
    if (optionsState !== "ready") return;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [optionsState, step]);

  useEffect(() => {
    if (!confirmation) return;
    const frame = window.requestAnimationFrame(() => successHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [confirmation]);

  useEffect(() => {
    if (!options) return;

    const onPopState = () => {
      const state = window.history.state as { bookingIndex?: unknown } | null;
      if (Number.isInteger(state?.bookingIndex) && Number(state?.bookingIndex) >= 0) {
        historyIndexRef.current = Number(state?.bookingIndex);
      }
      const search = new URLSearchParams(window.location.search);
      const service = options.services.find((item) => item.slug === search.get("service")) ?? null;
      const variant = service?.variants.find((item) => item.id === search.get("variant")) ?? null;
      const specialistParam = search.get("specialist");
      const specialist = specialistParam === "any"
        ? null
        : service?.specialists.find((item) => item.id === specialistParam)?.id;
      const requestedStep = isBookingStep(search.get("step")) ? search.get("step") as BookingStep : "service";
      let nextStep: BookingStep = requestedStep;

      if (!service) nextStep = "service";
      else if (!variant && steps.indexOf(nextStep) > steps.indexOf("variant")) nextStep = "variant";
      else if (variant && specialist === undefined && steps.indexOf(nextStep) > steps.indexOf("specialist")) nextStep = "specialist";
      else if ((nextStep === "details" || nextStep === "review") && !hold) nextStep = "schedule";

      if (nextStep === "schedule") scheduleHistoryIndexRef.current = historyIndexRef.current;
      if (nextStep !== requestedStep) {
        window.history.replaceState(
          { bookingFlow: true, bookingIndex: historyIndexRef.current, step: nextStep },
          "",
          buildBookingUrl({
            date: variant ? search.get("date") : null,
            service: service?.slug ?? null,
            specialist: variant ? specialist : undefined,
            step: nextStep,
            variant: variant?.id ?? null,
          }),
        );
      }

      setSelectedServiceSlug(service?.slug ?? null);
      setSelectedVariantId(variant?.id ?? null);
      setSelectedSpecialistId(variant ? specialist : undefined);
      setSelectedDate(variant && specialist !== undefined ? search.get("date") : null);
      setStep(nextStep);
      setStatusMessage(pendingScheduleMessageRef.current);
      pendingScheduleMessageRef.current = null;
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hold, options]);

  const refreshAvailability = useCallback(async (signal?: AbortSignal) => {
    if (!selectedVariantId || selectedSpecialistId === undefined || !availabilityKey) return;
    setAvailabilityState("loading");

    try {
      const result = await loadBookingAvailability({
        horizonDays: options?.horizonDays ?? 31,
        signal,
        ...(selectedSpecialistId ? { specialistId: selectedSpecialistId } : {}),
        variantId: selectedVariantId,
      });
      setAvailabilityDates(result.dates);
      setLoadedAvailabilityKey(availabilityKey);
      setAvailabilityState("ready");
      setSelectedDate((current) =>
        current && result.dates.some((date) => date.date === current && date.availability !== "unavailable")
          ? current
          : null,
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") setAvailabilityState("error");
    }
  }, [availabilityKey, options, selectedSpecialistId, selectedVariantId]);

  useEffect(() => {
    if (step !== "schedule" || !availabilityKey || loadedAvailabilityKey === availabilityKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void refreshAvailability(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [availabilityKey, loadedAvailabilityKey, refreshAvailability, step]);

  useEffect(() => {
    if (!hold) return;
    const expiresIn = Date.parse(hold.expiresAt) - Date.now();

    const expireHold = () => {
      returnToSchedule(copy.holdExpired);
    };

    const timer = window.setTimeout(expireHold, Math.max(0, expiresIn) + 50);

    return () => window.clearTimeout(timer);
  }, [copy.holdExpired, hold, returnToSchedule]);

  const restoreActiveHold = useCallback(async () => {
    const refreshedOptions = await loadBookingOptions(locale);
    setOptions(refreshedOptions);
    const restoredHold = refreshedOptions.activeHold;
    const restoredService = restoredHold
      ? refreshedOptions.services.find((item) => item.slug === restoredHold.serviceSlug) ?? null
      : null;
    const restoredVariant = restoredService?.variants.find(
      (item) => item.id === restoredHold?.priceVariantId,
    ) ?? null;
    const restoredSpecialist = restoredService?.specialists.find(
      (item) => item.id === restoredHold?.specialistId,
    ) ?? null;
    if (!restoredHold || !restoredService || !restoredVariant || !restoredSpecialist) return null;

    const activeHold = { ...restoredHold, idempotencyKey: createIdempotencyKey() };
    setSelectedServiceSlug(restoredService.slug);
    setSelectedVariantId(restoredVariant.id);
    setSelectedSpecialistId(restoredSpecialist.id);
    setSelectedDate(restoredHold.date);
    setSelectedTime(restoredHold.time);
    setHold(activeHold);
    setAvailabilityDates([]);
    setLoadedAvailabilityKey(null);

    return { hold: activeHold, service: restoredService, specialist: restoredSpecialist, variant: restoredVariant };
  }, [locale]);

  const selectService = (service: BookingService) => {
    setSelectedServiceSlug(service.slug);
    setSelectedVariantId(null);
    setSelectedSpecialistId(undefined);
    setSelectedDate(null);
    setSelectedTime(null);
    setHold(null);
    setAvailabilityDates([]);
    setLoadedAvailabilityKey(null);
    setAvailabilityState("idle");
    setStatusMessage(null);
    writeHistory("service", "replace", {
      date: null,
      service: service.slug,
      specialist: undefined,
      variant: null,
    });
  };

  const selectVariant = (variant: BookingVariant) => {
    setSelectedVariantId(variant.id);
    setSelectedSpecialistId(undefined);
    setSelectedDate(null);
    setSelectedTime(null);
    setHold(null);
    setAvailabilityDates([]);
    setLoadedAvailabilityKey(null);
    setAvailabilityState("idle");
    setStatusMessage(null);
    writeHistory("variant", "replace", { date: null, specialist: undefined, variant: variant.id });
  };

  const selectSpecialist = (specialistId: string | null) => {
    setSelectedSpecialistId(specialistId);
    setSelectedDate(null);
    setSelectedTime(null);
    setHold(null);
    setAvailabilityDates([]);
    setLoadedAvailabilityKey(null);
    setAvailabilityState("idle");
    setStatusMessage(null);
    writeHistory("specialist", "replace", { date: null, specialist: specialistId });
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setHold(null);
    setStatusMessage(null);
    writeHistory("schedule", "replace", { date });
  };

  const selectTime = async (time: string) => {
    if (!selectedServiceSlug || !selectedVariantId || selectedSpecialistId === undefined || !selectedDate || holdBusy) return;
    if (isActiveHold(hold) && selectedTime === time) {
      navigateToStep("details");
      return;
    }
    const previousHold = isActiveHold(hold) ? hold : null;
    const previousTime = previousHold ? selectedTime : null;
    setHoldBusy(true);
    setStatusMessage(copy.loadingHold);

    try {
      const result = await createBookingHold({
        date: selectedDate,
        ...(selectedSpecialistId ? { specialistId: selectedSpecialistId } : {}),
        time,
        variantId: selectedVariantId,
      });
      setHold({ ...result, idempotencyKey: createIdempotencyKey() });
      setSelectedTime(time);
      setStatusMessage(null);
      navigateToStep("details");
    } catch (error) {
      let restored = null;
      try {
        restored = await restoreActiveHold();
      } catch {
        // Preserve the last known valid hold when reconciliation is unavailable.
      }

      if (restored?.hold.time === time) {
        setStatusMessage(null);
        setStep("details");
        writeHistory("details", "push", {
          date: restored.hold.date,
          service: restored.service.slug,
          specialist: restored.specialist.id,
          variant: restored.variant.id,
        });
      } else {
        setHold(restored?.hold ?? previousHold);
        setSelectedTime(restored?.hold.time ?? previousTime);
        setStatusMessage(error instanceof BookingApiError && error.status === 409 ? copy.conflict : copy.holdError);
        if (!restored && !previousHold) setLoadedAvailabilityKey(null);
        if (restored) {
          setStep("schedule");
          writeHistory("schedule", "replace", {
            date: restored.hold.date,
            service: restored.service.slug,
            specialist: restored.specialist.id,
            variant: restored.variant.id,
          });
        }
      }
    } finally {
      setHoldBusy(false);
    }
  };

  const updateContact = <Key extends keyof BookingContact>(key: Key, value: BookingContact[Key]) => {
    setContact((current) => ({ ...current, [key]: value }));
    setContactErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: ContactErrors = {};
    const normalizedName = contact.name.trim();
    const phoneDigits = contact.phone.replace(/\D/g, "");
    if (!normalizedName) errors.name = copy.required;
    else if (normalizedName.length < 2 || normalizedName.length > 100) errors.name = copy.invalidName;
    if (!contact.phone.trim()) errors.phone = copy.required;
    else if (contact.phone.length < 7 || contact.phone.length > 32 || phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phone = copy.invalidPhone;
    }
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.email = copy.invalidEmail;
    if (contact.contactPreference === "email" && !contact.email.trim()) errors.email = copy.emailPreference;
    if (!contact.privacyAccepted) errors.privacy = copy.required;
    setContactErrors(errors);

    const firstError = Object.keys(errors)[0];
    if (firstError) {
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-booking-field="${firstError}"]`)?.focus(),
      );
      return;
    }

    navigateToStep("review");
  };

  const confirmBooking = async () => {
    if (!hold) {
      returnToSchedule(copy.holdExpired);
      return;
    }

    setConfirmationBusy(true);
    setStatusMessage(null);

    try {
      setConfirmation(await confirmPublicBooking({
        contact,
        holdToken: hold.holdToken,
        idempotencyKey: hold.idempotencyKey,
        locale,
        selectionId: hold.selectionId,
        selectionVersion: hold.selectionVersion,
      }));
    } catch (error) {
      if (error instanceof BookingApiError && error.status === 409) {
        setLoadedAvailabilityKey(null);
        returnToSchedule(copy.conflict);
      } else {
        setStatusMessage(copy.confirmError);
      }
    } finally {
      setConfirmationBusy(false);
    }
  };

  const goBack = () => {
    const currentIndex = steps.indexOf(step);
    if (currentIndex <= 0) return;
    if (historyIndexRef.current > 0) {
      window.history.back();
      return;
    }
    navigateToStep(steps[currentIndex - 1], "replace");
  };

  const renderSummary = (full = false) => (
    <dl className={styles.summaryList}>
      <div>
        <dt>{copy.service}</dt>
        <dd>{confirmation?.appointment.serviceName ?? selectedService?.title ?? copy.notSelected}</dd>
      </div>
      <div>
        <dt>{copy.duration}</dt>
        <dd>{summaryQuote
          ? `${summaryQuote.durationMinutes} ${copy.minutes} · ${formatPrice(locale, summaryQuote)}`
          : copy.notSelected}</dd>
      </div>
      <div><dt>{copy.specialist}</dt><dd>{summarySpecialist}</dd></div>
      <div><dt>{copy.date}</dt><dd>{selectedDate ? formatDate(locale, selectedDate) : copy.notSelected}</dd></div>
      <div><dt>{copy.time}</dt><dd>{selectedTime ?? copy.notSelected}</dd></div>
      {full && contact.name ? (
        <>
          <div><dt>{copy.name}</dt><dd>{contact.name}</dd></div>
          <div><dt>{copy.phone}</dt><dd>{contact.phone}</dd></div>
          {contact.email ? <div><dt>{copy.email.replace(/\s*\(.+\)$/, "")}</dt><dd>{contact.email}</dd></div> : null}
          <div><dt>{copy.contactPreference}</dt><dd>{copy.preferences[contact.contactPreference]}</dd></div>
        </>
      ) : null}
    </dl>
  );

  if (optionsState === "loading") {
    return <main className={styles.workspace}><p className={styles.loading} role="status">{copy.loading}</p></main>;
  }

  if (optionsState === "error" || optionsState === "unavailable") {
    return (
      <main className={styles.workspace}>
        <section className={styles.unavailablePanel} aria-labelledby="booking-unavailable-title">
          <h1 id="booking-unavailable-title">{copy.unavailableTitle}</h1>
          <p>{copy.unavailableText}</p>
          <div className={styles.unavailableActions}>
            {optionsState === "error" ? <button type="button" onClick={() => window.location.reload()}>{copy.retry}</button> : null}
            <a {...externalBookingLinkProps}>{copy.continue}</a>
          </div>
        </section>
      </main>
    );
  }

  if (confirmation) {
    return (
      <main className={styles.workspace}>
        <section
          className={styles.successPanel}
          aria-labelledby="booking-success-title"
          aria-live="polite"
          role="status"
        >
          <span className={styles.successMark} aria-hidden="true">✓</span>
          <p className={styles.kicker}>Magic Massage Natali</p>
          <h1 id="booking-success-title" ref={successHeadingRef} tabIndex={-1}>{copy.successTitle}</h1>
          <p>{copy.successText}</p>
          <div className={styles.successSummary}>{renderSummary(true)}</div>
          <p className={styles.reference}>
            <span>{copy.reference}</span>
            <code>{safeReference(confirmation.reference, copy.referenceUnavailable)}</code>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Magic Massage Natali</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>

      <ol className={styles.progress} aria-label={copy.title}>
        {steps.map((item, index) => {
          const activeIndex = steps.indexOf(step);
          return (
            <li
              key={item}
              className={index < activeIndex ? styles.completeStep : index === activeIndex ? styles.activeStep : undefined}
              aria-label={copy.steps[index]}
              aria-current={index === activeIndex ? "step" : undefined}
            >
              <span>{index < activeIndex ? "✓" : index + 1}</span>
              <small>{copy.steps[index]}</small>
            </li>
          );
        })}
      </ol>

      <div className={styles.bookingLayout}>
        <section className={styles.mainPanel}>
          <div className={styles.stepHeader}>
            {step !== "service" ? (
              <button className={styles.backButton} type="button" onClick={goBack} aria-label={copy.back} title={copy.back}>
                <span aria-hidden="true">←</span>
              </button>
            ) : null}
            <div>
              {/* Keyed wrappers keep browser translation DOM mutations inside the node React replaces. */}
              <h2 ref={headingRef} tabIndex={-1}>
                <span key={step}>{currentStepTitle[step]}</span>
              </h2>
              <p><span key={step}>{currentStepHint[step]}</span></p>
            </div>
          </div>

          {statusMessage ? <p className={styles.statusMessage} role="alert">{statusMessage}</p> : null}

          {step === "service" ? (
            <div className={styles.choiceGrid}>
              {options?.services.map((service) => (
                <button
                  className={styles.choiceCard}
                  type="button"
                  key={service.slug}
                  aria-pressed={service.slug === selectedServiceSlug}
                  onClick={() => selectService(service)}
                >
                  {service.category ? <span>{service.category}</span> : null}
                  <strong>{service.title}</strong>
                  <small>{service.variants.length} {copy.steps[1].toLocaleLowerCase(localeTags[locale])}</small>
                </button>
              ))}
            </div>
          ) : null}

          {step === "variant" ? (
            <fieldset className={styles.variantList}>
              <legend className={styles.visuallyHidden}>{copy.variantTitle}</legend>
              {selectedService?.variants.map((variant) => (
                <label
                  className={styles.variantChoice}
                  key={variant.id}
                >
                  <input
                    checked={variant.id === selectedVariantId}
                    className={styles.variantRadio}
                    name="booking-variant"
                    onChange={() => selectVariant(variant)}
                    type="radio"
                    value={variant.id}
                  />
                  <span><strong>{variant.durationMinutes}</strong> {copy.minutes}</span>
                  <strong>{formatPrice(locale, variant)}</strong>
                </label>
              ))}
            </fieldset>
          ) : null}

          {step === "specialist" ? (
            <fieldset className={styles.specialistList}>
              <legend className={styles.visuallyHidden}>{copy.specialistTitle}</legend>
              <label className={styles.specialistChoice}>
                <input
                  aria-describedby={`${formId}-any-specialist-hint`}
                  aria-labelledby={`${formId}-any-specialist-title`}
                  checked={selectedSpecialistId === null}
                  className={styles.specialistRadio}
                  name="booking-specialist"
                  onChange={() => selectSpecialist(null)}
                  type="radio"
                  value="any"
                />
                <span>
                  <strong id={`${formId}-any-specialist-title`}>{copy.anySpecialist}</strong>
                  <small id={`${formId}-any-specialist-hint`}>{copy.anySpecialistHint}</small>
                </span>
              </label>
              {selectedService?.specialists.map((specialist) => (
                <label className={styles.specialistChoice} key={specialist.id}>
                  <input
                    checked={selectedSpecialistId === specialist.id}
                    className={styles.specialistRadio}
                    name="booking-specialist"
                    onChange={() => selectSpecialist(specialist.id)}
                    type="radio"
                    value={specialist.id}
                  />
                  <span><strong>{specialist.displayName}</strong></span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {step === "schedule" ? (
            <div className={styles.schedule}>
              <div className={styles.legend} aria-label={copy.scheduleTitle}>
                {(["available", "limited", "unavailable"] as const).map((status) => (
                  <span key={status} className={styles[status]}>{copy.availability[status]}</span>
                ))}
              </div>
              {availabilityState === "loading" ? <p className={styles.inlineLoading} role="status">{copy.loadingAvailability}</p> : null}
              {availabilityState === "error" ? (
                <div className={styles.inlineError} role="alert">
                  <p>{copy.availabilityError}</p>
                  <button type="button" onClick={() => void refreshAvailability()}>{copy.retry}</button>
                </div>
              ) : null}
              {availabilityState === "ready" ? (
                <DateCalendar
                  dates={availabilityDates}
                  locale={locale}
                  onSelect={selectDate}
                  selectedDate={selectedDate}
                />
              ) : null}

              <section className={styles.timesSection} aria-labelledby="booking-times-title">
                <h3 id="booking-times-title">
                  {selectedDate ? `${copy.timesTitle}: ${formatDate(locale, selectedDate)}` : copy.timesTitle}
                </h3>
                {!selectedDate ? <p>{copy.chooseDate}</p> : null}
                {selectedDate && selectedAvailabilityDate?.slots.length === 0 ? <p>{copy.noTimes}</p> : null}
                {selectedDate && selectedAvailabilityDate?.slots.length ? (
                  <div className={styles.timeGrid}>
                    {selectedAvailabilityDate.slots.map((time) => (
                      <button
                        type="button"
                        key={time}
                        disabled={holdBusy}
                        aria-pressed={selectedTime === time}
                        onClick={() => void selectTime(time)}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {step === "details" ? (
            <form className={styles.contactForm} id={formId} onSubmit={submitDetails} noValidate>
              {hold ? <HoldCountdown expiresAt={hold.expiresAt} label={copy.holdLabel} /> : null}
              <label>
                <span>{copy.name}</span>
                <input
                  data-booking-field="name"
                  autoComplete="name"
                  value={contact.name}
                  aria-invalid={Boolean(contactErrors.name)}
                  aria-describedby={contactErrors.name ? `${formId}-name-error` : undefined}
                  onChange={(event) => updateContact("name", event.target.value)}
                />
                {contactErrors.name ? <small id={`${formId}-name-error`}>{contactErrors.name}</small> : null}
              </label>
              <label>
                <span>{copy.phone}</span>
                <input
                  data-booking-field="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  value={contact.phone}
                  aria-invalid={Boolean(contactErrors.phone)}
                  aria-describedby={contactErrors.phone ? `${formId}-phone-error` : undefined}
                  onChange={(event) => updateContact("phone", event.target.value)}
                />
                {contactErrors.phone ? <small id={`${formId}-phone-error`}>{contactErrors.phone}</small> : null}
              </label>
              <label>
                <span>{copy.email}</span>
                <input
                  data-booking-field="email"
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={contact.email}
                  aria-invalid={Boolean(contactErrors.email)}
                  aria-describedby={contactErrors.email ? `${formId}-email-error` : undefined}
                  onChange={(event) => {
                    updateContact("email", event.target.value);
                    if (!event.target.value.trim()) updateContact("careEmailOptIn", false);
                  }}
                />
                {contactErrors.email ? <small id={`${formId}-email-error`}>{contactErrors.email}</small> : null}
              </label>

              <fieldset className={styles.contactPreference}>
                <legend>{copy.contactPreference}</legend>
                <div>
                  {(Object.keys(copy.preferences) as BookingContactPreference[]).map((preference) => (
                    <label key={preference}>
                      <input
                        type="radio"
                        name="contact-preference"
                        value={preference}
                        checked={contact.contactPreference === preference}
                        onChange={() => updateContact("contactPreference", preference)}
                      />
                      <span>{copy.preferences[preference]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {notice ? <p className={styles.policyNotice}>{notice}</p> : null}
              <div className={styles.optionalConsent}>
                <label className={styles.privacyChoice}>
                  <input
                    aria-describedby={`${formId}-care-email-helper`}
                    checked={contact.careEmailOptIn}
                    disabled={!contact.email.trim()}
                    onChange={(event) => updateContact("careEmailOptIn", event.target.checked)}
                    type="checkbox"
                  />
                  <span>{copy.careEmailOptIn}</span>
                </label>
                <small id={`${formId}-care-email-helper`}>
                  {contact.email.trim() ? copy.careEmailOptInHelper : copy.careEmailOptInRequiresEmail}
                </small>
              </div>
              <label className={styles.privacyChoice}>
                <input
                  data-booking-field="privacy"
                  type="checkbox"
                  checked={contact.privacyAccepted}
                  aria-invalid={Boolean(contactErrors.privacy)}
                  aria-describedby={contactErrors.privacy ? `${formId}-privacy-error` : undefined}
                  onChange={(event) => updateContact("privacyAccepted", event.target.checked)}
                />
                <span>{copy.privacyPrefix} <Link href={`/${locale}/privacy`}>{copy.privacyLink}</Link>.</span>
              </label>
              {contactErrors.privacy ? <small className={styles.privacyError} id={`${formId}-privacy-error`}>{contactErrors.privacy}</small> : null}
            </form>
          ) : null}

          {step === "review" ? (
            <div className={styles.review}>
              {hold ? <HoldCountdown expiresAt={hold.expiresAt} label={copy.holdLabel} /> : null}
              {renderSummary(true)}
              {notice ? <p className={styles.policyNotice}>{notice}</p> : null}
            </div>
          ) : null}

          {step !== "schedule" ? (
            <div className={styles.actionBar}>
              {step === "service" ? (
                <button type="button" disabled={!selectedService} onClick={() => navigateToStep("variant")}>{copy.continue}</button>
              ) : null}
              {step === "variant" ? (
                <button type="button" disabled={!selectedVariant} onClick={() => navigateToStep("specialist")}>{copy.continue}</button>
              ) : null}
              {step === "specialist" ? (
                <button
                  type="button"
                  disabled={selectedSpecialistId === undefined}
                  onClick={() => navigateToStep("schedule")}
                >
                  {copy.continue}
                </button>
              ) : null}
              {step === "details" ? <button type="submit" form={formId}>{copy.continue}</button> : null}
              {step === "review" ? (
                <button type="button" disabled={confirmationBusy} onClick={() => void confirmBooking()}>
                  {confirmationBusy ? copy.confirming : copy.confirm}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className={styles.summary} aria-labelledby="booking-summary-title">
          <h2 id="booking-summary-title">{copy.summaryTitle}</h2>
          {renderSummary()}
          {hold && step !== "details" && step !== "review"
            ? <HoldCountdown expiresAt={hold.expiresAt} label={copy.holdLabel} />
            : null}
        </aside>
      </div>
    </main>
  );
}
