"use client";

import { useState } from "react";
import { Check, Cpu, FileText, PanelRightClose, PanelRightOpen, RotateCcw, X } from "lucide-react";
import { selectCurrentStep, useRepairStore } from "@/store/useRepairStore";

export function SessionHeader() {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const setDeviceModel = useRepairStore((s) => s.setDeviceModel);
  const schematic = useRepairStore((s) => s.activeSchematic);
  const steps = useRepairStore((s) => s.diagnosticSteps);
  const stepIndex = useRepairStore((s) => s.currentStepIndex);
  const currentStep = useRepairStore(selectCurrentStep);
  const completeCurrentStep = useRepairStore((s) => s.completeCurrentStep);
  const hudOpen = useRepairStore((s) => s.hudOpen);
  const toggleHud = useRepairStore((s) => s.toggleHud);
  const resetSession = useRepairStore((s) => s.resetSession);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(deviceModel);

  const commitModel = () => {
    if (draft.trim()) setDeviceModel(draft.trim());
    setEditing(false);
  };

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-bench-border bg-bench-panel px-4 py-3 md:gap-6 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Cpu className="size-8 shrink-0 text-bench-accent" aria-hidden />
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitModel();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitModel}
              aria-label="Device model"
              className="h-12 w-56 rounded-lg border-2 border-bench-accent bg-bench-bg px-3 text-xl font-bold outline-none md:w-72"
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setDraft(deviceModel);
              setEditing(true);
            }}
            className="min-w-0 truncate rounded-lg px-2 py-1 text-left text-2xl font-bold tracking-tight hover:bg-bench-raised"
            title="Tap to change device"
          >
            {deviceModel}
          </button>
        )}
      </div>

      <div className="order-last flex min-w-0 basis-full items-center gap-3 md:order-none md:flex-1 md:basis-auto">
        <span className="shrink-0 rounded-md bg-bench-accent px-3 py-1 font-mono text-lg font-black text-black">
          STEP {stepIndex + 1}/{steps.length}
        </span>
        <span className="min-w-0 truncate text-xl font-semibold">{currentStep?.title ?? "No active step"}</span>
        <div className="ml-auto flex shrink-0 gap-2">
          <IconButton label="Mark step passed" onClick={() => completeCurrentStep("done")} tone="ok">
            <Check className="size-7" />
          </IconButton>
          <IconButton label="Mark step failed" onClick={() => completeCurrentStep("failed")} tone="fault">
            <X className="size-7" />
          </IconButton>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <span className="hidden items-center gap-2 text-lg text-bench-muted lg:flex">
          <FileText className="size-6" aria-hidden />
          {schematic ? schematic.name : "No schematic loaded"}
        </span>
        <IconButton label="Reset session" onClick={() => confirm("Start a new repair session?") && resetSession()}>
          <RotateCcw className="size-7" />
        </IconButton>
        <IconButton label={hudOpen ? "Hide HUD" : "Show HUD"} onClick={toggleHud}>
          {hudOpen ? <PanelRightClose className="size-7" /> : <PanelRightOpen className="size-7" />}
        </IconButton>
      </div>
    </header>
  );
}

const TONES = {
  neutral: "border-bench-border text-bench-text hover:border-bench-accent",
  ok: "border-bench-ok/60 text-bench-ok hover:bg-bench-ok hover:text-black",
  fault: "border-bench-fault/60 text-bench-fault hover:bg-bench-fault hover:text-black",
} as const;

export function IconButton({
  label,
  onClick,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-14 place-items-center rounded-xl border-2 bg-bench-raised transition-colors ${TONES[tone]}`}
    >
      {children}
    </button>
  );
}
