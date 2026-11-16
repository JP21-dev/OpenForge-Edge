"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, Wrench } from "lucide-react";
import { useRepairStore } from "@/store/useRepairStore";
import { api, type AppMode } from "@/lib/api";

const OPTIONS: { id: AppMode; label: string; icon: typeof Wrench }[] = [
  { id: "repair", label: "Repair", icon: Wrench },
  { id: "ingest", label: "Ingest", icon: Upload },
];

export function ModeToggle() {
  const appMode = useRepairStore((s) => s.appMode);
  const loading = useRepairStore((s) => s.modeLoading);
  const setAppMode = useRepairStore((s) => s.setAppMode);
  const thinking = useRepairStore((s) => s.isCopilotThinking);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      api
        .getMode()
        .then((m) => setAppMode(m.mode, m.loading))
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [loading, setAppMode]);

  const choose = async (mode: AppMode) => {
    if (mode === appMode || switching) return;
    setSwitching(true);
    setError("");
    try {
      const status = await api.setMode(mode);
      setAppMode(status.mode, status.loading);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {(switching || loading) && (
        <span className="hidden items-center gap-2 text-base text-bench-muted xl:flex" role="status">
          <Loader2 className="size-5 animate-spin text-bench-accent" aria-hidden />
          Loading {loading ?? "model"}…
        </span>
      )}
      {error && (
        <span className="hidden max-w-56 truncate text-base text-bench-fault xl:inline" title={error}>
          {error}
        </span>
      )}
      <div role="radiogroup" aria-label="Workspace mode" className="flex rounded-xl border-2 border-bench-border bg-bench-raised p-1">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="radio"
            aria-checked={appMode === id}
            disabled={switching || thinking}
            onClick={() => choose(id)}
            title={id === "repair" ? "Chat model loaded, for diagnosing boards" : "Vision model loaded, for reading schematics"}
            className={`flex h-11 items-center gap-2 rounded-lg px-3 text-lg font-bold disabled:opacity-50 ${
              appMode === id ? "bg-bench-accent text-black" : "text-bench-muted hover:text-bench-text"
            }`}
          >
            <Icon className="size-5" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
