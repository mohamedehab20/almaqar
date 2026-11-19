/**
 * Top-view drawings (plan view, camera straight above). Every drawing uses viewBox "0 0 widthCm depthCm",
 * so 1 unit = 1 cm, and the FRONT of the item faces DOWN (seat cushion at the bottom, backrest at the top).
 * Three tones of the base colour: light top surfaces, a mid tone, and darker creases and edges.
 * Shadows are NOT part of these drawings: the screens draw them as a separate, toggleable layer.
 */

type Tones = { light: string; mid: string; dark: string; line: string };

function mix(hex: string, target: number, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (target - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function tones(hex: string): Tones {
  return { light: mix(hex, 255, 0.28), mid: hex, dark: mix(hex, 0, 0.28), line: mix(hex, 0, 0.45) };
}

/**
 * How a surface catches the light, so drawings read like top-view photos rather than flat shapes:
 * - fabric: plush, rounded edges, soft sheen and a fine weave;
 * - wood: a slight bevel and long grain;
 * - hard: plastic, metal, ceramic or stone, with a crisp highlight;
 * - leaf: plant foliage, a little depth;
 * - rug: flat pile, texture only.
 */
type Finish = "fabric" | "wood" | "hard" | "leaf" | "rug";

const FINISHES: Record<Finish, { blur: number; height: number; shine: number; grain: number; freq: string }> = {
  fabric: { blur: 0.06, height: 5, shine: 0.22, grain: 0.1, freq: "0.55" },
  wood: { blur: 0.025, height: 2.2, shine: 0.3, grain: 0.09, freq: "0.012 0.45" },
  hard: { blur: 0.03, height: 2.2, shine: 0.25, grain: 0.02, freq: "0.9" },
  leaf: { blur: 0.03, height: 3, shine: 0.25, grain: 0.04, freq: "0.6" },
  rug: { blur: 0.01, height: 0.6, shine: 0, grain: 0.14, freq: "0.7" },
};

/**
 * Light from the top left and fairly high (so light pieces do not get dark rims), as in the reference photos. The height of each point comes from the outline (soft,
 * rounded edges) and from its tone (lighter cushions and tops stand higher), then the material's texture is added.
 */
function finishFilter(w: number, d: number, finish: Finish) {
  const f = FINISHES[finish];
  const blur = Math.max(0.8, Math.min(6, Math.min(w, d) * f.blur));
  return `<filter id="finish" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum"/>` +
    `<feComposite in="lum" in2="SourceAlpha" operator="in" result="lumIn"/>` +
    `<feGaussianBlur in="lumIn" stdDeviation="${blur * 0.8}" result="hTone"/>` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="hEdge"/>` +
    `<feComposite in="hEdge" in2="hTone" operator="arithmetic" k2="0.7" k3="0.5" result="height"/>` +
    `<feDiffuseLighting in="height" surfaceScale="${f.height}" diffuseConstant="1.18" lighting-color="#ffffff" result="diffuse"><feDistantLight azimuth="225" elevation="70"/></feDiffuseLighting>` +
    `<feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="1" result="lit"/>` +
    `<feSpecularLighting in="height" surfaceScale="${f.height}" specularConstant="0.9" specularExponent="22" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="60"/></feSpecularLighting>` +
    `<feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>` +
    `<feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3="${f.shine}" result="shiny"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${f.freq}" numOctaves="2" seed="11" result="noise"/>` +
    `<feColorMatrix in="noise" type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1" result="grey"/>` +
    `<feComposite in="shiny" in2="grey" operator="arithmetic" k2="1" k3="${f.grain}" k4="${-f.grain / 2}" result="textured"/>` +
    `<feComposite in="textured" in2="SourceAlpha" operator="in"/>` +
    `</filter>`;
}

const svg = (w: number, d: number, body: string, finish: Finish) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${d}" width="${w}" height="${d}"><defs>${finishFilter(w, d, finish)}</defs><g filter="url(#finish)">${body}</g></svg>`;

const r = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;

/** Upholstered seating: backrest band at the top, arms on both sides, `seats` cushions at the front (bottom). */
export function upholstered(w: number, d: number, hex: string, seats: number, opts: { arms?: boolean; back?: boolean } = {}) {
  const t = tones(hex);
  const arms = opts.arms ?? true;
  const back = opts.back ?? true;
  const backD = back ? Math.max(14, d * 0.24) : 0;
  const armW = arms ? Math.max(10, Math.min(22, w * 0.14)) : 0;
  const pad = 2;
  const parts: string[] = [];
  // Base / frame (darkest, a thin rim around everything)
  parts.push(r(0, 0, w, d, 12, t.dark));
  // Backrest: rounded band along the back (top)
  if (back) parts.push(r(pad, pad, w - pad * 2, backD, Math.min(14, backD / 2), t.mid), r(pad + 4, pad + 3, w - pad * 2 - 8, backD * 0.45, 8, t.light, 'opacity="0.55"'));
  // Arms: rounded rolls on both sides, from the back to the front
  if (arms) {
    for (const x of [pad, w - pad - armW]) {
      parts.push(r(x, pad + backD * 0.35, armW, d - pad * 2 - backD * 0.35, armW / 2, t.mid));
      parts.push(r(x + armW * 0.25, pad + backD * 0.35 + 4, armW * 0.5, d - pad * 2 - backD * 0.35 - 8, armW / 4, t.light, 'opacity="0.5"'));
    }
  }
  // Seat cushions (lightest), separated by darker creases
  const seatX = pad + armW + 1;
  const seatY = pad + backD + 1;
  const seatW = w - (pad + armW + 1) * 2;
  const seatD = d - seatY - pad - 1;
  const gap = 2.5;
  const each = (seatW - gap * (seats - 1)) / seats;
  for (let i = 0; i < seats; i++) {
    const x = seatX + i * (each + gap);
    parts.push(r(x, seatY, each, seatD, Math.min(10, each / 4), t.light));
    // A soft front roll (the cushion's front edge, facing down)
    parts.push(r(x + 2, seatY + seatD - Math.min(10, seatD * 0.16), each - 4, Math.min(8, seatD * 0.13), 4, t.mid, 'opacity="0.45"'));
    // Centre tuft
    parts.push(`<circle cx="${x + each / 2}" cy="${seatY + seatD * 0.45}" r="1.6" fill="${t.line}" opacity="0.5"/>`);
  }
  return svg(w, d, parts.join(""), "fabric");
}

/** Office chair: five-star base under a seat, a curved backrest at the top, two thin armrests. */
export function officeChair(w: number, d: number, hex: string) {
  const t = tones(hex);
  const cx = w / 2;
  const cy = d / 2 + 2;
  const legs = [0, 72, 144, 216, 288]
    .map((a) => {
      const rad = ((a - 90) * Math.PI) / 180;
      const x = cx + Math.cos(rad) * (w / 2 - 3);
      const y = cy + Math.sin(rad) * (d / 2 - 3);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#3a3a3a" stroke-width="3.2" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="2.8" fill="#222"/>`;
    })
    .join("");
  return svg(
    w,
    d,
    legs +
      r(w * 0.17, d * 0.3, w * 0.66, d * 0.58, 14, t.mid) +
      r(w * 0.21, d * 0.34, w * 0.58, d * 0.48, 11, t.light) +
      `<path d="M ${w * 0.16} ${d * 0.24} Q ${cx} ${d * 0.02} ${w * 0.84} ${d * 0.24} L ${w * 0.8} ${d * 0.32} Q ${cx} ${d * 0.14} ${w * 0.2} ${d * 0.32} Z" fill="${t.dark}"/>` +
      r(w * 0.07, d * 0.38, w * 0.08, d * 0.34, 3, t.line) +
      r(w * 0.85, d * 0.38, w * 0.08, d * 0.34, 3, t.line), "fabric",
  );
}

/** A plain top surface (desk, table, cabinet): light top, darker rim, a front edge line at the bottom. */
export function slab(w: number, d: number, hex: string, opts: { rx?: number; frontEdge?: boolean; grain?: boolean } = {}) {
  const t = tones(hex);
  const rx = opts.rx ?? 3;
  let body = r(0, 0, w, d, rx, t.dark) + r(1.5, 1.5, w - 3, d - 3, Math.max(0, rx - 1), t.light);
  if (opts.grain) for (let y = 8; y < d - 4; y += 9) body += `<line x1="4" y1="${y}" x2="${w - 4}" y2="${y + 1.5}" stroke="${t.mid}" stroke-width="0.6" opacity="0.5"/>`;
  if (opts.frontEdge ?? true) body += r(1.5, d - 4, w - 3, 2.5, 1, t.mid);
  return svg(w, d, body, "wood");
}

export function lDesk(w: number, d: number, hex: string, returnW: number) {
  const t = tones(hex);
  const top = Math.min(d, 70);
  const path = (inset: number) =>
    `M ${inset} ${inset} H ${w - inset} V ${d - inset} H ${w - returnW + inset} V ${top - inset} H ${inset} Z`;
  return svg(
    w,
    d,
    `<path d="${path(0)}" fill="${t.dark}"/><path d="${path(1.5)}" fill="${t.light}"/>` +
      r(1.5, top - 4, w - returnW, 2.5, 1, t.mid) +
      r(w - returnW + 1.5, d - 4, returnW - 3, 2.5, 1, t.mid), "wood",
  );
}

export function roundTop(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w / 2}" ry="${d / 2}" fill="${t.dark}"/>` +
      `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w / 2 - 1.5}" ry="${d / 2 - 1.5}" fill="${t.light}"/>` +
      `<ellipse cx="${w / 2 - w * 0.12}" cy="${d / 2 - d * 0.12}" rx="${w * 0.18}" ry="${d * 0.1}" fill="#fff" opacity="0.18"/>`, "wood",
  );
}

export function meetingTable(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    r(0, 0, w, d, d / 2, t.dark) +
      r(1.5, 1.5, w - 3, d - 3, d / 2 - 1.5, t.light) +
      r(w * 0.3, d * 0.42, w * 0.4, d * 0.16, 4, t.mid, 'opacity="0.55"') +
      `<circle cx="${w / 2}" cy="${d / 2}" r="3" fill="${t.line}"/>`, "wood",
  );
}

