"use client";

import { Layers, LocateFixed, MapPin, Minus, Plus, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ActivityItem, Department, FurnitureItem, Member, PresenceStatus, Room, Zone } from "../mock";
import { ControlBar } from "./control-bar";
import { FloorPlan } from "./floor-plan";
import { ActivityPanel, PresencePanel } from "./side-panel";

type HqViewProps = {
  currentUserId: string;
  members: Member[];
  rooms: Room[];
  furniture: FurnitureItem[];
  activity: ActivityItem[];
  zones: Zone[];
  departments: Department[];
  floor: { widthM: number; depthM: number };
};

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;

/** The "main hall": live floor plan + presence panel + personal controls. */
export function HqView({ currentUserId, members, rooms, furniture, zones, departments, activity, floor }: HqViewProps) {
  const t = useTranslations("hq");
  const [zoom, setZoom] = useState(1);
  const [myStatus, setMyStatus] = useState<PresenceStatus>(
    () => members.find((m) => m.id === currentUserId)?.status ?? "available",
  );
  const [panel, setPanel] = useState<"presence" | "history" | null>("presence");
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Reflect my own status change everywhere I appear (desk + presence list)
  const liveMembers = members.map((m) => (m.id === currentUserId ? { ...m, status: myStatus } : m));
  const changeZoom = (delta: number) =>
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 10) / 10)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 p-3 sm:p-8">
        <section className="relative h-full overflow-hidden rounded-xl bg-surface-container-lowest bg-[radial-gradient(circle,#d5d7e2_1px,transparent_1.2px)] bg-[size:22px_22px] shadow-ambient">
          {/* Plan (scrollable when zoomed in) */}
          <div
            className={cn(
              "absolute inset-0 grid place-items-center overflow-auto pb-20 pe-10 ps-20 pt-24",
              panel && "md:pe-[22rem]",
            )}
          >
            <FloorPlan
              rooms={rooms}
              furniture={furniture}
              members={liveMembers}
              zones={zones}
              departments={departments}
              floor={floor}
              zoom={zoom}
            >
              {/* Add layer (HQ editor — not built yet), pinned under the open workspace */}
              <button
                type="button"
                onClick={() => setNotice(t("addLayerSoon"))}
                className="mx-auto mt-6 flex items-center gap-3 rounded-xl bg-surface-container-lowest px-6 py-3 text-base font-extrabold text-primary shadow-ambient-lg ghost-border transition hover:-translate-y-0.5 sm:px-8 sm:py-4 sm:text-xl"
              >
                <Layers className="size-6 fill-current" aria-hidden />
                {t("addLayer")}
              </button>
            </FloorPlan>
          </div>

          {/* Status chips */}
          <div className="absolute start-4 top-4 z-10 flex flex-wrap gap-3 sm:start-6 sm:top-6">
            <span className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-sm shadow-ambient ghost-border">
              <MapPin className="size-4 fill-primary-container text-surface-container-lowest" aria-hidden />
              {t("participants", { count: members.length })}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-sm shadow-ambient ghost-border">
              <Radio className="size-4 text-emerald-500" aria-hidden />
              {t("live")}
            </span>
          </div>

          {notice && (
            <p
              role="status"
              className="absolute inset-x-4 top-20 z-20 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg"
            >
              {notice}
            </p>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-6 start-6 z-10 flex flex-col items-center gap-3">
            <MapButton label={t("zoomIn")} onClick={() => changeZoom(0.2)} disabled={zoom >= MAX_ZOOM}>
              <Plus className="size-5" aria-hidden />
            </MapButton>
            <MapButton label={t("zoomOut")} onClick={() => changeZoom(-0.2)} disabled={zoom <= MIN_ZOOM}>
              <Minus className="size-5" aria-hidden />
            </MapButton>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label={t("recenter")}
              className="grid size-12 place-items-center rounded-full bg-brand-gradient text-white shadow-ambient-lg transition hover:brightness-110"
            >
              <LocateFixed className="size-5" aria-hidden />
            </button>
          </div>

          {panel === "presence" && <PresencePanel members={liveMembers} />}
          {panel === "history" && <ActivityPanel items={activity} />}
        </section>
      </div>

      <ControlBar
        status={myStatus}
        onStatusChange={setMyStatus}
        panelHidden={panel === null}
        onTogglePanel={() => setPanel((p) => (p ? null : "presence"))}
        historyOpen={panel === "history"}
        onToggleHistory={() => setPanel((p) => (p === "history" ? "presence" : "history"))}
        micOn={micOn}
        onToggleMic={() => setMicOn((v) => !v)}
        cameraOn={cameraOn}
        onToggleCamera={() => setCameraOn((v) => !v)}
      />
    </div>
  );
}

function MapButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-ambient ghost-border transition hover:bg-surface-container-low disabled:opacity-40"
    >
      {children}
    </button>
  );
}
