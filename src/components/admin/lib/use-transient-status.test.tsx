import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTransientStatus } from "./use-transient-status";

describe("useTransientStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dismisses a status after the delay and restarts the delay for repeated messages", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransientStatus("clients"));

    act(() => result.current.showStatus("Изменение сохранено в Supabase.", { autoDismiss: true }));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.showStatus("Изменение сохранено в Supabase.", { autoDismiss: true }));
    act(() => vi.advanceTimersByTime(3000));

    expect(result.current.message).toBe("Изменение сохранено в Supabase.");

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.message).toBe("");
  });

  it("keeps errors visible until another action or section change", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransientStatus("clients"));

    act(() => result.current.showStatus("Supabase недоступен."));
    act(() => vi.advanceTimersByTime(10_000));

    expect(result.current.message).toBe("Supabase недоступен.");
  });

  it("clears on section change and ignores a late result from the previous section", () => {
    const { rerender, result } = renderHook(
      ({ scope }: { scope: string }) => useTransientStatus(scope),
      { initialProps: { scope: "clients" } },
    );

    const showFromClients = result.current.showStatus;
    act(() => showFromClients("Изменение сохранено в Supabase.", { autoDismiss: true }));
    rerender({ scope: "certificates" });

    expect(result.current.message).toBe("");

    act(() => result.current.showStatus("Ошибка сертификата."));
    act(() => showFromClients("Поздний ответ клиентов.", { autoDismiss: true }));

    expect(result.current.message).toBe("Ошибка сертификата.");
  });
});
