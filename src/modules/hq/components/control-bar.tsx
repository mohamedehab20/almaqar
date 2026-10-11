"use client";

import { Camera, CameraOff, History, Maximize2, Mic, MicOff, Minus, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { PresenceStatus } from "../mock";
import { StatusMenu } from "./status-menu";

type ControlBarProps = {
  status: PresenceStatus;
  onStatusChange: (status: PresenceStatus) => void;
  panelHidden: boolean;
  onTogglePanel: () => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
  micOn: boolean;
  onToggleMic: () => void;
  cameraOn: boolean;
  onToggleCamera: () => void;
};

export function ControlBar(props: ControlBarProps) {
  const t = useTranslations("hq");

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 bg-[#1c1d1f] px-2 py-3 sm:gap-10 sm:px-4 sm:py-4">
      <ControlButton
        icon={props.panelHidden ? Maximize2 : Minus}
        label={props.panelHidden ? t("controls.expand") : t("controls.minimize")}
        onClick={props.onTogglePanel}
      />
      <ControlButton
        icon={History}
        label={t("controls.history")}
        onClick={props.onToggleHistory}
        pressed={props.historyOpen}
      />

      <StatusMenu status={props.status} onChange={props.onStatusChange} />

      <ControlButton
        icon={props.micOn ? Mic : MicOff}
        label={t("controls.mic")}
        onClick={props.onToggleMic}
        pressed={props.micOn}
        off={!props.micOn}
      />
      <ControlButton
        icon={props.cameraOn ? Camera : CameraOff}
        label={t("controls.camera")}
        onClick={props.onToggleCamera}
        pressed={props.cameraOn}
        off={!props.cameraOn}
      />
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  off,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  off?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="group flex flex-col items-center gap-1.5 text-xs text-white/80 sm:text-sm"
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full bg-white/10 text-white transition group-hover:bg-white/20 sm:size-14",
          !off && pressed && "bg-white text-[#1c1d1f] group-hover:bg-white/90",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}