export function drawers(w: number, d: number, hex: string, rows: number) {
  const t = tones(hex);
  let body = r(0, 0, w, d, 2, t.dark) + r(1.5, 1.5, w - 3, d - 3, 1.5, t.light);
  // Handles show at the front (bottom) edge, one per drawer column
  for (let i = 0; i < rows; i++) body += r(w * 0.35, d - 3.5, w * 0.3, 2, 1, t.line);
  return svg(w, d, body, "wood");
}

export function bookshelf(w: number, d: number, hex: string) {
  const t = tones(hex);
  let body = r(0, 0, w, d, 1.5, t.dark) + r(1.5, 1.5, w - 3, d - 3, 1, t.light);
  // Vertical dividers seen as darker lines on the top
  for (let x = w / 4; x < w - 2; x += w / 4) body += `<line x1="${x}" y1="2" x2="${x}" y2="${d - 2}" stroke="${t.mid}" stroke-width="1.4"/>`;
  return svg(w, d, body + r(1.5, d - 3.5, w - 3, 2, 1, t.mid), "wood");
}

export function laptop(w: number, d: number) {
  return svg(
    w,
    d,
    r(0, d * 0.12, w, d * 0.88, 2.5, "#b9bdc4") +
      r(0, 0, w, d * 0.14, 1.5, "#2b2e33") +
      r(w * 0.08, d * 0.24, w * 0.84, d * 0.42, 1.5, "#8d929b") +
      r(w * 0.36, d * 0.72, w * 0.28, d * 0.18, 1.5, "#a3a8b0"), "hard",
  );
}

