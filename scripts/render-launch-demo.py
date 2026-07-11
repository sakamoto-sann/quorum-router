#!/usr/bin/env python3
"""Render the QuorumRouter combined Best Route + SafeLoop Agent Chat launch demo."""
from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, DURATION = 1280, 720, 30, 22
BG = (5, 8, 18)
WHITE = (238, 244, 255)
MUTED = (138, 153, 184)
CYAN = (60, 220, 255)
VIOLET = (150, 92, 255)
GREEN = (68, 232, 159)
AMBER = (255, 188, 75)
RED = (255, 104, 126)
PANEL = (14, 20, 39)

FONT_REG = "/System/Library/Fonts/SFNS.ttf"
FONT_BOLD = "/System/Library/Fonts/SFNSRounded.ttf"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"


def font(size: int, bold: bool = False, mono: bool = False):
    path = FONT_MONO if mono else FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(path, size)


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def alpha_color(c, a):
    return (*c, int(a))


def text(draw, xy, s, size, color=WHITE, bold=False, mono=False, anchor="la"):
    draw.text(xy, s, font=font(size, bold, mono), fill=color, anchor=anchor)


def glow(base: Image.Image, box, color, radius=20, width=3):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, 20, outline=alpha_color(color, 170), width=width)
    blur = layer.filter(ImageFilter.GaussianBlur(radius))
    base.alpha_composite(blur)


def panel(draw, box, fill=PANEL, outline=(35, 47, 79), radius=18, width=2):
    draw.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)


def pill(draw, x, y, label, color, width=None):
    f = font(16, True)
    bbox = draw.textbbox((0, 0), label, font=f)
    w = width or bbox[2] - bbox[0] + 26
    dark = tuple(max(8, int(channel * 0.18)) for channel in color)
    draw.rounded_rectangle((x, y, x + w, y + 31), 15, fill=dark, outline=color, width=1)
    draw.text((x + w / 2, y + 16), label, font=f, fill=WHITE, anchor="mm")
    return w


def background(t):
    im = Image.new("RGBA", (W, H), (*BG, 255))
    d = ImageDraw.Draw(im)
    # Subtle moving grid and two blurred color fields.
    offset = int((t * 13) % 48)
    for x in range(-48 + offset, W, 48):
        d.line((x, 0, x, H), fill=(25, 36, 66, 45), width=1)
    for y in range(-48 + offset, H, 48):
        d.line((0, y, W, y), fill=(25, 36, 66, 35), width=1)
    field = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(field)
    fd.ellipse((-140 + 30 * math.sin(t / 3), -180, 450, 400), fill=(*VIOLET, 48))
    fd.ellipse((850, 330 + 25 * math.cos(t / 2), 1460, 920), fill=(*CYAN, 35))
    im.alpha_composite(field.filter(ImageFilter.GaussianBlur(90)))
    return im


def header(draw, mode=None):
    text(draw, (52, 42), "QUORUM", 23, WHITE, True)
    text(draw, (173, 42), "ROUTER", 23, CYAN, True)
    if mode:
        pill(draw, 1045, 28, mode, VIOLET if "AGENT" in mode else CYAN, 180)


def scene_intro(im, t):
    d = ImageDraw.Draw(im)
    header(d)
    k = ease(t / 1.2)
    y = 300 - 28 * k
    text(d, (W / 2, y), "One prompt.", 64, WHITE, True, anchor="mm")
    text(d, (W / 2, y + 75), "The best route.", 64, CYAN, True, anchor="mm")
    text(d, (W / 2, y + 137), "Execution with proof.", 32, MUTED, False, anchor="mm")
    # Three animated trust markers.
    labels = [("ROUTE", CYAN), ("DEBATE", VIOLET), ("VERIFY", GREEN)]
    for i, (label, color) in enumerate(labels):
        x = 430 + i * 150
        a = ease((t - 0.5 - i * 0.15) / 0.7)
        if a > 0:
            pill(d, x - 48, 520, label, color, 112)


