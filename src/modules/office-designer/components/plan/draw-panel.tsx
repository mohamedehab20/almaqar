"use client";

import type { OpeningKind } from "@/modules/office-designer/data/types";
import type { Strings } from "../i18n";
import { DOOR_KINDS, openingShapes, WINDOW_KINDS } from "./geometry";

export type Tool = "select" | "wall" | "glass" | "room" | "column" | "roundColumn" | OpeningKind;

/** Tools that can also be dragged from the panel straight onto the plan. */
export const DROPPABLE: Tool[] = [...DOOR_KINDS, ...WINDOW_KINDS, "column", "roundColumn"];

const KEYS: Partial<Record<Tool, string>> = { select: "V", wall: "B", room: "F" };

/** The tool's icon, drawn with the same symbols as the plan. */
function ToolIcon({ tool }: { tool: Tool }) {
  const ink = "#3a3a3a";
  let body: React.ReactNode;
  if (tool === "select") body = <path d="M20 12 L20 46 L29 37 L35 50 L41 47 L35 34 L47 34 Z" fill="#fff" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />;
  else if (tool === "wall")
    body = (
      <>
        <path d="M10 50 V10 H50 V50" fill="none" stroke={ink} strokeWidth="5" />
        <path d="M10 50 H50" stroke={ink} strokeWidth="1.5" strokeDasharray="3 3" />
      </>
    );
  else if (tool === "glass") body = <path d="M8 30 H52" stroke="#9fb7c8" strokeWidth="6" />;
  else if (tool === "room") body = <rect x="10" y="10" width="40" height="40" fill="none" stroke={ink} strokeWidth="5" />;
  else if (tool === "column") body = <rect x="19" y="19" width="22" height="22" fill={ink} />;
  else if (tool === "roundColumn") body = <circle cx="30" cy="30" r="12" fill={ink} />;
  else {
    const door = DOOR_KINDS.includes(tool);
    const y = door ? 14 : 32;
    body = (
      <>
        <path d={`M2 ${y} H10 M50 ${y} H58`} stroke={ink} strokeWidth="8" />
        <g transform={`translate(30 ${y})`}>
          {openingShapes(tool, 40, 8).map((s, i) => (
            <path key={i} d={s.d} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
          ))}
        </g>
      </>
    );
  }
  return (
    <svg viewBox="0 0 60 60" width="52" height="52" aria-hidden>
      {body}
    </svg>
  );
}

/**
 * The "Draw Floor Plan" panel: pick a drawing tool (walls, rooms), or a door, window or column and either
 * click it onto the plan or drag it there.
 */
export function DrawPanel({ t, tool, setTool }: { t: Strings; tool: Tool; setTool: (t: Tool) => void }) {
  const label: Record<Tool, string> = {
    select: t.selectTool,
    wall: t.wallTool,
    glass: t.glassWall,
    room: t.roomTool,
    column: t.column,
    roundColumn: t.roundColumn,
    single: t.singleDoor,
    double: t.doubleDoor,
    sliding: t.slidingDoor,
    window: t.windows,
    bay: t.bayWindow,
    french: t.frenchWindow,
  };
  const tile = (k: Tool) => (
    <li key={k}>
      <button
        type="button"
        className={`tool-tile${tool === k ? " tool-on" : ""}`}
        aria-pressed={tool === k}
        onClick={() => setTool(k)}
        draggable={DROPPABLE.includes(k)}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", `tool:${k}`);
          e.dataTransfer.effectAllowed = "copy";
        }}
      >
        <ToolIcon tool={k} />
        <span>
          {label[k]}
          {KEYS[k] && <span className="muted"> ({KEYS[k]})</span>}
        </span>
      </button>
    </li>
  );
  return (
    <>
      <ul className="tool-grid">{(["select", "wall", "room"] as Tool[]).map(tile)}</ul>
      <h4 className="tool-heading">{t.doorsWindows}</h4>
      <ul className="tool-grid">{[...DOOR_KINDS, ...WINDOW_KINDS].map(tile)}</ul>
      <h4 className="tool-heading">{t.structural}</h4>
      <ul className="tool-grid">{(["glass", "column", "roundColumn"] as Tool[]).map(tile)}</ul>
    </>
  );
}