export function monitor(w: number, d: number) {
  return svg(
    w,
    d,
    r(w * 0.36, d * 0.45, w * 0.28, d * 0.5, 3, "#3d4148") +
      r(0, 0, w, d * 0.32, 2, "#1f2226") +
      r(1.2, d * 0.24, w - 2.4, d * 0.06, 1, "#4a4f57"), "hard",
  );
}

export function printer(w: number, d: number) {
  return svg(
    w,
    d,
    r(0, 0, w, d, 4, "#9aa0a8") +
      r(2, 2, w - 4, d * 0.7, 3, "#d9dce0") +
      r(w * 0.6, d * 0.12, w * 0.3, d * 0.16, 2, "#5b6068") +
      r(w * 0.15, d * 0.78, w * 0.7, d * 0.18, 2, "#f4f4f2"), "hard",
  );
}

/** Potted plant: pot rim, soil, and leaves fanning out from the centre. */
export function plant(w: number, d: number, potHex: string, leafHex: string, leaves: number) {
  const t = tones(leafHex);
  const cx = w / 2;
  const cy = d / 2;
  const potR = Math.min(w, d) * 0.3;
  let body = `<circle cx="${cx}" cy="${cy}" r="${potR}" fill="${potHex}"/><circle cx="${cx}" cy="${cy}" r="${potR - 2}" fill="#5a4636"/>`;
  for (let i = 0; i < leaves; i++) {
    const a = (360 / leaves) * i + (i % 2) * 12;
    const len = Math.min(w, d) * (0.42 + (i % 3) * 0.04);
    const fill = [t.dark, t.mid, t.light][i % 3];
    body += `<ellipse cx="${cx}" cy="${cy - len / 2}" rx="${len * 0.18}" ry="${len / 2}" fill="${fill}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  return svg(w, d, body, "leaf");
}

export function rug(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    r(0, 0, w, d, 2, t.mid) +
      r(6, 6, w - 12, d - 12, 1, "none", `stroke="${t.light}" stroke-width="3"`) +
      r(16, 16, w - 32, d - 32, 1, "none", `stroke="${t.dark}" stroke-width="1.5" stroke-dasharray="6 4"`) +
      `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w * 0.18}" ry="${d * 0.16}" fill="${t.light}" opacity="0.6"/>`, "rug",
  );
}

