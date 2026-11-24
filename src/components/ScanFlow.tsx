"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera, Check, ImagePlus, Loader2, ScanLine, Sparkles, TriangleAlert } from "lucide-react";
import { useApp, type ScanPayload } from "@/store";
import { bestMatch, fmtCompact, prettyDate, todayISO } from "@/lib/format";
import { demoExtraction, scanOnDevice } from "@/lib/gemini";
import { idx, pickAt } from "@/lib/analytics";
import { Button, Card, Dot, Sheet, inputCls } from "@/components/ui";

function toBase64(file: File): Promise<{ name: string; mime: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mime: file.type || "image/png", data: String(reader.result).split(",")[1] ?? "" });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/* Step 1 — pick screenshots and call the Gemini pipeline              */
/* ------------------------------------------------------------------ */

function ScanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setSheet = useApp((s) => s.setSheet);
  const scanning = useApp((s) => s.scanning);
  const setScanning = useApp((s) => s.setScanning);
  const scanError = useApp((s) => s.scanError);
  const setScanError = useApp((s) => s.setScanError);
  const clientKey = useApp((s) => s.data.settings.geminiKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);

  async function run(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setCount(list.length);
    setScanning(true);
    setScanError(null);

    const targetChannel = useApp.getState().data.channels[0]?.id ?? "";
    const finish = (payload: ScanPayload) => {
      setSheet({ kind: "review", payload });
      setScanning(false);
    };

    try {
      const shots = await Promise.all(list.map(toBase64));

      // 1) Key saved on this device → call Gemini straight from the phone.
      //    This is the path used inside the installed APK, where no server exists.
      if (clientKey) {
        try {
          const images = await scanOnDevice(shots, clientKey);
          finish({ images, demo: false, date: todayISO(), channelId: targetChannel });
          return;
        } catch (e) {
          setScanError(`On-device scan failed — ${(e as Error).message}. Trying server…`);
        }
      }

      // 2) Server proxy (web preview / hosted build with a server key).
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ images: shots, clientKey }),
        });
        const json = await res.json();
        if (res.ok && json.images?.length) {
          finish({ images: json.images, demo: Boolean(json.demo), date: todayISO(), channelId: targetChannel });
          return;
        }
      } catch {
        /* no server reachable — running as an installed app */
      }

      // 3) Offline demo extraction so the review pipeline always stays testable.
      setScanError(null);
      finish({ images: demoExtraction(shots.map((s) => s.name)), demo: true, date: todayISO(), channelId: targetChannel });
    } catch (e) {
      setScanError((e as Error).message);
      setScanning(false);
    }
  }

  function runDemo() {
    setCount(1);
    setSheet({
      kind: "review",
      payload: {
        demo: true,
        date: todayISO(),
        channelId: useApp.getState().data.channels[0]?.id ?? "",
        images: demoExtraction(["author_profile.png"]),
      },
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Scan screenshot"
      subtitle="Share from Pratilipi → LipiPulse, or pick screenshots here. Extracted with gemini-2.5-flash."
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => inputRef.current?.click()} disabled={scanning}>
            {scanning ? <Loader2 size={15} className="mr-2 inline animate-spin" /> : <ImagePlus size={15} className="mr-2 inline" />}
            {scanning ? "Extracting…" : "Choose screenshots"}
          </Button>
          <Button variant="ghost" onClick={runDemo} disabled={scanning}>
            <Sparkles size={15} className="mr-1.5 inline" />
            Demo
          </Button>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void run(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="space-y-3 pb-2">
        <div className="rounded-[16px] border border-hair bg-pill p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface text-accent">
              <ScanLine size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold">AI screenshot detection</p>
              <p className="text-[11.5px] text-muted">Profile · story list · story detail · episode list</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { n: "1", t: "Extract" },
              { n: "2", t: "Verify" },
              { n: "3", t: "Save" },
            ].map((s) => (
              <div key={s.n} className="rounded-[12px] bg-surface px-2 py-2">
                <p className="text-[12px] font-bold tnum text-accent">{s.n}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">{s.t}</p>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {scanning && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[16px] border border-hair bg-surface p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <Loader2 size={14} className="animate-spin text-accent" />
                Reading {count} screenshot{count > 1 ? "s" : ""}…
              </p>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-pill">
                <motion.div className="h-full rounded-full bg-accent" initial={{ width: "8%" }} animate={{ width: "96%" }} transition={{ duration: 2.4, ease: "easeOut" }} />
              </div>
              <p className="mt-2 text-[11.5px] text-muted">Normalising Devanagari numerals · K / L / Cr units</p>
            </motion.div>
          )}
        </AnimatePresence>

        {scanError && (
          <div className="flex items-start gap-2 rounded-[16px] bg-warn px-3.5 py-3 text-[12.5px] text-warnink">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        <div className="rounded-[16px] border border-dashed border-hair p-3.5 text-center">
          <Camera size={18} className="mx-auto text-muted" />
          <p className="mt-2 text-[12.5px] font-medium">Share directly from Pratilipi</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            On Android, use Share → LipiPulse. This installable PWA receives the images through the share target and opens this same review sheet.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — fuzzy match, sanity checks, confirm & save                 */
/* ------------------------------------------------------------------ */

function NumField({
  label,
  value,
  onChange,
  warn,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warn?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="eyebrow flex items-center gap-1">
        {label}
        {warn && <TriangleAlert size={10} className="text-warnink" />}
      </span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-[12px] border px-2.5 py-2 text-[14px] tnum focus:outline-none ${
          warn ? "border-[#EFDDA4] bg-warn text-warnink" : "border-hair bg-pill text-ink"
        }`}
      />
      {warn && <span className="mt-1 block text-[10px] font-medium text-warnink">lower than previous</span>}
    </label>
  );
}

function ReviewSheet({ payload, onClose }: { payload: ScanPayload; onClose: () => void }) {
  const data = useApp((s) => s.data);
  const showToast = useApp((s) => s.showToast);
  const I = useMemo(() => idx(data), [data]);

  const [date, setDate] = useState(payload.date || todayISO());
  const [channelFor, setChannelFor] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    payload.images.forEach((img, i) => {
      const titled = data.channels.map((c) => ({ id: c.id, title: c.name }));
      const m = img.channel_name ? bestMatch(img.channel_name, titled) : null;
      map[i] = m?.item.id ?? payload.channelId ?? data.channels[0]?.id ?? "";
    });
    return map;
  });

  const initial: Record<string, string> = {};
  payload.images.forEach((img, i) => {
    if (img.followers != null) initial[`${i}|ch|followers`] = String(img.followers);
    if (img.total_channel_views != null) initial[`${i}|ch|views`] = String(img.total_channel_views);
    img.stories.forEach((s, j) => {
      if (s.views != null) initial[`${i}|st|${j}|views`] = String(s.views);
      if (s.rating != null) initial[`${i}|st|${j}|rating`] = String(s.rating);
      if (s.rating_count != null) initial[`${i}|st|${j}|rc`] = String(s.rating_count);
      if (s.episode_count != null) initial[`${i}|st|${j}|eps`] = String(s.episode_count);
    });
    img.episodes.forEach((e, k) => {
      if (e.views != null) initial[`${i}|ep|${k}|views`] = String(e.views);
      if (e.rating != null) initial[`${i}|ep|${k}|rating`] = String(e.rating);
    });
  });
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [storyChoice, setStoryChoice] = useState<Record<string, string>>({});

  const setVal = (k: string, v: string) => setVals((prev) => ({ ...prev, [k]: v }));
  const numOf = (k: string): number | null => {
    const raw = (vals[k] ?? "").replace(/,/g, "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const floatOf = (k: string): number | null => {
    const raw = (vals[k] ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const stories = data.stories;
  function resolveStory(i: number, j: number): { id?: string; title: string; isNew: boolean; score: number } {
    const item = payload.images[i].stories[j];
    const chosen = storyChoice[`${i}|${j}`];
    if (chosen && chosen !== "NEW") return { id: chosen, title: item.title, isNew: false, score: 1 };
    if (chosen === "NEW") return { title: item.title, isNew: true, score: 0 };
    const m = bestMatch(item.title, stories);
    if (m) return { id: m.item.id, title: m.item.title, isNew: false, score: m.score };
    return { title: item.title, isNew: true, score: 0 };
  }

  function prevStorySnap(storyId: string) {
    const snaps = data.storySnapshots.filter((s) => s.storyId === storyId && s.snapshotDate < date);
    snaps.sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));
    return snaps[snaps.length - 1];
  }
  function prevChannelSnap(channelId: string) {
    const snaps = data.channelSnapshots.filter((s) => s.channelId === channelId && s.snapshotDate < date);
    snaps.sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));
    return snaps[snaps.length - 1];
  }

  const storyCount = payload.images.reduce((a, i) => a + i.stories.length, 0);
  const epCount = payload.images.reduce((a, i) => a + i.episodes.length, 0);

  async function confirm() {
    if (navigator.vibrate) navigator.vibrate(16);
    const store = useApp.getState();
    let saved = 0;

    for (let i = 0; i < payload.images.length; i++) {
      const img = payload.images[i];
      const chId = channelFor[i] || store.data.channels[0]?.id;
      if (!chId) continue;

      const followers = numOf(`${i}|ch|followers`);
      const totalViews = numOf(`${i}|ch|views`);
      if (followers !== null || totalViews !== null) {
        await store.saveChannelSnapshot({ channelId: chId, date, followers, totalViews });
      }

      for (let j = 0; j < img.stories.length; j++) {
        const item = img.stories[j];
        let target = resolveStory(i, j);
        if (target.isNew) {
          await store.addStory({ channelId: chId, title: item.title, status: "ongoing" });
          const created = useApp.getState().data.stories.find((s) => s.title === item.title && s.channelId === chId);
          if (created) target = { id: created.id, title: created.title, isNew: false, score: 1 };
        }
        if (!target.id) continue;
        await store.saveStorySnapshot({
          storyId: target.id,
          date,
          views: numOf(`${i}|st|${j}|views`),
          rating: floatOf(`${i}|st|${j}|rating`),
          ratingCount: numOf(`${i}|st|${j}|rc`),
          episodeCount: numOf(`${i}|st|${j}|eps`),
        });
        saved += 1;
      }

      for (let k = 0; k < img.episodes.length; k++) {
        const ep = img.episodes[k];
        const pool = ep.story_title ? bestMatch(ep.story_title, useApp.getState().data.stories) : null;
        const storyId = pool?.item.id ?? (img.stories.length ? resolveStory(i, 0).id : undefined);
        if (!storyId) continue;
        const number = ep.episode_number ?? useApp.getState().data.episodes.filter((e) => e.storyId === storyId).length + 1;
        const existing = useApp.getState().data.episodes.find((e) => e.storyId === storyId && e.episodeNumber === number);
        if (existing) {
          const views = numOf(`${i}|ep|${k}|views`);
          if (views !== null) await store.saveEpisodeSnapshot({ episodeId: existing.id, date, views, rating: floatOf(`${i}|ep|${k}|rating`) });
        } else {
          await store.addEpisode({ storyId, title: ep.title, publishedDate: ep.published_date && /^\d{4}-\d{2}-\d{2}$/.test(ep.published_date) ? ep.published_date : date, episodeNumber: number });
          const created = useApp.getState().data.episodes.slice(-1)[0];
          const views = numOf(`${i}|ep|${k}|views`);
          if (created && views !== null) await store.saveEpisodeSnapshot({ episodeId: created.id, date, views, rating: floatOf(`${i}|ep|${k}|rating`) });
        }
        saved += 1;
      }
    }

    showToast(`Snapshot saved · ${prettyDate(date)} · ${saved} records`);
    onClose();
  }

  const channelPills = data.channels.map((c) => ({ id: c.id, label: c.name.split(" ")[0], color: c.colorHex }));

  return (
    <Sheet
      open
      onClose={onClose}
      title="Review & confirm"
      subtitle={`${payload.images.length} screenshot${payload.images.length > 1 ? "s" : ""} · ${storyCount} stories · ${epCount} episodes${payload.demo ? " · demo extraction" : ""}`}
      footer={
        <Button className="w-full" onClick={() => void confirm()}>
          <Check size={15} className="mr-2 inline" />
          Confirm &amp; save snapshot · {prettyDate(date)}
        </Button>
      }
    >
      <div className="space-y-3 pb-2">
        {payload.demo && (
          <div className="flex items-start gap-2 rounded-[14px] bg-warn px-3.5 py-2.5 text-[12px] text-warnink">
            <Sparkles size={13} className="mt-0.5 shrink-0" />
            <span>
              Demo extraction — no server API key configured. Add a Gemini key in Insights to parse real screenshots. Values below include one
              deliberate typo to show the sanity check.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-[16px] border border-hair bg-surface px-3.5 py-3">
          <div>
            <p className="eyebrow">Snapshot date</p>
            <p className="mt-1 text-[14px] font-semibold tnum">{prettyDate(date)}</p>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-[152px] py-2 text-[13px]`} />
        </div>

        {payload.images.map((img, i) => {
          const chId = channelFor[i];
          const prevCh = chId ? prevChannelSnap(chId) : undefined;
          return (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate rounded-full bg-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {img.screen_type.replace("_", " ")}
                </span>
                <span className="truncate text-[11px] text-muted">{img.name}</span>
              </div>

              <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
                {channelPills.map((c) => {
                  const active = chId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannelFor((m) => ({ ...m, [i]: c.id }))}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium ${active ? "border-ink bg-ink text-paper" : "border-hair text-muted"}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Dot color={c.color} size={6} />
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(img.followers != null || img.total_channel_views != null) && (
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hair pt-3">
                  <NumField
                    label="Followers"
                    value={vals[`${i}|ch|followers`] ?? ""}
                    onChange={(v) => setVal(`${i}|ch|followers`, v)}
                    warn={Boolean(prevCh && numOf(`${i}|ch|followers`) !== null && (numOf(`${i}|ch|followers`) as number) < prevCh.followers)}
                    placeholder="—"
                  />
                  <NumField
                    label="Channel views"
                    value={vals[`${i}|ch|views`] ?? ""}
                    onChange={(v) => setVal(`${i}|ch|views`, v)}
                    warn={Boolean(prevCh && numOf(`${i}|ch|views`) !== null && (numOf(`${i}|ch|views`) as number) < prevCh.totalViews)}
                    placeholder="—"
                  />
                </div>
              )}

              {img.stories.map((s, j) => {
                const res = resolveStory(i, j);
                const prev = res.id ? prevStorySnap(res.id) : undefined;
                const viewsVal = numOf(`${i}|st|${j}|views`);
                const epsVal = numOf(`${i}|st|${j}|eps`);
                const warnViews = Boolean(prev && viewsVal !== null && viewsVal < prev.views);
                const warnEps = Boolean(prev && epsVal !== null && epsVal < prev.episodeCount);

                return (
                  <div key={j} className="mt-3 border-t border-hair pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="deva min-w-0 flex-1 text-[14.5px] font-medium">{s.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10.5px] font-semibold ${
                          res.isNew ? "bg-accent/12 text-accent" : "bg-posbg text-pos"
                        }`}
                        style={res.isNew ? { background: "#EDEDFF", color: "#5A69F5" } : undefined}
                      >
                        {res.isNew ? "New story — will create" : `Matched ${res.score.toFixed(2)}`}
                      </span>
                    </div>

                    {!res.isNew && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStoryChoice((m) => ({ ...m, [`${i}|${j}`]: "NEW" }))}
                          className="rounded-full border border-hair px-2.5 py-1 text-[11px] text-muted"
                        >
                          create new instead
                        </button>
                        {stories.slice(0, 4).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setStoryChoice((m) => ({ ...m, [`${i}|${j}`]: st.id }))}
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${storyChoice[`${i}|${j}`] === st.id ? "border-ink text-ink" : "border-hair text-muted"}`}
                          >
                            {st.title.slice(0, 16)}…
                          </button>
                        ))}
                      </div>
                    )}
                    {res.isNew && (
                      <button
                        type="button"
                        onClick={() => setStoryChoice((m) => ({ ...m, [`${i}|${j}`]: "" }))}
                        className="mt-2 rounded-full border border-hair px-2.5 py-1 text-[11px] text-muted"
                      >
                        match to existing instead
                      </button>
                    )}

                    <div className="mt-2.5 grid grid-cols-4 gap-2">
                      <NumField label="Views" value={vals[`${i}|st|${j}|views`] ?? ""} onChange={(v) => setVal(`${i}|st|${j}|views`, v)} warn={warnViews} placeholder="—" />
                      <NumField label="Rating" value={vals[`${i}|st|${j}|rating`] ?? ""} onChange={(v) => setVal(`${i}|st|${j}|rating`, v)} placeholder="—" />
                      <NumField label="Ratings" value={vals[`${i}|st|${j}|rc`] ?? ""} onChange={(v) => setVal(`${i}|st|${j}|rc`, v)} placeholder="—" />
                      <NumField label="Eps" value={vals[`${i}|st|${j}|eps`] ?? ""} onChange={(v) => setVal(`${i}|st|${j}|eps`, v)} warn={warnEps} placeholder="—" />
                    </div>
                    {prev && (
                      <p className="mt-1.5 text-[10.5px] tnum text-muted">
                        previous · {prettyDate(prev.snapshotDate)} → {fmtCompact(prev.views)} views · {prev.episodeCount} eps
                      </p>
                    )}
                  </div>
                );
              })}

              {img.episodes.map((e, k) => (
                <div key={`ep${k}`} className="mt-3 border-t border-hair pt-3">
                  <p className="deva truncate text-[14px] font-medium">
                    <span className="mr-1.5 rounded-full bg-pill px-1.5 py-0.5 text-[10.5px] font-bold tnum text-muted">
                      {e.episode_number ? `EP ${e.episode_number}` : "EP"}
                    </span>
                    {e.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted">
                    {e.story_title ? `for ${e.story_title}` : "story unresolved"} · {e.published_date ? prettyDate(e.published_date) : "date not visible"}
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <NumField label="Episode views" value={vals[`${i}|ep|${k}|views`] ?? ""} onChange={(v) => setVal(`${i}|ep|${k}|views`, v)} placeholder="—" />
                    <NumField label="Episode rating" value={vals[`${i}|ep|${k}|rating`] ?? ""} onChange={(v) => setVal(`${i}|ep|${k}|rating`, v)} placeholder="—" />
                  </div>
                </div>
              ))}
            </Card>
          );
        })}

        <p className="px-1 pb-1 text-[11.5px] leading-relaxed text-muted">
          Amber fields are lower than the previous stored snapshot — almost always an OCR typo. Correct them before saving; the delta engine will
          refuse to treat the dip as real growth.
        </p>
        <p className="px-1 pb-1 text-center text-[11.5px] font-medium text-muted tnum">
          Writing to {data.channels.length} channels · {storyCount} story records · {epCount} episode records
        </p>
      </div>
    </Sheet>
  );
}

export default function ScanFlow() {
  const sheet = useApp((s) => s.sheet);
  const setSheet = useApp((s) => s.setSheet);
  return (
    <>
      <ScanSheet open={sheet?.kind === "scan"} onClose={() => setSheet(null)} />
      {sheet?.kind === "review" && <ReviewSheet payload={sheet.payload} onClose={() => setSheet(null)} />}
    </>
  );
}
