"use client";

import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import type { Department, DepartmentColor, FurnitureItem, Member, Room, Zone } from "../mock";

const zoneStyle: Record<DepartmentColor, { area: string; chip: string; dot: string }> = {
  blue: { area: "border-blue-300 bg-blue-50/70", chip: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  violet: { area: "border-violet-300 bg-violet-50/70", chip: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  amber: { area: "border-amber-300 bg-amber-50/70", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  emerald: { area: "border-emerald-300 bg-emerald-50/70", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
};

// Floor-plan units (see mock.ts): 1000 × 650
const PLAN_W = 1000;
const PLAN_H = 650;

const box = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => ({
  left: `${(x / PLAN_W) * 100}%`,
  top: `${(y / PLAN_H) * 100}%`,
  width: `${(w / PLAN_W) * 100}%`,
  height: `${(h / PLAN_H) * 100}%`,
});

type FloorPlanProps = {
  rooms: Room[];
  furniture: FurnitureItem[];
  members: Member[];
  zones: Zone[];
  departments: Department[];
  floor: { widthM: number; depthM: number };
  zoom: number;
  /** Rendered right under the plan (scales with it) */
  children?: React.ReactNode;
};

/** 2D top-down plan. Positions are physical, so the layout is the same in RTL and LTR. */
export function FloorPlan({ rooms, furniture, members, zones, departments, floor, zoom, children }: FloorPlanProps) {
  const t = useTranslations("hq");
  const locale = useLocale() as "ar" | "en";
  const memberById = new Map(members.map((m) => [m.id, m]));
  const departmentById = new Map(departments.map((d) => [d.id, d]));

  return (
    <div
      className="relative w-full max-w-[860px] transition-transform duration-200"
      style={{ transform: `scale(${zoom})` }}
    >
      <p className="mb-2 text-center font-mono text-xs text-muted" dir="ltr">
        {floor.widthM.toFixed(2)}m
      </p>
      <div className="relative">
        <div dir="ltr" className="relative aspect-[1000/650] w-full border-[3px] border-on-surface" role="img" aria-label={t("floorPlan")}>
          {rooms.map((room) => (
            <div
              key={room.id}
              style={box(room)}
              className={cn(
                "absolute border-[1.5px] border-on-surface",
                room.type === "meeting" && "bg-primary-fixed/25",
              )}
            >
              <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex items-start justify-between gap-2 p-[3%]">
                <span className="text-[10px] font-bold leading-tight sm:text-sm lg:text-base">{t(`rooms.${room.type}`)}</span>
                {room.code && <span className="hidden font-mono text-xs tracking-widest text-muted sm:inline">{room.code}</span>}
              </div>
            </div>
          ))}

          {zones.map((zone) => {
            const department = departmentById.get(zone.departmentId);
            if (!department) return null;
            const style = zoneStyle[department.color];
            return (
              <div
                key={zone.id}
                style={box(zone)}
                dir={locale === "ar" ? "rtl" : "ltr"}
                className={cn("absolute rounded-md border-[1.5px] border-dashed p-[1%]", style.area)}
              >
                <span
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-bold sm:text-[11px]",
                    style.chip,
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full sm:size-2", style.dot)} />
                  <span className="truncate">{department.name[locale]}</span>
                </span>
              </div>
            );
          })}

          {furniture.map((item) => {
            if (item.kind === "meetingTable") {
              return (
                <div
                  key={item.id}
                  style={box(item)}
                  className="absolute flex items-center justify-around rounded-full border-2 border-outline-variant bg-surface-container-lowest px-[4%]"
                >
                  {Array.from({ length: 4 }, (_, i) => (
                    <span key={i} className="size-2.5 rounded-full bg-outline-variant" />
                  ))}
                </div>
              );
            }

            const member = item.memberId ? memberById.get(item.memberId) : undefined;
            const name = member?.name[locale];
            const tooltip = member
              ? [name, member.title[locale], member.currentTask?.[locale]].filter(Boolean).join(" · ")
              : t("emptyDesk");

            return (
              <div
                key={item.id}
                style={box(item)}
                title={tooltip}
                dir={locale === "ar" ? "rtl" : "ltr"}
                className={cn(
                  "absolute flex items-center gap-2 overflow-hidden rounded-sm border-2 bg-surface-container-lowest px-2 transition",
                  member ? "border-outline-variant hover:border-primary-container hover:shadow-ambient" : "border-dashed border-outline-variant/70",
                )}
              >
                {member && (
                  <>
                    <Avatar name={name!} status={member.status} size="sm" className="hidden sm:inline-grid" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{name}</span>
                      {member.currentTask && (
                        <span className="hidden truncate text-[10px] text-muted md:block">{member.currentTask[locale]}</span>
                      )}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p
          className="absolute -right-9 top-1/2 -translate-y-1/2 rotate-90 font-mono text-xs text-muted"
          dir="ltr"
        >
          {floor.depthM.toFixed(2)}m
        </p>
      </div>
      {children}
    </div>
  );
}
