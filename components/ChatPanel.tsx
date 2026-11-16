"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, FileText, History, Loader2, Mic, SendHorizonal, Wrench, ZoomIn } from "lucide-react";
import { selectCurrentStep, selectProcedure, useRepairStore, type ChatMessage } from "@/store/useRepairStore";
import { askCopilot } from "@/lib/copilot";
import { CoverageBanner } from "@/components/CoverageBanner";

const QUICK_PROMPTS = [
  "What do I measure next?",
  "Expected value here?",
  "Is this reading bad?",
  "Safety check",
];

const ROUTE_STATUS: Record<string, string> = {
  schematic_rag: "Searching schematics…",
  respond: "Writing answer…",
};

export function ChatPanel() {
  const messages = useRepairStore((s) => s.messages);
  const thinking = useRepairStore((s) => s.isCopilotThinking);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const last = messages.at(-1);
  const awaitingFirstToken = thinking && last?.role === "copilot" && !last.content;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, last?.content.length, thinking]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;
    setInput("");

    const store = useRepairStore.getState();
    const history = store.messages;
    store.addMessage("technician", content);
    const { id } = store.addMessage("copilot", "");
    const update = useRepairStore.getState().updateMessage;
    setStatus("Triaging issue…");
    store.setCopilotThinking(true);
    try {
      const result = await askCopilot(
        content,
        history,
        {
          sessionId: store.sessionId,
          deviceModel: store.deviceModel,
          boardRevision: store.boardRevision,
          currentStep: `${selectProcedure(store).title}: step ${store.currentStepIndex + 1}, ${selectCurrentStep(store)?.title ?? ""}`,
          readings: store.readings,
          schematic: store.activeSchematic?.name,
        },
        {
          onRoute: (route) => setStatus(ROUTE_STATUS[route] ?? `Consulting ${route.replace(/_/g, " ")}…`),
          onSources: (sources) => {
            update(id, () => ({ sources }));
            setStatus(ROUTE_STATUS.respond);
          },
          onToken: (t) => update(id, (m) => ({ content: m.content + t })),
        },
      );
      update(id, () => ({ content: result.reply, sources: result.sources }));
    } finally {
      useRepairStore.getState().setCopilotThinking(false);
      inputRef.current?.focus();
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Copilot chat">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-8" aria-live="polite">
        <CoverageBanner />
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {awaitingFirstToken && (
          <div className="flex items-center gap-3 text-xl text-bench-muted">
            <Loader2 className="size-7 animate-spin text-bench-accent" aria-hidden />
            {status}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-bench-border bg-bench-panel px-4 pb-4 pt-3 md:px-8">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={thinking}
              className="shrink-0 rounded-full border-2 border-bench-border bg-bench-raised px-5 py-3 text-lg font-semibold hover:border-bench-accent disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-3"
        >
          <button
            type="button"
            disabled
            aria-label="Voice input (local speech-to-text not yet connected)"
            title="Voice input — local STT coming soon"
            className="grid size-16 shrink-0 place-items-center rounded-2xl border-2 border-bench-border bg-bench-raised text-bench-muted disabled:opacity-50"
          >
            <Mic className="size-8" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Describe the symptom or ask the copilot…"
            aria-label="Message the copilot"
            className="max-h-40 min-h-16 flex-1 resize-none rounded-2xl border-2 border-bench-border bg-bench-bg px-5 py-4 text-xl placeholder:text-bench-muted focus:border-bench-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            aria-label="Send"
            className="grid size-16 shrink-0 place-items-center rounded-2xl bg-bench-accent text-black transition-opacity disabled:opacity-30"
          >
            <SendHorizonal className="size-8" />
          </button>
        </form>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const openViewer = useRepairStore((s) => s.openViewer);
  if (message.role === "system") {
    return (
      <p className="mx-auto max-w-3xl rounded-lg border border-dashed border-bench-border px-4 py-2 text-center text-lg text-bench-muted">
        {message.content}
      </p>
    );
  }
  if (!message.content) return null;

  const isTech = message.role === "technician";
  return (
    <div className={`flex gap-3 ${isTech ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid size-12 shrink-0 place-items-center rounded-xl ${
          isTech ? "bg-bench-raised text-bench-text" : "bg-bench-accent text-black"
        }`}
        aria-hidden
      >
        {isTech ? <Wrench className="size-6" /> : <Bot className="size-6" />}
      </div>
      <div
        className={`max-w-[min(48rem,85%)] whitespace-pre-wrap rounded-2xl px-5 py-4 text-xl leading-relaxed md:text-2xl ${
          isTech
            ? "bg-bench-raised"
            : "border-2 border-bench-accent/40 bg-bench-panel"
        }`}
      >
        <span className="sr-only">{isTech ? "You: " : "Copilot: "}</span>
        {message.content}
        {!!message.sources?.length && (
          <ul className="mt-4 space-y-2 border-t border-bench-border pt-3 text-base leading-snug md:text-lg">
            {message.sources.map((s, i) => {
              const Icon = s.source.startsWith("Past repair") ? History : FileText;
              const schematicId = s.schematic_id;
              return (
                <li key={`${s.source}-${i}`} className="flex gap-2">
                  <Icon className="mt-0.5 size-5 shrink-0 text-bench-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono font-semibold text-bench-accent">
                      {s.source}
                      {s.page != null && ` p.${s.page}`}
                      {s.board_rev && ` · ${s.board_rev}`}
                    </span>
                    <span className="line-clamp-3 text-bench-muted" title={s.text}>
                      {s.text}
                    </span>
                  </span>
                  {schematicId && (
                    <button
                      onClick={() => openViewer(schematicId, s.page ?? 1)}
                      className="flex h-11 shrink-0 items-center gap-1 self-start rounded-lg border-2 border-bench-border px-3 text-base font-semibold hover:border-bench-accent"
                    >
                      <ZoomIn className="size-5" aria-hidden />
                      View page
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
