"use client";

import { useState } from "react";
import { CircleDot, Database, Ruler, X } from "lucide-react";
import { useRepairStore } from "@/store/useRepairStore";

export function CoverageBanner() {
  const coverage = useRepairStore((s) => s.coverage);
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const setMainView = useRepairStore((s) => s.setMainView);
  const setHudTab = useRepairStore((s) => s.setHudTab);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const key = `${deviceModel}|${boardRevision}`;
  if (!coverage || coverage.level === "ok" || dismissed === key) return null;

  const c = coverage.counts;
  const none = coverage.level === "none";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border-2 border-bench-accent/70 bg-bench-accent/10 p-4" role="status">
      <div className="flex items-start gap-3">
        <Database className="mt-1 size-6 shrink-0 text-bench-accent" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xl font-bold">
            {none ? `No saved data for ${deviceModel} yet.` : `Little saved data for ${deviceModel}${boardRevision ? ` ${boardRevision}` : ""}.`}
          </p>
          <p className="text-lg">
            {c.reference_values}/{coverage.targets.reference_values} known-good values · {c.known_good_boards} good boards measured ·{" "}
            {c.repairs}/{coverage.targets.repairs} repairs · {c.schematics} schematics. Help build it while you work:
          </p>
          <ul className="list-inside list-disc text-lg text-bench-muted">
            <li>On a working board, capture known-good values from the checklist.</li>
            <li>Tick &quot;Board is known-good&quot; when logging a reading from a working board.</li>
            <li>Finish the repair with the flag button so the fix is saved to history.</li>
          </ul>
          <p className="flex items-center gap-2 text-base font-semibold text-bench-ok">
            <CircleDot className="size-4 animate-pulse" aria-hidden />
            Recording: readings, captures and finished repairs are saved to the database on this machine.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => setMainView("capture")}
              className="flex h-12 items-center gap-2 rounded-xl bg-bench-accent px-4 text-lg font-bold text-black"
            >
              <Database className="size-5" aria-hidden />
              Capture known-good values
            </button>
            <button
              onClick={() => setHudTab("reference")}
              className="flex h-12 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border"
            >
              <Ruler className="size-5" aria-hidden />
              Add a reference value
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(key)} aria-label="Hide for now" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-bench-raised">
          <X className="size-6" />
        </button>
      </div>
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
