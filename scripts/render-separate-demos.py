#!/usr/bin/env python3
"""Render separate Best Route and multi-model Agent Chat launch videos."""
from __future__ import annotations
import argparse, math, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W,H,FPS=1280,720,30
BG=(5,8,18); PANEL=(12,18,34); WHITE=(240,245,255); MUTED=(140,155,184)
CYAN=(55,218,255); VIOLET=(158,102,255); GREEN=(65,232,157); AMBER=(255,188,74); RED=(255,105,128)
REG="/System/Library/Fonts/SFNS.ttf"; BOLD="/System/Library/Fonts/SFNSRounded.ttf"; MONO="/System/Library/Fonts/SFNSMono.ttf"

def f(n,b=False,m=False): return ImageFont.truetype(MONO if m else BOLD if b else REG,n)
def txt(d,xy,s,n,c=WHITE,b=False,m=False,a="la"): d.text(xy,s,font=f(n,b,m),fill=c,anchor=a)
def panel(d,b,fill=PANEL,out=(38,50,81),r=16,w=2): d.rounded_rectangle(b,r,fill=fill,outline=out,width=w)
def dark(c,k=.16): return tuple(max(7,int(x*k)) for x in c)
def pill(d,x,y,s,c,w):
    d.rounded_rectangle((x,y,x+w,y+30),15,fill=dark(c,.18),outline=c,width=1); txt(d,(x+w/2,y+15),s,15,WHITE,True,a="mm")
def base(t,mode):
    im=Image.new("RGBA",(W,H),(*BG,255)); d=ImageDraw.Draw(im)
    off=int(t*10)%48
    for x in range(-48+off,W,48): d.line((x,0,x,H),fill=(24,34,61,55))
    for y in range(-48+off,H,48): d.line((0,y,W,y),fill=(24,34,61,42))
    g=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(g)
    gd.ellipse((-120,-180,430,370),fill=(*VIOLET,48)); gd.ellipse((880,380,1420,900),fill=(*CYAN,36))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(90))); d=ImageDraw.Draw(im)
    txt(d,(42,35),"QUORUM",22,WHITE,True); txt(d,(158,35),"ROUTER",22,CYAN,True)
    pill(d,1050,22,mode,CYAN if mode=="BEST ROUTE" else VIOLET,185)
    return im

def terminal(d,box,title):
    panel(d,box,fill=(7,11,22),out=(43,58,91),r=18); x1,y1,x2,_=box
    d.rounded_rectangle((x1,y1,x2,y1+40),18,fill=(18,25,44)); d.rectangle((x1,y1+20,x2,y1+40),fill=(18,25,44))
    for i,c in enumerate((RED,AMBER,GREEN)): d.ellipse((x1+18+i*22,y1+14,x1+30+i*22,y1+26),fill=c)
    txt(d,(x1+98,y1+21),title,14,MUTED,True,m=True,a="lm")

def best_frame(t):
    im=base(t,"BEST ROUTE"); d=ImageDraw.Draw(im)
    txt(d,(42,90),"Independent answers in. One stronger answer out.",31,WHITE,True)
    terminal(d,(42,145,1238,665),"quorum — best_route")
    if t<2.2:
        txt(d,(72,205),"$ quorum run \"Find the race condition and propose the safest fix\" \\",20,GREEN,m=True)
        txt(d,(72,240),"    --mode best_route --models grok,claude,qwen",20,GREEN,m=True)
        if t>1: txt(d,(72,295),"Routing: parallel candidates • isolated context • no cross-talk",18,MUTED,m=True)
    else:
        cards=[("GROK","Fast diagnosis","Lock inversion in shutdown.","Serialize close after queue drain.",CYAN),
               ("CLAUDE","Deep analysis","Stale read before commit.","Move state check into transaction.",VIOLET),
               ("LOCAL QWEN","Independent verifier","TOCTOU: digest vs execution.","Bind payload bytes to approval.",GREEN)]
        show=min(3,max(1,int((t-2.2)/1.5)+1))
        for i,(name,tag,l1,l2,c) in enumerate(cards[:show]):
            x=66+i*390; box=(x,205,x+360,430); panel(d,box,fill=(12,18,34),out=c if i==show-1 else (43,56,88))
            pill(d,x+18,223,name,c,125); txt(d,(x+18,277),tag,18,c,True)
            txt(d,(x+18,318),l1,15,WHITE,m=True); txt(d,(x+18,351),l2,15,MUTED,m=True)
            txt(d,(x+18,397),"candidate complete",14,GREEN,m=True)
        if t>7.0:
            txt(d,(72,472),"[router] Comparing capability, evidence, safety and reviewer diversity...",18,AMBER,m=True)
        if t>9.0:
            panel(d,(70,515,1210,638),fill=(9,34,30),out=GREEN,r=14)
            pill(d,90,535,"SELECTED",GREEN,118)
            txt(d,(230,551),"Claude diagnosis + Qwen TOCTOU verification",22,WHITE,True)
            txt(d,(90,596),"BEST ANSWER  Move the state check inside the transaction, then bind exact payload bytes to approval.",17,GREEN,m=True)
    txt(d,(1210,688),"deterministic CLI visualization • independent candidate mode",12,MUTED,a="ra")
    return im.convert("RGB")

