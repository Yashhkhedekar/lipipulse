"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useApp } from "@/store";
import { CHANNEL_PALETTE, uid } from "@/lib/types";
import { idx, pickAt } from "@/lib/analytics";
import { todayISO } from "@/lib/format";
import { Button, Field, Segmented, Select, Sheet, inputCls } from "@/components/ui";

/* ---------------- channel create / edit ---------------- */

export function ChannelFormSheet() {
  const sheet = useApp((s) => s.sheet);
  const data = useApp((s) => s.data);
  const setSheet = useApp((s) => s.setSheet);
  const upsertChannel = useApp((s) => s.upsertChannel);
  const removeChannel = useApp((s) => s.removeChannel);
  const showToast = useApp((s) => s.showToast);

  const open = sheet?.kind === "channelForm";
  const editing = open && sheet.kind === "channelForm" && sheet.channelId ? data.channels.find((c) => c.id === sheet.channelId) : undefined;

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [color, setColor] = useState(CHANNEL_PALETTE[0]);
  const [base, setBase] = useState("0");

  // reset draft whenever the sheet opens
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(editing?.name ?? "");
      setHandle(editing?.handle ?? "");
      setColor(editing?.colorHex ?? CHANNEL_PALETTE[data.channels.length % CHANNEL_PALETTE.length]);
      setBase(String(editing?.baselineFollowers ?? 0));
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => setSheet(null)}
      title={editing ? "Edit channel" : "New channel"}
      subtitle="Channel identity colours are used across charts, badges and sparklines."
      footer={
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={async () => {
              await upsertChannel({
                id: editing?.id,
                name: name.trim() || "Untitled channel",
                handle: handle.trim() || "@handle",
                colorHex: color,
                baselineFollowers: Number(base) || 0,
              });
              setSheet(null);
              showToast(editing ? "Channel updated" : "Channel added");
            }}
          >
            {editing ? "Save changes" : "Add channel"}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              onClick={async () => {
                await removeChannel(editing.id);
                setSheet(null);
                showToast("Channel and its history removed");
              }}
            >
              <Trash2 size={15} />
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Channel name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vaishali Kulkarni" className={inputCls} />
        </Field>
        <Field label="Handle">
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@vaishali.k" className={inputCls} />
        </Field>
        <Field label="Identity colour">
          <div className="flex flex-wrap gap-2">
            {CHANNEL_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${color === c ? "border-ink scale-110" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Baseline followers" hint="Lifetime followers recorded when this channel was first added.">
          <input inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value.replace(/\D/g, ""))} className={inputCls} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------- story create ---------------- */

export function StoryFormSheet() {
  const sheet = useApp((s) => s.sheet);
  const data = useApp((s) => s.data);
  const setSheet = useApp((s) => s.setSheet);
  const addStory = useApp((s) => s.addStory);
  const showToast = useApp((s) => s.showToast);

  const open = sheet?.kind === "storyForm";
  const presetChannel = open && sheet.kind === "storyForm" ? sheet.channelId : undefined;

  const [title, setTitle] = useState("");
  const [channelId, setChannelId] = useState("");
  const [status, setStatus] = useState<"ongoing" | "completed">("ongoing");
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTitle("");
      setStatus("ongoing");
      setChannelId(presetChannel ?? data.channels[0]?.id ?? "");
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => setSheet(null)}
      title="New story"
      subtitle="A baseline snapshot is recorded immediately so lifetime views never read as new growth."
      footer={
        <Button
          className="w-full"
          onClick={async () => {
            if (!title.trim() || !channelId) return;
            await addStory({ channelId, title: title.trim(), status });
            setSheet(null);
          }}
        >
          Create story
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="सावळीचं घर" className={`${inputCls} deva`} />
        </Field>
        <Field label="Channel">
          <Select value={channelId} onChange={setChannelId} options={data.channels.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Status">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "ongoing", label: "Ongoing" },
              { value: "completed", label: "Completed" },
            ]}
          />
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------- episode log ---------------- */

export function EpisodeFormSheet() {
  const sheet = useApp((s) => s.sheet);
  const data = useApp((s) => s.data);
  const setSheet = useApp((s) => s.setSheet);
  const addEpisode = useApp((s) => s.addEpisode);
  const saveEpisodeSnapshot = useApp((s) => s.saveEpisodeSnapshot);
  const saveStorySnapshot = useApp((s) => s.saveStorySnapshot);
  const showToast = useApp((s) => s.showToast);

  const open = sheet?.kind === "episodeForm";
  const storyId = open && sheet.kind === "episodeForm" ? sheet.storyId : "";
  const story = data.stories.find((s) => s.id === storyId);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [views, setViews] = useState("");
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTitle("");
      setDate(todayISO());
      setViews("");
    }
  }

  const nextNumber = useMemo(() => data.episodes.filter((e) => e.storyId === storyId).length + 1, [data.episodes, storyId]);

  return (
    <Sheet
      open={open}
      onClose={() => setSheet(null)}
      title="Log episode"
      subtitle={story ? `Ep ${nextNumber} · ${story.title}` : ""}
      footer={
        <Button
          className="w-full"
          onClick={async () => {
            if (!storyId) return;
            if (navigator.vibrate) navigator.vibrate(12);
            const epId = uid("ep");
            await addEpisode({
              storyId,
              title: title.trim() || `प्रकरण ${nextNumber}`,
              publishedDate: date,
              episodeNumber: nextNumber,
            });
            const created = useApp.getState().data.episodes.filter((e) => e.storyId === storyId).slice(-1)[0];
            if (created && views) {
              await saveEpisodeSnapshot({ episodeId: created.id, date, views: Number(views) || 0 });
            }
            void epId;
            await saveStorySnapshot({ storyId, date, episodeCount: nextNumber });
            setSheet(null);
            showToast(`Episode ${nextNumber} logged`);
          }}
        >
          Save episode
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Episode title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="कोकणाचा पाऊस" className={`${inputCls} deva`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Published">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Episode views" hint="Optional">
            <input inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))} placeholder="0" className={inputCls} />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- manual snapshot entry ---------------- */

