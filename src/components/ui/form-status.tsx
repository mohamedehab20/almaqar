import { Info } from "lucide-react";

/** Inline status line under a form (announced to screen readers). Renders nothing when empty. */
export function FormStatus({ message }: { message?: string | null }) {
  return (
    <p role="status" className="empty:hidden">
      {message && (
        <span className="flex items-start gap-2 rounded-md bg-primary-fixed/50 px-4 py-3 text-sm text-primary">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </span>
      )}
    </p>
  );
}
