"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Gauge, Lightbulb, Radio, ScanLine } from "lucide-react";
import { useApp, type TabKey } from "@/store";
import Overview from "@/screens/Overview";
import Channels, { ChannelDetail } from "@/screens/Channels";
import Stories, { StoryDetail } from "@/screens/Stories";
import Insights from "@/screens/Insights";
import ScanFlow from "@/components/ScanFlow";
import { registerServiceWorker } from "@/components/InstallCard";
import { ChannelFormSheet, EpisodeFormSheet, ManualSheet, StoryFormSheet } from "@/components/forms";
import { Toast } from "@/components/ui";
import { PERIODS } from "@/lib/analytics";
import { fmtCompact } from "@/lib/format";

const TABS: { key: TabKey; label: string; icon: typeof Gauge }[] = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "channels", label: "Channels", icon: Radio },
  { key: "stories", label: "Stories", icon: BookOpen },
  { key: "insights", label: "Insights", icon: Lightbulb },
];

function Boot() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-8 text-center">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-[44px] italic leading-none tracking-[-0.02em]"
        >
          LipiPulse
        </motion.p>
        <div className="mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-hair">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
        <p className="mt-4 text-[12.5px] text-muted">Opening local database…</p>
      </div>
    </div>
  );
}

function Colophon() {
  const data = useApp((s) => s.data);
  const totalViews = data.channelSnapshots.length
    ? data.channelSnapshots.filter((s) => s.snapshotDate === data.channelSnapshots.map((x) => x.snapshotDate).sort().slice(-1)[0]).reduce((a, b) => a + b.totalViews, 0)
    : 0;

  return (
    <div className="hidden max-w-[430px] flex-1 flex-col lg:flex">
      <p className="eyebrow">Pratilipi author studio · offline-first</p>
      <h1 className="mt-3 font-display text-[76px] italic leading-[0.88] tracking-[-0.03em]">
        Lipi<span className="not-italic">Pulse</span>
      </h1>
      <p className="mt-6 max-w-[380px] text-[15.5px] leading-relaxed text-muted">
        A daily snapshot delta engine for authors running more than one channel. Every view, follower, rating and episode is recorded once a day —
        so growth over <span className="font-medium text-ink">7D · 30D · Quarter · Year · All-time</span> is exact, never estimated.
      </p>

      <div className="mt-9 border-t border-[#E6E4E0] pt-5">
        <p className="eyebrow mb-3">Channels tracked</p>
        <div className="space-y-2.5">
          {data.channels.map((c) => {
            const snaps = data.channelSnapshots.filter((s) => s.channelId === c.id).sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));
            const latest = snaps[snaps.length - 1];
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.colorHex }} />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{c.name}</span>
                <span className="text-[12.5px] tnum text-muted">{latest ? `${fmtCompact(latest.totalViews)} views` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 border-t border-[#E6E4E0] pt-5">
        <p className="eyebrow mb-3">Periods</p>
        <div className="grid grid-cols-5 gap-2">
          {PERIODS.map((p) => (
            <div key={p.key}>
              <p className="text-[13.5px] font-semibold tnum">{p.short}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted">{p.label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-[11.5px] leading-relaxed text-muted">
        Install on Android: open this page in Chrome → ⋮ → <span className="font-medium text-ink">Add to Home screen</span> → share Pratilipi
        screenshots straight into LipiPulse.
      </p>
      {totalViews > 0 && <p className="mt-3 text-[11.5px] tnum text-muted">Local database · {fmtCompact(totalViews)} lifetime views indexed</p>}
    </div>
  );
}

export default function Page() {
  const ready = useApp((s) => s.ready);
  const hydrate = useApp((s) => s.hydrate);
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const detail = useApp((s) => s.detail);
  const toast = useApp((s) => s.toast);
  const setSheet = useApp((s) => s.setSheet);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void hydrate();
    registerServiceWorker();
  }, [hydrate]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  if (!ready) return <Boot />;

  const screen =
    tab === "overview" ? <Overview /> : tab === "channels" ? <Channels /> : tab === "stories" ? <Stories /> : <Insights />;

  return (
    <div className="relative min-h-[100dvh] w-full">
      <div
        className="fixed inset-0 -z-10 bg-paper bg-cover bg-center"
        style={{ backgroundImage: "url(images/backdrop.jpg)" }}
        aria-hidden="true"
      />

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1240px] items-center justify-center gap-16 lg:px-10 lg:py-10">
        <Colophon />

        <div className="relative flex h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden bg-paper lg:h-[860px] lg:max-h-[90dvh] lg:rounded-[30px] lg:border lg:border-[#E6E4E0]">
          {/* screens */}
          <div className="relative min-h-0 flex-1">
            <main ref={mainRef} className="h-full overflow-y-auto no-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {screen}
                </motion.div>
              </AnimatePresence>
            </main>

            <AnimatePresence>
              {detail && (
                <motion.div
                  key={detail.type + detail.id}
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 24, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 z-30 overflow-y-auto no-scrollbar bg-paper"
                >
                  {detail.type === "story" ? <StoryDetail storyId={detail.id} /> : <ChannelDetail channelId={detail.id} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* FAB */}
          <motion.button
            type="button"
            onClick={() => setSheet({ kind: "scan" })}
            whileTap={{ scale: 0.94 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 320, damping: 22 }}
            className="absolute right-4 bottom-[84px] z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-white"
            aria-label="Scan screenshot"
          >
            <ScanLine size={22} />
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-pos" />
          </motion.button>

          {/* bottom nav */}
          <nav className="relative z-20 border-t border-hair bg-paper/95 px-1 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur">
            <div className="grid grid-cols-4">
              {TABS.map((t) => {
                const active = tab === t.key && !detail;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className="relative flex flex-col items-center gap-1 rounded-2xl py-1.5"
                    aria-current={active ? "page" : undefined}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute -top-1.5 h-[3px] w-7 rounded-full bg-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <Icon size={19} className={active ? "text-ink" : "text-muted"} strokeWidth={active ? 2.2 : 1.8} />
                    <span className={`text-[10px] ${active ? "font-semibold text-ink" : "font-medium text-muted"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* sheets + toast */}
          <ScanFlow />
          <ChannelFormSheet />
          <StoryFormSheet />
          <EpisodeFormSheet />
          <ManualSheet />
          <Toast message={toast} />
        </div>
      </div>
    </div>
  );
}
