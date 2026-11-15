"use client";

import { useEffect } from "react";
import { Activity, CircleCheck, CircleDashed, Gauge, Cog, X } from "lucide-react";
import { useRepairStore, type HudTab, type MeterReading } from "@/store/useRepairStore";

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

type ReadingStatus = "ok" | "fault" | "unknown";

function statusOf(r: MeterReading): ReadingStatus {
  if (r.value === null || !r.expected) return "unknown";
  return r.value >= r.expected.min && r.value <= r.expected.max ? "ok" : "fault";
}

const STATUS_STYLE: Record<ReadingStatus, { text: string; border: string; label: string }> = {
  ok: { text: "text-bench-ok", border: "border-bench-ok", label: "IN RANGE" },
  fault: { text: "text-bench-fault", border: "border-bench-fault", label: "OUT OF RANGE" },
  unknown: { text: "text-bench-muted", border: "border-bench-border", label: "NO REF" },
};

function MultimeterPanel() {
  const readings = useRepairStore((s) => s.readings);
  const [live, ...history] = readings;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-bench-border bg-bench-bg p-5">
        <div className="mb-2 flex items-center gap-2 text-lg font-semibold text-bench-muted">
          <Activity className="size-5 text-bench-accent" aria-hidden />
          LIVE · <span className="font-mono">{live?.mode ?? "--"}</span>
          <span className="ml-auto text-sm">meter not connected</span>
        </div>
        <div className="font-mono text-7xl font-black tabular-nums leading-none tracking-tight">
          {live?.value ?? "----"}
          <span className="ml-2 text-4xl text-bench-muted">{live?.unit}</span>
        </div>
        <div className="mt-2 truncate text-xl">{live?.testPoint ?? "Probe a test point"}</div>
      </div>

      <h3 className="pt-2 text-lg font-bold uppercase tracking-wider text-bench-muted">Logged readings</h3>
      {!live && <p className="text-lg text-bench-muted">No readings logged yet.</p>}
      <ul className="space-y-3">
        {(live ? [live, ...history] : []).map((r) => {
          const st = STATUS_STYLE[statusOf(r)];
          return (
            <li key={r.id} className={`rounded-xl border-l-8 bg-bench-raised p-4 ${st.border}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xl font-semibold">{r.testPoint}</span>
                <span className={`font-mono text-3xl font-bold tabular-nums ${st.text}`}>
                  {r.value ?? "—"}
                  <span className="ml-1 text-xl">{r.unit}</span>
                </span>
              </div>
              <div className="mt-1 flex justify-between font-mono text-base text-bench-muted">
                <span>
                  {r.mode}
                  {r.expected && ` · ref ${r.expected.min}–${r.expected.max} ${r.unit}`}
                </span>
                <span className={`font-bold ${st.text}`}>{st.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
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
