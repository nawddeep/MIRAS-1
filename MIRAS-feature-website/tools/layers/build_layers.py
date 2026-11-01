import json, numpy as np, cv2, os
from PIL import Image
from scipy import ndimage as ndi
SRC='../../udaipur_4k_no_title.png'
img=np.array(Image.open(SRC).convert('RGB')); H,W=img.shape[:2]
E=json.load(open('elements.json')); os.makedirs('layers',exist_ok=True)
man=cv2.imread('masks/walker_man.png',0)>0
meta=[]; union=np.zeros((H,W),bool)
for name,el in E.items():
    m=cv2.imread(f'masks/{name}.png',0)>0
    src=img.copy()
    if name=='cyclist':
        cx,cy,r,rx,ry=2272,1745,63,2490,1745
        yy,xx=np.mgrid[:H,:W]; disk=((xx-cx)**2+(yy-cy)**2<=r*r)
        occl=disk&cv2.dilate(man.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
        ys,xs=np.nonzero(occl); src[ys,xs]=img[ys,xs+(rx-cx)]
    grow=cv2.dilate(m.astype(np.uint8),np.ones((5,5),np.uint8))
    a=cv2.GaussianBlur(grow.astype(np.float32),(0,0),1.0)
    if el['group']=='boats':
        ys,xs=np.nonzero(m); bx0,bx1,by1=xs.min(),xs.max(),ys.max()
        wake=np.zeros((H,W),np.uint8); wake[by1-6:by1+34,bx0-10:bx1+10]=1
        lum=img.mean(2); inkamt=np.clip((240-lum)/120,0,1)
        a=np.maximum(a,wake*inkamt).astype(np.float32); grow=np.maximum(grow,wake)
        m=m|(wake>0)
    if name in ('walkers_pair','walker_saree','walker_man','cyclist'):
        ys,xs=np.nonzero(m); by1=ys.max()
        foot=m.copy(); foot[:by1-45]=False
        sh=cv2.dilate(foot.astype(np.uint8),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(70,30)))
        sh[:by1-30]=0
        lum=img.mean(2); inkamt=np.clip((240-lum)/120,0,1)
        a=np.maximum(a,sh*inkamt).astype(np.float32); grow=np.maximum(grow,sh); m=m|(sh>0)
    union|=m
    ys,xs=np.nonzero(grow); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    rgba=np.dstack([src[y0:y1,x0:x1],(np.clip(a[y0:y1,x0:x1],0,1)*255).astype(np.uint8)])
    Image.fromarray(rgba).save(f'layers/{name}.png',optimize=True)
    meta.append(dict(id=name,group=el['group'],x=int(x0),y=int(y0),w=int(x1-x0),h=int(y1-y0)))
    print(name,x0,y0,x1-x0,y1-y0)
json.dump(dict(width=W,height=H,layers=meta),open('layers/layers.json','w'),indent=1)
cv2.imwrite('masks/_union.png',(union*255).astype(np.uint8))
