"use client";

import { useState } from "react";
import { Check, CheckCircle2, ChevronDown, CircleDashed, ExternalLink, Info, X } from "lucide-react";
import { resolveStep, selectCurrentStep, selectDevice, selectProcedure, useRepairStore } from "@/store/useRepairStore";
import { VIEW_BOX, screwKey, type DeviceView, type ScrewGroup, type Shape } from "@/lib/devices";

const COLORS = ["#f5a524", "#22d3ee", "#e879f9", "#a3e635", "#fb7185", "#818cf8", "#facc15", "#34d399"];

const FILL: Record<string, string> = {
  body: "#11161c",
  part: "#1c242d",
  chip: "#2a3440",
  hot: "#3a2a12",
};

export function ScrewMapPanel() {
  const device = useRepairStore(selectDevice);
  const procedure = useRepairStore(selectProcedure);
  const step = useRepairStore(selectCurrentStep);
  const stepIndex = useRepairStore((s) => s.currentStepIndex);
  const rawSteps = useRepairStore((s) => s.diagnosticSteps);
  const deviceId = useRepairStore((s) => s.deviceId);
  const procedureId = useRepairStore((s) => s.procedureId);
  const steps = rawSteps.map((s) => resolveStep({ deviceId, procedureId }, s));
  const removed = useRepairStore((s) => s.removedScrews);
  const toggleScrew = useRepairStore((s) => s.toggleScrew);
  const setScrews = useRepairStore((s) => s.setScrews);
  const completeCurrentStep = useRepairStore((s) => s.completeCurrentStep);
  const goToStep = useRepairStore((s) => s.goToStep);
  const [showSteps, setShowSteps] = useState(false);

  if (!step) return <p className="text-lg text-bench-muted">No active step.</p>;

  const groups = (step.screws ?? []).map((id) => device.screws[id]).filter(Boolean);
  const view = step.view ? device.views[step.view] : undefined;
  const keysOf = (g: ScrewGroup) => Array.from({ length: g.count }, (_, i) => screwKey(g.id, i));
  const allKeys = groups.flatMap(keysOf);
  const doneCount = allKeys.filter((k) => removed.includes(k)).length;
  const allDone = allKeys.length > 0 && doneCount === allKeys.length;
  const procedureScrews = steps.flatMap((s) => (s.screws ?? []).map((id) => device.screws[id]).filter(Boolean));
  const procedureTotal = procedureScrews.reduce((n, g) => n + g.count, 0);
  const procedureDone = procedureScrews.flatMap(keysOf).filter((k) => removed.includes(k)).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="font-mono text-base font-bold uppercase text-bench-accent">
          Step {stepIndex + 1}/{steps.length} · {procedure.title}
        </div>
        <h3 className="text-2xl font-black leading-tight">
          {step.title}
          {step.added && <span className="ml-2 align-middle rounded bg-bench-accent/20 px-2 py-0.5 font-mono text-sm text-bench-accent">added after a failed step</span>}
        </h3>
        {step.detail && <p className="text-lg text-bench-muted">{step.detail}</p>}
      </div>

      {view ? (
        <ViewDrawing view={view} groups={groups} removed={removed} onToggle={toggleScrew} />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-bench-border p-6 text-center text-lg text-bench-muted">
          No layout drawing for {device.id === "custom" ? "this device yet" : "this step"}.
        </div>
      )}

      {groups.length > 0 ? (
        <>
          <div className="flex items-center justify-between text-xl font-bold">
            <span>Screws this step</span>
            <span className={`font-mono tabular-nums ${allDone ? "text-bench-ok" : "text-bench-accent"}`}>
              {doneCount}/{allKeys.length}
            </span>
          </div>
          <ul className="space-y-2">
            {groups.map((g) => {
              const keys = keysOf(g);
              const n = keys.filter((k) => removed.includes(k)).length;
              const done = n === g.count;
              const color = COLORS[(step.screws ?? []).indexOf(g.id) % COLORS.length];
              return (
                <li key={g.id}>
                  <button
                    onClick={() => setScrews(keys, !done)}
                    aria-pressed={done}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                      done ? "border-bench-ok bg-bench-ok/10" : "border-bench-border bg-bench-raised hover:border-bench-accent"
                    }`}
                  >
                    <span className="size-6 shrink-0 rounded-full border-2 border-black/40" style={{ background: color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xl font-semibold">{g.label}</div>
                      <div className="font-mono text-base text-bench-muted">
                        {g.head} · {g.length}
                      </div>
                      {g.note && <div className="text-base text-bench-muted">{g.note}</div>}
                    </div>
                    <span className="text-right font-mono">
                      <span className="block text-2xl font-black">×{g.count}</span>
                      <span className="text-base text-bench-muted">
                        {n}/{g.count}
                      </span>
                    </span>
                    {done ? (
                      <CheckCircle2 className="size-8 shrink-0 text-bench-ok" aria-hidden />
                    ) : (
                      <CircleDashed className="size-8 shrink-0 text-bench-muted" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {allDone && stepIndex < steps.length - 1 && (
            <button
              onClick={() => completeCurrentStep("done")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-bench-ok text-xl font-black text-black"
            >
              <Check className="size-6" aria-hidden />
              All out: next step
            </button>
          )}
        </>
      ) : (
        <p className="text-lg text-bench-muted">No screws in this step.</p>
      )}

      <div>
        <button
          onClick={() => setShowSteps((v) => !v)}
          aria-expanded={showSteps}
          className="flex w-full items-center justify-between rounded-xl bg-bench-raised px-4 py-3 text-lg font-semibold"
        >
          <span>
            All steps · {procedureDone}/{procedureTotal} screws out
          </span>
          <ChevronDown className={`size-6 transition-transform ${showSteps ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {showSteps && (
          <ol className="mt-2 space-y-1">
            {steps.map((s, i) => {
              const count = (s.screws ?? []).reduce((n, id) => n + (device.screws[id]?.count ?? 0), 0);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => goToStep(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-lg ${
                      i === stepIndex ? "bg-bench-accent/15 text-bench-text" : "text-bench-muted hover:bg-bench-raised"
                    }`}
                  >
                    <span className="w-7 font-mono font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {s.added && <span className="rounded bg-bench-accent/20 px-1.5 font-mono text-sm text-bench-accent">added</span>}
                    {count > 0 && <span className="font-mono text-base">{count} screws</span>}
                    {s.status === "done" && <Check className="size-5 text-bench-ok" aria-label="done" />}
                    {s.status === "failed" && <X className="size-5 text-bench-fault" aria-label="failed" />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {device.sources.length > 0 && (
        <div className="space-y-1 rounded-xl border border-bench-border p-3 text-base text-bench-muted">
          <p className="flex gap-2">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
            Screw counts and lengths come from the guides below. Positions on the drawing are approximate: match screws by colour
            and length.
          </p>
          {device.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 pl-7 underline hover:text-bench-text">
              {s.label}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ShapeEl({ shape }: { shape: Shape }) {
  if (shape.kind === "text") {
    return (
      <text x={shape.x} y={shape.y} textAnchor="middle" fontSize={5} fill="#8b97a5">
        {shape.text}
      </text>
    );
  }
  const fill = FILL[shape.tone ?? "part"];
  const stroke = shape.tone === "hot" ? "#f5a524" : "#3a4652";
  if (shape.kind === "circle") {
    return (
      <g>
        <circle cx={shape.x} cy={shape.y} r={shape.r} fill={fill} stroke={stroke} strokeWidth={0.8} />
        {shape.label && (
          <text x={shape.x} y={shape.y + 1.8} textAnchor="middle" fontSize={5} fill="#8b97a5">
            {shape.label}
          </text>
        )}
      </g>
    );
  }
  return (
    <g>
      <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.tone === "body" ? 5 : 1.5} fill={fill} stroke={stroke} strokeWidth={0.8} />
      {shape.label && (
        <text x={shape.x + shape.w / 2} y={shape.y + shape.h / 2 + 1.8} textAnchor="middle" fontSize={shape.h < 12 ? 4 : 5} fill="#8b97a5">
          {shape.label}
        </text>
      )}
    </g>
  );
}

function ViewDrawing({
  view,
  groups,
  removed,
  onToggle,
}: {
  view: DeviceView;
  groups: ScrewGroup[];
  removed: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <figure className="space-y-2">
      <div className="mx-auto max-w-sm rounded-2xl border-2 border-bench-border bg-bench-bg p-2">
        <svg viewBox={VIEW_BOX} role="img" aria-label={`${view.title} layout with screw positions`} className="block w-full">
          {view.shapes.map((s, i) => (
            <ShapeEl key={i} shape={s} />
          ))}
          {groups.map((g, gi) =>
            g.positions.slice(0, g.count).map(([x, y], i) => {
              const key = screwKey(g.id, i);
              const out = removed.includes(key);
              const color = COLORS[gi % COLORS.length];
              return (
                <g
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${g.label} ${g.length} screw ${i + 1}${out ? ", removed" : ""}`}
                  onClick={() => onToggle(key)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle(key)}
                  className="cursor-pointer focus:outline-none"
                >
                  <circle cx={x} cy={y} r={4.5} fill="transparent" />
                  <circle cx={x} cy={y} r={2.6} fill={out ? "transparent" : color} stroke={color} strokeWidth={out ? 0.9 : 0.6} opacity={out ? 0.45 : 1} />
                  {out && <path d={`M${x - 1.4} ${y} l1 1 l1.9 -2`} stroke={color} strokeWidth={0.8} fill="none" opacity={0.7} />}
                </g>
              );
            }),
          )}
        </svg>
      </div>
      <figcaption className="text-center text-base text-bench-muted">
        <span className="font-semibold text-bench-text">{view.title}.</span> {view.caption} Tap a screw to mark it removed.
      </figcaption>
    </figure>
  );
}
