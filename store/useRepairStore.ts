import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppMode, ReferenceValue } from "@/lib/api";

export type ChatRole = "technician" | "copilot" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  sources?: CopilotSource[];
}

export interface CopilotSource {
  source: string;
  page: number | null;
  text: string;
  score: number;
  schematic_id?: string | null;
  board_rev?: string | null;
}

export type StepStatus = "pending" | "active" | "done" | "failed";

export interface DiagnosticStep {
  id: string;
  title: string;
  detail?: string;
  status: StepStatus;
}

export interface Schematic {
  id: string;
  name: string;
  boardRevision?: string;
  src?: string;
}

export type MeterMode = "DCV" | "ACV" | "OHM" | "DIODE" | "CONT" | "AMP";

export interface MeterReading {
  id: string;
  testPoint: string;
  mode: MeterMode;
  value: number | null;
  unit: string;
  expected?: { min: number; max: number };
  takenAt: number;
}

export const METER_UNITS: Record<MeterMode, string> = {
  DCV: "V",
  ACV: "V",
  OHM: "Ω",
  DIODE: "V",
  CONT: "Ω",
  AMP: "A",
};

export type ReadingStatus = "ok" | "fault" | "unknown";

export function readingStatus(r: MeterReading): ReadingStatus {
  if (r.value === null || !r.expected) return "unknown";
  return r.value >= r.expected.min && r.value <= r.expected.max ? "ok" : "fault";
}

export interface ScrewSpec {
  id: string;
  position: string;
  length: string;
  head: string;
  count: number;
  removed: boolean;
}

export type HudTab = "meter" | "reference" | "schematics" | "screws" | "history";

export interface ViewerTarget {
  schematicId: string;
  page: number;
}

export interface ReferenceDraft {
  testPoint: string;
  mode: MeterMode;
  min: number;
  max: number;
  source: string;
}

const normalizePoint = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

export function findReference(refs: ReferenceValue[], testPoint: string, mode: MeterMode) {
  const key = normalizePoint(testPoint);
  return refs.find((r) => r.mode === mode && normalizePoint(r.test_point) === key);
}

interface RepairState {
  sessionId: string;
  deviceModel: string;
  boardRevision: string;
  activeSchematic: Schematic | null;
  diagnosticSteps: DiagnosticStep[];
  currentStepIndex: number;

  messages: ChatMessage[];
  isCopilotThinking: boolean;

  hudOpen: boolean;
  hudTab: HudTab;
  readings: MeterReading[];
  screws: ScrewSpec[];

  appMode: AppMode;
  modeLoading: string | null;
  viewer: ViewerTarget | null;
  references: ReferenceValue[];
  referenceDraft: ReferenceDraft | null;

  setDeviceModel: (model: string) => void;
  setBoardRevision: (rev: string) => void;
  setActiveSchematic: (schematic: Schematic | null) => void;
  setDiagnosticSteps: (steps: Omit<DiagnosticStep, "status">[]) => void;
  completeCurrentStep: (outcome?: "done" | "failed") => void;
  goToStep: (index: number) => void;

  addMessage: (role: ChatRole, content: string, sources?: CopilotSource[]) => ChatMessage;
  updateMessage: (id: string, patch: (message: ChatMessage) => Partial<ChatMessage>) => void;
  setCopilotThinking: (thinking: boolean) => void;

  toggleHud: () => void;
  setHudTab: (tab: HudTab) => void;
  addReading: (reading: Omit<MeterReading, "id" | "takenAt">) => void;
  removeReading: (id: string) => void;
  toggleScrewRemoved: (id: string) => void;

  setAppMode: (mode: AppMode, loading?: string | null) => void;
  openViewer: (schematicId: string, page?: number) => void;
  setViewerPage: (page: number) => void;
  closeViewer: () => void;
  setReferences: (refs: ReferenceValue[]) => void;
  setReferenceDraft: (draft: ReferenceDraft | null) => void;

