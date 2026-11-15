from dataclasses import dataclass
from typing import Callable

from agents.schematic_rag import schematic_rag_node
from state import AgentState

NodeFn = Callable[[AgentState], dict]


@dataclass(frozen=True)
class Specialist:
    name: str
    node: NodeFn
    description: str


SPECIALISTS: dict[str, Specialist] = {
    s.name: s
    for s in [
        Specialist(
            name="schematic_rag",
            node=schematic_rag_node,
            description=(
                "Look up board schematics, boardview data, test points, expected voltages "
                "or diode-mode values, and component locations in the repair manuals."
            ),
        ),
    ]
}

DIRECT = "respond"
