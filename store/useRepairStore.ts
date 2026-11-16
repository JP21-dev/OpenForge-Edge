import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppMode, ReferenceValue } from "@/lib/api";
import { CUSTOM_ID, DEVICES, getDevice, getProcedure, type ProcedureStep } from "@/lib/devices";

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

export interface DiagnosticStep extends ProcedureStep {
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

interface DeviceSession {
  sessionId: string;
  deviceModel: string;
  boardRevision: string;
  procedureId: string;
  activeSchematic: Schematic | null;
  diagnosticSteps: DiagnosticStep[];
  currentStepIndex: number;
  messages: ChatMessage[];
  readings: MeterReading[];
  removedScrews: string[];
}

interface RepairState extends DeviceSession {
  deviceId: string;
  savedSessions: Record<string, DeviceSession>;
  isCopilotThinking: boolean;

  hudOpen: boolean;
  hudTab: HudTab;

  appMode: AppMode;
  modeLoading: string | null;
  viewer: ViewerTarget | null;
  references: ReferenceValue[];
  referenceDraft: ReferenceDraft | null;

  switchDevice: (deviceId: string, customName?: string) => void;
  setDeviceModel: (model: string) => void;
  setBoardRevision: (rev: string) => void;
  setProcedure: (procedureId: string) => void;
  setActiveSchematic: (schematic: Schematic | null) => void;
  completeCurrentStep: (outcome?: "done" | "failed") => void;
  goToStep: (index: number) => void;

  addMessage: (role: ChatRole, content: string, sources?: CopilotSource[]) => ChatMessage;
  updateMessage: (id: string, patch: (message: ChatMessage) => Partial<ChatMessage>) => void;
  setCopilotThinking: (thinking: boolean) => void;

  toggleHud: () => void;
  setHudTab: (tab: HudTab) => void;
  addReading: (reading: Omit<MeterReading, "id" | "takenAt">) => void;
  removeReading: (id: string) => void;
  toggleScrew: (key: string) => void;
  setScrews: (keys: string[], removed: boolean) => void;

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

function stepsFor(deviceId: string, procedureId: string): DiagnosticStep[] {
  return getProcedure(getDevice(deviceId), procedureId).steps.map((s, i) => ({
    ...s,
    status: i === 0 ? "active" : "pending",
  }));
}

function newSession(deviceId: string, deviceModel?: string, procedureId?: string): DeviceSession {
  const device = getDevice(deviceId);
  const procedure = getProcedure(device, procedureId ?? "");
  return {
    sessionId: uid(),
    deviceModel: deviceModel ?? device.name,
    boardRevision: "",
    procedureId: procedure.id,
    activeSchematic: null,
    diagnosticSteps: stepsFor(deviceId, procedure.id),
    currentStepIndex: 0,
    messages: [
      {
        id: "welcome",
        role: "system",
        content: `OpenForge Edge is running locally for ${deviceModel ?? device.name}. No data leaves this bench.`,
        createdAt: 0,
      },
    ],
    readings: [],
    removedScrews: [],
  };
}

function snapshot(state: RepairState): DeviceSession {
  return {
    sessionId: state.sessionId,
    deviceModel: state.deviceModel,
    boardRevision: state.boardRevision,
    procedureId: state.procedureId,
    activeSchematic: state.activeSchematic,
    diagnosticSteps: state.diagnosticSteps,
    currentStepIndex: state.currentStepIndex,
    messages: state.messages,
    readings: state.readings,
    removedScrews: state.removedScrews,
  };
}

const DEFAULT_DEVICE = DEVICES[0].id;

export const useRepairStore = create<RepairState>()(
  persist(
    (set, get) => ({
      deviceId: DEFAULT_DEVICE,
      ...newSession(DEFAULT_DEVICE),
      savedSessions: {},
      isCopilotThinking: false,
      hudOpen: true,
      hudTab: "meter",
      appMode: "repair",
      modeLoading: null,
      viewer: null,
      references: [],
      referenceDraft: null,

      switchDevice: (deviceId, customName) => {
        const state = get();
        const key = deviceId === CUSTOM_ID ? `${CUSTOM_ID}:${(customName ?? "").toLowerCase()}` : deviceId;
        const currentKey =
          state.deviceId === CUSTOM_ID ? `${CUSTOM_ID}:${state.deviceModel.toLowerCase()}` : state.deviceId;
        if (key === currentKey) return;
        const saved = { ...state.savedSessions, [currentKey]: snapshot(state) };
        const restored = saved[key] ?? newSession(deviceId, deviceId === CUSTOM_ID ? customName : undefined);
        set({ deviceId, ...restored, savedSessions: saved, viewer: null, referenceDraft: null });
      },
      setDeviceModel: (deviceModel) => set({ deviceModel }),
      setBoardRevision: (boardRevision) => set({ boardRevision: boardRevision.trim().toUpperCase() }),
      setProcedure: (procedureId) =>
        set((state) => ({
          procedureId,
          diagnosticSteps: stepsFor(state.deviceId, procedureId),
          currentStepIndex: 0,
          removedScrews: [],
        })),
      setActiveSchematic: (activeSchematic) => set({ activeSchematic }),

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
      toggleScrew: (key) =>
        set((state) => ({
          removedScrews: state.removedScrews.includes(key)
            ? state.removedScrews.filter((k) => k !== key)
            : [...state.removedScrews, key],
        })),
      setScrews: (keys, removed) =>
        set((state) => {
          const rest = state.removedScrews.filter((k) => !keys.includes(k));
          return { removedScrews: removed ? [...rest, ...keys] : rest };
        }),

      setAppMode: (appMode, modeLoading = null) => set({ appMode, modeLoading }),
      openViewer: (schematicId, page = 1) => set({ viewer: { schematicId, page } }),
      setViewerPage: (page) => set((state) => (state.viewer ? { viewer: { ...state.viewer, page } } : {})),
      closeViewer: () => set({ viewer: null }),
      setReferences: (references) => set({ references }),
      setReferenceDraft: (referenceDraft) => set({ referenceDraft }),

      resetSession: () =>
        set((state) => newSession(state.deviceId, state.deviceModel, state.procedureId)),
    }),
    {
      name: "openforge-repair-session-v3",
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
export const selectDevice = (s: RepairState) => getDevice(s.deviceId);
export const selectProcedure = (s: RepairState) => getProcedure(getDevice(s.deviceId), s.procedureId);
