import numpy as np, cv2
man=cv2.imread('masks/walker_man.png',0)>0
H,W=man.shape; yy,xx=np.mgrid[:H,:W]
cut=(xx>2262)&(yy>1630)&(yy<1815); man&=~cut
cv2.imwrite('masks/walker_man.png',(man*255).astype(np.uint8))
cyc=cv2.imread('masks/cyclist.png',0)>0
disk=(xx-2272)**2+(yy-1745)**2<=63**2
cyc|=disk
cv2.imwrite('masks/cyclist.png',(cyc*255).astype(np.uint8))
np.save('cyclist_patch.npy',np.array([2272,1745,63,2490,1745]))
# trim the wheel arc that sits behind the man's back leg (right of the leg outline)
man=cv2.imread('masks/walker_man.png',0)>0
ys=np.array([1688,1717,1750,1797,1827]); xs=np.array([2216,2218,2225,2251,2265])
for y in range(1688,1828):
    xo=int(np.interp(y,ys,xs))+3
    man[y,xo:2300]=False
cv2.imwrite('masks/walker_man.png',(man*255).astype(np.uint8))
