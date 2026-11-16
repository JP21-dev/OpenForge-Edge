import { readingStatus, type ChatMessage, type CopilotSource, type MeterReading } from "@/store/useRepairStore";
import { API_URL } from "@/lib/api";
const MAX_HISTORY = 20;
const MAX_READINGS = 10;

interface CopilotContext {
  sessionId: string;
  deviceModel: string;
  boardRevision?: string;
  currentStep?: string;
  schematic?: string;
  readings: MeterReading[];
  deep?: boolean;
}

export interface CopilotReply {
  reply: string;
  route?: string;
  sources: CopilotSource[];
  model?: string;
}

export interface CopilotHandlers {
  onRoute?: (route: string, issue: string) => void;
  onSources?: (sources: CopilotSource[]) => void;
  onToken?: (text: string) => void;
  onThinking?: () => void;
}

type StreamEvent =
  | { type: "route"; route: string; issue: string }
  | { type: "sources"; sources: CopilotSource[] }
  | { type: "token"; text: string }
  | { type: "thinking" }
  | { type: "done"; reply: string; trace: string[]; model?: string }
  | { type: "error"; detail: string };

export async function askCopilot(
  message: string,
  history: ChatMessage[],
  ctx: CopilotContext,
  handlers: CopilotHandlers = {},
): Promise<CopilotReply> {
  const body = {
    message,
    session: {
      session_id: ctx.sessionId,
      device_model: ctx.deviceModel,
      board_revision: ctx.boardRevision || undefined,
      current_step: ctx.currentStep,
      active_schematic: ctx.schematic,
      deep: ctx.deep ?? false,
      history: history
        .filter((m) => m.role !== "system")
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content })),
      readings: ctx.readings.slice(0, MAX_READINGS).map((r) => ({
        test_point: r.testPoint,
        mode: r.mode,
        value: r.value,
        unit: r.unit,
        expected_min: r.expected?.min ?? null,
        expected_max: r.expected?.max ?? null,
        status: readingStatus(r),
      })),
    },
  };

  const result: CopilotReply = { reply: "", sources: [] };

  const handle = (event: StreamEvent) => {
    switch (event.type) {
      case "route":
        result.route = event.route;
        handlers.onRoute?.(event.route, event.issue);
        break;
      case "sources":
        result.sources = event.sources;
        handlers.onSources?.(event.sources);
        break;
      case "token":
        result.reply += event.text;
        handlers.onToken?.(event.text);
        break;
      case "thinking":
        handlers.onThinking?.();
        break;
      case "done":
        result.reply = event.reply;
        result.model = event.model;
        break;
      case "error":
        result.reply = `⚠ ${event.detail}`;
        break;
    }
  };

  try {
    const res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      const detail = typeof data.detail === "string" ? data.detail : `HTTP ${res.status}`;
      return { reply: `⚠ ${detail}`, sources: [] };
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) handle(JSON.parse(line));
    }
    if (buffer.trim()) handle(JSON.parse(buffer));

    if (!result.reply) result.reply = "(empty response)";
    return result;
  } catch (err) {
    return {
      reply: `⚠ Backend unreachable (${(err as Error).message}). Check that the stack is running: docker compose ps`,
      sources: [],
    };
  }
}
