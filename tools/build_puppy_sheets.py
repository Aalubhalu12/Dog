import sys; import os; sys.path.insert(0, os.path.dirname(__file__)); from clip_utils import *
import cv2, numpy as np
import os
_ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
OUT=os.path.join(_ROOT,'assets','images','puppy')+'/'
def stream(name):
    cap=cv2.VideoCapture(os.path.join(_ROOT,'art','clips',f'{name}.mp4'))
    while True:
        ok,f=cap.read()
        if not ok: break
        yield f
def pass1(name):
    """alpha bboxes + low-res masks per frame (memory-light)"""
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
def samp(a,b,K): return [a+int(round(k*(b-a)/K)) for k in range(K)]   # K frames over [a,b)

report={}
# ---------------- RUN: every real frame of one stride (16 @ 24 fps) ----------------
boxes,small=pass1('run_treadmill'); N=len(small)
best=None
for P in (15,16,17):
    for s in range(8,N-P-2):
        e=float(np.mean(np.abs(small[s]-small[s+P])))+float(np.mean(np.abs(small[s+1]-small[s+P+1])))
        if best is None or e<best[0]: best=(e,s,P)
e,s,P=best; idx=list(range(s,s+P)); print('run seam',best,'frames',idx)
box=ubox(boxes,idx,6,1280,720); cells=grab('run_treadmill',idx,box)
sh=pack(cells,OUT+'run_sheet.webp',280); preview(sh,'/tmp/prev_run.jpg',len(idx)); report['run']=(len(idx),sh.size)

# ---------------- IDLE: breathing frames at the start of the hop clip, ping-pong ----------------
boxes,small=pass1('hop'); N=len(small)
m=[float(np.mean(np.abs(small[i]-small[i+1]))) for i in range(N-1)]
still_end=next(i for i in range(10,N-1) if m[i]>0.003)   # first frame where the hop wind-up starts
fw=list(range(0,still_end)); idx=fw+fw[-2:0:-1]            # ping-pong → seamless
idx=samp(0,len(idx),24) if len(idx)>=24 else idx; seq=[ (fw+fw[-2:0:-1])[i] for i in idx]
print('idle: still until',still_end,'seq',seq)
box_hop=ubox(boxes,range(0,N),6,1280,720)                    # one box for the whole hop clip (shared by idle/yay/still)
cells=grab('hop',seq,box_hop); sh=pack(cells,OUT+'idle_sheet.webp',280); preview(sh,'/tmp/prev_idle.jpg',len(seq)); report['idle']=(len(seq),sh.size)
# still puppy.webp (map marker, aspect reference) = first idle frame
c0=cells[0]; c0=c0.crop(c0.getbbox()); c0.thumbnail((500,500)); c0.save(OUT+'puppy.webp',quality=92,method=6)

# ---------------- YAY (hop): action window → 24 frames ----------------
act=[i for i in range(N-1) if m[i]>0.004]; a,b=act[0]-2,act[-1]+3; idx=samp(a,b,24); print('hop window',a,b,'idx',idx)
cells=grab('hop',idx,box_hop); sh=pack(cells,OUT+'yay_sheet.webp',280); preview(sh,'/tmp/prev_yay.jpg',24); report['yay']=(24,sh.size,(b-a)/24)
peak=int(np.argmax([np.array(c)[...,3].any(1).argmax()*-1 for c in cells]))  # highest (smallest top y) frame
cp=cells[peak]; cp=cp.crop(cp.getbbox()); cp.thumbnail((500,500)); cp.save(OUT+'puppy_yay.webp',quality=92,method=6)

# ---------------- BONK: action window → 24 frames ----------------
boxes,small=pass1('bonk'); N=len(small)
m=[float(np.mean(np.abs(small[i]-small[i+1]))) for i in range(N-1)]
act=[i for i in range(N-1) if m[i]>0.004]; a,b=act[0]-2,act[-1]+4; idx=samp(a,b,24); print('bonk window',a,b,'idx',idx)
box=ubox(boxes,range(a,b),6,1280,720); cells=grab('bonk',idx,box); sh=pack(cells,OUT+'bonk_sheet.webp',280); preview(sh,'/tmp/prev_bonk.jpg',24); report['bonk']=(24,sh.size,(b-a)/24)
mid=cells[len(cells)//3]; mid=mid.crop(mid.getbbox()); mid.thumbnail((500,500)); mid.save(OUT+'puppy_bonk.webp',quality=92,method=6)

# ---------------- DIZZY: loop period → 24 frames (keep the stars) ----------------
boxes,small=pass1('dizzy'); N=len(small)
sims=[(P,float(np.mean(np.abs(small[:N-P]-small[P:])))) for P in range(12,80)]; sims.sort(key=lambda x:x[1]); print('dizzy periods',sims[:5])
P=sims[0][0]; best=None
for s in range(4,N-P-2):
    e=float(np.mean(np.abs(small[s]-small[s+P])))
    if best is None or e<best[0]: best=(e,s)
s=best[1]; idx=samp(s,s+P,24); print('dizzy seam',best,'idx',idx)
box=ubox(boxes,range(s,s+P),6,720,1280); cells=grab('dizzy',idx,box,keep_all=True); sh=pack(cells,OUT+'dizzy_sheet.webp',360); preview(sh,'/tmp/prev_dizzy.jpg',24); report['dizzy']=(24,sh.size,P/24)
d0=cells[0]; d0=d0.crop(d0.getbbox()); d0.thumbnail((500,600)); d0.save(OUT+'puppy_dizzy.webp',quality=92,method=6)
print(report)
