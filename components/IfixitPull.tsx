"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, DownloadCloud, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { selectDevice, useRepairStore } from "@/store/useRepairStore";
import { api, type PulledGuide } from "@/lib/api";

export function IfixitPull({ compact = false, onPulled }: { compact?: boolean; onPulled?: () => void }) {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const device = useRepairStore(selectDevice);
  const [name, setName] = useState(device.ifixit ?? deviceModel);
  const [guides, setGuides] = useState<PulledGuide[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = useCallback(() => {
    api.listIfixit(deviceModel).then(setGuides).catch(() => setGuides([]));
  }, [deviceModel]);

  useEffect(() => {
    setName(device.ifixit ?? deviceModel);
    setStatus("");
    refresh();
  }, [device.ifixit, deviceModel, refresh]);

  const pull = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setStatus("Fetching guides from iFixit…");
    try {
      const res = await api.pullIfixit({ device_model: deviceModel, ifixit_device: name.trim() });
      setStatus(`Saved ${res.guides.length} guide${res.guides.length === 1 ? "" : "s"} for ${res.ifixit_device} (${res.chunks} searchable sections). They work offline from now on.`);
      refresh();
      onPulled?.();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-3 ${compact ? "" : "rounded-2xl border-2 border-bench-border bg-bench-panel p-5"}`}>
      {!compact && (
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <BookOpen className="size-6 text-bench-accent" aria-hidden />
            Public guides from iFixit
          </h2>
          <p className="text-lg text-bench-muted">
            Pulls the teardown and the main replacement guides for {deviceModel} into the local knowledge base. Needs internet once;
            afterwards the copilot uses them offline. iFixit guides are CC BY-NC-SA: they stay on this bench and are credited as the source.
          </p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pull();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Device name on iFixit"
          placeholder="Exact model, e.g. iPhone 13 Pro"
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-bench-border bg-bench-bg px-4 text-lg focus:border-bench-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="flex h-12 items-center gap-2 rounded-xl bg-bench-raised px-4 text-lg font-semibold hover:bg-bench-border disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <DownloadCloud className="size-5" aria-hidden />}
          Pull guides
        </button>
      </form>
      <p className="text-base text-bench-muted">Type the exact model on the bench for the best match; close names are looked up automatically.</p>
      {status && <p className="text-lg">{status}</p>}
      {guides.length > 0 && (
        <ul className="space-y-1">
          {guides.map((g) => (
            <li key={g.id ?? g.guideid} className="flex items-center gap-2 text-base">
              <span className="w-24 shrink-0 font-mono text-bench-muted">{g.type}</span>
              <a href={g.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1 truncate underline hover:text-bench-accent">
                <span className="truncate">{g.title}</span>
                <ExternalLink className="size-4 shrink-0" aria-hidden />
              </a>
              {!compact && g.id && (
                <button
                  onClick={async () => {
                    await api.deleteIfixit(g.id!).catch(() => undefined);
                    refresh();
                  }}
                  aria-label={`Remove ${g.title}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-bench-muted hover:text-bench-fault"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
