"use client";

import { useRef } from "react";

type OtpInputProps = {
  length?: number;
  name: string;
  /** Accessible label for the whole group */
  label: string;
  digitLabel: (index: number) => string;
};

/** One box per digit: auto-advances, Backspace goes back, paste fills all boxes. */
export function OtpInput({ length = 4, name, label, digitLabel }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const sync = () => {
    if (hiddenRef.current) hiddenRef.current.value = refs.current.map((el) => el?.value ?? "").join("");
  };

  const fill = (start: number, digits: string) => {
    digits.split("").forEach((digit, offset) => {
      const el = refs.current[start + offset];
      if (el) el.value = digit;
    });
    refs.current[Math.min(start + digits.length, length - 1)]?.focus();
    sync();
  };

  return (
    // Codes are always read left-to-right, even in RTL pages
    <div role="group" aria-label={label} dir="ltr" className="flex justify-center gap-3">
      <input ref={hiddenRef} type="hidden" name={name} />
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={digitLabel(i + 1)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          className="size-14 rounded-md bg-surface-container-low text-center text-xl font-bold outline-none transition focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/30"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            e.target.value = "";
            if (digits) fill(i, digits.slice(0, length - i));
            else sync();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !e.currentTarget.value) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(i, e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length - i));
          }}
        />
      ))}
    </div>
  );
}
