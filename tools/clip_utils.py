import cv2, numpy as np
import os
_ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
def load(name):
    cap=cv2.VideoCapture(os.path.join(_ROOT,'art','clips',f'{name}.mp4')); out=[]
    while True:
        ok,f=cap.read()
        if not ok: break
        out.append(f)
    return out
def key(f):
    hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV); h=hsv[...,0].astype(np.float32); s=hsv[...,1].astype(np.float32); v=hsv[...,2].astype(np.float32)
    green=np.clip(1-np.abs(h-62)/22,0,1)*np.clip((s-60)/80,0,1)*np.clip((v-60)/60,0,1)
    return (np.clip((0.35-green)/0.30,0,1)*255).astype(np.uint8)
def cell(f,a,box,keep_all=False):
    x0,y0,x1,y1=box
    im=np.dstack([cv2.cvtColor(f[y0:y1,x0:x1],cv2.COLOR_BGR2RGB),a[y0:y1,x0:x1]])
    r,g,b=im[...,0].astype(int),im[...,1].astype(int),im[...,2].astype(int); mx=np.maximum(r,b)
    im[...,1]=np.where(g>mx+8,mx+8,g).astype(np.uint8)
    al=im[...,3]; n,lab,st,_=cv2.connectedComponentsWithStats((al>20).astype(np.uint8),8)
    if n>1 and not keep_all:
        big=1+np.argmax(st[1:,4]); al[lab!=big]=0
    elif n>1:  # keep components bigger than 0.4% of the largest (stars) drop sparkles
        mx_=st[1:,4].max(); small=[i for i in range(1,n) if st[i,4]<mx_*0.004]; 
        for i in small: al[lab==i]=0
    im[...,3]=al; return Image.fromarray(im,'RGBA')
def union_box(alphas,idx,pad=6):
    X0,X1,Y0,Y1=1e9,0,1e9,0
    for i in idx:
        ys,xs=np.where(alphas[i]>60); X0=min(X0,xs.min()); X1=max(X1,xs.max()); Y0=min(Y0,ys.min()); Y1=max(Y1,ys.max())
    H,W=alphas[0].shape; return (max(0,X0-pad),max(0,Y0-pad),min(W,X1+pad+1),min(H,Y1+pad+1))
def pack(cells,path,height):
    cw,ch=cells[0].size; K=len(cells); sheet=Image.new('RGBA',(cw*K,ch),(0,0,0,0))
    for k,c in enumerate(cells): sheet.paste(c,(k*cw,0))
    sc=height/ch; sheet=sheet.resize((round(cw*sc)*K,height),Image.LANCZOS); sheet.save(path,quality=92,method=6); return sheet
def preview(sheet,path,K):
    cw=sheet.width//K; cols=min(K,12); rows=(K+cols-1)//cols
    p=Image.new('RGB',(cols*cw,rows*sheet.height),(90,90,90))
    for k in range(K): p.paste(sheet.crop((k*cw,0,(k+1)*cw,sheet.height)),((k%cols)*cw,(k//cols)*sheet.height),sheet.crop((k*cw,0,(k+1)*cw,sheet.height)))
    p.thumbnail((1800,1200)); p.save(path,quality=85)
def motion(alphas,a,b):
    return [float(np.mean(np.abs(alphas[i].astype(np.float32)-alphas[i+1].astype(np.float32))))/255 for i in range(a,b)]