export function floorLamp(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<circle cx="${w / 2}" cy="${d / 2}" r="${w / 2 - 1}" fill="${t.light}" stroke="${t.dark}" stroke-width="1.5"/>` +
      `<circle cx="${w / 2}" cy="${d / 2}" r="${w * 0.18}" fill="#fff6d8"/><circle cx="${w / 2}" cy="${d / 2}" r="2" fill="${t.line}"/>`, "hard",
  );
}

// ---------- Office-plan pieces (styled after a real estate floor-plan render) ----------

/** White shell chair: rounded seat, curved back at the top, front down. */
export function shellChair(w: number, d: number, hex = "#f2f2f0") {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<path d="M ${w * 0.08} ${d * 0.3} Q ${w * 0.5} ${-d * 0.02} ${w * 0.92} ${d * 0.3} L ${w * 0.86} ${d * 0.4} Q ${w * 0.5} ${d * 0.16} ${w * 0.14} ${d * 0.4} Z" fill="${t.dark}"/>` +
      r(w * 0.12, d * 0.3, w * 0.76, d * 0.66, w * 0.3, "#c9cbce") +
      r(w * 0.16, d * 0.33, w * 0.68, d * 0.6, w * 0.27, t.light) +
      `<ellipse cx="${w / 2}" cy="${d * 0.62}" rx="${w * 0.2}" ry="${d * 0.14}" fill="#ffffff" opacity="0.7"/>`, "hard",
  );
}

