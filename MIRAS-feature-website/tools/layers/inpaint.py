import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from simple_lama_inpainting import SimpleLama
SRC='../../udaipur_4k_no_title.png'
img=np.array(Image.open(SRC).convert('RGB')); H,W=img.shape[:2]
union=cv2.imread('masks/_union.png',0)>0
hole=cv2.dilate(union.astype(np.uint8),np.ones((9,9),np.uint8))>0
lab,n=ndi.label(cv2.dilate(hole.astype(np.uint8),np.ones((41,41),np.uint8)))
lama=SimpleLama()
out=img.copy()
for sl in ndi.find_objects(lab):
    y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop
    m=int(max(y1-y0,x1-x0)*0.6)+64
    cy0,cy1,cx0,cx1=max(0,y0-m),min(H,y1+m),max(0,x0-m),min(W,x1+m)
    ch,cw=cy1-cy0,cx1-cx0; sc=0.5 if max(y1-y0,x1-x0)>300 else 1.0
    crop=Image.fromarray(img[cy0:cy1,cx0:cx1]); mk=hole[cy0:cy1,cx0:cx1]
    mi=Image.fromarray((mk*255).astype(np.uint8))
    if sc<1:
        crop=crop.resize((int(cw*sc),int(ch*sc)),Image.LANCZOS); mi=mi.resize(crop.size,Image.NEAREST)
        mi=Image.fromarray(((np.array(mi)>0)*255).astype(np.uint8))
    res=Image.fromarray(np.array(lama(crop,mi))[:crop.size[1],:crop.size[0]])
    res=np.array(res.resize((cw,ch),Image.LANCZOS)).astype(np.float32)
    # re-ink: fade washes back to paper, keep crisp strokes
    paper=np.array([255,247,238],np.float32); lum=res.mean(2,keepdims=True)
    t=np.clip((248-lum)/190,0,1); g=t*t*(3-2*t); g=np.clip((t-0.18)/0.5,0,1); g=g*g*(3-2*g)
    res=paper+(res-paper)*np.where(t>1e-3,g/np.maximum(t,1e-3),0)*np.minimum(1,t*1.0+0.0)/np.maximum(np.minimum(1,t),1e-3)
    res=np.clip(res,0,255)
    a=cv2.GaussianBlur(mk.astype(np.float32),(0,0),1.5)[...,None]
    blend=(res*a+out[cy0:cy1,cx0:cx1]*(1-a)).astype(np.uint8)
    region=lab[cy0:cy1,cx0:cx1]>0
    out[cy0:cy1,cx0:cx1][region]=blend[region]
    print('inpainted',x0,y0,x1-x0,y1-y0)
Image.fromarray(out).save('plate.png')
