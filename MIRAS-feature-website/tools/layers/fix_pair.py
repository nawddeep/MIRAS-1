import numpy as np,cv2
from scipy import ndimage as ndi
img=cv2.imread('../../udaipur_4k_no_title.png',0)
m=cv2.imread('masks/walkers_pair.png',0)>0
ink=cv2.dilate((img<170).astype(np.uint8),np.ones((3,3),np.uint8))>0
free=m&~ink
lab,_=ndi.label(free)
rem=np.zeros_like(m)
for (x,y) in [(1550,1805),(1520,1880),(1565,1870),(1545,1850)]:
    if lab[y,x]: rem|=lab==lab[y,x]
    else: print('seed on ink',x,y)
print('removed px',rem.sum())
rem=cv2.morphologyEx(rem.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))>0
m&=~rem
m=cv2.morphologyEx(m.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))>0
cv2.imwrite('masks/walkers_pair.png',(m*255).astype(np.uint8))
