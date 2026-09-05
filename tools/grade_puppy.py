"""⚠️ ONE-SHOT: already applied to the shipped sheets. Only run on freshly rebuilt (ungraded) sheets.
Colour-grade the puppy sheets (cut from video) to match the game's reference puppy / theme.
Measured: video tan sat .60 val .62, white .84  →  reference tan sat .71 val .70, white .95.
Grade = per-pixel in HSV: warm hue nudge, saturation lift on tan, brightness lift on white, keep blacks deep;
plus a subtle warm rim so he sits in the sunny meadow instead of looking like a cut-out."""
import numpy as np, cv2, sys
import os
_ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
D=os.path.join(_ROOT,'assets','images','puppy')+'/'
def grade(im):
    a=im[...,3:4].astype(np.float32)/255; rgb=im[...,:3]
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(np.float32); h,s,v=hsv[...,0],hsv[...,1]/255,hsv[...,2]/255
    tan=np.clip(1-np.abs(h*2-27)/22,0,1)*np.clip((s-.25)/.25,0,1)          # 0..1 how "tan" a pixel is
    white=np.clip((v-.6)/.25,0,1)*np.clip((.3-s)/.2,0,1)                    # 0..1 how "white"
    dark=np.clip((.35-v)/.2,0,1)
    # tan: +18 % saturation, +12 % brightness, hue 1° warmer
    s2=s*(1+.18*tan); v2=v*(1+.12*tan); h2=h-0.5*tan
    # white: lift toward .96, slight warm cream (matches cream UI), keep shading
    v2=v2+(0.96-v2)*.55*white; s2=s2*(1-.25*white)+.03*white
    # blacks: a hair deeper + slightly warm (reference is warm-black), restore contrast
    v2=v2*(1-.10*dark)
    # global: mild S-curve contrast
    v2=np.clip(v2,0,1); v2=v2*v2*(3-2*v2)*.35+v2*.65
    out=cv2.cvtColor(np.dstack([np.clip(h2,0,179),np.clip(s2,0,1)*255,np.clip(v2,0,1)*255]).astype(np.uint8),cv2.COLOR_HSV2RGB).astype(np.float32)
    # warm sunlight rim: pixels near the alpha edge on the top-right get a faint warm highlight
    al=im[...,3]; er=cv2.erode(al,np.ones((5,5),np.uint8)); rim=((al.astype(int)-er.astype(int))/255.).clip(0,1)[...,None]
    out=out+rim*np.array([40,26,0],np.float32)*.5
    return np.dstack([np.clip(out,0,255).astype(np.uint8),im[...,3]])
for n in ['run_sheet','idle_sheet','yay_sheet','bonk_sheet','dizzy_sheet','puppy','puppy_yay','puppy_bonk','puppy_dizzy']:
    im=np.array(Image.open(D+n+'.webp').convert('RGBA'))
    Image.fromarray(grade(im),'RGBA').save(D+n+'.webp',quality=92,method=6); print('graded',n)