def scene_route(im, t):
    d = ImageDraw.Draw(im)
    header(d, "BEST ROUTE")
    text(d, (52, 105), "Choose the safest launch fix — then explain why.", 31, WHITE, True)
    text(d, (52, 145), "QuorumRouter compares capability, reliability, cost and diversity.", 19, MUTED)
    cards = [
        ("GROK", "fast critic", 92, CYAN),
        ("CLAUDE", "deep reviewer", 89, VIOLET),
        ("LOCAL QWEN", "private verifier", 84, GREEN),
    ]
    progress = ease(t / 2.5)
    for i, (name, role, score, color) in enumerate(cards):
        x0 = 52 + i * 400
        box = (x0, 210, x0 + 360, 470)
        if i == 0 and t > 2.6:
            glow(im, box, CYAN, 16, 3)
        panel(d, box, fill=(14, 20, 39), outline=color if i == 0 and t > 2.6 else (35, 47, 79))
        pill(d, x0 + 22, 232, role.upper(), color)
        text(d, (x0 + 22, 296), name, 29, WHITE, True)
        current = int(score * progress)
        text(d, (x0 + 322, 297), str(current), 42, color, True, anchor="ra")
        metrics = [("Capability", score), ("Reliability", score - 4), ("Diversity", score - 9)]
        for j, (m, v) in enumerate(metrics):
            yy = 350 + j * 34
            text(d, (x0 + 22, yy), m, 15, MUTED)
            d.rounded_rectangle((x0 + 132, yy - 6, x0 + 322, yy + 6), 6, fill=(28, 38, 66))
            d.rounded_rectangle((x0 + 132, yy - 6, x0 + 132 + 190 * v / 100 * progress, yy + 6), 6, fill=color)
    if t > 2.8:
        box = (280, 525, 1000, 635)
        glow(im, box, GREEN, 14, 2)
        panel(d, box, fill=(11, 33, 31), outline=GREEN)
        pill(d, 305, 546, "SELECTED", GREEN, 115)
        text(d, (445, 563), "Grok critic + independent review", 25, WHITE, True)
        text(d, (445, 596), "Reason: strongest score without collapsing reviewer diversity", 17, MUTED)


def role_node(d, x, y, label, sub, color, active=False, done=False):
    box = (x, y, x + 212, y + 76)
    fill = (12, 31, 34) if done else (20, 18, 42) if active else PANEL
    outline = GREEN if done else color if active else (38, 48, 77)
    panel(d, box, fill=fill, outline=outline, radius=15, width=2)
    d.ellipse((x + 16, y + 21, x + 46, y + 51), fill=color if active else GREEN if done else (50, 61, 89))
    if done:
        text(d, (x + 31, y + 36), "✓", 17, BG, True, anchor="mm")
    else:
        text(d, (x + 31, y + 36), str(label[0]), 16, BG, True, anchor="mm")
    text(d, (x + 59, y + 27), label, 18, WHITE, True)
    text(d, (x + 59, y + 51), sub, 13, MUTED)


