import logging

from knowledge import detect_device, search
from state import AgentState

log = logging.getLogger(__name__)


def schematic_rag_node(state: AgentState) -> dict:
    session = state.get("session", {})
    question = state["messages"][-1].content
    device = detect_device(session.get("device_model"), question)
    query = " ".join(filter(None, [state.get("issue"), question]))

    try:
        docs = search(query, device)
    except Exception as exc:
        log.warning("Knowledge base search failed: %s", exc)
        docs = []

    return {"context": docs, "trace": ["schematic_rag"]}
