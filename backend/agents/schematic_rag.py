import logging

from knowledge import detect_device, search
from state import AgentState

log = logging.getLogger(__name__)


def _reading_terms(readings: list[dict]) -> str:
    faults = [r for r in readings if r.get("status") == "fault"][:3]
    terms = [f"{r.get('test_point')} {'low' if _is_low(r) else 'high'} missing" for r in faults]
    if readings and readings[0] not in faults:
        terms.append(str(readings[0].get("test_point", "")))
    return " ".join(terms)


def _is_low(reading: dict) -> bool:
    value, low = reading.get("value"), reading.get("expected_min")
    return value is not None and low is not None and value < low


def schematic_rag_node(state: AgentState) -> dict:
    session = state.get("session", {})
    question = state["messages"][-1].content
    device = detect_device(session.get("device_model"), question)
    query = " ".join(filter(None, [state.get("issue"), question, _reading_terms(session.get("readings", []))]))

    try:
        docs = search(query, device)
    except Exception as exc:
        log.warning("Knowledge base search failed: %s", exc)
        docs = []

    return {"context": docs, "trace": ["schematic_rag"]}
