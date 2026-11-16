"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, CircleSlash, EyeOff, FileStack, Loader2, PauseCircle, Plus, Repeat, Trash2 } from "lucide-react";
import { METER_UNITS, useRepairStore, type MeterMode } from "@/store/useRepairStore";
import { api, type Pattern, type RepairRecord, type SchematicSummary } from "@/lib/api";

const MODES: MeterMode[] = ["DCV", "ACV", "OHM", "DIODE", "CONT", "AMP"];

const field =
  "h-14 w-full rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none";

export async function loadReferences() {
  const { deviceModel, boardRevision, setReferences } = useRepairStore.getState();
  try {
    setReferences(await api.listReference(deviceModel, boardRevision || undefined));
  } catch {
    setReferences([]);
  }
}

function parseNumber(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function ReferencePanel() {
  const references = useRepairStore((s) => s.references);
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const draft = useRepairStore((s) => s.referenceDraft);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (draft) setAdding(true);
  }, [draft]);

  const remove = async (id: string, label: string) => {
    if (!confirm(`Delete the reference value for ${label}?`)) return;
    await api.deleteReference(id).catch(() => undefined);
    loadReferences();
  };

  return (
    <div className="space-y-4">
      <p className="text-lg text-bench-muted">
        Known-good values for {deviceModel}
        {boardRevision ? ` ${boardRevision}` : " (all revisions)"}. The copilot trusts these over the manuals, and new readings
        are checked against them automatically.
      </p>

      {adding ? (
        <ReferenceForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-bench-accent text-2xl font-black text-black"
        >
          <Plus className="size-8" aria-hidden />
          Add reference value
        </button>
      )}

      {!references.length && <p className="text-lg text-bench-muted">No reference values for this board yet.</p>}
      <ul className="space-y-3">
        {references.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-xl border-l-8 border-bench-ok bg-bench-raised p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xl font-semibold">{r.test_point}</span>
                <span className="shrink-0 font-mono text-xl font-bold tabular-nums">
                  {r.expected_min}–{r.expected_max} {r.unit}
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-base text-bench-muted" title={r.note || r.source}>
                {r.mode} · {r.board_rev ?? "all revisions"}
                {r.source && ` · ${r.source}`}
              </div>
            </div>
            <button
              onClick={() => remove(r.id, r.test_point)}
              aria-label={`Delete reference for ${r.test_point}`}
              className="grid size-12 shrink-0 place-items-center rounded-xl text-bench-muted hover:bg-bench-border hover:text-bench-fault"
            >
              <Trash2 className="size-6" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReferenceForm({ onDone }: { onDone: () => void }) {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const draft = useRepairStore((s) => s.referenceDraft);
  const setReferenceDraft = useRepairStore((s) => s.setReferenceDraft);
  const [testPoint, setTestPoint] = useState(draft?.testPoint ?? "");
  const [mode, setMode] = useState<MeterMode>(draft?.mode ?? "DCV");
  const [min, setMin] = useState(draft ? String(draft.min) : "");
  const [max, setMax] = useState(draft ? String(draft.max) : "");
  const [source, setSource] = useState(draft?.source ?? "");
  const [note, setNote] = useState("");
  const [allRevisions, setAllRevisions] = useState(!boardRevision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lo = parseNumber(min);
  const hi = parseNumber(max);
  const canSave = testPoint.trim() !== "" && lo !== null && hi !== null;

  const close = () => {
    setReferenceDraft(null);
    onDone();
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await api.addReference({
        device_model: deviceModel,
        board_revision: allRevisions ? "" : boardRevision,
        test_point: testPoint.trim(),
        mode,
        unit: METER_UNITS[mode],
        expected_min: lo,
        expected_max: hi,
        source,
        note,
      });
      await loadReferences();
      close();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4 rounded-2xl border-2 border-bench-accent bg-bench-raised p-4"
      aria-label="Add a known-good reference value"
    >
      <label className="block space-y-2">
        <span className="text-lg font-semibold text-bench-muted">Test point</span>
        <input autoFocus value={testPoint} onChange={(e) => setTestPoint(e.target.value)} placeholder="e.g. PP5V0_STBY at C7010" className={field} />
      </label>

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

      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold text-bench-muted">Good range ({METER_UNITS[mode]})</legend>
        <div className="flex items-center gap-2">
          <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="min" aria-label="Minimum" className={`${field} font-mono`} />
          <span className="text-xl text-bench-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="max" aria-label="Maximum" className={`${field} font-mono`} />
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-lg font-semibold text-bench-muted">Where it came from</span>
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Schematic p.7, or measured on a good board" className={field} />
      </label>
      <label className="block space-y-2">
        <span className="text-lg font-semibold text-bench-muted">Note</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Measure with the board in standby" className={field} />
      </label>

      {boardRevision && (
        <label className="flex items-center gap-3 text-lg">
          <input type="checkbox" checked={allRevisions} onChange={(e) => setAllRevisions(e.target.checked)} className="size-6" />
          Applies to all revisions, not only {boardRevision}
        </label>
      )}

      {error && <p className="text-lg text-bench-fault">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSave || saving}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-bench-accent text-xl font-black text-black disabled:opacity-30"
        >
          {saving && <Loader2 className="size-6 animate-spin" aria-hidden />}
          Save
        </button>
        <button type="button" onClick={close} className="h-14 rounded-xl bg-bench-bg px-6 text-xl font-semibold text-bench-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function SchematicsPanel() {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const openViewer = useRepairStore((s) => s.openViewer);
  const [items, setItems] = useState<SchematicSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(null);
    api
      .listSchematics(deviceModel, boardRevision || undefined)
      .then(setItems)
      .catch((err) => setError((err as Error).message));
  }, [deviceModel, boardRevision]);

  return (
    <div className="space-y-4">
      <p className="text-lg text-bench-muted">
        Schematics for {deviceModel}
        {boardRevision ? ` ${boardRevision} and all-revision sheets` : ""}. Upload more in Ingest mode.
      </p>
      {error && <p className="text-lg text-bench-fault">{error}</p>}
      {items === null && !error && <Loader2 className="size-8 animate-spin text-bench-accent" aria-label="Loading" />}
      {items?.length === 0 && <p className="text-lg text-bench-muted">No schematics for this board yet.</p>}
      <ul className="space-y-3">
        {items?.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => openViewer(s.id, 1)}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-bench-border bg-bench-raised p-4 text-left hover:border-bench-accent"
            >
              <FileStack className="size-9 shrink-0 text-bench-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-semibold">{s.title}</div>
                <div className="font-mono text-base text-bench-muted">
                  {s.board_rev ?? "all revisions"} · {s.pages_done}/{s.page_count} pages read
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const OUTCOME_STYLE = {
  fixed: { icon: CheckCircle2, tone: "text-bench-ok border-bench-ok", label: "Fixed" },
  not_fixed: { icon: CircleSlash, tone: "text-bench-fault border-bench-fault", label: "Not fixed" },
  parked: { icon: PauseCircle, tone: "text-bench-accent border-bench-accent", label: "Parked" },
} as const;

export function HistoryPanel() {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const [items, setItems] = useState<RepairRecord[] | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    api
      .listRepairs(deviceModel)
      .then(setItems)
      .catch((err) => setError((err as Error).message));
  }, [deviceModel]);

  useEffect(refresh, [refresh]);

  const remove = async (r: RepairRecord) => {
    if (!confirm(`Delete the repair record "${r.symptom.slice(0, 60)}"?`)) return;
    await api.deleteRepair(r.id).catch(() => undefined);
    refresh();
  };

  return (
    <div className="space-y-4">
      <PatternList />
      <p className="text-lg text-bench-muted">
        Past {deviceModel} repairs on this bench. Use the flag button in the header to save the current job here.
      </p>
      {error && <p className="text-lg text-bench-fault">{error}</p>}
      {items === null && !error && <Loader2 className="size-8 animate-spin text-bench-accent" aria-label="Loading" />}
      {items?.length === 0 && <p className="text-lg text-bench-muted">No repairs saved yet.</p>}
      <ul className="space-y-3">
        {items?.map((r) => {
          const st = OUTCOME_STYLE[r.outcome];
          return (
            <li key={r.id} className={`space-y-1 rounded-xl border-l-8 bg-bench-raised p-4 ${st.tone.split(" ")[1]}`}>
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-xl font-semibold">{r.symptom}</span>
                <button
                  onClick={() => remove(r)}
                  aria-label="Delete repair record"
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-bench-muted hover:text-bench-fault"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
              <div className={`flex items-center gap-2 font-mono text-base ${st.tone.split(" ")[0]}`}>
                <st.icon className="size-5" aria-hidden />
                {st.label} · {r.created_at.slice(0, 10)} · {r.board_rev ?? "rev not set"}
              </div>
              {r.root_cause && <p className="text-lg">Cause: {r.root_cause}</p>}
              {r.fix && <p className="text-lg text-bench-muted">Fix: {r.fix}</p>}
              {r.parts && <p className="font-mono text-base text-bench-muted">Parts: {r.parts}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const PATTERN_TONE = {
  verified: "border-bench-ok",
  auto: "border-bench-accent",
  dismissed: "border-bench-border opacity-60",
} as const;

function PatternList() {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const [items, setItems] = useState<Pattern[]>([]);

  const refresh = useCallback(() => {
    api.listPatterns(deviceModel).then(setItems).catch(() => setItems([]));
  }, [deviceModel]);

  useEffect(refresh, [refresh]);

  const setStatus = async (p: Pattern, status: Pattern["status"]) => {
    await api.setPatternStatus(p.id, status).catch(() => undefined);
    refresh();
  };

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-bench-muted">
        <Repeat className="size-5 text-bench-accent" aria-hidden />
        Recurring patterns
      </h3>
      {!items.length && (
        <p className="text-base text-bench-muted">
          None yet. When 3 or more fixed repairs share a similar symptom and root cause, they are promoted to a pattern automatically and the
          copilot starts suggesting it.
        </p>
      )}
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className={`space-y-1 rounded-xl border-l-8 bg-bench-raised p-4 ${PATTERN_TONE[p.status]}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-semibold">{p.root_cause}</span>
              <span className="shrink-0 font-mono text-base text-bench-accent">{p.count} repairs</span>
            </div>
            <p className="text-lg text-bench-muted">Symptom: {p.symptom}</p>
            {p.fix && <p className="text-lg text-bench-muted">Fix: {p.fix}</p>}
            <p className="font-mono text-sm text-bench-muted">
              {p.status === "verified" ? "verified" : p.status === "dismissed" ? "dismissed: not suggested" : "auto-detected"} · last{" "}
              {p.last_seen.slice(0, 10)}
              {p.revisions.filter((r) => r !== "any").length > 0 && ` · ${p.revisions.filter((r) => r !== "any").join(", ")}`}
            </p>
            <div className="flex gap-2 pt-1">
              {p.status !== "verified" && (
                <button onClick={() => setStatus(p, "verified")} className="flex h-10 items-center gap-1 rounded-lg bg-bench-bg px-3 text-base font-semibold text-bench-ok">
                  <BadgeCheck className="size-5" aria-hidden />
                  Verify
                </button>
              )}
              {p.status !== "dismissed" ? (
                <button onClick={() => setStatus(p, "dismissed")} className="flex h-10 items-center gap-1 rounded-lg bg-bench-bg px-3 text-base font-semibold text-bench-muted">
                  <EyeOff className="size-5" aria-hidden />
                  Dismiss
                </button>
              ) : (
                <button onClick={() => setStatus(p, "auto")} className="flex h-10 items-center gap-1 rounded-lg bg-bench-bg px-3 text-base font-semibold text-bench-muted">
                  Restore
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
