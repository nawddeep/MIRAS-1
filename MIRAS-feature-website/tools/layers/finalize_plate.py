import numpy as np,cv2
from scipy import ndimage as ndi
from PIL import Image
orig=np.array(Image.open('../../udaipur_4k_no_title.png').convert('RGB'))
plate=np.array(Image.open('plate.png').convert('RGB'))
gray=orig.mean(2)
hole=cv2.dilate(cv2.imread('masks/_union.png',0),np.ones((9,9),np.uint8))>0
H,W=gray.shape
PAPER=np.array([255,247,238],np.uint8); INK=np.array([30,44,82],np.float32)

# ---------- crosswalk: redraw straight lines across holes ----------
X0,Y0,X1,Y1=1200,1735,3100,1925
zone=np.zeros((H,W),bool); zone[Y0:Y1,X0:X1]=True; zone&=hole
plate[zone]=PAPER
pl_g=plate.mean(2); dark=((pl_g<170)&hole&~zone).astype(np.uint8)
dt=cv2.distanceTransform(cv2.dilate(dark,np.ones((2,2),np.uint8)),cv2.DIST_L2,3)
labd,nd=ndi.label(dark)
if nd:
    idx=np.arange(1,nd+1); mx=ndi.maximum(dt,labd,idx); ar=ndi.sum(dark,labd,idx)
    bad=np.zeros(nd+1,bool); cy=ndi.center_of_mass(dark,labd,idx); cx=np.array([c[1] for c in cy]); cy=np.array([c[0] for c in cy])
    road=(cy>1500)&(cx>1560)&(cx<2250)
    bad[1:]=((mx>3.2)&road)|(ar<10)
    kill=cv2.dilate((bad[labd]&(dark>0)).astype(np.uint8),np.ones((3,3),np.uint8))>0
    kill&=hole&~zone
    plate[kill]=PAPER
    print('cleaned comps',bad.sum())
known=(gray<150)&~cv2.dilate(hole.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
kb=(known[Y0:Y1,X0:X1]*255).astype(np.uint8)
segs=cv2.HoughLinesP(kb,1,np.pi/360,threshold=25,minLineLength=28,maxLineGap=4).reshape(-1,4)
segs=[(x1+X0,y1+Y0,x2+X0,y2+Y0) for x1,y1,x2,y2 in segs]
def ang(s): return np.degrees(np.arctan2(s[3]-s[1],s[2]-s[0]))%180
def rho(s,a):
    t=np.radians(a); return -s[0]*np.sin(t)+s[1]*np.cos(t)
cl=[]
for s in sorted(segs,key=lambda s:-np.hypot(s[2]-s[0],s[3]-s[1])):
    a=ang(s); r=rho(s,a)
    for c in cl:
        if abs(((a-c['a'])+90)%180-90)<2 and abs(r-rho(s,c['a']))<4: c['s'].append(s); break
    else: cl.append(dict(a=a,s=[s]))
SS=4
big=np.zeros(((Y1-Y0)*SS,(X1-X0)*SS),np.uint8)
def pl(p,closed=False):
    q=(np.asarray(p,np.float32)-[X0,Y0])*SS
    cv2.polylines(big,[np.round(q*4).astype(np.int32)],closed,255,int(1.9*SS),cv2.LINE_AA,shift=2)
drawn=np.zeros((H,W),np.uint8)
def walk(c):
    # fit line through all segment endpoints
    P=np.array([p for s in c['s'] for p in ((s[0],s[1]),(s[2],s[3]))],float)
    mu=P.mean(0); _,_,vt=np.linalg.svd(P-mu); d=vt[0]
    if abs(d[0])<1e-6: d=np.array([1e-6,d[1]])
    ts=np.arange(-2500,2500,0.5); pts=mu+ts[:,None]*d
    ok=(pts[:,0]>=X0)&(pts[:,0]<X1-1)&(pts[:,1]>=Y0)&(pts[:,1]<Y1-1); pts=pts[ok]
    xi,yi=pts[:,0].astype(int),pts[:,1].astype(int)
    onink=np.zeros(len(pts),bool)
    for s in c['s']:
        a=np.array(s[:2],float); b=np.array(s[2:],float); ab=b-a; L=ab@ab
        t=np.clip(((pts-a)@ab)/L,0,1); q=a+t[:,None]*ab
        onink|=np.hypot(*(pts-q).T)<2.5
    inh=hole[yi,xi]
    return pts,onink,inh,d
STRIPES=[(1326,1385,1118,1118),(1475,1523,1245,1325),(1620,1685,1492,1572),(1753,1812,1697,1796),
         (1867,1918,1880,1969),(1981,2040,2057,2163),(2092,2150,2244,2323)]
TY,BY=1739,1908
for i,(tl,tr,bl,br) in enumerate(STRIPES):
    poly=[(tl,TY),(tr,TY),(br,BY),(bl,BY)] if i else [(tl,TY),(tr,TY),(br,BY)]
    p=np.array(poly,np.float32)
    pl(p,i>0)
for c in cl:
    pts,onink,inh,d=walk(c)
    if abs(d[1])<0.08: continue
    lab,n=ndi.label(inh)
    for k in range(1,n+1):
        idx=np.nonzero(lab==k)[0]; i0,i1=idx[0],idx[-1]
        run=pts[i0:i1+1]
        if run[:,0].mean()<2240: continue
        before=onink[max(0,i0-30):i0].any(); after=onink[i1+1:i1+31].any()
        if before and after: pl(run)
        elif before or after:
            seg=run if before else run[::-1]
            keep=(seg[:,1]>=1737)&(seg[:,1]<=1910)
            stop=len(seg) if keep.all() else int(np.argmin(keep))
            if stop>3: pl(seg[:stop])
drawn[Y0:Y1,X0:X1]=cv2.resize(big,(X1-X0,Y1-Y0),interpolation=cv2.INTER_AREA)
a=(drawn.astype(np.float32)/255)[...,None]*zone[...,None]
plate=(plate*(1-a)+INK*a).astype(np.uint8)

# ---------- lake: rebuild water rows by copying neighbouring row content ----------
lake=hole.copy(); lake[:1960]=False
lab,n=ndi.label(lake)
for sl in ndi.find_objects(lab):
    y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop; w=x1-x0
    for y in range(y0,y1):
        row=lake[y,x0:x1]
        if not row.any(): continue
        for k in (1,-1,2,-2,3,-3,4,-4):
            src=x0+k*(w+12)
            if src<8 or src+w>W-8: continue
            if not lake[y,src:src+w].any(): break
        seg=orig[y,src:src+w].copy()
        plate[y,x0:x1][row]=seg[row]
np.save('drawn.npy',drawn)
Image.fromarray(plate).save('plate_final.png')
