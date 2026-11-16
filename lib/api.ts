import type { MeterMode } from "@/store/useRepairStore";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AppMode = "repair" | "ingest";

export interface ModeStatus {
  mode: AppMode;
  active_model: string;
  chat_model: string;
  vision_model: string;
  loading: string | null;
}

export type SchematicStatus = "queued" | "processing" | "done" | "error";

export interface SchematicSummary {
  id: string;
  title: string;
  device: string | null;
  device_model: string;
  board_rev: string | null;
  dense: boolean;
  filenames: string[];
  status: SchematicStatus;
  page_count: number;
  pages_done: number;
  pages_failed: number;
  created_at: string;
}

export interface SchematicPage {
  n: number;
  status: "pending" | "done" | "error";
  text: string;
  edited: boolean;
  error: string | null;
}

export interface SchematicDetail extends SchematicSummary {
  pages: SchematicPage[];
}

export interface ReferenceValue {
  id: string;
  device: string | null;
  device_model: string;
  board_rev: string | null;
  test_point: string;
  mode: MeterMode;
  unit: string;
  expected_min: number;
  expected_max: number;
  source: string;
  note: string;
}

export interface ReferenceInput {
  device_model: string;
  board_revision: string;
  test_point: string;
  mode: MeterMode;
  unit: string;
  expected_min: number;
  expected_max: number;
  source: string;
  note: string;
}

export type RepairOutcome = "fixed" | "not_fixed" | "parked";

export interface RepairRecord {
  id: string;
  device_model: string;
  board_rev: string | null;
  symptom: string;
  outcome: RepairOutcome;
  root_cause: string;
  fix: string;
  parts: string;
  created_at: string;
}

export interface RepairInput {
  device_model: string;
  board_revision: string;
  symptom: string;
  outcome: RepairOutcome;
  root_cause: string;
  fix: string;
  parts: string;
  readings: {
    test_point: string;
    mode: string;
    value: number | null;
    unit: string;
    expected_min: number | null;
    expected_max: number | null;
    status: "ok" | "fault" | "unknown";
  }[];
  steps: { title: string; status: string }[];
  message_count: number;
}

export interface SuggestedStep {
  title: string;
  detail: string;
  why: string;
}

export interface SuggestInput {
  device_model: string;
  board_revision?: string;
  procedure: string;
  failed_step: { title: string; detail: string };
  note: string;
  completed_steps: string[];
  readings: RepairInput["readings"];
}

export interface MeasuredStats {
  count: number;
  boards: number;
  min: number;
  max: number;
}

export interface CapturePoint {
  id: string | null;
  test_point: string;
  mode: MeterMode;
  unit: string;
  hint: string;
  origin: string;
  measured: MeasuredStats | null;
  reference: { min: number; max: number; source: string } | null;
  captured_on_board: boolean;
}

export interface CapturePlan {
  device: string;
  board_rev: string | null;
  points: CapturePoint[];
}

export interface ImportRow {
  test_point: string;
  mode: MeterMode;
  hint?: string;
  expected?: number;
  expected_min?: number;
  expected_max?: number;
}

export interface Coverage {
  device: string;
  board_rev: string | null;
  level: "none" | "low" | "ok";
  counts: {
    reference_values: number;
    known_good_boards: number;
    repairs: number;
    schematics: number;
    knowledge_chunks: number;
    patterns: number;
  };
  targets: { reference_values: number; repairs: number };
}

export interface Pattern {
  id: string;
  device_model: string;
  board_rev: string | null;
  revisions: string[];
  symptom: string;
  root_cause: string;
  fix: string;
  parts: string;
  count: number;
  status: "auto" | "verified" | "dismissed";
  last_seen: string;
}

