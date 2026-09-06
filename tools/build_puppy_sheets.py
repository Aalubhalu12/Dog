"""Build the puppy sprite sheets from the AI clips (art/clips/*.mp4, 24 fps) — v2: TRUE 24 fps.
Every sheet uses consecutive real clip frames (no sub-sampling), so playback at 24 sprite-fps is 1:1 with the source.
    idle   20 f = still frames 0..19 (puppy.js ping-pongs them → 1.6 s loop)
    run    16 f = one real stride of the treadmill clip     (0.67 s loop)
    yay    28 f = hop clip 24..51 (take-off → landing)      (1.17 s once)
    bonk   28 f = bonk clip 22..49 (flinch → recover)       (1.17 s once)
    dizzy  26 f = one wobble period of the dizzy clip       (1.08 s loop)
Pipeline: this → tools/grade_puppy.py → tools/light_puppy.py (both on FRESH sheets only).
Prints the `body` ratios to paste into Puppy.SHEETS."""
import sys; import os; sys.path.insert(0, os.path.dirname(__file__)); from clip_utils import *
import cv2, numpy as np
_ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
OUT=os.path.join(_ROOT,'assets','images','puppy')+'/'
Q=88
def stream(name):
    cap=cv2.VideoCapture(os.path.join(_ROOT,'art','clips',f'{name}.mp4'))
    while True:
        ok,f=cap.read()
        if not ok: break
        yield f
def pass1(name):
    boxes=[]; small=[]
    for f in stream(name):
        a=key(f); ys,xs=np.where(a>60); boxes.append((xs.min(),ys.min(),xs.max(),ys.max())); small.append(cv2.resize(a,(96,54) if f.shape[1]>f.shape[0] else (54,96)).astype(np.float32)/255)
    return boxes,np.array(small)
def grab(name,idx,box,keep_all=False):
    idx=list(idx); want=set(idx); got={}
    for i,f in enumerate(stream(name)):
        if i in want: got[i]=cell(f,key(f),box,keep_all)
    return [got[i] for i in idx]
def ubox(boxes,idx,pad,W,H):
    X0=min(boxes[i][0] for i in idx); Y0=min(boxes[i][1] for i in idx); X1=max(boxes[i][2] for i in idx); Y1=max(boxes[i][3] for i in idx)
    return (max(0,X0-pad),max(0,Y0-pad),min(W,X1+pad+1),min(H,Y1+pad+1))
def packq(cells,path,height):
    cw,ch=cells[0].size; K=len(cells); sheet=Image.new('RGBA',(cw*K,ch),(0,0,0,0))
    for k,c in enumerate(cells): sheet.paste(c,(k*cw,0))
    sc=height/ch; sheet=sheet.resize((round(cw*sc)*K,height),Image.LANCZOS); sheet.save(path,quality=Q,method=6); return sheet
def body_ratio(boxes,i,box): return (boxes[i][3]-boxes[i][1]+1)/(box[3]-box[1])   # standing-dog height / cell height
report={}

# ---------------- RUN: one real stride (16 @ 24 fps) ----------------
boxes,small=pass1('run_treadmill'); N=len(small); best=None
for P in (15,16,17):
    for s in range(8,N-P-2):
        e=float(np.mean(np.abs(small[s]-small[s+P])))+float(np.mean(np.abs(small[s+1]-small[s+P+1])))
        if best is None or e<best[0]: best=(e,s,P)
e,s,P=best; idx=list(range(s,s+P)); print('run seam',best,'frames',idx)
box=ubox(boxes,idx,6,1280,720); cells=grab('run_treadmill',idx,box)
sh=packq(cells,OUT+'run_sheet.webp',280); preview(sh,'/tmp/prev_run.jpg',len(idx))
report['run']=dict(frames=len(idx),size=sh.size,body=round(float(np.median([body_ratio(boxes,i,box) for i in idx])),3))

# ---------------- IDLE: real still frames 0..19, ping-pong → 38 @ 24 fps ----------------
boxes,small=pass1('hop'); N=len(small)
m=[float(np.mean(np.abs(small[i]-small[i+1]))) for i in range(N-1)]
still_end=min(20, next(i for i in range(10,N-1) if m[i]>0.004))
fw=list(range(0,still_end)); seq=fw; print('idle: still until',still_end,'frames',len(seq),'(ping-pong in code)')
box_idle=ubox(boxes,fw,6,1280,720)
cells=grab('hop',seq,box_idle); sh=packq(cells,OUT+'idle_sheet.webp',280); preview(sh,'/tmp/prev_idle.jpg',len(seq))
report['idle']=dict(frames=len(seq),size=sh.size,body=round(body_ratio(boxes,0,box_idle),3))

# ---------------- YAY: hop clip, real frames 24..51 (take-off → landing) ----------------
a,b=24,52; idx=list(range(a,b)); box_hop=ubox(boxes,range(0,N),6,1280,720)
cells=grab('hop',idx,box_hop); sh=packq(cells,OUT+'yay_sheet.webp',280); preview(sh,'/tmp/prev_yay.jpg',len(idx))
report['yay']=dict(frames=len(idx),size=sh.size,body=round(body_ratio(boxes,0,box_hop),3),sec=len(idx)/24)
peak=int(np.argmin([boxes[i][1] for i in idx])); cp=cells[peak]; cp=cp.crop(cp.getbbox()); cp.thumbnail((500,500)); cp.save(OUT+'puppy_yay.webp',quality=92,method=6)

# ---------------- BONK: real frames 22..49 (flinch → recover) ----------------
boxes,small=pass1('bonk'); N=len(small)
a,b=22,50; idx=list(range(a,b)); box=ubox(boxes,range(a,b),6,1280,720)
cells=grab('bonk',idx,box); sh=packq(cells,OUT+'bonk_sheet.webp',280); preview(sh,'/tmp/prev_bonk.jpg',len(idx))
report['bonk']=dict(frames=len(idx),size=sh.size,body=round(body_ratio(boxes,0,box),3),sec=len(idx)/24)
# game-over still = the strongest flinch (frame with the biggest change vs the standing pose)
m0=[float(np.mean(np.abs(small[i]-small[0]))) for i in idx]; k=int(np.argmax(m0)); mid=cells[k]; mid=mid.crop(mid.getbbox()); mid.thumbnail((500,500)); mid.save(OUT+'puppy_bonk.webp',quality=92,method=6)
print('bonk still frame', idx[k])

# ---------------- DIZZY: one real wobble period (≈26 f) ----------------
boxes,small=pass1('dizzy'); N=len(small)
sims=[(P,float(np.mean(np.abs(small[:N-P]-small[P:])))) for P in range(20,40)]; sims.sort(key=lambda x:x[1]); P=sims[0][0]
best=None
for s in range(4,N-P-2):
    e=float(np.mean(np.abs(small[s]-small[s+P])))
    if best is None or e<best[0]: best=(e,s)
s=best[1]; idx=list(range(s,s+P)); print('dizzy period',P,'seam',best)
box=ubox(boxes,idx,6,720,1280); cells=grab('dizzy',idx,box,keep_all=True); sh=packq(cells,OUT+'dizzy_sheet.webp',360); preview(sh,'/tmp/prev_dizzy.jpg',len(idx))
report['dizzy']=dict(frames=len(idx),size=sh.size,body=round(body_ratio(boxes,idx[0],box),3),sec=P/24)
d0=cells[0]; d0=d0.crop(d0.getbbox()); d0.thumbnail((500,600)); d0.save(OUT+'puppy_dizzy.webp',quality=92,method=6)
for k,v in report.items(): print(k,v)
