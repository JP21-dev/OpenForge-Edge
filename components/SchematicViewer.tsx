"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2, Maximize, Minus, Plus, RefreshCw, Save, X } from "lucide-react";
import { useRepairStore } from "@/store/useRepairStore";
import { api, type SchematicDetail } from "@/lib/api";

const ZOOMS = [1, 1.5, 2, 3, 4];

export function SchematicViewer() {
  const viewer = useRepairStore((s) => s.viewer);
  const closeViewer = useRepairStore((s) => s.closeViewer);
  const setViewerPage = useRepairStore((s) => s.setViewerPage);
  const setActiveSchematic = useRepairStore((s) => s.setActiveSchematic);
  const [doc, setDoc] = useState<SchematicDetail | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(0);
  const [showText, setShowText] = useState(false);

  const id = viewer?.schematicId;
  const load = useCallback(() => {
    if (!id) return;
    api
      .getSchematic(id)
      .then((d) => {
        setDoc(d);
        setActiveSchematic({ id: d.id, name: d.title, boardRevision: d.board_rev ?? undefined });
      })
      .catch((err) => setError((err as Error).message));
  }, [id, setActiveSchematic]);

  useEffect(() => {
    setDoc(null);
    setError("");
    setZoom(0);
    load();
  }, [load]);

  const pageCount = doc?.page_count ?? 0;
  const pageNumber = Math.min(Math.max(viewer?.page ?? 1, 1), Math.max(pageCount, 1));
  const page = doc?.pages.find((p) => p.n === pageNumber);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowRight" && pageNumber < pageCount) setViewerPage(pageNumber + 1);
      if (e.key === "ArrowLeft" && pageNumber > 1) setViewerPage(pageNumber - 1);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 1, ZOOMS.length - 1));
      if (e.key === "-") setZoom((z) => Math.max(z - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, pageNumber, pageCount, closeViewer, setViewerPage]);

  if (!viewer) return null;

  const btn = "grid size-12 place-items-center rounded-xl bg-bench-raised hover:bg-bench-border disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bench-bg" role="dialog" aria-modal aria-label="Schematic viewer">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-bench-border bg-bench-panel p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{doc?.title ?? "Loading…"}</div>
          {doc && (
            <div className="font-mono text-base text-bench-muted">
              {doc.device_model} · {doc.board_rev ?? "all revisions"}
            </div>
          )}
        </div>
        <button className={btn} onClick={() => setViewerPage(pageNumber - 1)} disabled={pageNumber <= 1} aria-label="Previous page">
          <ChevronLeft className="size-7" />
        </button>
        <span className="min-w-24 text-center font-mono text-lg font-bold">
          {pageNumber}/{pageCount || "–"}
        </span>
        <button className={btn} onClick={() => setViewerPage(pageNumber + 1)} disabled={pageNumber >= pageCount} aria-label="Next page">
          <ChevronRight className="size-7" />
        </button>
        <span className="mx-1 h-8 w-px bg-bench-border" aria-hidden />
        <button className={btn} onClick={() => setZoom((z) => Math.max(z - 1, 0))} disabled={zoom === 0} aria-label="Zoom out">
          <Minus className="size-6" />
        </button>
        <span className="w-14 text-center font-mono text-lg">{ZOOMS[zoom]}×</span>
        <button className={btn} onClick={() => setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">
          <Plus className="size-6" />
        </button>
        <button className={btn} onClick={() => setZoom(0)} aria-label="Fit to screen">
          <Maximize className="size-6" />
        </button>
        <button
          onClick={() => setShowText((v) => !v)}
          aria-pressed={showText}
          className={`flex h-12 items-center gap-2 rounded-xl px-4 text-lg font-bold ${
            showText ? "bg-bench-accent text-black" : "bg-bench-raised hover:bg-bench-border"
          }`}
        >
          <FileText className="size-5" aria-hidden />
          Extracted text
        </button>
        <button className={btn} onClick={closeViewer} aria-label="Close viewer">
          <X className="size-7" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto bg-white">
          {error && <p className="p-6 text-xl text-bench-fault">{error}</p>}
          {doc && pageCount > 0 && (
            <img
              key={`${doc.id}-${pageNumber}`}
              src={api.pageImageUrl(doc.id, pageNumber)}
              alt={`${doc.title}, page ${pageNumber}`}
              draggable={false}
              style={zoom === 0 ? undefined : { width: `${ZOOMS[zoom] * 100}%`, maxWidth: "none" }}
              className={zoom === 0 ? "mx-auto h-full max-h-full w-auto object-contain" : "block"}
            />
          )}
        </div>
        {showText && doc && page && <PageTextPanel doc={doc} pageNumber={pageNumber} onSaved={setDoc} />}
      </div>
    </div>
  );
}

function PageTextPanel({
  doc,
  pageNumber,
  onSaved,
}: {
  doc: SchematicDetail;
  pageNumber: number;
  onSaved: (doc: SchematicDetail) => void;
}) {
  const page = doc.pages.find((p) => p.n === pageNumber)!;
  const appMode = useRepairStore((s) => s.appMode);
  const [text, setText] = useState(page.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setText(page.text), [page.text, pageNumber]);

  const run = async (action: () => Promise<SchematicDetail>) => {
    setBusy(true);
    setError("");
    try {
      onSaved(await action());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex w-full max-w-xl shrink-0 flex-col border-l-2 border-bench-border bg-bench-panel">
      <div className="space-y-1 border-b-2 border-bench-border p-4">
        <div className="text-lg font-bold">
          Page {pageNumber} ·{" "}
          {page.status === "done" ? (page.edited ? "edited by you" : "read by the vision model") : page.status === "error" ? "failed" : "waiting to be read"}
        </div>
        <p className="text-base text-bench-muted">
          This text is what the copilot searches. Fix anything the model misread, then save.
        </p>
        {page.error && <p className="text-base text-bench-fault">{page.error}</p>}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={`Extracted text for page ${pageNumber}`}
        placeholder={page.status === "pending" ? "Not read yet. Switch to Ingest mode to process it." : ""}
        className="min-h-0 flex-1 resize-none bg-bench-bg p-4 font-mono text-base leading-relaxed focus:outline-none"
      />
      {error && <p className="px-4 pt-2 text-base text-bench-fault">{error}</p>}
      <div className="flex gap-2 p-4">
        <button
          onClick={() => run(() => api.editPage(doc.id, pageNumber, text))}
          disabled={busy || text === page.text}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-bench-accent text-xl font-black text-black disabled:opacity-30"
        >
          {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Save className="size-6" aria-hidden />}
          Save
        </button>
        <button
          onClick={() => run(() => api.rescanPage(doc.id, pageNumber))}
          disabled={busy}
          title={appMode === "ingest" ? "Read this page again" : "Queues the page; it is read next time you switch to Ingest mode"}
          className="flex h-14 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border disabled:opacity-30"
        >
          <RefreshCw className="size-5" aria-hidden />
          Re-read
        </button>
      </div>
    </aside>
  );
}
