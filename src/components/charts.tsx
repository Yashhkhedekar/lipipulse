"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import type { Pt } from "@/lib/analytics";

const W = 340;

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export interface Series {
  points: Pt[];
  color: string;
  name?: string;
  fill?: boolean;
}

/**
 * Smooth Bezier area chart. SVG uses preserveAspectRatio="none" with
 * non-scaling strokes so it can fill any width without distorting line weight.
 */
export function AreaChart({
  series,
  height = 168,
  yMin,
  yFormat,
  className = "",
  gridLines = 3,
}: {
  series: Series[];
  height?: number;
  yMin?: number;
  yFormat?: (n: number) => string;
  className?: string;
  gridLines?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) {
    return (
      <div className={`grid place-items-center text-[12.5px] text-muted ${className}`} style={{ height }}>
        Not enough history yet — snapshots start appearing tomorrow.
      </div>
    );
  }

  const max = Math.max(...all.map((p) => p.v));
  const minRaw = Math.min(...all.map((p) => p.v));
  const lo = yMin !== undefined ? yMin : Math.min(minRaw, 0);
  const hi = max === lo ? lo + 1 : max;
  const padT = 14;
  const padB = 16;
  const H = height;

  const xOf = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const yOf = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const sig = `${series.map((s) => `${s.color}:${s.points.length}:${s.points[0]?.v}:${s.points[s.points.length - 1]?.v}`).join("|")}:${H}`;

  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => lo + ((hi - lo) * i) / gridLines);

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      {/* value grid + labels */}
      <div className="pointer-events-none absolute inset-0">
        {gridVals.map((v, i) => (
          <div
            key={i}
            className="absolute inset-x-0 flex items-center"
            style={{ top: `${(yOf(v) / H) * 100}%`, position: "absolute" }}
          >
            <div className="h-px w-full bg-hair" />
            {yFormat && (
              <span className="absolute right-0 -top-2.5 bg-surface pl-1 text-[9.5px] font-medium tnum text-muted">
                {yFormat(v)}
              </span>
            )}
            <span className="sr-only">{yFormat ? yFormat(v) : v}</span>
          </div>
        ))}
      </div>

      <svg
        key={sig}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color ?? "#6C7BFF"} stopOpacity="0.30" />
            <stop offset="100%" stopColor={series[0]?.color ?? "#6C7BFF"} stopOpacity="0" />
          </linearGradient>
        </defs>

        {series.map((s, si) => {
          const pts = s.points.map((p, i) => ({ x: xOf(i, s.points.length), y: yOf(p.v) }));
          const line = smoothPath(pts);
          const area = `${line} L ${W} ${H} L 0 ${H} Z`;
          return (
            <g key={`${s.color}-${si}`}>
              {s.fill !== false && (
                <motion.path
                  d={area}
                  fill={si === 0 ? `url(#g-${gid})` : "transparent"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                />
              )}
              <motion.path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 2 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </g>
          );
        })}
      </svg>

      {/* live marker on the final point (HTML so it stays circular) */}
      {series[0] && series[0].points.length > 0 && (
        <span
          className="absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
          style={{
            left: "100%",
            top: `${(yOf(series[0].points[series[0].points.length - 1].v) / H) * 100}%`,
            background: series[0].color,
          }}
        />
      )}
    </div>
  );
}

export function Sparkline({
  points,
  color,
  height = 34,
  fill = true,
  className = "",
}: {
  points: Pt[];
  color: string;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  if (points.length < 2) return <div style={{ height }} className={className} />;
  const max = Math.max(...points.map((p) => p.v));
  const min = Math.min(...points.map((p) => p.v));
  const hi = max === min ? max + 1 : max;
  const lo = min;
  const H = 30;
  const pts = points.map((p, i) => ({
    x: (i / (points.length - 1)) * 100,
    y: 3 + (1 - (p.v - lo) / (hi - lo)) * (H - 6),
  }));
  const line = smoothPath(pts);
  return (
    <svg
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`s-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line} L 100 ${H} L 0 ${H} Z`} fill={`url(#s-${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

export function Donut({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F3F1" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <motion.circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              initial={{ strokeDashoffset: -offset + c * 0.02 }}
              animate={{ strokeDashoffset: -offset }}
              transition={{ duration: 0.7, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="text-[20px] font-semibold tnum leading-none">{centerValue}</div>
        <div className="eyebrow mt-1.5">{centerLabel}</div>
      </div>
    </div>
  );
}

export function MiniBars({
  values,
  color = "#6C7BFF",
  height = 52,
  labels,
}: {
  values: number[];
  color?: string;
  height?: number;
  labels?: string[];
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <motion.div
            className="w-full rounded-t-[4px]"
            style={{ background: v === 0 ? "#EFEFEF" : color }}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(v === 0 ? 3 : 8, (v / max) * (height - 16))}px` }}
            transition={{ duration: 0.5, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
          />
          {labels && <span className="text-[8.5px] font-medium tnum text-muted">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}
