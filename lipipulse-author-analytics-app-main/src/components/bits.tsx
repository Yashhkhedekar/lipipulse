"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Num } from "./ui";

export function StoryThumb({
  cover,
  color,
  title,
  size = 40,
  radius = 12,
  layoutId,
}: {
  cover?: string | null;
  color: string;
  title: string;
  size?: number;
  radius?: number;
  layoutId?: string;
}) {
  if (cover) {
    return (
      <motion.img
        layoutId={layoutId}
        src={cover}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: color }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
    );
  }
  return (
    <motion.span
      layoutId={layoutId}
      className="grid shrink-0 place-items-center font-medium text-ink/70"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color,
        fontSize: size * 0.42,
      }}
      aria-hidden="true"
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {title.trim().charAt(0)}
    </motion.span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const first = rank === 1;
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tnum ${
        first ? "bg-ink text-paper" : "bg-pill text-muted"
      }`}
    >
      {rank}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  format,
  sub,
  className = "",
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="eyebrow truncate">{label}</p>
      <p className="mt-1.5 truncate text-[21px] font-semibold leading-none tracking-[-0.02em]">
        <Num value={value} format={format} />
      </p>
      {sub && <div className="mt-1.5 truncate text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

export function Hr({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-hair ${className}`} />;
}

export function SparkPill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-semibold"
      style={{ background: `${color}2E`, color: "#1C1C1E" }}
    >
      {children}
    </motion.span>
  );
}