/** Four-person bench desk: two rows facing each other across a screen, a monitor and keyboard per seat. */
export function benchDesk(w: number, d: number, hex = "#efede8") {
  const t = tones(hex);
  let body = r(0, 0, w, d, 2, "#bdbab3") + r(1.5, 1.5, w - 3, d - 3, 1.5, t.light) + r(0, d / 2 - 1.5, w, 3, 1, "#8f8b84");
  const seats = 2;
  const cell = w / seats;
  for (let i = 0; i < seats; i++) {
    const x = i * cell;
    for (const top of [true, false]) {
      const my = top ? d / 2 - 9 : d / 2 + 4; // monitors sit at the screen, facing the person
      const ky = top ? d * 0.18 : d * 0.72;
      body += r(x + cell * 0.18, my, cell * 0.64, 5, 1.5, "#2c2f34");
      body += r(x + cell * 0.25, ky, cell * 0.5, 8, 1.5, "#4a4e55") + r(x + cell * 0.27, ky + 1.5, cell * 0.46, 5, 1, "#6c7179");
      body += r(x + cell * 0.8, ky + 1, 5, 6, 2.5, "#4a4e55");
    }
  }
  return svg(w, d, body, "wood");
}

export function toilet(w: number, d: number) {
  return svg(
    w,
    d,
    r(0, 0, w, d * 0.28, 4, "#d9dadc") + r(2, 2, w - 4, d * 0.24, 3, "#ffffff") +
      `<ellipse cx="${w / 2}" cy="${d * 0.62}" rx="${w / 2 - 1}" ry="${d * 0.37}" fill="#d9dadc"/>` +
      `<ellipse cx="${w / 2}" cy="${d * 0.62}" rx="${w / 2 - 4}" ry="${d * 0.32}" fill="#ffffff"/>` +
      `<ellipse cx="${w / 2}" cy="${d * 0.66}" rx="${w * 0.22}" ry="${d * 0.18}" fill="#e8f0f3"/>`, "hard",
  );
}

/** Washbasin(s) on a stone vanity top (the basins sit nearer the front). */
export function vanity(w: number, d: number, stone = "#e6dccd", basins = 1) {
  const t = tones(stone);
  let body = r(0, 0, w, d, 2, t.dark) + r(1.5, 1.5, w - 3, d - 3, 1.5, t.light);
  for (let i = 0; i < basins; i++) {
    const cx = (w / basins) * (i + 0.5);
    body += `<ellipse cx="${cx}" cy="${d * 0.56}" rx="${Math.min(w / basins, d) * 0.34}" ry="${d * 0.3}" fill="#ffffff" stroke="#b9bcc0" stroke-width="1.2"/>`;
    body += `<circle cx="${cx}" cy="${d * 0.18}" r="2.2" fill="#9aa0a8"/>`;
  }
  return svg(w, d, body, "hard");
}

/** Kitchenette counter: dark stone top with a sink on the left and a two-ring hob on the right. */
export function kitchenCounter(w: number, d: number) {
  let body = r(0, 0, w, d, 2, "#2d2f33") + r(1.5, 1.5, w - 3, d - 3, 1.5, "#45484e");
  body += r(w * 0.08, d * 0.2, w * 0.28, d * 0.6, 4, "#c8ccd1") + r(w * 0.1, d * 0.25, w * 0.24, d * 0.5, 3, "#e5e8eb");
  body += `<circle cx="${w * 0.22}" cy="${d * 0.5}" r="2" fill="#8b9097"/>`;
  for (const [cx, cy, rr] of [[0.62, 0.35, 9], [0.62, 0.68, 7], [0.82, 0.35, 7], [0.82, 0.68, 9]] as const)
    body += `<circle cx="${w * cx}" cy="${d * cy}" r="${rr}" fill="#1d1e20" stroke="#6b6f76" stroke-width="1.2"/>`;
  return svg(w, d, body, "hard");
}

