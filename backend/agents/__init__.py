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
                "Look up the repair manuals and notes: schematics, boardview data, test points, "
                "expected voltages or diode-mode values, IC and component locations, fault "
                "diagnosis procedures, error codes, beep codes, teardown steps and screw sizes."
            ),
        ),
    ]
}

DIRECT = "respond"
