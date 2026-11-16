"use client";

import { useState } from "react";
import { BookOpen, CircleDot, Database, Ruler, X } from "lucide-react";
import { useRepairStore } from "@/store/useRepairStore";
import { IfixitPull } from "@/components/IfixitPull";

export function CoverageBanner() {
  const coverage = useRepairStore((s) => s.coverage);
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const setMainView = useRepairStore((s) => s.setMainView);
  const setHudTab = useRepairStore((s) => s.setHudTab);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showPull, setShowPull] = useState(false);

  const key = `${deviceModel}|${boardRevision}`;
  if (!coverage || coverage.level === "ok" || dismissed === key) return null;

  const c = coverage.counts;
  const none = coverage.level === "none";

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-bench-accent/50 bg-bench-accent/[0.07] px-4 py-3" role="status">
      <div className="flex items-center gap-3">
        <Database className="size-5 shrink-0 text-bench-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-base">
          <span className="font-semibold">{none ? "No saved data yet" : "Little saved data"}</span>
          <span className="text-bench-muted">
            {" "}
            · {c.reference_values}/{coverage.targets.reference_values} known-good values · {c.repairs}/{coverage.targets.repairs} repairs
          </span>
        </p>
        <button
          onClick={() => setMainView("capture")}
          className="hidden h-10 shrink-0 items-center gap-2 rounded-lg bg-bench-accent px-3 text-base font-bold text-white sm:flex"
        >
          Capture values
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="h-10 shrink-0 rounded-lg px-3 text-base font-semibold text-bench-muted hover:bg-bench-raised hover:text-bench-text"
        >
          {expanded ? "Less" : "Details"}
        </button>
        <button onClick={() => setDismissed(key)} aria-label="Hide for now" className="grid size-10 shrink-0 place-items-center rounded-lg text-bench-muted hover:bg-bench-raised">
          <X className="size-5" />
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-bench-border pt-3 pl-8">
          <p className="text-base text-bench-muted">
            {c.known_good_boards} good boards measured · {c.schematics} schematics
            {c.placeholders > 0 && ` · ${c.placeholders} placeholder value${c.placeholders === 1 ? "" : "s"} (typical values, replaced by your first captures)`}
          </p>
          <ul className="list-inside list-disc text-base text-bench-muted">
            <li>On a working board, capture known-good values from the checklist.</li>
            <li>Tick &quot;Board is known-good&quot; when logging a reading from a working board.</li>
            <li>Finish the repair with the flag button so the fix is saved to history.</li>
          </ul>
          <p className="flex items-center gap-2 text-sm font-semibold text-bench-ok">
            <CircleDot className="size-4" aria-hidden />
            Recording: readings, captures and finished repairs are saved on this machine.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => setMainView("capture")}
              className="flex h-12 items-center gap-2 rounded-xl bg-bench-accent px-4 text-lg font-bold text-white"
            >
              <Database className="size-5" aria-hidden />
              Capture known-good values
            </button>
            {c.knowledge_chunks === 0 && (
              <button
                onClick={() => setShowPull((v) => !v)}
                className="flex h-12 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border"
              >
                <BookOpen className="size-5" aria-hidden />
                Pull public guides
              </button>
            )}
            <button
              onClick={() => setHudTab("reference")}
              className="flex h-12 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border"
            >
              <Ruler className="size-5" aria-hidden />
              Add a reference value
            </button>
          </div>
          {showPull && <IfixitPull compact onPulled={() => useRepairStore.getState().setCoverage({ ...coverage, counts: { ...c, knowledge_chunks: 1 } })} />}
        </div>
      )}
    </div>
  );
}

export function RecordingPill() {
  const coverage = useRepairStore((s) => s.coverage);
  const setMainView = useRepairStore((s) => s.setMainView);
  const low = coverage && coverage.level !== "ok";
  return (
    <button
      onClick={() => setMainView("capture")}
      title="Readings, known-good captures and finished repairs are saved to the local database on this machine. Click to capture known-good values."
      className={`flex h-11 shrink-0 items-center gap-2 rounded-full border-2 px-3 text-base font-bold ${
        low ? "border-bench-accent text-bench-accent" : "border-bench-ok/60 text-bench-ok"
      }`}
    >
      <CircleDot className="size-4 animate-pulse" aria-hidden />
      <span className="hidden sm:inline">Recording{low ? " · data needed" : ""}</span>
    </button>
  );
}
