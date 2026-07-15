"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const defaultDismissDelay = 5000;

type TransientStatusState = {
  autoDismiss: boolean;
  message: string;
  scopeVersion: symbol;
  sequence: number;
  variant: "error" | "success";
};

export function useTransientStatus(scope: string, dismissDelay = defaultDismissDelay) {
  const scopeVersion = useMemo(() => Symbol(scope), [scope]);
  const [status, setStatus] = useState<TransientStatusState>({
    autoDismiss: false,
    message: "",
    scopeVersion,
    sequence: 0,
    variant: "success",
  });
  const currentScopeVersion = useRef(scopeVersion);

  useLayoutEffect(() => {
    currentScopeVersion.current = scopeVersion;
  }, [scopeVersion]);

  const showStatus = useCallback(
    (message: string, options: { autoDismiss?: boolean; variant?: "error" | "success" } = {}) => {
      if (currentScopeVersion.current !== scopeVersion) return;

      setStatus((current) => ({
        autoDismiss: options.autoDismiss ?? false,
        message,
        scopeVersion,
        sequence: current.sequence + 1,
        variant: options.variant ?? "success",
      }));
    },
    [scopeVersion],
  );

  useEffect(() => {
    if (!status.autoDismiss || !status.message || status.scopeVersion !== scopeVersion) return;

    const timeout = window.setTimeout(() => {
      setStatus((current) =>
        current.sequence === status.sequence ? { ...current, message: "" } : current,
      );
    }, dismissDelay);

    return () => window.clearTimeout(timeout);
  }, [dismissDelay, scopeVersion, status.autoDismiss, status.message, status.scopeVersion, status.sequence]);

  return {
    message: status.scopeVersion === scopeVersion ? status.message : "",
    showStatus,
    variant: status.scopeVersion === scopeVersion ? status.variant : "success",
  };
}
