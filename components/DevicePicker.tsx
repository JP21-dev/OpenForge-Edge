"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Wrench } from "lucide-react";
import { selectProcedure, useRepairStore } from "@/store/useRepairStore";
import { CUSTOM_ID, DEVICE_GROUPS, DEVICES, getDevice } from "@/lib/devices";

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const menu = "absolute left-0 top-full z-30 mt-2 w-80 space-y-1 rounded-2xl border-2 border-bench-border bg-bench-panel p-2 shadow-2xl";
const item = "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-xl hover:bg-bench-raised";

export function DevicePicker() {
  const deviceId = useRepairStore((s) => s.deviceId);
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const switchDevice = useRepairStore((s) => s.switchDevice);
  const thinking = useRepairStore((s) => s.isCopilotThinking);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useDismiss(open, () => setOpen(false));

  const pick = (id: string, name?: string) => {
    switchDevice(id, name);
    setOpen(false);
    setCustom("");
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={thinking}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch device"
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-2xl font-bold tracking-tight hover:bg-bench-raised disabled:opacity-50"
      >
        <span className="truncate">{deviceModel}</span>
        <ChevronDown className="size-6 shrink-0 text-bench-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className={`${menu} max-h-[70vh] overflow-y-auto`}>
          {DEVICE_GROUPS.map((group) => (
            <div key={group} role="group" aria-label={group}>
              <div className="px-4 pb-1 pt-2 text-sm font-bold uppercase tracking-wider text-bench-muted">{group}</div>
              {DEVICES.filter((d) => d.group === group).map((d) => (
                <button key={d.id} role="menuitemradio" aria-checked={deviceId === d.id} onClick={() => pick(d.id)} className={`${item} py-2`}>
                  <span className="flex-1 font-semibold">{d.name}</span>
                  {d.starter && <span className="rounded bg-bench-raised px-1.5 font-mono text-xs text-bench-muted">starter</span>}
                  {deviceId === d.id && <Check className="size-6 text-bench-accent" aria-hidden />}
                </button>
              ))}
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) pick(CUSTOM_ID, custom.trim());
            }}
            className="flex gap-2 border-t-2 border-bench-border pt-2"
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Other device…"
              aria-label="Other device name"
              className="h-12 min-w-0 flex-1 rounded-xl border-2 border-bench-border bg-bench-bg px-3 text-lg focus:border-bench-accent focus:outline-none"
            />
            <button type="submit" disabled={!custom.trim()} className="h-12 rounded-xl bg-bench-accent px-4 text-lg font-bold text-black disabled:opacity-30">
              Use
            </button>
          </form>
          <p className="px-2 pb-1 text-sm text-bench-muted">Each device keeps its own session: switching back restores it.</p>
        </div>
      )}
    </div>
  );
}

export function ProcedurePicker() {
  const deviceId = useRepairStore((s) => s.deviceId);
  const procedure = useRepairStore(selectProcedure);
  const setProcedure = useRepairStore((s) => s.setProcedure);
  const stepIndex = useRepairStore((s) => s.currentStepIndex);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const procedures = getDevice(deviceId).procedures;

  const pick = (id: string) => {
    setOpen(false);
    if (id === procedure.id) return;
    if (stepIndex > 0 && !confirm("Switch repair? Step progress and the screw checklist restart.")) return;
    setProcedure(id);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose the repair"
        className="flex h-11 items-center gap-2 rounded-lg border-2 border-bench-border px-3 text-lg font-semibold hover:border-bench-accent"
      >
        <Wrench className="size-5 text-bench-accent" aria-hidden />
        <span className="max-w-56 truncate">{procedure.title}</span>
        <ChevronDown className="size-5 text-bench-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className={`${menu} w-96`}>
          {procedures.map((p) => (
            <button key={p.id} role="menuitemradio" aria-checked={p.id === procedure.id} onClick={() => pick(p.id)} className={`${item} items-start`}>
              <span className="flex-1">
                <span className="block font-semibold">{p.title}</span>
                <span className="block text-base text-bench-muted">
                  {p.steps.length} steps · {p.summary}
                </span>
              </span>
              {p.id === procedure.id && <Check className="mt-1 size-6 text-bench-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
