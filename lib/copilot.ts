import type { ChatMessage, CopilotSource } from "@/store/useRepairStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_HISTORY = 20;

interface CopilotContext {
  sessionId: string;
  deviceModel: string;
  currentStep?: string;
  schematic?: string;
}

export interface CopilotReply {
  reply: string;
  route?: string;
  sources: CopilotSource[];
}

export interface CopilotHandlers {
  onRoute?: (route: string, issue: string) => void;
  onSources?: (sources: CopilotSource[]) => void;
  onToken?: (text: string) => void;
}

type StreamEvent =
  | { type: "route"; route: string; issue: string }
  | { type: "sources"; sources: CopilotSource[] }
  | { type: "token"; text: string }
  | { type: "done"; reply: string; trace: string[] }
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
      current_step: ctx.currentStep,
      active_schematic: ctx.schematic,
      history: history
        .filter((m) => m.role !== "system")
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content })),
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
      case "done":
        result.reply = event.reply;
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
      reply: `⚠ Backend unreachable at ${API_URL} (${(err as Error).message}). Start it with: uvicorn main:app --port 8000`,
      sources: [],
    };
  }
}
