"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CircleDot, FileUp, Loader2, Plus, SkipForward, Trash2 } from "lucide-react";
import { METER_UNITS, useRepairStore, type MeterMode } from "@/store/useRepairStore";
import { api, type CapturePlan, type CapturePoint } from "@/lib/api";
import { parseImport } from "@/lib/importPoints";
import { loadReferences } from "@/components/HudPanels";

const MODES: MeterMode[] = ["DCV", "ACV", "OHM", "DIODE", "CONT", "AMP"];
const field =
  "h-14 w-full rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none";

const pointId = (p: Pick<CapturePoint, "test_point" | "mode">) => `${p.test_point.toLowerCase()}|${p.mode}`;

function parseNumber(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function defaultLabel() {
  const d = new Date();
  return `Board ${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

export function CapturePanel() {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const setMainView = useRepairStore((s) => s.setMainView);
  const [boardLabel, setBoardLabel] = useState(defaultLabel);
  const [plan, setPlan] = useState<CapturePlan | null>(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const p = await api.capturePlan(deviceModel, boardRevision, boardLabel.trim());
      setPlan(p);
      setError("");
      return p;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [deviceModel, boardRevision, boardLabel]);

  useEffect(() => {
    refresh().then((p) => {
      const next = p?.points.find((x) => !x.captured_on_board);
      setCurrent(next ? pointId(next) : null);
    });
  }, [refresh]);

  const points = plan?.points ?? [];
  const point = points.find((p) => pointId(p) === current);
  const done = points.filter((p) => p.captured_on_board).length;

  const advance = (from: CapturePoint, list: CapturePoint[]) => {
    const i = list.findIndex((p) => pointId(p) === pointId(from));
    const next = [...list.slice(i + 1), ...list.slice(0, i)].find((p) => !p.captured_on_board);
    setCurrent(next ? pointId(next) : null);
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = async () => {
    const v = parseNumber(value);
    if (!point || v === null || !boardLabel.trim()) return;
    setSaving(true);
    try {
      const res = await api.addCaptureSample({
        device_model: deviceModel,
        board_revision: boardRevision,
        board_label: boardLabel.trim(),
        test_point: point.test_point,
        mode: point.mode,
        value: v,
      });
      const range = `${res.reference.expected_min}–${res.reference.expected_max} ${point.unit}`;
      setNotice(
        res.outside_reference
          ? {
              tone: "warn",
              text: `Saved, but ${v} ${point.unit} is outside the reference range ${range}. Is this board definitely good? Re-enter the value to overwrite it.`,
            }
          : {
              tone: "ok",
              text: `Saved ${point.test_point}: ${v} ${point.unit}. Known-good on ${res.measured.boards} board${res.measured.boards === 1 ? "" : "s"}, reference ${range}.`,
            },
      );
      const p = await refresh();
      loadReferences();
      if (p) advance(point, p.points);
    } catch (err) {
      setNotice({ tone: "warn", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8" aria-label="Known-good capture">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setMainView("chat")}
            className="flex h-12 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Back to chat
          </button>
          <h2 className="text-2xl font-black">Capture known-good values</h2>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border-2 border-bench-ok/60 bg-bench-ok/10 p-4 text-lg" role="status">
          <CircleDot className="mt-1 size-5 shrink-0 animate-pulse text-bench-ok" aria-hidden />
          <p>
            <span className="font-bold text-bench-ok">Recording.</span> Every value you save here goes into the local known-good
            database for <span className="font-semibold">{deviceModel}</span>{" "}
            <span className="font-mono">{boardRevision || "(all revisions)"}</span>. Values from several boards are combined into
            the reference range the copilot and the meter use. Only capture on a board you know works.
          </p>
        </div>

        {!boardRevision && (
          <p className="flex items-center gap-2 text-lg text-bench-accent">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            No board revision set. Set it in the header so values are filed under the right board.
          </p>
        )}

        <label className="block space-y-2">
          <span className="text-lg font-semibold text-bench-muted">This board (serial number or label)</span>
          <input value={boardLabel} onChange={(e) => setBoardLabel(e.target.value)} className={field} />
        </label>

        {error && <p className="text-lg text-bench-fault">{error}</p>}
        {plan === null && !error && <Loader2 className="size-8 animate-spin text-bench-accent" aria-label="Loading" />}

        {plan && (
          <>
            <div className="flex items-center justify-between text-xl font-bold">
              <span>Checklist</span>
              <span className="font-mono text-bench-accent">
                {done}/{points.length} on this board
              </span>
            </div>

            {point ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
                className="space-y-4 rounded-2xl border-2 border-bench-accent bg-bench-raised p-5"
              >
                <div>
                  <div className="font-mono text-base font-bold uppercase text-bench-accent">
                    {point.mode} · {point.origin}
                  </div>
                  <div className="text-3xl font-black">{point.test_point}</div>
                  {point.hint && <p className="text-lg text-bench-muted">{point.hint}</p>}
                  <p className="mt-1 font-mono text-base text-bench-muted">
                    {point.reference ? `Reference ${point.reference.min}–${point.reference.max} ${point.unit} (${point.reference.source})` : "No reference yet"}
                    {point.measured && ` · measured on ${point.measured.boards} board${point.measured.boards === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.000"
                    aria-label={`Reading for ${point.test_point}`}
                    className={`${field} h-16 font-mono text-4xl font-bold tabular-nums`}
                  />
                  <span className="w-12 font-mono text-3xl text-bench-muted">{point.unit}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving || parseNumber(value) === null || !boardLabel.trim()}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-bench-accent text-xl font-black text-white disabled:opacity-30"
                  >
                    {saving ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Check className="size-6" aria-hidden />}
                    Save and next
                  </button>
                  <button
                    type="button"
                    onClick={() => advance(point, points)}
                    className="flex h-14 items-center gap-2 rounded-xl bg-bench-bg px-5 text-lg font-semibold text-bench-muted"
                  >
                    <SkipForward className="size-5" aria-hidden />
                    Skip
                  </button>
                </div>
              </form>
            ) : (
              <p className="rounded-2xl border-2 border-bench-ok/60 p-5 text-xl font-semibold text-bench-ok">
                Every test point on the list is captured for this board. Add more points, or change the board label to start the next board.
              </p>
            )}

            {notice && (
              <p
                className={`flex items-start gap-2 rounded-xl p-3 text-lg ${notice.tone === "ok" ? "bg-bench-ok/10 text-bench-ok" : "bg-bench-fault/10 text-bench-fault"}`}
                role="status"
              >
                {notice.tone === "ok" ? <Check className="mt-1 size-5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-1 size-5 shrink-0" aria-hidden />}
                {notice.text}
              </p>
            )}

            <ul className="space-y-2">
              {points.map((p) => (
                <li key={pointId(p)} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrent(pointId(p));
                      setValue("");
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border-2 p-3 text-left ${
                      pointId(p) === current ? "border-bench-accent bg-bench-accent/10" : "border-bench-border bg-bench-raised hover:border-bench-accent"
                    }`}
                  >
                    {p.captured_on_board ? (
                      <Check className="size-6 shrink-0 text-bench-ok" aria-label="captured on this board" />
                    ) : (
                      <span className="size-6 shrink-0 rounded-full border-2 border-bench-border" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{p.test_point}</span>
                      <span className="block truncate font-mono text-sm text-bench-muted">
                        {p.mode} · {p.origin}
                        {p.measured && ` · ${p.measured.boards} board${p.measured.boards === 1 ? "" : "s"}, ${p.measured.min}–${p.measured.max} ${p.unit}`}
                      </span>
                    </span>
                  </button>
                  {p.id && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove ${p.test_point} from the checklist? Captured values are kept.`)) return;
                        await api.deleteCapturePoint(p.id!).catch(() => undefined);
                        refresh();
                      }}
                      aria-label={`Remove ${p.test_point} from the checklist`}
                      className="grid size-12 shrink-0 place-items-center rounded-xl text-bench-muted hover:bg-bench-border hover:text-bench-fault"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {adding ? (
              <AddPointForm
                onDone={async (added) => {
                  setAdding(false);
                  const p = await refresh();
                  if (added && p) {
                    const match = p.points.find((x) => pointId(x) === pointId(added));
                    if (match) setCurrent(pointId(match));
                  }
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdding(true)}
                  className="flex h-14 items-center gap-2 rounded-xl border-2 border-bench-border px-5 text-lg font-semibold hover:border-bench-accent"
                >
                  <Plus className="size-5" aria-hidden />
                  Add test point
                </button>
                <ImportButton onImported={refresh} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function AddPointForm({ onDone }: { onDone: (added?: { test_point: string; mode: MeterMode }) => void }) {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const [testPoint, setTestPoint] = useState("");
  const [mode, setMode] = useState<MeterMode>("DCV");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    if (!testPoint.trim()) return;
    try {
      await api.addCapturePoint({ device_model: deviceModel, board_revision: boardRevision, test_point: testPoint.trim(), mode, hint, source: "Added at the bench" });
      onDone({ test_point: testPoint.trim(), mode });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-3 rounded-2xl border-2 border-bench-accent bg-bench-raised p-4"
    >
      <input autoFocus value={testPoint} onChange={(e) => setTestPoint(e.target.value)} placeholder="Test point, e.g. PP3V3_S5 at C7120" className={field} />
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Meter mode">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`h-12 rounded-xl font-mono text-base font-bold ${mode === m ? "bg-bench-accent text-white" : "bg-bench-bg text-bench-muted"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Where and how to measure (optional)" className={field} />
      {error && <p className="text-lg text-bench-fault">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!testPoint.trim()} className="h-14 flex-1 rounded-xl bg-bench-accent text-xl font-black text-white disabled:opacity-30">
          Add to checklist ({METER_UNITS[mode]})
        </button>
        <button type="button" onClick={() => onDone()} className="h-14 rounded-xl bg-bench-bg px-6 text-lg font-semibold text-bench-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ImportButton({ onImported }: { onImported: () => void }) {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("Boardview (private)");
  const [status, setStatus] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus("Reading…");
    try {
      const rows = parseImport(await file.text(), file.name);
      if (!rows.length) {
        setStatus("No rows found. The file needs a header row with at least a test_point column.");
        return;
      }
      const res = await api.importCapturePoints({ device_model: deviceModel, board_revision: boardRevision, source, rows });
      setStatus(`Imported ${res.added} new and ${res.updated} updated test points; ${res.reference_values} have expected values.`);
      loadReferences();
      onImported();
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-2 rounded-2xl border-2 border-dashed border-bench-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-14 items-center gap-2 rounded-xl bg-bench-raised px-5 text-lg font-semibold hover:bg-bench-border"
        >
          <FileUp className="size-5" aria-hidden />
          Import test points (CSV or JSON)
        </button>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Source label for imported values"
          className="h-14 min-w-0 flex-1 rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-lg focus:border-bench-accent focus:outline-none"
        />
      </div>
      <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.json,text/csv,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <p className="text-base text-bench-muted">
        Columns: <span className="font-mono">test_point, mode, expected</span> (or <span className="font-mono">min, max</span>),{" "}
        <span className="font-mono">hint</span>. Values only: no images are stored. Imported data stays in this bench&apos;s database
        and is never committed to git.
      </p>
      {status && <p className="text-lg">{status}</p>}
    </div>
  );
}
