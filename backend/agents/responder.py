import json
import logging
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from llm import get_llm
from state import AgentState

log = logging.getLogger(__name__)

VALUE_QUESTION = re.compile(
    r"\b(voltage|volts?|reading|resistance|ohms?|diode|current draw|expected value|what should .+ (read|be|measure))\b",
    re.IGNORECASE,
)

NOT_COVERED = (
    "That value isn't in the knowledge base yet.\n"
    "1. Compare against a known-good board or your boardview.\n"
    "2. Once you have a trusted value, save it in the HUD's Reference tab so the copilot can use it."
)

COVERAGE_CHECK = """Reference excerpts:
{context}

Known-good reference values for this board:
{references}

Technician's logged meter readings (most recent first):
{readings}

Question: {question}

Does any excerpt, known-good reference value, or logged reading's expected range, explicitly state the requested value for exactly the same rail, pin, chip or part that the question names? A value for a different rail or part does not count. If the question asks about "this reading" or "my reading", it refers to the most recent logged reading.
Reply with only a JSON object: {{"covered": true}} or {{"covered": false}}"""

SYSTEM = """You are OpenForge Edge, an offline copilot for electronics repair technicians, speaking like an experienced bench tech.
The technician's hands are busy: answer in 3 to 8 short, numbered, actionable steps.
Match the question:
- "What should I do?" or a found fault: give the whole job in order: assess how bad it is, fix it, check before powering on, then test before the device goes back to the customer.
  Never stop at the diagnosis. The last numbered step is always the final test: "Before returning it: run a demanding game or stress test for 30 to 60 minutes while watching temperatures and the fan, then check every port and function the customer uses."
- A measurement or "what next?" question: give the next check first, then what each result means.
- A factual question: answer it directly in one or two lines.
When an excerpt contains a procedure for this exact job, follow its steps in order. Do not add steps from guides for a different job (for example a heatsink repaste when the problem is a noisy fan).
Never write "excerpt", "[1]" or similar, and never paste excerpt text: the technician already sees the sources under your answer.
The reference excerpts are ordered by relevance. Answer the technician's exact symptom or question from the excerpts that match it, and ignore excerpts about other faults.
Only state part numbers, designators, values, screw counts or tool sizes that appear in the excerpts, the known-good reference values or the logged readings. If they do not cover the question, say it is not in the knowledge base yet instead of guessing.
Use the logged meter readings when relevant. "This reading" means the most recent one. If the logged readings say (none), the technician has not measured anything yet: never describe a reading as in or out of range, only say what to measure and what value to expect. A reading marked OUT OF RANGE is a fault lead: name it and say what to check next. Judge a reading in or out of range only from its logged expected range, a known-good reference value, or a value stated in the excerpts. Known-good reference values were measured or confirmed by this shop and outrank excerpts. Values whose source starts with "Placeholder" are only typical values from an interface standard (USB, HDMI, battery chemistry), not measured on this board: say so when you use one.
Excerpts labelled "Past repair" are this shop's earlier jobs on the same device: mention a matching one as a lead ("a previous board with this symptom had …"), never as proof.
Excerpts labelled "Recurring pattern" summarise several fixed repairs with the same symptom and cause on this bench: when one matches, name it early as the most likely lead and say how many repairs it is based on.
Excerpts from schematics were transcribed by a vision model: when you rely on one, tell the technician which page to confirm it on.
A value for one rail, pin or part never answers a question about a different rail, pin or part.
Example: the excerpts give the 5 V USB rail, and the technician asks for the memory rail voltage. Correct answer: "The memory rail voltage isn't in the knowledge base yet. 1. Compare against a known-good board or your boardview." Wrong answer: "5 V".
Mention a safety hazard only when one specifically applies (for example liquid metal, mains power inside the power supply, or BGA rework).

Device: {device}
Board revision: {rev}
Current diagnostic step: {step}
Triaged issue: {issue}

Technician's logged meter readings (most recent first):
{readings}

Known-good reference values for this board:
{references}

Reference excerpts:
{context}"""

