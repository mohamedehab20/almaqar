"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/action";
import type { ErrorCode } from "@/server/errors";

/**
 * Runs an auth Server Action from a form: tracks the pending state and turns error codes into
 * translated messages (auth.errors.*). `onSuccess` gets the action's data and `say` to show a message.
 */
export function useAuthAction<I, T>(
  run: (input: I) => Promise<ActionResult<T>>,
  onSuccess: (data: T, say: (message: string) => void) => void,
) {
  const t = useTranslations("auth.errors");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const submit = (input: I, onError?: (code: ErrorCode) => boolean) =>
    startTransition(async () => {
      setMessage(null);
      const result = await run(input);
      if (result.ok) onSuccess(result.data, setMessage);
      // onError may handle a code itself (return true), e.g. not_configured → open the demo
      else if (!onError?.(result.error)) setMessage(t(result.error));
    });

  return { submit, pending, message, setMessage };
}
