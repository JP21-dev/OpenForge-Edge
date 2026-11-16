"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, FileImage, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useRepairStore } from "@/store/useRepairStore";
import { api, type SchematicSummary } from "@/lib/api";
import { IfixitPull } from "@/components/IfixitPull";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,image/bmp,image/tiff,.heic,.heif";

export function IngestPanel() {
  const [items, setItems] = useState<SchematicSummary[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    api
      .listSchematics()
      .then((list) => {
        setItems(list);
        setError("");
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(refresh, [refresh]);

  const busy = items.some((s) => s.status === "queued" || s.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8" aria-label="Schematic ingest">
      <div className="mx-auto max-w-4xl space-y-8">
        <UploadForm onUploaded={refresh} />
        <IfixitPull />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold uppercase tracking-wider text-bench-muted">Library</h2>
            <button onClick={refresh} className="flex h-11 items-center gap-2 rounded-lg px-3 text-lg text-bench-muted hover:bg-bench-raised">
              <RefreshCw className="size-5" aria-hidden />
              Refresh
            </button>
          </div>
          {error && <p className="text-lg text-bench-fault">{error}</p>}
          {!items.length && !error && <p className="text-lg text-bench-muted">No schematics uploaded yet.</p>}
          <ul className="space-y-3">
            {items.map((s) => (
              <SchematicRow key={s.id} item={s} onChange={refresh} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const [title, setTitle] = useState("");
  const [device, setDevice] = useState(deviceModel);
  const [rev, setRev] = useState(boardRevision);
  const [dense, setDense] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDevice(deviceModel), [deviceModel]);
  useEffect(() => setRev(boardRevision), [boardRevision]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked]);
    if (!title && picked[0]) setTitle(picked[0].name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const submit = async () => {
    if (!files.length || !title.trim() || !device.trim()) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    form.append("title", title.trim());
    form.append("device_model", device.trim());
    form.append("board_revision", rev.trim());
    form.append("dense", String(dense));
    try {
      await api.uploadSchematic(form);
      setFiles([]);
      setTitle("");
      onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const field =
    "h-14 w-full rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4 rounded-2xl border-2 border-bench-border bg-bench-panel p-5"
      aria-label="Upload schematics"
    >
      <h2 className="text-2xl font-black">Upload schematics or photos</h2>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center text-xl ${
          dragging ? "border-bench-accent bg-bench-accent/10" : "border-bench-border bg-bench-bg hover:border-bench-accent"
        }`}
      >
        <UploadCloud className="size-12 text-bench-accent" aria-hidden />
        <span className="font-bold">Drop PDFs or photos here, or tap to choose</span>
        <span className="text-lg text-bench-muted">Several photos become pages of one schematic, in the order you add them.</span>
      </button>
      <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => addFiles(e.target.files)} />

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl bg-bench-raised px-4 py-2 text-lg">
              <FileImage className="size-5 shrink-0 text-bench-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="font-mono text-bench-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.name}`}
                className="grid size-10 place-items-center rounded-lg text-bench-muted hover:text-bench-fault"
              >
                <Trash2 className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block space-y-2 md:col-span-3">
          <span className="text-lg font-semibold text-bench-muted">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PS5 main board power section" className={field} />
        </label>
        <label className="block space-y-2 md:col-span-2">
          <span className="text-lg font-semibold text-bench-muted">Device</span>
          <input value={device} onChange={(e) => setDevice(e.target.value)} className={field} />
        </label>
        <label className="block space-y-2">
          <span className="text-lg font-semibold text-bench-muted">Board revision</span>
          <input value={rev} onChange={(e) => setRev(e.target.value.toUpperCase())} placeholder="All revisions" className={`${field} font-mono`} />
        </label>
      </div>

      <label className="flex items-start gap-3 text-lg">
        <input type="checkbox" checked={dense} onChange={(e) => setDense(e.target.checked)} className="mt-1 size-6 accent-[var(--color-bench-accent)]" />
        <span>
          <span className="font-semibold">Dense sheet</span>
          <span className="block text-bench-muted">Reads each page in four quarters to catch small text. About four times slower.</span>
        </span>
      </label>

      {error && <p className="text-lg text-bench-fault">{error}</p>}
      <button
        type="submit"
        disabled={uploading || !files.length || !title.trim() || !device.trim()}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-bench-accent text-2xl font-black text-white disabled:opacity-30"
      >
        {uploading ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <UploadCloud className="size-7" aria-hidden />}
        {uploading ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}

const STATUS: Record<SchematicSummary["status"], { label: string; tone: string }> = {
  queued: { label: "Queued", tone: "text-bench-muted" },
  processing: { label: "Reading", tone: "text-bench-accent" },
  done: { label: "Ready", tone: "text-bench-ok" },
  error: { label: "Some pages failed", tone: "text-bench-fault" },
};

function SchematicRow({ item, onChange }: { item: SchematicSummary; onChange: () => void }) {
  const openViewer = useRepairStore((s) => s.openViewer);
  const appMode = useRepairStore((s) => s.appMode);
  const st = STATUS[item.status];
  const pct = item.page_count ? Math.round(((item.pages_done + item.pages_failed) / item.page_count) * 100) : 0;
  const working = item.status === "queued" || item.status === "processing";

  const remove = async () => {
    if (!confirm(`Delete "${item.title}" and its ${item.page_count} pages from the knowledge base?`)) return;
    await api.deleteSchematic(item.id).catch(() => undefined);
    onChange();
  };

  return (
    <li className="space-y-3 rounded-2xl border-2 border-bench-border bg-bench-raised p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{item.title}</div>
          <div className="font-mono text-base text-bench-muted">
            {item.device_model} · {item.board_rev ?? "all revisions"} · {item.page_count} page{item.page_count === 1 ? "" : "s"}
            {item.dense && " · dense"}
          </div>
        </div>
        <span className={`flex shrink-0 items-center gap-2 text-lg font-bold ${st.tone}`}>
          {working && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {item.status === "done" && <CheckCircle2 className="size-5" aria-hidden />}
          {item.status === "error" && <AlertTriangle className="size-5" aria-hidden />}
          {st.label}
        </span>
      </div>

      {working && (
        <>
          <div className="h-3 overflow-hidden rounded-full bg-bench-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-bench-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-base text-bench-muted">
            {item.pages_done}/{item.page_count} pages read
            {appMode !== "ingest" && " · paused until you switch to Ingest mode"}
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => openViewer(item.id, 1)}
          className="flex h-12 items-center gap-2 rounded-xl border-2 border-bench-border px-4 text-lg font-semibold hover:border-bench-accent"
        >
          <Eye className="size-5" aria-hidden />
          View and check
        </button>
        {item.pages_failed > 0 && (
          <button
            onClick={() => api.retrySchematic(item.id).then(onChange).catch(() => undefined)}
            className="flex h-12 items-center gap-2 rounded-xl border-2 border-bench-border px-4 text-lg font-semibold hover:border-bench-accent"
          >
            <RefreshCw className="size-5" aria-hidden />
            Retry {item.pages_failed} failed
          </button>
        )}
        <button
          onClick={remove}
          className="ml-auto flex h-12 items-center gap-2 rounded-xl px-4 text-lg font-semibold text-bench-muted hover:bg-bench-border hover:text-bench-fault"
        >
          <Trash2 className="size-5" aria-hidden />
          Delete
        </button>
      </div>
    </li>
  );
}
