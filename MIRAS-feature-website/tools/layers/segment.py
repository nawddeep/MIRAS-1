import json, sys, numpy as np, cv2
from scipy import ndimage as ndi
from segment_anything import sam_model_registry, SamPredictor
SRC='../../udaipur_4k_no_title.png'
img=cv2.cvtColor(cv2.imread(SRC),cv2.COLOR_BGR2RGB); H,W=img.shape[:2]
ink=cv2.cvtColor(img,cv2.COLOR_RGB2GRAY)<200
E=json.load(open('elements.json')); only=sys.argv[1:]
sam=sam_model_registry['vit_b'](checkpoint='sam_vit_b.pth'); pred=SamPredictor(sam)
def run(box,pos,neg):
    x0,y0,x1,y1=box; pad=int(max(x1-x0,y1-y0)*0.35)
    cx0,cy0,cx1,cy1=max(0,x0-pad),max(0,y0-pad),min(W,x1+pad),min(H,y1+pad)
    pred.set_image(img[cy0:cy1,cx0:cx1]); kw={}
    if pos or neg:
        kw['point_coords']=np.array([[p[0]-cx0,p[1]-cy0] for p in pos+neg]); kw['point_labels']=np.array([1]*len(pos)+[0]*len(neg))
    ms,sc,_=pred.predict(box=np.array([x0-cx0,y0-cy0,x1-cx0,y1-cy0]),multimask_output=True,**kw)
    mm=ms[int(np.argmax(sc))]; bb=np.zeros_like(mm); bb[max(0,y0-cy0-4):y1-cy0+4,max(0,x0-cx0-4):x1-cx0+4]=1
    out=np.zeros((H,W),bool); out[cy0:cy1,cx0:cx1]=mm&bb; return out
def largest(m):
    lab,n=ndi.label(m)
    if n<2: return m
    s=ndi.sum(m,lab,range(1,n+1)); return lab==(1+int(np.argmax(s)))
for name,el in E.items():
    if only and name not in only: continue
    x0,y0,x1,y1=el['box']; m=np.zeros((H,W),bool)
    if el['group']=='sky':
        k=cv2.morphologyEx(ink[y0:y1,x0:x1].astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))>0
        m[y0:y1,x0:x1]=ndi.binary_fill_holes(k)
    else:
        for part in el.get('parts',[el]):
            m|=run(part['box'],part.get('pos',[]),part.get('neg',[]))
        m=cv2.morphologyEx(m.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))>0
        holes=ndi.binary_fill_holes(m)&~m; lab,n=ndi.label(holes); sz=ndi.sum(holes,lab,range(1,n+1)) if n else []
        for i,s in enumerate(sz):
            if s<2500: m|=lab==(i+1)
        if el.get('largest'): m=largest(m)
    cv2.imwrite(f'masks/{name}.png',(m*255).astype(np.uint8))
    print('done',name)
