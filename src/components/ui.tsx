"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { fmtPct, fmtSigned } from "@/lib/format";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------------- count-up ---------------- */

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = Number.isFinite(target) ? target : 0;
    if (prefersReduced() || from === to) {
      prev.current = to;
      setValue(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function Num({
  value,
  format,
  className = "",
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const v = useCountUp(value);
  return <span className={`tnum ${className}`}>{format(v)}</span>;
}

/* ---------------- card ---------------- */

export function Card({
  children,
  className = "",
  i = 0,
  onClick,
  hero = false,
}: {
  children: ReactNode;
  className?: string;
  i?: number;
  onClick?: () => void;
  hero?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      onClick={onClick}
      className={`relative rounded-[20px] border border-hair bg-surface ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={hero ? { borderColor: "#E4E4E7" } : undefined}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- growth badge ---------------- */

export function Growth({
  value,
  pct,
  className = "",
  compact = true,
}: {
  value: number;
  pct?: number | null;
  className?: string;
  compact?: boolean;
}) {
  const pos = value > 0;
  const neg = value < 0;
  const tone = pos ? "text-pos bg-posbg" : neg ? "text-neg bg-negbg" : "text-muted bg-pill";
  const text = compact ? fmtSigned(value) : fmtSigned(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold tnum ${tone} ${className}`}>
      {text}
      {pct !== undefined && pct !== null && <span className="opacity-70">{fmtPct(pct)}</span>}
    </span>
  );
}

/* ---------------- segmented control (sliding pill) ---------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  accent,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
  accent?: string;
}) {
  const id = useId().replace(/:/g, "");
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const width = 100 / options.length;

  return (
    <div className="relative flex rounded-full bg-pill p-1">
      <motion.span
        layoutId={`pill-${id}`}
        className="absolute top-1 bottom-1 rounded-full border border-hair bg-surface"
        style={{
          left: `calc(4px + ${activeIndex} * (100% - 8px) / ${options.length})`,
          width: `calc((100% - 8px) / ${options.length})`,
        }}
        transition={{ type: "spring", stiffness: 460, damping: 38 }}
      />
      {options.map((o, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex-1 rounded-full px-1 text-center transition-colors ${
              compact ? "py-1.5 text-[11.5px]" : "py-2 text-[12.5px]"
            } ${active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
      {accent && <span className="pointer-events-none absolute -bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: accent }} />}
    </div>
  );
}

/* ---------------- bottom sheet ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col rounded-t-[24px] border-t border-hair bg-surface"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 330, damping: 34 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="min-w-0">
                <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-hair" />
                <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="press mt-4 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pill text-muted hover:text-ink"
              >
                <X size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 no-scrollbar">{children}</div>
            {footer && <div className="border-t border-hair px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- form atoms ---------------- */

export function Field({
  label,
  hint,
  warn,
  children,
}: {
  label: string;
  hint?: string;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow flex items-center gap-1.5">
        {label}
        {warn && (
          <span className="rounded-full bg-warn px-1.5 py-px text-[9px] font-bold tracking-normal text-warnink normal-case">
            check value
          </span>
        )}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-[14px] border border-hair bg-pill px-3.5 py-2.5 text-[15px] tnum text-ink placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none";

export function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "quiet";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-black"
      : variant === "ghost"
        ? "border border-hair bg-surface text-ink hover:bg-pill"
        : "bg-pill text-ink hover:bg-hair";
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={`rounded-full px-4 py-3 text-[14px] font-semibold transition-colors disabled:opacity-45 ${styles} ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ---------------- misc ---------------- */

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <h3 className="eyebrow">{children}</h3>
      {right}
    </div>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

export function Select({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-full border border-hair bg-surface py-2 pl-3.5 pr-9 text-[13px] font-medium text-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-hair bg-surface px-5 py-8 text-center">
      <p className="text-[14.5px] font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[260px] text-[12.5px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          className="pointer-events-none absolute inset-x-5 bottom-24 z-[60] rounded-full bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-paper shadow-none"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