export interface StepPhoto {
  id: string;
  step_id: string;
  width: number;
  height: number;
  markers: Record<string, [number, number]>;
}

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    throw new ApiError(`Backend unreachable at ${API_URL} (${(err as Error).message})`);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof data.detail === "string" ? data.detail : `HTTP ${res.status}`;
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const query = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const api = {
  getMode: () => request<ModeStatus>("/api/mode"),
  setMode: (mode: AppMode) => request<ModeStatus>("/api/mode", json("POST", { mode })),

  listSchematics: (deviceModel?: string, boardRevision?: string) =>
    request<SchematicSummary[]>(`/api/schematics${query({ device_model: deviceModel, board_revision: boardRevision })}`),
  getSchematic: (id: string) => request<SchematicDetail>(`/api/schematics/${id}`),
  uploadSchematic: (form: FormData) => request<SchematicSummary>("/api/schematics", { method: "POST", body: form }),
  editPage: (id: string, n: number, text: string) =>
    request<SchematicDetail>(`/api/schematics/${id}/pages/${n}`, json("PUT", { text })),
  rescanPage: (id: string, n: number) =>
    request<SchematicDetail>(`/api/schematics/${id}/pages/${n}/rescan`, { method: "POST" }),
  retrySchematic: (id: string) => request<SchematicDetail>(`/api/schematics/${id}/retry`, { method: "POST" }),
  deleteSchematic: (id: string) => request<{ deleted: string }>(`/api/schematics/${id}`, { method: "DELETE" }),
  pageImageUrl: (id: string, n: number) => `${API_URL}/api/schematics/${id}/pages/${n}/image`,

  listReference: (deviceModel: string, boardRevision?: string) =>
    request<ReferenceValue[]>(`/api/reference${query({ device_model: deviceModel, board_revision: boardRevision })}`),
  addReference: (body: ReferenceInput) => request<ReferenceValue>("/api/reference", json("POST", body)),
  deleteReference: (id: string) => request<{ deleted: string }>(`/api/reference/${id}`, { method: "DELETE" }),
  listBoards: (deviceModel: string) => request<string[]>(`/api/boards${query({ device_model: deviceModel })}`),

  suggestSteps: (body: SuggestInput, signal?: AbortSignal) =>
    request<{ steps: SuggestedStep[]; patterns: SuggestedStep[]; sources: { source: string }[] }>("/api/steps/suggest", {
      ...json("POST", body),
      signal,
    }),

  capturePlan: (deviceModel: string, boardRevision: string, boardLabel: string) =>
    request<CapturePlan>(`/api/capture/plan${query({ device_model: deviceModel, board_revision: boardRevision, board_label: boardLabel })}`),
  addCaptureSample: (body: { device_model: string; board_revision: string; board_label: string; test_point: string; mode: MeterMode; value: number }) =>
    request<{ saved: boolean; measured: MeasuredStats; reference: ReferenceValue; outside_reference: boolean }>("/api/capture/samples", json("POST", body)),
  addCapturePoint: (body: { device_model: string; board_revision: string; test_point: string; mode: MeterMode; hint: string; source: string }) =>
    request<{ ok: boolean }>("/api/capture/points", json("POST", body)),
  deleteCapturePoint: (id: string) => request<{ deleted: string }>(`/api/capture/points/${id}`, { method: "DELETE" }),
  importCapturePoints: (body: { device_model: string; board_revision: string; source: string; rows: ImportRow[] }) =>
    request<{ added: number; updated: number; reference_values: number }>("/api/capture/import", json("POST", body)),
  coverage: (deviceModel: string, boardRevision: string) =>
    request<Coverage>(`/api/coverage${query({ device_model: deviceModel, board_revision: boardRevision })}`),
  logReading: (body: {
    device_model: string;
    board_revision: string;
    session_id: string;
    step: string;
    test_point: string;
    mode: MeterMode;
    value: number | null;
    expected_min: number | null;
    expected_max: number | null;
    status: "ok" | "fault" | "unknown";
  }) => request<{ saved: boolean; id: string }>("/api/readings", json("POST", body)),

  listPatterns: (deviceModel: string) => request<Pattern[]>(`/api/patterns${query({ device_model: deviceModel })}`),
  setPatternStatus: (id: string, status: Pattern["status"]) =>
    request<Pattern>(`/api/patterns/${id}/status`, json("POST", { status })),

  listStepPhotos: (deviceModel: string) => request<StepPhoto[]>(`/api/step-photos${query({ device_model: deviceModel })}`),
  uploadStepPhoto: (form: FormData) => request<StepPhoto>("/api/step-photos", { method: "POST", body: form }),
  saveStepMarkers: (id: string, markers: StepPhoto["markers"]) =>
    request<StepPhoto>(`/api/step-photos/${id}/markers`, json("PUT", { markers })),
  deleteStepPhoto: (id: string) => request<{ deleted: string }>(`/api/step-photos/${id}`, { method: "DELETE" }),
  stepPhotoUrl: (id: string) => `${API_URL}/api/step-photos/${id}/image`,

  saveRepair: (body: RepairInput) => request<RepairRecord & { patterns?: Pattern[] }>("/api/repairs", json("POST", body)),
  listRepairs: (deviceModel?: string) => request<RepairRecord[]>(`/api/repairs${query({ device_model: deviceModel })}`),
  deleteRepair: (id: string) => request<{ deleted: string }>(`/api/repairs/${id}`, { method: "DELETE" }),
};