  resetSession: () => void;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const PS5_STEPS: DiagnosticStep[] = [
  { id: "s1", title: "Visual inspection", detail: "HDMI port, burnt parts, liquid metal outside the APU barrier.", status: "active" },
  { id: "s2", title: "Confirm 12 V from the power supply", status: "pending" },
  { id: "s3", title: "Check 5 V and southbridge voltages", status: "pending" },
  { id: "s4", title: "Check fuses and shorts to ground", status: "pending" },
  { id: "s5", title: "Read UART error codes", status: "pending" },
];

const PS5_SCREWS: ScrewSpec[] = [
  { id: "sc1", position: "Stand", length: "26.5 mm", head: "Coin / flathead", count: 1, removed: false },
  { id: "sc2", position: "Fan shroud", length: "23.3 mm", head: "TR9", count: 2, removed: false },
  { id: "sc3", position: "Fan shroud", length: "11.4 mm", head: "TR9", count: 1, removed: false },
  { id: "sc4", position: "Fan shroud", length: "31 mm", head: "TR9", count: 1, removed: false },
  { id: "sc5", position: "SSD cover", length: "17 mm", head: "Phillips", count: 1, removed: false },
  { id: "sc6", position: "Case", length: "18.6 mm", head: "TR8", count: 6, removed: false },
  { id: "sc7", position: "Case", length: "23.3 mm", head: "TR8", count: 2, removed: false },
  { id: "sc8", position: "Case", length: "43.2 mm", head: "TR8", count: 2, removed: false },
  { id: "sc9", position: "Case", length: "7.3 mm", head: "TR8", count: 1, removed: false },
  { id: "sc10", position: "Top shield plate", length: "7.3 mm", head: "TR8", count: 41, removed: false },
  { id: "sc11", position: "Top shield plate", length: "43.2 mm", head: "TR8", count: 1, removed: false },
  { id: "sc12", position: "Main board (SSD)", length: "11 mm", head: "Phillips", count: 1, removed: false },
  { id: "sc13", position: "APU tension bracket", length: "11.8 mm", head: "Phillips", count: 2, removed: false },
  { id: "sc14", position: "Main board", length: "7.3 mm", head: "TR8", count: 2, removed: false },
];

const initialSession = () => ({
  sessionId: uid(),
  deviceModel: "PlayStation 5",
  boardRevision: "",
  activeSchematic: null as Schematic | null,
  diagnosticSteps: PS5_STEPS,
  currentStepIndex: 0,
  messages: [
    {
      id: "welcome",
      role: "system" as const,
      content: "OpenForge Edge is running locally. No data leaves this bench.",
      createdAt: 0,
    },
  ],
  isCopilotThinking: false,
  readings: [] as MeterReading[],
  screws: PS5_SCREWS,
});

export const useRepairStore = create<RepairState>()(
  persist(
    (set, get) => ({
      ...initialSession(),
      hudOpen: true,
      hudTab: "meter",
      appMode: "repair",
      modeLoading: null,
      viewer: null,
      references: [],
      referenceDraft: null,

      setDeviceModel: (deviceModel) => set({ deviceModel }),
      setBoardRevision: (boardRevision) => set({ boardRevision: boardRevision.trim().toUpperCase() }),
      setActiveSchematic: (activeSchematic) => set({ activeSchematic }),

      setDiagnosticSteps: (steps) =>
        set({
          diagnosticSteps: steps.map((s, i) => ({ ...s, status: i === 0 ? "active" : "pending" })),
          currentStepIndex: 0,
        }),

      completeCurrentStep: (outcome = "done") => {
        const { diagnosticSteps, currentStepIndex } = get();
        const next = Math.min(currentStepIndex + 1, diagnosticSteps.length - 1);
        set({
          diagnosticSteps: diagnosticSteps.map((s, i) => {
            if (i === currentStepIndex) return { ...s, status: outcome };
            if (i === next && next !== currentStepIndex) return { ...s, status: "active" };
            return s;
          }),
          currentStepIndex: next,
        });
      },

      goToStep: (index) =>
        set((state) => ({
          currentStepIndex: index,
          diagnosticSteps: state.diagnosticSteps.map((s, i) =>
            i === index ? { ...s, status: "active" } : s.status === "active" ? { ...s, status: "pending" } : s,
          ),
        })),

      addMessage: (role, content, sources) => {
        const message: ChatMessage = { id: uid(), role, content, createdAt: Date.now(), sources };
        set((state) => ({ messages: [...state.messages, message] }));
        return message;
      },
      updateMessage: (id, patch) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)),
        })),
      setCopilotThinking: (isCopilotThinking) => set({ isCopilotThinking }),

      toggleHud: () => set((state) => ({ hudOpen: !state.hudOpen })),
      setHudTab: (hudTab) => set({ hudTab, hudOpen: true }),
      addReading: (reading) =>
        set((state) => ({
          readings: [{ ...reading, id: uid(), takenAt: Date.now() }, ...state.readings],
        })),
      removeReading: (id) => set((state) => ({ readings: state.readings.filter((r) => r.id !== id) })),
      toggleScrewRemoved: (id) =>
        set((state) => ({
          screws: state.screws.map((s) => (s.id === id ? { ...s, removed: !s.removed } : s)),
        })),

      setAppMode: (appMode, modeLoading = null) => set({ appMode, modeLoading }),
      openViewer: (schematicId, page = 1) => set({ viewer: { schematicId, page } }),
      setViewerPage: (page) => set((state) => (state.viewer ? { viewer: { ...state.viewer, page } } : {})),
      closeViewer: () => set({ viewer: null }),
      setReferences: (references) => set({ references }),
      setReferenceDraft: (referenceDraft) => set({ referenceDraft }),

      resetSession: () => set((state) => ({ ...initialSession(), deviceModel: state.deviceModel })),
    }),
    {
      name: "openforge-repair-session-v2",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({
        isCopilotThinking: _thinking,
        appMode: _mode,
        modeLoading: _loading,
        viewer: _viewer,
        references: _refs,
        referenceDraft: _draft,
        ...rest
      }) => rest,
    },
  ),
);

export const selectCurrentStep = (s: RepairState) => s.diagnosticSteps[s.currentStepIndex];
