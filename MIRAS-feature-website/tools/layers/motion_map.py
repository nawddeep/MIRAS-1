# Builds motion_map.png (half-res, 1920x1080):
#   R = foliage sway weight (0 at trunk base / outside, 1 at canopy top)
#   G = per-tree phase (0..1) so trees never sway in sync
#   B = water mask for the lake ripple shader
import numpy as np, cv2
from segment_anything import sam_model_registry, SamPredictor
SRC='../../udaipur_4k_no_title.png'
img=cv2.cvtColor(cv2.imread(SRC),cv2.COLOR_BGR2RGB); H,W=img.shape[:2]
pred=SamPredictor(sam_model_registry['vit_b'](checkpoint='sam_vit_b.pth'))
yy,xx=np.mgrid[:H,:W].astype(np.float32)
# name, box, anchor_y (no sway at/below), top_y (full sway), phase, use_sam
TREES=[('tree_right',[2650,1000,2885,1420],1420,1020,0.13,True),
       ('trees_far',[1860,1140,2000,1300],1300,1150,0.57,True),
       ('tree_far_left',[1725,1200,1805,1320],1320,1210,0.81,True),
       ('tree_palace',[2085,755,2185,862],862,760,0.34,False),
       ('palm_balcony',[1225,835,1305,915],915,840,0.68,False),
       ('vines_cafe',[1485,1040,1565,1300],1040,1300,0.92,False)]   # vines hang: anchored at top
R=np.zeros((H,W),np.float32); G=np.zeros((H,W),np.float32)
for name,(x0,y0,x1,y1),ay,ty,ph,use_sam in TREES:
    if use_sam:
        pad=60; cx0,cy0=max(0,x0-pad),max(0,y0-pad); cx1,cy1=min(W,x1+pad),min(H,y1+pad)
        pred.set_image(img[cy0:cy1,cx0:cx1])
        ms,sc,_=pred.predict(box=np.array([x0-cx0,y0-cy0,x1-cx0,y1-cy0]),multimask_output=True)
        m=np.zeros((H,W),np.float32); m[cy0:cy1,cx0:cx1]=ms[int(np.argmax(sc))]
        m=cv2.dilate(m,np.ones((15,15),np.uint8))
    else:
        m=(((xx-(x0+x1)/2)/((x1-x0)/2))**2+((yy-(y0+y1)/2)/((y1-y0)/2))**2<=1).astype(np.float32)
    m=cv2.GaussianBlur(m,(0,0),8)
    t=np.clip((ay-yy)/(ay-ty),0,1); ramp=t*t*(3-2*t)
    w=m*ramp; R=np.maximum(R,w); G=np.where(m>0.05,ph,G)
    print(name,'ok')
B=np.zeros((H,W),np.float32); B[1962:2125]=1; B=cv2.GaussianBlur(B,(0,0),3)
out=np.dstack([B,G,R])  # BGR for cv2
out=cv2.resize(out,(W//2,H//2),interpolation=cv2.INTER_AREA)
cv2.imwrite('motion_map.png',(np.clip(out,0,1)*255).astype(np.uint8))
