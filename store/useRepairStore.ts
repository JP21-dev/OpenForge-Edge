import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

export interface ScrewSpec {
  id: string;
  position: string;
  length: string;
  head: string;
  count: number;
  removed: boolean;
}

export type HudTab = "meter" | "screws";

interface RepairState {
  sessionId: string;
  deviceModel: string;
  activeSchematic: Schematic | null;
  diagnosticSteps: DiagnosticStep[];
  currentStepIndex: number;

  messages: ChatMessage[];
  isCopilotThinking: boolean;

  hudOpen: boolean;
  hudTab: HudTab;
  readings: MeterReading[];
  screws: ScrewSpec[];

  setDeviceModel: (model: string) => void;
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
  toggleScrewRemoved: (id: string) => void;

  resetSession: () => void;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const PLACEHOLDER_STEPS: DiagnosticStep[] = [
  { id: "s1", title: "Visual inspection", detail: "Check for burnt components, corrosion, lifted pads.", status: "active" },
  { id: "s2", title: "Measure main rail (PP_VDD_MAIN)", detail: "Expect 3.7–4.2 V with battery connected.", status: "pending" },
  { id: "s3", title: "Diode mode on charge IC", detail: "Compare against known-good values.", status: "pending" },
  { id: "s4", title: "Thermal check under load", status: "pending" },
];

const PLACEHOLDER_READINGS: MeterReading[] = [
  { id: "r1", testPoint: "PP_VDD_MAIN", mode: "DCV", value: 3.98, unit: "V", expected: { min: 3.7, max: 4.2 }, takenAt: 0 },
  { id: "r2", testPoint: "PP3V3_S2", mode: "DCV", value: 2.41, unit: "V", expected: { min: 3.2, max: 3.4 }, takenAt: 0 },
  { id: "r3", testPoint: "C4210 → GND", mode: "OHM", value: 0.6, unit: "Ω", expected: { min: 50, max: 100000 }, takenAt: 0 },
  { id: "r4", testPoint: "U3300 pin 4", mode: "DIODE", value: null, unit: "V", takenAt: 0 },
];

const PLACEHOLDER_SCREWS: ScrewSpec[] = [
  { id: "sc1", position: "Bottom edge (pentalobe)", length: "3.4 mm", head: "P2", count: 2, removed: false },
  { id: "sc2", position: "Battery bracket", length: "1.2 mm", head: "Y000", count: 3, removed: false },
  { id: "sc3", position: "Display shield", length: "1.3 mm", head: "PH000", count: 4, removed: false },
  { id: "sc4", position: "Logic board standoff", length: "2.5 mm", head: "Standoff", count: 1, removed: false },
];

const initialSession = () => ({
  sessionId: uid(),
  deviceModel: "Unassigned device",
  activeSchematic: null as Schematic | null,
  diagnosticSteps: PLACEHOLDER_STEPS,
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
  readings: PLACEHOLDER_READINGS,
  screws: PLACEHOLDER_SCREWS,
});

export const useRepairStore = create<RepairState>()(
  persist(
    (set, get) => ({
      ...initialSession(),
      hudOpen: true,
      hudTab: "meter",

      setDeviceModel: (deviceModel) => set({ deviceModel }),
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
      toggleScrewRemoved: (id) =>
        set((state) => ({
          screws: state.screws.map((s) => (s.id === id ? { ...s, removed: !s.removed } : s)),
        })),

      resetSession: () => set(initialSession()),
    }),
    {
      name: "openforge-repair-session",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ isCopilotThinking: _thinking, ...rest }) => rest,
    },
  ),
);

export const selectCurrentStep = (s: RepairState) => s.diagnosticSteps[s.currentStepIndex];
