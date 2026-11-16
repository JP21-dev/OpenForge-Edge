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

  saveRepair: (body: RepairInput) => request<RepairRecord>("/api/repairs", json("POST", body)),
  listRepairs: (deviceModel?: string) => request<RepairRecord[]>(`/api/repairs${query({ device_model: deviceModel })}`),
  deleteRepair: (id: string) => request<{ deleted: string }>(`/api/repairs/${id}`, { method: "DELETE" }),
};
