"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { readingStatus, useRepairStore } from "@/store/useRepairStore";
import { api, type RepairOutcome } from "@/lib/api";

const OUTCOMES: { id: RepairOutcome; label: string; tone: string }[] = [
  { id: "fixed", label: "Fixed", tone: "bg-bench-ok text-black" },
  { id: "not_fixed", label: "Not fixed", tone: "bg-bench-fault text-black" },
  { id: "parked", label: "Parked", tone: "bg-bench-accent text-black" },
];

export function FinishRepairDialog({ onClose, prompted = false }: { onClose: () => void; prompted?: boolean }) {
  const store = useRepairStore();
  const coverage = store.coverage;
  const firstQuestion = store.messages.find((m) => m.role === "technician")?.content ?? "";
  const [outcome, setOutcome] = useState<RepairOutcome>("fixed");
  const [symptom, setSymptom] = useState(firstQuestion.slice(0, 500));
  const [rootCause, setRootCause] = useState("");
  const [fix, setFix] = useState("");
  const [parts, setParts] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!symptom.trim()) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api.saveRepair({
        device_model: store.deviceModel,
        board_revision: store.boardRevision,
        symptom,
        outcome,
        root_cause: rootCause,
        fix,
        parts,
        readings: store.readings.slice(0, 50).map((r) => ({
          test_point: r.testPoint,
          mode: r.mode,
          value: r.value,
          unit: r.unit,
          expected_min: r.expected?.min ?? null,
          expected_max: r.expected?.max ?? null,
          status: readingStatus(r),
        })),
        steps: store.diagnosticSteps.map((s) => ({ title: s.title, status: s.status })),
        message_count: store.messages.filter((m) => m.role !== "system").length,
      });
      if (saved.patterns?.length) {
        alert(
          `Recurring pattern detected for ${store.deviceModel}:\n\n` +
            saved.patterns.map((p) => `${p.root_cause} (${p.count} repairs)`).join("\n") +
            "\n\nThe copilot will now suggest it on matching symptoms. Review it in the History tab.",
        );
      }
      store.resetSession();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border-2 border-bench-border bg-bench-bg px-4 py-3 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal aria-label="Finish repair">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="max-h-full w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border-2 border-bench-border bg-bench-panel p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">Finish repair</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-12 place-items-center rounded-xl hover:bg-bench-raised">
            <X className="size-7" />
          </button>
        </div>
        {prompted && (
          <p className="rounded-xl border-2 border-bench-accent/60 bg-bench-accent/10 p-3 text-lg">
            That was the last step. Save the outcome so the next {store.deviceModel} repair can learn from it
            {coverage ? ` (${coverage.counts.repairs} repair${coverage.counts.repairs === 1 ? "" : "s"} saved so far)` : ""}.
          </p>
        )}
        <p className="text-lg text-bench-muted">
          Saved to this bench&apos;s repair history for {store.deviceModel}
          {store.boardRevision && ` ${store.boardRevision}`}, with {store.readings.length} logged readings. The copilot
          brings up matching past repairs on later jobs.
        </p>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Outcome">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={outcome === o.id}
              onClick={() => setOutcome(o.id)}
              className={`h-14 rounded-xl text-xl font-bold ${outcome === o.id ? o.tone : "bg-bench-raised text-bench-muted"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="block space-y-2">
          <span className="text-lg font-semibold text-bench-muted">Symptom</span>
          <textarea value={symptom} onChange={(e) => setSymptom(e.target.value)} rows={2} required className={field} />
        </label>
        <label className="block space-y-2">
          <span className="text-lg font-semibold text-bench-muted">Root cause</span>
          <input value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="e.g. shorted capacitor on the 5 V rail" className={field} />
        </label>
        <label className="block space-y-2">
          <span className="text-lg font-semibold text-bench-muted">What fixed it</span>
          <textarea value={fix} onChange={(e) => setFix(e.target.value)} rows={2} className={field} />
        </label>
        <label className="block space-y-2">
          <span className="text-lg font-semibold text-bench-muted">Parts replaced</span>
          <input value={parts} onChange={(e) => setParts(e.target.value)} placeholder="Designators or part numbers" className={field} />
        </label>

        {error && <p className="text-lg text-bench-fault">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !symptom.trim()}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-bench-accent text-xl font-black text-black disabled:opacity-40"
          >
            {saving && <Loader2 className="size-6 animate-spin" aria-hidden />}
            Save and start a new session
          </button>
          <button type="button" onClick={onClose} className="h-14 rounded-xl bg-bench-raised px-6 text-xl font-semibold text-bench-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
