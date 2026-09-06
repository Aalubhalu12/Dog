"""⚠️ Run ONCE on freshly built sheets (tools/build_puppy_sheets.py). Applies colour grade + a 3D relight.
Relight = pseudo-normal from the silhouette (distance-to-edge gradient, "inflated" body) →
  • key light from top-left (sun in the meadow): warm highlight on lit side, cool falloff on the far side
  • ambient occlusion: darkening near the belly / under the head-body joint (bottom of the shape)
  • rim light on the silhouette edge (sky blue-white on top, warm ground bounce underneath)
  • faint specular sheen where the pseudo-normal faces the light (glossy-fur toy feel)
Understated: all terms clamped so the dog stays cute, not plastic."""
import numpy as np, cv2, os, sys
_ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
D=os.path.join(_ROOT,'assets','images','puppy')+'/'
from grade_puppy import grade   # noqa (module runs nothing on import — see guard below)

def relight(im, frames, strength=1.0, light=(-0.55,-0.75)):
    """im: HxWx4 uint8 sheet; frames: cells across. Light dir in image space (x right, y down): top-left."""
    out=im.copy().astype(np.float32); H,W=im.shape[:2]; cw=W//frames
    lx,ly=light; ln=np.hypot(lx,ly); lx,ly=lx/ln,ly/ln; lz=0.9
    for k in range(frames):
        cell=out[:,k*cw:(k+1)*cw]; a=(cell[...,3]/255.).astype(np.float32)
        if a.max()<.05: continue
        mask=(a>.5).astype(np.uint8)
        dist=cv2.distanceTransform(mask,cv2.DIST_L2,5)                         # px to the edge
        dmax=max(1.0,float(np.percentile(dist[mask>0],97)))
        h=np.sqrt(np.clip(dist/dmax,0,1))                                     # inflated height field 0..1 (dome)
        h=cv2.GaussianBlur(h,(0,0),max(1.0,cw*0.012))
        gx=cv2.Sobel(h,cv2.CV_32F,1,0,ksize=3); gy=cv2.Sobel(h,cv2.CV_32F,0,1,ksize=3)
        nx,ny=-gx*6,-gy*6; nz=np.ones_like(h); nl=np.sqrt(nx*nx+ny*ny+nz*nz); nx,ny,nz=nx/nl,ny/nl,nz/nl
        lam=np.clip(nx*lx+ny*ly+nz*lz,0,1)                                      # lambert 0..1
        # curvature-ish AO: dark where the height field is low AND lower half of the body
        yy=np.linspace(0,1,cell.shape[0])[:,None]*np.ones_like(h)
        ao=np.clip((0.35-h)/0.35,0,1)*np.clip((yy-.45)/.4,0,1)
        edge=np.clip((0.12-h)/0.12,0,1)*a                                       # rim band
        rim_top=edge*np.clip(-ny*.7+.3,0,1); rim_bot=edge*np.clip(ny*.7+.1,0,1)
        spec=np.power(lam,18)*np.clip(h-.15,0,1)
        rgb=cell[...,:3]
        # apply — multiplicative shading around 1.0 so the grade's colours stay
        shade=1+ (lam-.55)*.22*strength - ao*.16*strength
        rgb*=shade[...,None]
        rgb+= (rim_top[...,None]*np.array([70,95,120],np.float32)*.55 + rim_bot[...,None]*np.array([90,60,10],np.float32)*.45 + spec[...,None]*np.array([255,240,210],np.float32)*.16)*strength*a[...,None]
        cell[...,:3]=np.clip(rgb,0,255)
    return out.clip(0,255).astype(np.uint8)

SHEETS={'run_sheet':16,'idle_sheet':20,'yay_sheet':28,'bonk_sheet':28,'dizzy_sheet':26}
if __name__=='__main__':
    for n,K in SHEETS.items():
        im=np.array(Image.open(D+n+'.webp').convert('RGBA'))
        g=grade(im); L=relight(g,K)
        Image.fromarray(L,'RGBA').save(D+n+'.webp',quality={'dizzy_sheet':82,'run_sheet':88}.get(n,84),method=6); print('graded+lit',n,L.shape)
    for n in ['puppy_yay','puppy_bonk','puppy_dizzy']:
        im=np.array(Image.open(D+n+'.webp').convert('RGBA')); L=relight(grade(im),1)
        Image.fromarray(L,'RGBA').save(D+n+'.webp',quality=92,method=6); print('graded+lit',n)
