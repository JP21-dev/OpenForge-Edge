from langchain_core.messages import AIMessage, SystemMessage

from llm import get_llm
from state import AgentState

SYSTEM = """You are OpenForge Edge, an offline copilot for electronics repair technicians.
The technician's hands are busy: answer in short, numbered, actionable steps and lead with the single next action.
Flag safety hazards (high voltage, lithium cells, ESD) first.
Only cite values that appear in the reference excerpts; if none apply, say so instead of guessing.

Device: {device}
Current diagnostic step: {step}
Triaged issue: {issue}

Reference excerpts:
{context}"""


def _format_context(docs: list[dict]) -> str:
    if not docs:
        return "(none)"
    lines = []
    for i, d in enumerate(docs, 1):
        page = f" p.{d['page']}" if d.get("page") else ""
        lines.append(f"[{i}] {d['source']}{page}: {d['text']}")
    return "\n".join(lines)


def respond_node(state: AgentState) -> dict:
    session = state.get("session", {})
    system = SYSTEM.format(
        device=session.get("device_model") or "unknown",
        step=session.get("current_step") or "none",
        issue=state.get("issue", "unknown"),
        context=_format_context(state.get("context", [])),
    )
    answer = get_llm().invoke([SystemMessage(system), *state["messages"]])
    return {
        "messages": [AIMessage(answer.content)],
        "reply": answer.content,
        "trace": ["respond"],
    }
