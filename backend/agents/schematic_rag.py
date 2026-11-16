import logging

import reference
from knowledge import resolve_device, search, search_history
from state import AgentState

log = logging.getLogger(__name__)

SCHEMATIC_K = 2


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
    device = resolve_device(session.get("device_model"), question)
    rev = session.get("board_revision")
    query = " ".join(filter(None, [state.get("issue"), question, _reading_terms(session.get("readings", []))]))

    docs: list[dict] = []
    try:
        docs = search(query, device, rev=rev)
        seen = {(d["source"], d["page"], d["text"]) for d in docs}
        for d in search(query, device, k=SCHEMATIC_K, rev=rev, doc_type="schematic"):
            if (d["source"], d["page"], d["text"]) not in seen:
                docs.append(d)
    except Exception as exc:
        log.warning("Knowledge base search failed: %s", exc)
    try:
        docs += search_history(query, device, rev=rev)
    except Exception as exc:
        log.warning("Repair history search failed: %s", exc)

    try:
        refs = reference.for_board(device, rev)
    except Exception as exc:
        log.warning("Reference values unavailable: %s", exc)
        refs = []

    return {"context": docs, "references": refs, "trace": ["schematic_rag"]}
