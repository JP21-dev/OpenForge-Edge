from langgraph.graph import END, START, StateGraph

from agents import DIRECT, SPECIALISTS
from agents.responder import respond_node
from agents.triage import triage_node
from state import AgentState


def _route(state: AgentState) -> str:
    return state.get("route", DIRECT)


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("triage", triage_node)
    graph.add_node(DIRECT, respond_node)
    for name, spec in SPECIALISTS.items():
        graph.add_node(name, spec.node)
        graph.add_edge(name, DIRECT)

    graph.add_edge(START, "triage")
    graph.add_conditional_edges(
        "triage",
        _route,
        {**{name: name for name in SPECIALISTS}, DIRECT: DIRECT},
    )
    graph.add_edge(DIRECT, END)

    return graph.compile()


repair_graph = build_graph()
