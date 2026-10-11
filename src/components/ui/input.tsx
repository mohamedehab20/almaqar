import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputBaseClass =
  "h-13 w-full rounded-md bg-surface-container-low px-4 text-sm text-on-surface outline-none transition-[background-color,box-shadow] placeholder:text-muted focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

type InputProps = React.ComponentProps<"input"> & {
  /** Icon shown at the start of the field (right side in RTL) */
  icon?: LucideIcon;
  /** Element pinned to the end of the field (left side in RTL), e.g. a toggle button */
  endSlot?: React.ReactNode;
};

export function Input({ icon: Icon, endSlot, className, ...props }: InputProps) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
          aria-hidden
        />
      )}
      <input className={cn(inputBaseClass, Icon && "ps-12", endSlot && "pe-12", className)} {...props} />
      {endSlot && <div className="absolute end-3 top-1/2 -translate-y-1/2">{endSlot}</div>}
    </div>
  );
}
