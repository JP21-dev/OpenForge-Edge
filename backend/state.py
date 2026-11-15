import operator
from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class SessionInfo(TypedDict, total=False):
    device_model: str
    current_step: str
    active_schematic: str


class RetrievedDoc(TypedDict):
    source: str
    page: int | None
    text: str
    score: float


class AgentState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    session: SessionInfo

    issue: str
    route: str

    context: Annotated[list[RetrievedDoc], operator.add]
    trace: Annotated[list[str], operator.add]

    reply: str
