"""Hermes plugin registration for Fusion Router."""

from . import tools


def register(ctx) -> None:
    ctx.register_tool(
        name="fusion_router_route",
        toolset="fusion_router",
        schema=tools.ROUTE_SCHEMA,
        handler=tools.route,
        check_fn=tools.is_available,
        requires_env=[],
        description="Route a bounded text task through Fusion Router",
        emoji="🧭",
    )
    ctx.register_tool(
        name="fusion_router_health",
        toolset="fusion_router",
        schema=tools.HEALTH_SCHEMA,
        handler=tools.health,
        check_fn=tools.is_available,
        requires_env=[],
        description="Check Fusion Router provider readiness without generation",
        emoji="🩺",
    )
