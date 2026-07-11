# Combined launch video — Best Route + SafeLoop Agent Chat

## Assets

- HD MP4: `docs/assets/launch/quorum-router-best-route-agent-chat.mp4`
- animated GIF: `docs/assets/launch/quorum-router-best-route-agent-chat.gif`
- poster: `docs/assets/launch/quorum-router-best-route-agent-chat-poster.jpg`
- deterministic renderer: `scripts/render-launch-demo.py`

## Storyboard

|      Time | Surface         | Proof shown                                                                                                  |
| --------: | --------------- | ------------------------------------------------------------------------------------------------------------ |
|    0–2.5s | Product promise | One prompt, best route, execution with proof                                                                 |
|  2.5–7.5s | Best Route      | Capability/reliability/diversity comparison and explainable selection                                        |
| 7.5–18.5s | Agent Chat      | Strategist → coder → SafeLoop approval → reviewer objection → repair → second approval → red team → closeout |
|  18.5–22s | Close           | “Route with judgment. Execute with proof.” and canonical GitHub URL                                          |

## Launch caption

> QuorumRouter does more than choose a model. Best Route finds the strongest
> answer path; SafeLoop Agent Chat turns a complex request into a bounded,
> operator-approved plan → execute → review → repair → red-team loop — with
> every write digest-bound and verified before closeout.

## Claims boundary

This is a deterministic launch visualization, not a recording of live external
model/API traffic. The workflow and status transitions mirror the verified
QuorumRouter + SafeLoop E2E contract. It must not be described as unrestricted
autonomy, self-approval, automatic GitHub publication, or live model footage.

## Rebuild

```bash
python3 scripts/render-launch-demo.py \
  --output docs/assets/launch/quorum-router-best-route-agent-chat.mp4 \
  --poster docs/assets/launch/quorum-router-best-route-agent-chat-poster.jpg

ffmpeg -y -i docs/assets/launch/quorum-router-best-route-agent-chat.mp4 \
  -vf "fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 docs/assets/launch/quorum-router-best-route-agent-chat.gif
```
