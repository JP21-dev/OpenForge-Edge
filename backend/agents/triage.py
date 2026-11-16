import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from knowledge import detect_device
from llm import get_llm
from state import AgentState

log = logging.getLogger(__name__)

_RAG_HINTS = re.compile(
    r"\b(schematic|boardview|voltage|rail|pin|diode|resistance|ohm|test ?point|measure|expected|pp_\w+|[a-z]\d{3,5})\b",
    re.IGNORECASE,
)


def _prompt(specialists: dict, direct: str, session: dict) -> str:
    options = "\n".join(f'- "{name}": {s.description}' for name, s in specialists.items())
    return f"""You are the TriageAgent for a hardware repair copilot.
Device: {session.get("device_model") or "unknown"}
Current diagnostic step: {session.get("current_step") or "none"}

Identify the technician's repair issue in under 12 words, then choose ONE route:
{options}
- "{direct}": general advice, safety questions, or anything the routes above don't cover.

Reply with only a JSON object: {{"issue": "<short issue>", "route": "<route name>"}}"""


def _parse(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return json.loads(match.group(0)) if match else {}


def triage_node(state: AgentState) -> dict:
    from agents import DIRECT, SPECIALISTS

    question = state["messages"][-1].content
    session = state.get("session", {})

    try:
        raw = get_llm(json_mode=True, deep=bool(session.get("deep"))).invoke(
            [SystemMessage(_prompt(SPECIALISTS, DIRECT, session)), HumanMessage(question)]
        )
        result = _parse(raw.content)
    except Exception as exc:
        log.warning("Triage LLM failed, using keyword fallback: %s", exc)
        result = {}

    route = result.get("route")
    if route not in SPECIALISTS and route != DIRECT:
        route = "schematic_rag" if _RAG_HINTS.search(question) else DIRECT
    if route == DIRECT and detect_device(session.get("device_model"), question):
        route = "schematic_rag"

    return {
        "issue": str(result.get("issue") or question[:80]),
        "route": route,
        "trace": ["triage"],
    }
