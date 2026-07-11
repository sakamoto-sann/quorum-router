# Agent Chat CLI video

![Grok vs GLM Agent Chat](../assets/launch/quorum-router-agent-chat.gif)

[HD MP4](../assets/launch/quorum-router-agent-chat.mp4)

The 26-second CLI visualization shows two different named models sharing context
and directly responding to each other:

1. Grok proposes an opening.
2. GLM disagrees and explains the counterplay.
3. Grok reads that objection and changes strategy.
4. GLM challenges the revised line.
5. Grok answers the challenge.
6. GLM converges on the revised move.

Required visual markers include `replying to GROK`, `replying to GLM`,
`COUNTERARGUMENT`, `STRATEGY REVISED`, `CHALLENGE`, and `CONSENSUS`.

This is a deterministic CLI conversation fixture, not live external model/API
traffic. SafeLoop logs are intentionally absent because the point of this video
is the inter-model dialogue itself.