def scene_agent(im, t):
    d = ImageDraw.Draw(im)
    header(d, "AGENT CHAT")
    text(d, (52, 98), "A reviewer objects. The agent fixes it. SafeLoop proves every write.", 29, WHITE, True)
    text(d, (52, 137), "Not a chatbot transcript — a bounded plan → execute → review → repair loop.", 18, MUTED)
    stages = [
        ("STRATEGIST", "plan locked", VIOLET, "Plan: patch README claim"),
        ("CODER", "proposal only", CYAN, "- experimental  + production, bounded"),
        ("SAFELOOP", "operator gate", GREEN, "sha256:8f2a…  APPROVED  VERIFIED"),
        ("REVIEWER", "objection", AMBER, "Objection: add explicit trust boundary"),
        ("CODER", "repair", CYAN, "+ requester never receives signing key"),
        ("SAFELOOP", "second gate", GREEN, "sha256:b931…  APPROVED  VERIFIED"),
        ("RED TEAM", "adversarial", RED, "PASS — no key path in requester process"),
        ("CLOSEOUT", "artifact ready", GREEN, "PR READY  •  audit bound  •  258 tests"),
    ]
    stage = min(len(stages) - 1, max(0, int(t / 1.15)))
    # Left role rail.
    role_data = [
        ("STRATEGIST", "scope + plan", VIOLET),
        ("CODER", "structured patch", CYAN),
        ("SAFELOOP", "execution authority", GREEN),
        ("REVIEWER", "blocks closeout", AMBER),
        ("RED TEAM", "adversarial gate", RED),
        ("CLOSEOUT", "verified result", GREEN),
    ]
    stage_to_role = [0, 1, 2, 3, 1, 2, 4, 5]
    active_role = stage_to_role[stage]
    for i, (label, sub, color) in enumerate(role_data):
        role_node(d, 52, 185 + i * 83, label, sub, color, active=i == active_role, done=i < active_role and stage > 0)
        if i < len(role_data) - 1:
            d.line((158, 261 + i * 83, 158, 268 + i * 83), fill=(55, 70, 105), width=2)
    # Right execution canvas.
    panel(d, (300, 185, 1228, 680), fill=(8, 12, 26), outline=(42, 55, 91), radius=20)
    pill(d, 326, 209, f"STEP {stage + 1} / {len(stages)}", stages[stage][2], 130)
    text(d, (478, 226), stages[stage][0], 22, stages[stage][2], True)
    text(d, (326, 281), stages[stage][3], 25, WHITE, True, mono=True)
    # Timeline rows remain visible as proof accumulates.
    visible = min(stage + 1, 6)
    start = max(0, stage - 5)
    for row, idx in enumerate(range(start, start + visible)):
        yy = 340 + row * 48
        name, _, color, message = stages[idx]
        d.line((347, yy + 5, 347, yy + 45), fill=(45, 57, 89), width=2)
        d.ellipse((337, yy - 5, 357, yy + 15), fill=color)
        text(d, (375, yy + 5), name, 14, color, True)
        text(d, (493, yy + 5), message, 16, WHITE if idx == stage else MUTED, mono=True)
    # Security shield pulse during SafeLoop stages.
    if active_role == 2:
        pulse = 1 + 0.06 * math.sin(t * 9)
        cx, cy = 1122, 255
        r = int(27 * pulse)
        d.regular_polygon((cx, cy, r), 6, rotation=30, fill=(10, 48, 38), outline=GREEN)
        text(d, (cx, cy), "✓", 24, GREEN, True, anchor="mm")
    banners = {
        2: ("OPERATOR APPROVED  •  WRITE VERIFIED", GREEN),
        3: ("OBJECTION  →  CLOSEOUT BLOCKED", AMBER),
        4: ("FIX LOOP  •  NEW DIGEST REQUIRED", CYAN),
        5: ("SECOND APPROVAL  •  REPAIR VERIFIED", GREEN),
        6: ("ADVERSARIAL REVIEW  •  PASS", RED),
        7: ("READY TO SHIP  •  AUDIT BOUND", GREEN),
    }
    if stage in banners:
        label, color = banners[stage]
        box = (515, 615, 1015, 655)
        glow(im, box, color, 12, 2)
        dark = tuple(max(8, int(channel * 0.16)) for channel in color)
        d.rounded_rectangle(box, 19, fill=dark, outline=color, width=2)
        text(d, (765, 635), label, 16, color, True, anchor="mm")
    text(d, (1210, 657), "deterministic launch visualization • no live model/API calls", 12, (94, 108, 138), anchor="ra")


def scene_final(im, t):
    d = ImageDraw.Draw(im)
    header(d)
    a = ease(t / 1.0)
    text(d, (W / 2, 235), "Route with judgment.", 58, WHITE, True, anchor="mm")
    text(d, (W / 2, 310), "Execute with proof.", 58, GREEN, True, anchor="mm")
    text(d, (W / 2, 387), "Best Route + SafeLoop Agent Chat", 27, MUTED, anchor="mm")
    labels = [("MULTI-MODEL", CYAN), ("HUMAN APPROVAL", VIOLET), ("FAIL-CLOSED", GREEN)]
    for i, (label, color) in enumerate(labels):
        pill(d, 363 + i * 190, 450, label, color, 172)
    text(d, (W / 2, 552), "github.com/sakamoto-sann/quorum-router", 22, WHITE, True, mono=True, anchor="mm")
    d.rounded_rectangle((430, 594, 850, 598), 2, fill=GREEN)
    text(d, (W / 2, 630), "Source-Available Non-Commercial", 15, MUTED, anchor="mm")


def frame_at(t: float) -> Image.Image:
    im = background(t)
    if t < 2.5:
        scene_intro(im, t)
    elif t < 7.5:
        scene_route(im, t - 2.5)
    elif t < 18.5:
        scene_agent(im, t - 7.5)
    else:
        scene_final(im, t - 18.5)
    return im.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True)
    ap.add_argument("--poster")
    args = ap.parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output),
    ]
    proc = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for i in range(FPS * DURATION):
        proc.stdin.write(frame_at(i / FPS).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    if args.poster:
        poster = Path(args.poster)
        poster.parent.mkdir(parents=True, exist_ok=True)
        frame_at(15.7).save(poster, quality=95)


if __name__ == "__main__":
    main()
