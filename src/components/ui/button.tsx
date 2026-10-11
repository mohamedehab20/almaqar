import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,box-shadow,background-color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-gradient text-on-primary shadow-[0_8px_16px_rgba(0,74,198,0.18)] hover:-translate-y-px hover:shadow-ambient-lg",
        secondary:
          "bg-surface-container-lowest text-primary ghost-border hover:-translate-y-px hover:shadow-ambient",
        tertiary: "text-primary hover:bg-primary-fixed/50",
        gold: "bg-secondary-container text-on-secondary-container hover:-translate-y-px hover:shadow-ambient",
        icon: "text-on-surface-variant hover:bg-surface-container-low",
      },
      size: {
        sm: "h-8 rounded-sm px-4 text-xs",
        md: "h-10 rounded-sm px-5 text-sm",
        lg: "h-12 rounded-sm px-7 text-sm",
        icon: "size-9 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
