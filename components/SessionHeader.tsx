"use client";

import { useState } from "react";
import { Check, CircuitBoard, Cpu, FileText, Flag, PanelRightClose, PanelRightOpen, RotateCcw, X } from "lucide-react";
import { selectCurrentStep, selectDevice, useRepairStore } from "@/store/useRepairStore";
import { api } from "@/lib/api";
import { DevicePicker, ProcedurePicker } from "@/components/DevicePicker";
import { ModeToggle } from "@/components/ModeToggle";
import { FinishRepairDialog } from "@/components/FinishRepairDialog";

export function SessionHeader() {
  const schematic = useRepairStore((s) => s.activeSchematic);
  const steps = useRepairStore((s) => s.diagnosticSteps);
  const stepIndex = useRepairStore((s) => s.currentStepIndex);
  const currentStep = useRepairStore(selectCurrentStep);
  const completeCurrentStep = useRepairStore((s) => s.completeCurrentStep);
  const hudOpen = useRepairStore((s) => s.hudOpen);
  const toggleHud = useRepairStore((s) => s.toggleHud);
  const resetSession = useRepairStore((s) => s.resetSession);
  const appMode = useRepairStore((s) => s.appMode);

  const [finishing, setFinishing] = useState(false);

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-bench-border bg-bench-panel px-4 py-3 md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Cpu className="size-8 shrink-0 text-bench-accent" aria-hidden />
        <DevicePicker />
        <BoardRevisionPicker />
      </div>

      {appMode === "repair" ? (
        <div className="order-last flex min-w-0 basis-full items-center gap-3 md:order-none md:flex-1 md:basis-auto">
          <ProcedurePicker />
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
      ) : (
        <div className="order-last basis-full text-xl font-semibold text-bench-muted md:order-none md:flex-1 md:basis-auto">
          Ingest mode · upload schematics and photos
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <ModeToggle />
        {appMode === "repair" && (
          <>
            <span className="hidden items-center gap-2 text-lg text-bench-muted 2xl:flex">
              <FileText className="size-6" aria-hidden />
              {schematic ? schematic.name : "No schematic open"}
            </span>
            <IconButton label="Finish repair and save to history" onClick={() => setFinishing(true)} tone="ok">
              <Flag className="size-7" />
            </IconButton>
            <IconButton label="Reset session without saving" onClick={() => confirm("Start a new repair session without saving?") && resetSession()}>
              <RotateCcw className="size-7" />
            </IconButton>
          </>
        )}
        <IconButton label={hudOpen ? "Hide HUD" : "Show HUD"} onClick={toggleHud}>
          {hudOpen ? <PanelRightClose className="size-7" /> : <PanelRightOpen className="size-7" />}
        </IconButton>
      </div>

      {finishing && <FinishRepairDialog onClose={() => setFinishing(false)} />}
    </header>
  );
}

function BoardRevisionPicker() {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const device = useRepairStore(selectDevice);
  const boardRevision = useRepairStore((s) => s.boardRevision);
  const setBoardRevision = useRepairStore((s) => s.setBoardRevision);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [known, setKnown] = useState<string[]>([]);

  const start = () => {
    setDraft(boardRevision);
    setEditing(true);
    api
      .listBoards(deviceModel)
      .then((seen) => setKnown([...new Set([...device.revisions, ...seen])].sort()))
      .catch(() => setKnown(device.revisions));
  };
  const commit = () => {
    setBoardRevision(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          autoFocus
          list="known-board-revisions"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder="e.g. EDM-020"
          aria-label="Board revision"
          className="h-12 w-40 rounded-lg border-2 border-bench-accent bg-bench-bg px-3 font-mono text-lg font-bold uppercase outline-none"
        />
        <datalist id="known-board-revisions">
          {known.map((rev) => (
            <option key={rev} value={rev} />
          ))}
        </datalist>
      </form>
    );
  }

  return (
    <button
      onClick={start}
      title="Board revision: answers and schematics are filtered to it"
      className={`flex h-12 shrink-0 items-center gap-2 rounded-lg border-2 px-3 font-mono text-lg font-bold ${
        boardRevision ? "border-bench-accent text-bench-accent" : "border-dashed border-bench-border text-bench-muted"
      }`}
    >
      <CircuitBoard className="size-5" aria-hidden />
      {boardRevision || "Set board"}
    </button>
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
