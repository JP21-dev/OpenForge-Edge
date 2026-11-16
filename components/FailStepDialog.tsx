"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, ListPlus, Loader2, RefreshCw, X } from "lucide-react";
import { readingStatus, selectCurrentStep, selectProcedure, useRepairStore } from "@/store/useRepairStore";
import { failSuggestions, type StepSuggestion } from "@/lib/devices";
import { api, type SuggestedStep } from "@/lib/api";

interface Option extends StepSuggestion {
  key: string;
  origin: "built-in" | "copilot";
  why?: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function FailStepDialog({ onClose }: { onClose: () => void }) {
  const step = useRepairStore(selectCurrentStep);
  const procedure = useRepairStore(selectProcedure);
  const failCurrentStep = useRepairStore((s) => s.failCurrentStep);
  const appMode = useRepairStore((s) => s.appMode);

  const builtIn: Option[] = (step ? failSuggestions(step) : []).map((s, i) => ({ ...s, key: `b${i}`, origin: "built-in" }));
  const [note, setNote] = useState("");
  const [copilot, setCopilot] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string[]>(builtIn.length ? [builtIn[0].key] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [askedWith, setAskedWith] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (withNote: string) => {
      if (!step) return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const s = useRepairStore.getState();
      setLoading(true);
      setError("");
      setAskedWith(withNote);
      try {
        const res = await api.suggestSteps(
          {
            device_model: s.deviceModel,
            board_revision: s.boardRevision || undefined,
            procedure: selectProcedure(s).title,
            failed_step: { title: step.title, detail: step.detail ?? "" },
            note: withNote,
            completed_steps: s.diagnosticSteps.filter((x) => x.status === "done").map((x) => x.title),
            readings: s.readings.slice(0, 10).map((r) => ({
              test_point: r.testPoint,
              mode: r.mode,
              value: r.value,
              unit: r.unit,
              expected_min: r.expected?.min ?? null,
              expected_max: r.expected?.max ?? null,
              status: readingStatus(r),
            })),
          },
          controller.signal,
        );
        const options = res.steps
          .filter((x: SuggestedStep) => !builtIn.some((b) => same(b.title, x.title)))
          .map((x: SuggestedStep, i: number) => ({ title: x.title, detail: x.detail, why: x.why, key: `c${Date.now()}-${i}`, origin: "copilot" as const }));
        setCopilot(options);
        if (!options.length) setError("The copilot had no further suggestions.");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (abort.current === controller) setLoading(false);
      }
    },
    [step?.id],
  );

  useEffect(() => {
    if (appMode === "repair") ask("");
    return () => abort.current?.abort();
  }, [ask, appMode]);

  if (!step) return null;

  const all = [...builtIn, ...copilot];
  const chosen = all.filter((o) => selected.includes(o.key));
  const toggle = (key: string) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = (withSteps: boolean) => {
    abort.current?.abort();
    failCurrentStep(note, withSteps ? chosen.map(({ title, detail }) => ({ title, detail })) : []);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal aria-label="Step failed">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl border-2 border-bench-fault/60 bg-bench-panel">
        <div className="flex items-start gap-3 border-b-2 border-bench-border p-5">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-base font-bold uppercase text-bench-fault">Step failed · {procedure.title}</div>
            <h2 className="text-2xl font-black leading-tight">{step.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Cancel" className="grid size-12 shrink-0 place-items-center rounded-xl hover:bg-bench-raised">
            <X className="size-7" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <label className="block space-y-2">
            <span className="text-lg font-semibold text-bench-muted">What happened? (optional, sharpens the copilot&apos;s suggestions)</span>
            <div className="flex gap-2">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && note.trim() && ask(note)}
                placeholder="e.g. 12 V reads 0, fan twitches once"
                className="h-14 min-w-0 flex-1 rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none"
              />
              <button
                onClick={() => ask(note)}
                disabled={loading || appMode !== "repair" || askedWith === note}
                title="Ask the copilot again with this note"
                className="flex h-14 shrink-0 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border disabled:opacity-40"
              >
                <RefreshCw className="size-5" aria-hidden />
                Ask
              </button>
            </div>
          </label>

          {builtIn.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-lg font-bold uppercase tracking-wider text-bench-muted">Suggested for this step</h3>
              {builtIn.map((o) => (
                <OptionRow key={o.key} option={o} checked={selected.includes(o.key)} onToggle={() => toggle(o.key)} />
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-bench-muted">
              <Bot className="size-5 text-bench-accent" aria-hidden />
              From the copilot
            </h3>
            {appMode !== "repair" && <p className="text-lg text-bench-muted">Switch to Repair mode for copilot suggestions.</p>}
            {loading && (
              <p className="flex items-center gap-2 text-lg text-bench-muted" role="status">
                <Loader2 className="size-5 animate-spin text-bench-accent" aria-hidden />
                Checking the manuals, readings and past repairs…
              </p>
            )}
            {!loading && error && <p className="text-lg text-bench-muted">{error}</p>}
            {!loading &&
              copilot.map((o) => <OptionRow key={o.key} option={o} checked={selected.includes(o.key)} onToggle={() => toggle(o.key)} />)}
          </section>
        </div>

        <div className="flex flex-wrap gap-2 border-t-2 border-bench-border p-5">
          <button
            onClick={() => submit(true)}
            disabled={!chosen.length}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-bench-accent px-4 text-xl font-black text-black disabled:opacity-30"
          >
            <ListPlus className="size-6" aria-hidden />
            Add {chosen.length || ""} step{chosen.length === 1 ? "" : "s"} and continue
          </button>
          <button onClick={() => submit(false)} className="h-14 rounded-xl bg-bench-raised px-5 text-lg font-semibold text-bench-muted hover:text-bench-text">
            Mark failed only
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow({ option, checked, onToggle }: { option: Option; checked: boolean; onToggle: () => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
        checked ? "border-bench-accent bg-bench-accent/10" : "border-bench-border bg-bench-raised hover:border-bench-accent"
      }`}
    >
      <span
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border-2 ${
          checked ? "border-bench-accent bg-bench-accent text-black" : "border-bench-border"
        }`}
        aria-hidden
      >
        {checked && <Check className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-semibold">{option.title}</span>
        {option.detail && <span className="block text-lg text-bench-muted">{option.detail}</span>}
        {option.why && <span className="mt-1 block font-mono text-sm text-bench-muted">Based on: {option.why}</span>}
      </span>
    </button>
  );
}