CHAT=[
("GROK","turn 1","I choose ▲P-76. Open the bishop diagonal and seize initiative.","opening proposal",CYAN),
("GLM","replying to GROK","I disagree. After △P-34, your rook attack arrives late. Secure the center first.","counterargument",VIOLET),
("GROK","replying to GLM","Good catch. I revise: ▲S-68 before the pawn push, then pressure the rook file.","strategy revised",CYAN),
("GLM","replying to GROK","That line is safer, but △P-84 still challenges the file. How do you answer it?","challenge",VIOLET),
("GROK","replying to GLM","▲P-26 keeps tempo while the silver protects the bishop lane. No overextension.","defense",CYAN),
("GLM","replying to GROK","Agreed. Balanced development survives the counterattack. I support ▲S-68.","convergence",VIOLET),
]

def agent_frame(t):
    im=base(t,"AGENT CHAT"); d=ImageDraw.Draw(im)
    txt(d,(42,88),"Different models. Reading, challenging, and changing each other’s minds.",29,WHITE,True)
    terminal(d,(42,137,1238,675),"quorum — agent_chat — live turn log")
    if t<2.8:
        txt(d,(70,196),"$ quorum run \"Debate the best move from this position\" \\",19,GREEN,m=True)
        txt(d,(70,231),"    --mode agent_chat --models grok,glm --max-rounds 6",19,GREEN,m=True)
        if t>1.2:
            txt(d,(70,285),"[session] Grok connected",17,CYAN,m=True); txt(d,(70,317),"[session] GLM connected",17,VIOLET,m=True)
            txt(d,(70,359),"[manager] shared conversation context created",17,MUTED,m=True)
    else:
        idx=min(len(CHAT)-1,int((t-2.8)/3.25)); start=max(0,idx-3)
        if t > 22.3:
            start=max(0,idx-2)
        txt(d,(70,183),f"ROUND {idx+1}/6",15,AMBER,True,m=True)
        y=220
        for j in range(start,idx+1):
            name,reply,msg,status,c=CHAT[j]; active=j==idx
            h=90
            panel(d,(70,y,1208,y+h),fill=dark(c,.09) if active else (10,16,29),out=c if active else (38,50,78),r=13,w=2)
            pill(d,86,y+12,name,c,92)
            txt(d,(190,y+27),reply,14,c,True,m=True)
            txt(d,(86,y+58),msg,17,WHITE if active else MUTED,m=True)
            txt(d,(1190,y+27),status.upper(),12,c,True,m=True,a="ra")
            y+=103
        if idx>=2:
            txt(d,(70,638),"[manager] disagreement changed the proposed move — conversation continues",15,AMBER,m=True)
        if t>22.3:
            panel(d,(310,540,1165,625),fill=(8,34,29),out=GREEN,r=14)
            txt(d,(335,568),"CONSENSUS",15,GREEN,True,m=True)
            txt(d,(465,568),"▲S-68 — balanced development",21,WHITE,True)
            txt(d,(335,603),"Synthesized from Grok revision + GLM counterplay analysis",15,MUTED,m=True)
    txt(d,(1210,696),"deterministic CLI conversation fixture • no live external model/API calls",12,MUTED,a="ra")
    return im.convert("RGB")

def render(kind,out):
    duration=15 if kind=="best" else 26
    fn=best_frame if kind=="best" else agent_frame
    cmd=["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",str(out)]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE); assert p.stdin
    for i in range(duration*FPS): p.stdin.write(fn(i/FPS).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit("ffmpeg failed")

def main():
    a=argparse.ArgumentParser(); a.add_argument("kind",choices=["best","agent"]); a.add_argument("output"); x=a.parse_args(); Path(x.output).parent.mkdir(parents=True,exist_ok=True); render(x.kind,Path(x.output))
if __name__=="__main__": main()
