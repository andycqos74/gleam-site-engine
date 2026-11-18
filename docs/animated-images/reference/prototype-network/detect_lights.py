import cv2, numpy as np, json
im=cv2.imread('src.jpg'); g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
# major nodes: very bright blobs
_,th=cv2.threshold(cv2.GaussianBlur(g,(9,9),0),215,255,cv2.THRESH_BINARY)
n,lab,st,cen=cv2.connectedComponentsWithStats(th)
nodes=[[round(c[0]),round(c[1]),int(s[4])] for c,s in zip(cen[1:],st[1:]) if s[4]>15]
# small stars: local maxima above threshold
k=cv2.dilate(g,np.ones((7,7),np.uint8))
ys,xs=np.where((g==k)&(g>150))
stars=[[int(x),int(y),int(g[y,x])] for x,y in zip(xs,ys)]
rng=np.random.default_rng(1); 
if len(stars)>700: stars=[stars[i] for i in rng.choice(len(stars),700,replace=False)]
print(len(nodes),len(stars))
json.dump({'nodes':nodes,'stars':stars},open('spots.json','w'))