/** Round lounge chair with a deep cushion (egg / tub chair). */
export function tubChair(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w / 2}" ry="${d / 2}" fill="${t.dark}"/>` +
      `<ellipse cx="${w / 2}" cy="${d / 2 + 3}" rx="${w * 0.38}" ry="${d * 0.36}" fill="${t.mid}"/>` +
      `<ellipse cx="${w / 2}" cy="${d * 0.58}" rx="${w * 0.27}" ry="${d * 0.24}" fill="${t.light}"/>`, "fabric",
  );
}

// ---------- More pieces for the library ----------

/** L-shaped sectional sofa: a long run along the back and a chaise on the right, cushions facing in. */
export function sectional(w: number, d: number, hex: string) {
  const t = tones(hex);
  const back = Math.max(16, d * 0.18);
  const arm = 14;
  const chaise = Math.min(w * 0.38, 95);
  const seat = d * 0.45;
  let body = `<path d="M 0 0 H ${w} V ${d} H ${w - chaise} V ${seat + back} H 0 Z" fill="${t.dark}"/>`;
  body += r(2, 2, w - 4, back, 8, t.mid) + r(w - back - 2, 2, back, d - 4, 8, t.mid);
  body += r(2, back, arm, seat, 7, t.mid);
  const runW = w - chaise - arm - 6;
  const n = Math.max(2, Math.round(runW / 70));
  const each = (runW - (n - 1) * 2.5) / n;
  for (let i = 0; i < n; i++) body += r(arm + 4 + i * (each + 2.5), back + 2, each, seat - 4, 8, t.light);
  body += r(w - chaise + 2, back + 2, chaise - back - 6, d - back - 6, 8, t.light);
  return svg(w, d, body, "fabric");
}

/** Bar or counter stool: a round seat on a ring footrest. */
export function stool(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<circle cx="${w / 2}" cy="${d / 2}" r="${w / 2 - 1}" fill="none" stroke="#3a3d42" stroke-width="2.5"/>` +
      `<circle cx="${w / 2}" cy="${d / 2}" r="${w * 0.36}" fill="${t.dark}"/><circle cx="${w / 2}" cy="${d / 2}" r="${w * 0.31}" fill="${t.light}"/>`,
    "fabric",
  );
}

/** Bean bag: a soft, slightly uneven blob with a dent where you sit. */
export function beanBag(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<path d="M ${w * 0.5} 1 C ${w * 0.9} 0 ${w} ${d * 0.3} ${w - 1} ${d * 0.55} C ${w} ${d * 0.85} ${w * 0.75} ${d - 1} ${w * 0.48} ${d - 1} C ${w * 0.2} ${d} 0 ${d * 0.8} 1 ${d * 0.5} C 0 ${d * 0.2} ${w * 0.2} 2 ${w * 0.5} 1 Z" fill="${t.mid}"/>` +
      `<ellipse cx="${w * 0.5}" cy="${d * 0.58}" rx="${w * 0.26}" ry="${d * 0.22}" fill="${t.dark}" opacity="0.5"/>` +
      `<ellipse cx="${w * 0.44}" cy="${d * 0.3}" rx="${w * 0.2}" ry="${d * 0.12}" fill="${t.light}" opacity="0.7"/>`,
    "fabric",
  );
}

/** Shower tray with a drain and a glass screen along the front. */
export function shower(w: number, d: number) {
  return svg(
    w,
    d,
    r(0, 0, w, d, 3, "#cfd3d6") + r(2, 2, w - 4, d - 4, 2, "#f1f4f6") +
      `<circle cx="${w / 2}" cy="${d / 2}" r="3.5" fill="#9aa0a8"/><circle cx="${w * 0.8}" cy="${d * 0.18}" r="5" fill="#c9ced3"/>` +
      r(0, d - 3, w, 3, 1, "#9fb7c8"),
    "hard",
  );
}

