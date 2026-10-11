import type { PresenceStatus } from "@/modules/hq/mock";
import { cn } from "@/lib/utils";

const statusColor: Record<PresenceStatus, string> = {
  available: "bg-emerald-500",
  meeting: "bg-primary-container",
  busy: "bg-danger",
  away: "bg-secondary-container",
  restroom: "bg-cyan-500",
  waiting: "bg-violet-500",
  offline: "bg-muted",
};

// Stable pleasant background per person, derived from their name
const palette = ["bg-[#1e3a5f]", "bg-[#0f5257]", "bg-[#4a3b6b]", "bg-[#7a3e2e]", "bg-[#2f4f2f]", "bg-[#5b4636]"];

type AvatarProps = {
  name: string;
  status?: PresenceStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Avatar({ name, status, size = "md", className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  const color = palette[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palette.length];

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full font-bold text-white",
        color,
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-12 text-base",
        className,
      )}
    >
      {initials}
      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 end-0 size-3.5 rounded-full ring-2 ring-surface-container-lowest",
            statusColor[status],
          )}
        />
      )}
    </span>
  );
}

export { statusColor };
