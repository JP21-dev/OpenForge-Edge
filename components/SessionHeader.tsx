"use client";

import { useState } from "react";
import { Check, CircuitBoard, Cpu, FileText, Flag, PanelRightClose, PanelRightOpen, RotateCcw, X } from "lucide-react";
import { selectCurrentStep, selectDevice, useRepairStore } from "@/store/useRepairStore";
import { api } from "@/lib/api";
import { DevicePicker, ProcedurePicker } from "@/components/DevicePicker";
import { ModeToggle } from "@/components/ModeToggle";
import { FinishRepairDialog } from "@/components/FinishRepairDialog";
import { FailStepDialog } from "@/components/FailStepDialog";
import { RecordingPill } from "@/components/CoverageBanner";

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

  const [finishingManual, setFinishing] = useState(false);
  const finishPrompt = useRepairStore((s) => s.finishPrompt);
  const setFinishPrompt = useRepairStore((s) => s.setFinishPrompt);
  const finishing = finishingManual || finishPrompt;
  const [failing, setFailing] = useState(false);

  return (
    <header className="shrink-0 border-b-2 border-bench-border bg-bench-panel">
      <div className="flex h-[4.5rem] items-center gap-2 px-3 md:gap-3 md:px-6">
        <Cpu className="hidden size-8 shrink-0 text-bench-accent sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <DevicePicker />
          <BoardRevisionPicker />
        </div>
        <RecordingPill />
        <ModeToggle />
        <IconButton label={hudOpen ? "Hide HUD" : "Show HUD"} onClick={toggleHud}>
          {hudOpen ? <PanelRightClose className="size-7" /> : <PanelRightOpen className="size-7" />}
        </IconButton>
      </div>

      <div className="flex h-[4.5rem] items-center gap-2 border-t border-bench-border/60 px-3 md:gap-3 md:px-6">
        {appMode === "repair" ? (
          <>
            <ProcedurePicker />
            <span className="shrink-0 rounded-md bg-bench-accent px-2 py-1 font-mono text-base font-black text-black md:px-3 md:text-lg">
              <span className="hidden sm:inline">STEP </span>
              {stepIndex + 1}/{steps.length}
            </span>
            <span className="min-w-0 flex-1 truncate text-lg font-semibold md:text-xl" title={currentStep?.title}>
              {currentStep?.title ?? "No active step"}
            </span>
            <span className="hidden max-w-64 shrink items-center gap-2 truncate text-lg text-bench-muted 2xl:flex">
              <FileText className="size-6 shrink-0" aria-hidden />
              <span className="truncate">{schematic ? schematic.name : "No schematic open"}</span>
            </span>
            <IconButton label="Mark step passed" onClick={() => completeCurrentStep("done")} tone="ok">
              <Check className="size-7" />
            </IconButton>
            <IconButton label="Step failed: suggest next steps" onClick={() => setFailing(true)} tone="fault">
              <X className="size-7" />
            </IconButton>
            <span className="mx-1 hidden h-10 w-px bg-bench-border sm:block" aria-hidden />
            <span className="hidden sm:contents">
              <IconButton label="Finish repair and save to history" onClick={() => setFinishing(true)} tone="ok">
                <Flag className="size-7" />
              </IconButton>
              <IconButton label="Reset session without saving" onClick={() => confirm("Start a new repair session without saving?") && resetSession()}>
                <RotateCcw className="size-7" />
              </IconButton>
            </span>
          </>
        ) : (
          <span className="truncate text-lg font-semibold text-bench-muted md:text-xl">Ingest mode · upload schematics and photos</span>
        )}
      </div>

      {finishing && (
        <FinishRepairDialog
          prompted={finishPrompt && !finishingManual}
          onClose={() => {
            setFinishing(false);
            setFinishPrompt(false);
          }}
        />
      )}
      {failing && <FailStepDialog onClose={() => setFailing(false)} />}
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
      aria-label={boardRevision ? `Board revision ${boardRevision}` : "Set board revision"}
      className={`flex h-12 shrink-0 items-center gap-2 rounded-lg border-2 px-2 font-mono text-lg font-bold sm:px-3 ${
        boardRevision ? "border-bench-accent text-bench-accent" : "border-dashed border-bench-border text-bench-muted"
      }`}
    >
      <CircuitBoard className="size-5" aria-hidden />
      {boardRevision ? (
        <span className="max-w-24 truncate sm:max-w-none">{boardRevision}</span>
      ) : (
        <span className="hidden sm:inline">Set board</span>
      )}
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
