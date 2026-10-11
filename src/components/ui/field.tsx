import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  /** Optional element on the label row, e.g. a "forgot password" or "resend" link */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, htmlFor, hint, action, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
