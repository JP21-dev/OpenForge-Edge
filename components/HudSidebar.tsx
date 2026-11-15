"use client";

import { useEffect, useState } from "react";
import { Activity, CircleCheck, CircleDashed, Cog, Gauge, Plus, Trash2, X } from "lucide-react";
import {
  METER_UNITS,
  readingStatus,
  useRepairStore,
  type HudTab,
  type MeterMode,
  type MeterReading,
  type ReadingStatus,
} from "@/store/useRepairStore";

const TABS: { id: HudTab; label: string; icon: typeof Gauge }[] = [
  { id: "meter", label: "Multimeter", icon: Gauge },
  { id: "screws", label: "Screw Map", icon: Cog },
];

export function HudSidebar() {
  const open = useRepairStore((s) => s.hudOpen);
  const tab = useRepairStore((s) => s.hudTab);
  const toggleHud = useRepairStore((s) => s.toggleHud);
  const setHudTab = useRepairStore((s) => s.setHudTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "]") toggleHud();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleHud]);

  return (
    <>
      {!open && (
        <nav className="hidden w-20 shrink-0 flex-col items-center gap-3 border-l-2 border-bench-border bg-bench-panel py-4 lg:flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setHudTab(id)}
              aria-label={`Open ${label}`}
              title={label}
              className="grid size-14 place-items-center rounded-xl border-2 border-bench-border bg-bench-raised hover:border-bench-accent"
            >
              <Icon className="size-7" />
            </button>
          ))}
        </nav>
      )}

      {open && <div className="fixed inset-0 z-10 bg-black/60 lg:hidden" onClick={toggleHud} aria-hidden />}

      <aside
        aria-label="Bench HUD"
        className={`${
          open ? "flex" : "hidden"
        } fixed inset-y-0 right-0 z-20 w-full max-w-md flex-col border-l-2 border-bench-border bg-bench-panel lg:static lg:z-auto lg:w-[26rem] lg:max-w-none xl:w-[30rem]`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b-2 border-bench-border p-3">
          <div role="tablist" className="flex flex-1 gap-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setHudTab(id)}
                className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-lg font-bold transition-colors ${
                  tab === id ? "bg-bench-accent text-black" : "bg-bench-raised text-bench-muted hover:text-bench-text"
                }`}
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleHud}
            aria-label="Close HUD"
            className="grid size-14 place-items-center rounded-xl bg-bench-raised hover:bg-bench-border"
          >
            <X className="size-7" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "meter" ? <MultimeterPanel /> : <ScrewMapPanel />}
        </div>
      </aside>
    </>
  );
}

const STATUS_STYLE: Record<ReadingStatus, { text: string; border: string; label: string }> = {
  ok: { text: "text-bench-ok", border: "border-bench-ok", label: "IN RANGE" },
  fault: { text: "text-bench-fault", border: "border-bench-fault", label: "OUT OF RANGE" },
  unknown: { text: "text-bench-muted", border: "border-bench-border", label: "NO REF" },
};

const MODES: MeterMode[] = ["DCV", "ACV", "OHM", "DIODE", "CONT", "AMP"];

function MultimeterPanel() {
  const readings = useRepairStore((s) => s.readings);
  const removeReading = useRepairStore((s) => s.removeReading);
  const [logging, setLogging] = useState(false);
  const latest = readings[0];
  const latestStatus = latest ? STATUS_STYLE[readingStatus(latest)] : STATUS_STYLE.unknown;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 bg-bench-bg p-5 ${latest ? latestStatus.border : "border-bench-border"}`}>
        <div className="mb-2 flex items-center gap-2 text-lg font-semibold text-bench-muted">
          <Activity className="size-5 text-bench-accent" aria-hidden />
          LATEST · <span className="font-mono">{latest?.mode ?? "--"}</span>
          {latest && <span className={`ml-auto text-sm font-bold ${latestStatus.text}`}>{latestStatus.label}</span>}
        </div>
        <div className="font-mono text-7xl font-black tabular-nums leading-none tracking-tight">
          {latest?.value ?? "----"}
          <span className="ml-2 text-4xl text-bench-muted">{latest?.unit}</span>
        </div>
        <div className="mt-2 truncate text-xl">{latest?.testPoint ?? "Probe a test point, then log it"}</div>
      </div>

      {logging ? (
        <LogReadingForm onDone={() => setLogging(false)} />
      ) : (
        <button
          onClick={() => setLogging(true)}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-bench-accent text-2xl font-black text-black"
        >
          <Plus className="size-8" aria-hidden />
          Log reading
        </button>
      )}

      <h3 className="pt-2 text-lg font-bold uppercase tracking-wider text-bench-muted">Logged readings</h3>
      {!latest && <p className="text-lg text-bench-muted">No readings logged yet.</p>}
      <ul className="space-y-3">
        {readings.map((r) => {
          const st = STATUS_STYLE[readingStatus(r)];
          return (
            <li key={r.id} className={`flex items-center gap-3 rounded-xl border-l-8 bg-bench-raised p-4 ${st.border}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xl font-semibold">{r.testPoint}</span>
                  <span className={`font-mono text-3xl font-bold tabular-nums ${st.text}`}>
                    {r.value ?? "—"}
                    <span className="ml-1 text-xl">{r.unit}</span>
                  </span>
                </div>
                <div className="mt-1 flex justify-between gap-2 font-mono text-base text-bench-muted">
                  <span className="truncate">
                    {r.mode}
                    {r.expected && ` · ref ${r.expected.min}–${r.expected.max} ${r.unit}`}
                  </span>
                  <span className={`shrink-0 font-bold ${st.text}`}>{st.label}</span>
                </div>
              </div>
              <button
                onClick={() => removeReading(r.id)}
                aria-label={`Delete reading for ${r.testPoint}`}
                className="grid size-12 shrink-0 place-items-center rounded-xl text-bench-muted hover:bg-bench-border hover:text-bench-fault"
              >
                <Trash2 className="size-6" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parseNumber(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function LogReadingForm({ onDone }: { onDone: () => void }) {
  const readings = useRepairStore((s) => s.readings);
  const addReading = useRepairStore((s) => s.addReading);
  const [testPoint, setTestPoint] = useState("");
  const [mode, setMode] = useState<MeterMode>(readings[0]?.mode ?? "DCV");
  const [value, setValue] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const recent = readings.filter((r, i) => readings.findIndex((x) => x.testPoint === r.testPoint) === i).slice(0, 6);
  const parsedValue = parseNumber(value);
  const canSave = testPoint.trim() !== "" && parsedValue !== null;
  const unit = METER_UNITS[mode];

  const pickRecent = (r: MeterReading) => {
    setTestPoint(r.testPoint);
    setMode(r.mode);
    setMin(r.expected ? String(r.expected.min) : "");
    setMax(r.expected ? String(r.expected.max) : "");
  };

  const save = () => {
    if (!canSave) return;
    const lo = parseNumber(min);
    const hi = parseNumber(max);
    addReading({
      testPoint: testPoint.trim(),
      mode,
      value: parsedValue,
      unit,
      expected: lo !== null && hi !== null ? { min: Math.min(lo, hi), max: Math.max(lo, hi) } : undefined,
    });
    onDone();
  };

  const field =
    "h-14 w-full rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4 rounded-2xl border-2 border-bench-accent bg-bench-raised p-4"
      aria-label="Log a meter reading"
    >
      <label className="block space-y-2">
        <span className="text-lg font-semibold text-bench-muted">Test point</span>
        <input
          autoFocus
          value={testPoint}
          onChange={(e) => setTestPoint(e.target.value)}
          placeholder="e.g. 12V input, F7002, C5101"
          className={field}
        />
      </label>

      {recent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recent.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pickRecent(r)}
              className="rounded-full border-2 border-bench-border px-4 py-2 text-lg hover:border-bench-accent"
            >
              {r.testPoint}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Meter mode">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`h-14 rounded-xl font-mono text-lg font-bold ${
              mode === m ? "bg-bench-accent text-black" : "bg-bench-bg text-bench-muted hover:text-bench-text"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="block space-y-2">
        <span className="text-lg font-semibold text-bench-muted">Reading</span>
        <div className="flex items-center gap-3">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="0.000"
            className={`${field} h-16 font-mono text-4xl font-bold tabular-nums`}
          />
          <span className="w-12 font-mono text-3xl text-bench-muted">{unit}</span>
        </div>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold text-bench-muted">Expected range (optional)</legend>
        <div className="flex items-center gap-2">
          <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="min" aria-label="Expected minimum" className={`${field} font-mono`} />
          <span className="text-xl text-bench-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="max" aria-label="Expected maximum" className={`${field} font-mono`} />
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="h-14 flex-1 rounded-xl bg-bench-accent text-xl font-black text-black disabled:opacity-30"
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="h-14 rounded-xl bg-bench-bg px-6 text-xl font-semibold text-bench-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ScrewMapPanel() {
  const screws = useRepairStore((s) => s.screws);
  const toggle = useRepairStore((s) => s.toggleScrewRemoved);
  const removed = screws.filter((s) => s.removed).reduce((n, s) => n + s.count, 0);
  const total = screws.reduce((n, s) => n + s.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid aspect-[4/3] place-items-center rounded-2xl border-2 border-dashed border-bench-border bg-bench-bg text-center text-lg text-bench-muted">
        <div>
          <Cog className="mx-auto mb-2 size-10" aria-hidden />
          Screw map image
          <br />
          <span className="text-base">(load from device profile)</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xl font-bold">
        <span>Removed</span>
        <span className="font-mono tabular-nums text-bench-accent">
          {removed}/{total}
        </span>
      </div>

      <ul className="space-y-3">
        {screws.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => toggle(s.id)}
              aria-pressed={s.removed}
              className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                s.removed ? "border-bench-ok bg-bench-ok/10" : "border-bench-border bg-bench-raised hover:border-bench-accent"
              }`}
            >
              {s.removed ? (
                <CircleCheck className="size-9 shrink-0 text-bench-ok" aria-hidden />
              ) : (
                <CircleDashed className="size-9 shrink-0 text-bench-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-semibold">{s.position}</div>
                <div className="font-mono text-lg text-bench-muted">
                  {s.head} · {s.length}
                </div>
              </div>
              <span className="font-mono text-3xl font-black">×{s.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