export function ManualSheet() {
  const sheet = useApp((s) => s.sheet);
  const data = useApp((s) => s.data);
  const setSheet = useApp((s) => s.setSheet);
  const saveChannelSnapshot = useApp((s) => s.saveChannelSnapshot);
  const saveStorySnapshot = useApp((s) => s.saveStorySnapshot);
  const showToast = useApp((s) => s.showToast);
  const I = useMemo(() => idx(data), [data]);

  const open = sheet?.kind === "manual";
  const [target, setTarget] = useState<"channel" | "story">("channel");
  const [entityId, setEntityId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [f1, setF1] = useState("");
  const [f2, setF2] = useState("");
  const [f3, setF3] = useState("");
  const [f4, setF4] = useState("");
  const [lastOpen, setLastOpen] = useState(false);

  /** Pre-fill with the latest stored values so daily logging is one tap + edit. */
  function applyPrefill(t: "channel" | "story", id: string) {
    if (!id) {
      setF1("");
      setF2("");
      setF3("");
      setF4("");
      return;
    }
    if (t === "channel") {
      const rows = data.channelSnapshots.filter((s) => s.channelId === id).sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));
      const s = rows[rows.length - 1];
      setF1(s ? String(s.followers) : "");
      setF2(s ? String(s.totalViews) : "");
      setF3(s ? String(s.totalStories) : "");
      setF4("");
    } else {
      const rows = data.storySnapshots.filter((s) => s.storyId === id).sort((a, b) => (a.snapshotDate < b.snapshotDate ? -1 : 1));
      const s = rows[rows.length - 1];
      setF1(s ? String(s.views) : "");
      setF2(s ? String(s.rating) : "");
      setF3(s ? String(s.ratingCount) : "");
      setF4(s ? String(s.episodeCount) : "");
    }
  }

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      const firstChannel = data.channels[0]?.id ?? "";
      const firstStory = data.stories[0]?.id ?? "";
      setTarget("channel");
      setEntityId(firstChannel);
      setDate(todayISO());
      applyPrefill("channel", firstChannel);
      void firstStory;
    }
  }

  const storyOptions = data.stories.map((s) => ({ value: s.id, label: s.title }));
  const prev =
    target === "channel"
      ? pickAt(
          (I.chSeries.get("views")?.get(entityId) ?? []),
          date,
        )
      : pickAt(I.stSeries.get(entityId) ?? [], date);

  return (
    <Sheet
      open={open}
      onClose={() => setSheet(null)}
      title="Manual snapshot"
      subtitle={`Previous recorded value on this date: ${prev ? prev.v.toLocaleString("en-IN") : "none"}`}
      footer={
        <Button
          className="w-full"
          onClick={async () => {
            if (navigator.vibrate) navigator.vibrate(12);
            if (target === "channel" && entityId) {
              await saveChannelSnapshot({
                channelId: entityId,
                date,
                followers: f1 ? Number(f1) : null,
                totalViews: f2 ? Number(f2) : null,
                totalStories: f3 ? Number(f3) : null,
              });
            } else if (entityId) {
              await saveStorySnapshot({
                storyId: entityId,
                date,
                views: f1 ? Number(f1) : null,
                rating: f2 ? Number(f2) : null,
                ratingCount: f3 ? Number(f3) : null,
                episodeCount: f4 ? Number(f4) : null,
              });
            }
            setSheet(null);
            showToast(`Snapshot saved · ${date}`);
          }}
        >
          Save snapshot
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Segmented
          value={target}
          onChange={(v) => {
            const nextId = v === "channel" ? data.channels[0]?.id ?? "" : data.stories[0]?.id ?? "";
            setTarget(v);
            setEntityId(nextId);
            applyPrefill(v, nextId);
          }}
          options={[
            { value: "channel", label: "Channel" },
            { value: "story", label: "Story" },
          ]}
        />

        <Field label={target === "channel" ? "Channel" : "Story"}>
          <Select
            value={entityId}
            onChange={(v) => {
              setEntityId(v);
              applyPrefill(target, v);
            }}
            options={target === "channel" ? data.channels.map((c) => ({ value: c.id, label: c.name })) : storyOptions}
          />
        </Field>

        <Field label="Snapshot date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>

        {target === "channel" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Followers">
              <input inputMode="numeric" value={f1} onChange={(e) => setF1(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            </Field>
            <Field label="Total views">
              <input inputMode="numeric" value={f2} onChange={(e) => setF2(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            </Field>
            <Field label="Total stories">
              <input inputMode="numeric" value={f3} onChange={(e) => setF3(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Views">
              <input inputMode="numeric" value={f1} onChange={(e) => setF1(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            </Field>
            <Field label="Rating">
              <input inputMode="decimal" value={f2} onChange={(e) => setF2(e.target.value.replace(/[^\d.]/g, ""))} placeholder="4.7" className={inputCls} />
            </Field>
            <Field label="Rating count">
              <input inputMode="numeric" value={f3} onChange={(e) => setF3(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            </Field>
            <Field label="Episode count">
              <input inputMode="numeric" value={f4} onChange={(e) => setF4(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            </Field>
          </div>
        )}
        <p className="rounded-[12px] bg-pill px-3 py-2 text-[11.5px] leading-relaxed text-muted">
          Leave a field blank to keep the previously recorded value. The delta engine picks the exact date, else the closest snapshot before it.
        </p>
      </div>
    </Sheet>
  );
}