/** Bathtub: a rounded basin in a frame, the tap end at the top. */
export function bathtub(w: number, d: number) {
  return svg(
    w,
    d,
    r(0, 0, w, d, 6, "#bfc4c9") + r(4, 4, w - 8, d - 8, Math.min(w, d) * 0.3, "#f7f8f9") +
      r(9, 9, w - 18, d - 18, Math.min(w, d) * 0.28, "#cfe4ee") +
      `<circle cx="${w / 2}" cy="${d * 0.14}" r="3" fill="#9aa0a8"/>`,
    "hard",
  );
}

/** Fridge seen from above: a white box with the door gap at the front. */
export function fridge(w: number, d: number, hex = "#eef0f2") {
  const t = tones(hex);
  return svg(
    w,
    d,
    r(0, 0, w, d, 2, "#a9aeb4") + r(1.5, 1.5, w - 3, d - 6, 1.5, t.light) + r(w * 0.1, d * 0.12, w * 0.8, d * 0.12, 1.5, t.mid) + r(2, d - 4, w - 4, 2.5, 1, "#7f858c") + r(w * 0.7, d - 9, 4, 6, 1.5, "#7f858c"),
    "hard",
  );
}

/** Whiteboard or screen on a stand: a thin bar with its feet. */
export function whiteboard(w: number, d: number) {
  return svg(
    w,
    d,
    r(w * 0.05, d * 0.15, 4, d * 0.7, 2, "#7a7f86") + r(w * 0.95 - 4, d * 0.15, 4, d * 0.7, 2, "#7a7f86") +
      r(0, d * 0.38, w, d * 0.24, 1.5, "#c9ccd1") + r(1, d * 0.42, w - 2, d * 0.16, 1, "#ffffff"),
    "hard",
  );
}

/** Wall TV / large display: a thin dark panel on a slim stand. */
export function tv(w: number, d: number) {
  return svg(w, d, r(w * 0.3, d * 0.55, w * 0.4, d * 0.4, 2, "#55595f") + r(0, 0, w, d * 0.45, 1.5, "#1d1f22") + r(2, d * 0.08, w - 4, d * 0.18, 1, "#33363b"), "hard");
}

/** Water cooler: a round bottle on a square base. */
export function waterCooler(w: number, d: number) {
  return svg(
    w,
    d,
    r(0, 0, w, d, 4, "#e4e6e9") + `<circle cx="${w / 2}" cy="${d / 2}" r="${Math.min(w, d) * 0.36}" fill="#bfe0f2"/>` +
      `<circle cx="${w / 2}" cy="${d / 2}" r="${Math.min(w, d) * 0.12}" fill="#5aa9d6"/>`,
    "hard",
  );
}

/** Round rug with a border and a soft centre. */
export function roundRug(w: number, d: number, hex: string) {
  const t = tones(hex);
  return svg(
    w,
    d,
    `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w / 2}" ry="${d / 2}" fill="${t.mid}"/>` +
      `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w / 2 - 8}" ry="${d / 2 - 8}" fill="none" stroke="${t.light}" stroke-width="3"/>` +
      `<ellipse cx="${w / 2}" cy="${d / 2}" rx="${w * 0.22}" ry="${d * 0.22}" fill="${t.light}" opacity="0.6"/>`,
    "rug",
  );
}

/** Long planter box with a row of plants. */
export function planterBox(w: number, d: number, leafHex: string) {
  const t = tones(leafHex);
  let body = r(0, 0, w, d, 3, "#8a7a68") + r(2, 2, w - 4, d - 4, 2, "#5b4a3a");
  const n = Math.max(2, Math.round(w / 30));
  for (let i = 0; i < n; i++) {
    const cx = (w / n) * (i + 0.5);
    body += `<circle cx="${cx}" cy="${d / 2}" r="${d * 0.48}" fill="${i % 2 ? t.mid : t.dark}"/><circle cx="${cx - 3}" cy="${d / 2 - 3}" r="${d * 0.22}" fill="${t.light}"/>`;
  }
  return svg(w, d, body, "leaf");
}