STATUS_LABEL = {"ok": "IN RANGE", "fault": "OUT OF RANGE", "unknown": "no expected range logged"}


def _format_readings(readings: list[dict]) -> str:
    if not readings:
        return "(none)"
    lines = []
    for r in readings:
        unit = r.get("unit", "")
        value = "no value" if r.get("value") is None else f"{r['value']} {unit}"
        expected = ""
        if r.get("expected_min") is not None and r.get("expected_max") is not None:
            expected = f", expected {r['expected_min']}–{r['expected_max']} {unit}"
        lines.append(f"- {r.get('test_point')} ({r.get('mode')}): {value}{expected} → {STATUS_LABEL.get(r.get('status'), 'unknown')}")
    return "\n".join(lines)


def _format_references(refs: list[dict]) -> str:
    if not refs:
        return "(none)"
    lines, typical = [], []
    for r in refs:
        if r.get("placeholder") or str(r.get("source", "")).startswith("Placeholder"):
            typical.append(
                f"- {r['test_point']} ({r['mode']}): typically {r['expected_min']}–{r['expected_max']} {r['unit']}"
                f" ({r['source'].removeprefix('Placeholder: ')})"
            )
            continue
        rev = f" [{r['board_rev']}]" if r.get("board_rev") else ""
        source = f" (source: {r['source']})" if r.get("source") else ""
        note = f" — {r['note']}" if r.get("note") else ""
        measured = r.get("measured")
        seen = f"; measured on {measured['boards']} good board(s): {measured['min']}–{measured['max']} {r['unit']}" if measured else ""
        lines.append(f"- {r['test_point']}{rev} ({r['mode']}): {r['expected_min']}–{r['expected_max']} {r['unit']}{source}{seen}{note}")
    out = "\n".join(lines) if lines else "(none measured yet)"
    if typical:
        out += (
            "\n\nTypical values only (placeholders from interface standards, NOT measured on this model or by this shop;"
            " when you quote one, call it a typical value):\n" + "\n".join(typical)
        )
    return out


def _format_context(docs: list[dict], numbered: bool = True) -> str:
    if not docs:
        return "(none)"
    lines = []
    for i, d in enumerate(docs, 1):
        page = f" p.{d['page']}" if d.get("page") else ""
        label = f"[{i}] " if numbered else "- "
        lines.append(f"{label}{d['source']}{page}: {d['text']}")
    return "\n".join(lines)


def _value_covered(question: str, context: str, readings: str, references: str, deep: bool = False) -> bool:
    try:
        raw = get_llm(json_mode=True, deep=deep).with_config(tags=["internal"]).invoke(
            [HumanMessage(COVERAGE_CHECK.format(context=context, readings=readings, references=references, question=question))]
        )
        match = re.search(r"\{.*\}", raw.content, re.DOTALL)
        return bool(json.loads(match.group(0)).get("covered", True)) if match else True
    except Exception as exc:
        log.warning("Coverage check failed, answering anyway: %s", exc)
        return True


def respond_node(state: AgentState) -> dict:
    session = state.get("session", {})
    question = state["messages"][-1].content
    context = _format_context(state.get("context", []), numbered=False)
    readings = _format_readings(session.get("readings", []))
    references = _format_references(state.get("references", []))

    deep = bool(session.get("deep"))
    if VALUE_QUESTION.search(question) and not _value_covered(question, context, readings, references, deep):
        return {
            "messages": [AIMessage(NOT_COVERED)],
            "reply": NOT_COVERED,
            "trace": ["respond:not_covered"],
        }

    system = SYSTEM.format(
        device=session.get("device_model") or "unknown",
        rev=session.get("board_revision") or "not set",
        step=session.get("current_step") or "none",
        issue=state.get("issue", "unknown"),
        readings=readings,
        references=references,
        context=context,
    )
    answer = get_llm(deep=deep).invoke([SystemMessage(system), *state["messages"]])
    return {
        "messages": [AIMessage(answer.content)],
        "reply": answer.content,
        "trace": ["respond"],
    }
