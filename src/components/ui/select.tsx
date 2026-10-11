import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputBaseClass } from "./input";

type SelectProps = React.ComponentProps<"select"> & { placeholder?: string };

export function Select({ placeholder, className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(inputBaseClass, "appearance-none pe-10 invalid:text-muted", className)}
        defaultValue={placeholder ? "" : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}
