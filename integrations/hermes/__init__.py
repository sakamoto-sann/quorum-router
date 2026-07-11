"""Hermes plugin registration for QuorumRouter."""

from . import tools


def register(ctx) -> None:
    ctx.register_tool(
        name="quorum_router_route",
        toolset="quorum_router",
        schema=tools.ROUTE_SCHEMA,
        handler=tools.route,
        check_fn=tools.is_available,
        requires_env=[],
        description="Route a bounded text task through QuorumRouter",
        emoji="🧭",
    )
    ctx.register_tool(
        name="quorum_router_health",
        toolset="quorum_router",
        schema=tools.HEALTH_SCHEMA,
        handler=tools.health,
        check_fn=tools.is_available,
        requires_env=[],
        description="Check QuorumRouter provider readiness without generation",
        emoji="🩺",
    )
    ctx.register_tool(
        name="quorum_router_agent_chat",
        toolset="quorum_router",
        schema=tools.AGENT_CHAT_SCHEMA,
        handler=tools.agent_chat,
        check_fn=tools.is_available,
        requires_env=[],
        description="Run bounded live dialogue between distinct model providers",
        emoji="💬",
    )
