"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, FileJson, History, KeyRound, Loader2, RefreshCw, Sparkles, TriangleAlert, Upload } from "lucide-react";
import { useApp } from "@/store";
import { backfillLast7 } from "@/lib/backfill";
import { testKeyOnDevice } from "@/lib/gemini";
import InstallCard from "@/components/InstallCard";
import ApkCard from "@/components/ApkCard";
import { consistency, contribution, fastestGrowing, idx } from "@/lib/analytics";
import { fmtCompact, fmtFull, fmtPct, fmtRating, fmtSigned, prettyDate, todayISO } from "@/lib/format";
import { Button, Card, Dot, Growth, Num, SectionTitle, Toast, inputCls } from "@/components/ui";
import { Donut, MiniBars } from "@/components/charts";
import { StoryThumb } from "@/components/bits";
import type { AppData } from "@/lib/types";

function InsightRow({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "pos" | "accent";
}) {
  const color = tone === "pos" ? "text-pos" : tone === "accent" ? "text-accent" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right">
        <b className={`text-[14.5px] font-semibold tnum ${color}`}>{value}</b>
        {sub && <span className="ml-1.5 text-[11.5px] text-muted">{sub}</span>}
      </span>
    </div>
  );
}

export default function Insights() {
  const data = useApp((s) => s.data);
  const period = useApp((s) => s.period);
  const filter = useApp((s) => s.channelFilter);
  const setSheet = useApp((s) => s.setSheet);
  const seedNow = useApp((s) => s.seedNow);
  const replaceData = useApp((s) => s.replaceData);
  const showToast = useApp((s) => s.showToast);
  const setGeminiKey = useApp((s) => s.setGeminiKey);
  const today = todayISO();
  const I = useMemo(() => idx(data), [data]);

  const ids = filter === "all" ? data.channels.map((c) => c.id) : [filter];
  const fastest = useMemo(() => fastestGrowing(data, ids, period, today), [data, ids, period, today]);
  const cons = useMemo(() => consistency(data, ids, today), [data, ids, today]);
  const split = useMemo(() => contribution(data, today), [data, today]);

  const [keyDraft, setKeyDraft] = useState("");
  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "ok" | "err"; msg: string }>({
    status: "idle",
    msg: "",
  });
  const importRef = useRef<HTMLInputElement>(null);
  const hasKey = Boolean(data.settings.geminiKey);

  async function testConnection() {
    const localKey = keyDraft.trim() || data.settings.geminiKey;
    if (localKey) {
      // On-device test — identical to what the installed APK does.
      setTestState({ status: "loading", msg: "Pinging gemini-2.5-flash from this device…" });
      const res = await testKeyOnDevice(localKey);
      setTestState(res.ok ? { status: "ok", msg: res.message } : { status: "err", msg: res.message });
      return;
    }
    setTestState({ status: "loading", msg: "Pinging server key…" });
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) });
      const json = await res.json();
      if (json.ok) setTestState({ status: "ok", msg: `Server key connected · ${json.model ?? "gemini-2.5-flash"}` });
      else setTestState({ status: "err", msg: json.message ?? "No key found. Save a key first." });
    } catch (e) {
      setTestState({ status: "err", msg: (e as Error).message });
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lipipulse-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Full database exported as JSON");
  }

  function exportCSV() {
    const head = "snapshot_date,channel_id,channel_name,followers,total_views,total_stories\n";
    const rows = data.channelSnapshots
      .slice()
      .sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1))
      .map((s) => {
        const c = I.channelById.get(s.channelId);
        return [s.snapshotDate, s.channelId, `"${(c?.name ?? "").replace(/"/g, "")}"`, s.followers, s.totalViews, s.totalStories].join(",");
      })
      .join("\n");
    const blob = new Blob([head + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lipipulse-channel-snapshots-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Channel snapshots exported as CSV");
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (!parsed.channels || !parsed.stories) throw new Error("Not a LipiPulse backup");
      await replaceData({ ...parsed, settings: { ...parsed.settings, geminiKey: data.settings.geminiKey } });
      showToast(`Imported ${parsed.channels.length} channels · ${parsed.stories.length} stories`);
    } catch (e) {
      showToast(`Import failed: ${(e as Error).message}`);
    }
  }

  const streakTone = cons.streak >= 5 ? "pos" : cons.streak >= 2 ? "accent" : "ink";

  return (
    <div className="px-5 pt-5 pb-6">
      <div>
        <h1 className="font-display text-[30px] italic leading-[1.05] tracking-[-0.01em]">Insights</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Automated signals across {ids.length} channel{ids.length > 1 ? "s" : ""} · {prettyDate(today)}
        </p>
      </div>

      {/* fastest growing */}
      <div className="mt-4">
        <SectionTitle>Fastest growing · {period}</SectionTitle>
        <Card i={0} className="p-4">
          {fastest ? (
            <div className="flex items-center gap-3">
              <StoryThumb cover={fastest.story.coverUri} color={fastest.channelColor} title={fastest.story.title} size={46} radius={14} />
              <div className="min-w-0 flex-1">
                <p className="deva truncate text-[15px] font-medium">{fastest.story.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Dot color={fastest.channelColor} size={6} />
                  {fastest.channelName.split(" ")[0]} · ★ {fmtRating(fastest.rating)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[16px] font-semibold tnum text-pos">{fmtSigned(fastest.viewsGain)}</p>
                <p className="text-[11px] tnum text-muted">{fmtPct(fastest.viewsPct)}</p>
              </div>
            </div>
          ) : (
            <p className="py-2 text-[13px] text-muted">No story data yet.</p>
          )}
        </Card>
      </div>

      {/* consistency */}
      <div className="mt-4">
        <SectionTitle>Upload consistency</SectionTitle>
        <Card i={1} className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="eyebrow">This week</p>
              <p className="mt-1.5 text-[22px] font-semibold leading-none tnum">{cons.thisWeek}</p>
              <p className="mt-1 text-[11px] tnum text-muted">vs {cons.lastWeek} last week</p>
            </div>
            <div>
              <p className="eyebrow">30D streak</p>
              <p className={`mt-1.5 text-[22px] font-semibold leading-none tnum ${streakTone === "pos" ? "text-pos" : streakTone === "accent" ? "text-accent" : "text-ink"}`}>
                {cons.streak}
              </p>
              <p className="mt-1 text-[11px] tnum text-muted">consecutive days</p>
            </div>
            <div>
              <p className="eyebrow">Best run</p>
              <p className="mt-1.5 text-[22px] font-semibold leading-none tnum">{cons.bestDay}</p>
              <p className="mt-1 text-[11px] text-muted">days in a row</p>
            </div>
          </div>
          <div className="mt-4 border-t border-hair pt-3.5">
            <p className="eyebrow mb-2">Last 14 days</p>
            <MiniBars
              values={cons.daily}
              labels={cons.daily.map((v, i) => (i % 2 === 0 ? `${13 - i}` : ""))}
              color={cons.thisWeek >= cons.lastWeek ? "#1F9D63" : "#6C7BFF"}
            />
          </div>
          <div className="mt-3 rounded-[14px] bg-pill px-3 py-2 text-[12px] text-muted">
            {cons.thisWeek === cons.lastWeek
              ? "Upload pace is holding steady against last week."
              : cons.thisWeek > cons.lastWeek
                ? `Up ${cons.thisWeek - cons.lastWeek} episode${cons.thisWeek - cons.lastWeek > 1 ? "s" : ""} on last week — momentum building.`
                : `Down ${cons.lastWeek - cons.thisWeek} episode${cons.lastWeek - cons.thisWeek > 1 ? "s" : ""} vs last week.`}
          </div>
        </Card>
      </div>

      {/* contribution */}
      <div className="mt-4">
        <SectionTitle>Channel contribution</SectionTitle>
        <Card i={2} className="flex items-center gap-4 p-4">
          <Donut
            segments={split.map((s) => ({ value: s.views, color: s.color, label: s.name }))}
            centerValue={`${Math.round(split[0]?.share ?? 0)}%`}
            centerLabel={split[0]?.name.split(" ")[0] ?? "—"}
          />
          <div className="min-w-0 flex-1">
            {split.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
                  <Dot color={s.color} size={7} />
                  <span className="truncate">{s.name.split(" ")[0]}</span>
                </span>
                <span className="shrink-0 text-right">
                  <b className="text-[12.5px] font-semibold tnum">{fmtCompact(s.views)}</b>
                  <span className="ml-1.5 text-[11px] tnum text-muted">{Math.round(s.share)}%</span>
                </span>
              </div>
            ))}
            <div className="mt-2 border-t border-hair pt-2">
              <InsightRow label="Total views" value={fmtCompact(split.reduce((a, b) => a + b.views, 0))} />
            </div>
          </div>
        </Card>
      </div>

      {/* gemini key */}
      <div className="mt-5">
        <SectionTitle>Gemini vision</SectionTitle>
        <Card i={3} className="p-4">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-accent" />
            <p className="text-[14px] font-semibold">Screenshot auto-detection</p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            Paste a Google AI Studio key to extract followers, views, ratings and episode counts from Pratilipi screenshots with{" "}
            <span className="font-medium text-ink">gemini-2.5-flash</span>. Stored locally in this device&apos;s database; sent only to{" "}
            <span className="font-medium text-ink">/api/scan</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={data.settings.geminiKey ? "•••••••••••• (saved)" : "AIza…"}
              className={`${inputCls} flex-1`}
              autoComplete="off"
            />
          </div>
          <div className="mt-2.5 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={async () => {
                await setGeminiKey(keyDraft.trim());
                setKeyDraft("");
                showToast("API key saved to local database");
              }}
            >
              Save key
            </Button>
            <Button className="flex-1" onClick={testConnection} disabled={testState.status === "loading"}>
              {testState.status === "loading" ? "Testing…" : "Test connection"}
            </Button>
          </div>
          {testState.status !== "idle" && testState.status !== "loading" && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-2.5 flex items-start gap-1.5 rounded-[12px] px-3 py-2 text-[12px] ${
                testState.status === "ok" ? "bg-posbg text-pos" : "bg-warn text-warnink"
              }`}
            >
              {testState.status === "ok" ? <Check size={13} className="mt-0.5 shrink-0" /> : <TriangleAlert size={13} className="mt-0.5 shrink-0" />}
              {testState.msg}
            </motion.p>
          )}
          <p className="mt-2 text-[11.5px] text-muted">
            {hasKey
              ? "A key is saved on this device — scans will use it when the server has no key of its own."
              : "No key saved yet — scans run in demo mode with a realistic sample extraction."}
          </p>
        </Card>
      </div>

      {/* install */}
      <div className="mt-5">
        <InstallCard />
      </div>

      {/* real APK via GitHub Actions */}
      <div className="mt-5">
        <SectionTitle>Build APK</SectionTitle>
        <ApkCard />
      </div>

      {/* data management */}
      <div className="mt-5">
        <SectionTitle>Data management</SectionTitle>
        <div className="space-y-2.5">
          <Card i={4} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Manual snapshot entry</p>
                <p className="mt-0.5 text-[11.5px] text-muted">Log today&apos;s numbers without a screenshot.</p>
              </div>
              <Button variant="ghost" onClick={() => setSheet({ kind: "manual" })}>
                Open
              </Button>
            </div>
          </Card>

          <Card i={5} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                  <Sparkles size={14} className="text-accent" /> Seed demo dataset
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">12 months · 3 channels · 9 stories · ~150 episodes.</p>
              </div>
              <Button variant="ghost" onClick={() => void seedNow()}>
                <RefreshCw size={13} className="mr-1.5 inline" />
                Seed
              </Button>
            </div>
            <p className="mt-2.5 rounded-[12px] bg-pill px-3 py-2 text-[11.5px] text-muted tnum">
              {fmtFull(data.channelSnapshots.length)} channel snapshots · {fmtFull(data.storySnapshots.length)} story snapshots ·{" "}
              {fmtFull(data.episodeSnapshots.length)} episode snapshots
            </p>
          </Card>

          <Card i={6} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                  <History size={14} className="text-accent" /> Backfill last 7 days
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                  Added a channel today? Fill the 7 missing daily snapshots so the 7D delta shows movement right away. Existing snapshots are never
                  overwritten.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  const res = backfillLast7(useApp.getState().data, ids, 7);
                  if (!res.created) {
                    showToast("Nothing to backfill — all 7 days already have snapshots");
                    return;
                  }
                  await replaceData(res.data);
                  showToast(`Backfilled ${res.created} snapshots · 7D growth now measurable`);
                }}
              >
                Run
              </Button>
            </div>
            <p className="mt-2.5 rounded-[12px] bg-pill px-3 py-2 text-[11.5px] text-muted tnum">
              Scope: {ids.length === data.channels.length ? "all channels" : "selected channel"} · 7 days · channels + stories
            </p>
          </Card>

          <Card i={7} className="p-4">
            <p className="text-[14px] font-semibold">Backup & restore</p>
            <p className="mt-0.5 text-[11.5px] text-muted">Full SQLite-equivalent export as JSON, or channel snapshots as CSV.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="ghost" onClick={exportJSON}>
                <FileJson size={13} className="mr-1.5 inline" />
                JSON
              </Button>
              <Button variant="ghost" onClick={exportCSV}>
                <Download size={13} className="mr-1.5 inline" />
                CSV
              </Button>
              <Button variant="quiet" onClick={() => importRef.current?.click()}>
                <Upload size={13} className="mr-1.5 inline" />
                Import
              </Button>
            </div>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </Card>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-hair pt-4 text-[11px] text-muted">
        <span>LipiPulse · offline-first author studio</span>
        <span className="tnum">{data.stories.length} stories · {data.episodes.length} episodes</span>
      </div>

    </div>
  );
}
