import cv2, numpy as np, json, math, subprocess, sys
OW,OH=1280,720; W,H=1920,1080; FPS=25; LOOP=8; I=0.7
d=json.load(open('spots.json')); bg=cv2.imread('src.jpg').astype(np.float32)/255
rng=np.random.default_rng(7)
hub=d['nodes'][0]
stars=[(x,y,b/255,int(rng.integers(1,4)),rng.random()*6.283,0.6+rng.random()*1.2) for i,(x,y,b) in enumerate(d['stars']) if i%2==0]
nodes=[(x,y,min(60,10+math.sqrt(a)*1.6),rng.random(),int(rng.integers(1,3))) for x,y,a in d['nodes']]
flows=[(x,y,rng.random(),1 if rng.random()<.5 else -1) for x,y,a in d['nodes'][1:] if a>40 and math.hypot(x-hub[0],y-hub[1])>150]
def sprite(n,stops):
    r=np.hypot(*np.meshgrid(np.linspace(-1,1,n),np.linspace(-1,1,n)))
    xs=[s[0] for s in stops]; out=np.zeros((n,n,3),np.float32)
    for c in range(3): out[...,c]=np.interp(r,xs,[s[1][c]*s[1][3] for s in stops])
    return out
glow=sprite(128,[(0,(1,1,1,1)),(.12,(1,.96,.86,.85)),(.35,(1,.78,.47,.25)),(1,(1,.63,.31,0))])  # BGR
dot=sprite(32,[(0,(.92,.98,1,1)),(.3,(.78,.92,1,.6)),(1,(.7,.86,1,0))])
def add(canvas,spr,cx,cy,w,h,a):
    w,h=max(2,int(w)),max(2,int(h)); s=cv2.resize(spr,(w,h))*a
    x0,y0=int(cx-w/2),int(cy-h/2); X0,Y0=max(0,x0),max(0,y0); X1,Y1=min(W,x0+w),min(H,y0+h)
    if X1<=X0 or Y1<=Y0: return
    canvas[Y0:Y1,X0:X1]+=s[Y0-y0:Y1-y0,X0-x0:X1-x0]
def xf(depth,t,zoom,panX,panY):
    mx=math.sin(t*2*math.pi)*.35; my=math.cos(t*2*math.pi)*.2
    s=OW/W*zoom; ox=OW/2-W/2*s+(panX+mx*22*depth)*OW/W; oy=OH/2-H/2*s+(panY+my*14*depth)*OW/W
    return np.float32([[s,0,ox],[0,s,oy]])
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{OW}x{OH}','-r',str(FPS),'-i','-',
  '-c:v','libx264','-preset','veryfast','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart','loop.mp4'],stdin=subprocess.PIPE)
TAU=2*math.pi; N=FPS*LOOP
for f in range(N):
    t=f/N; zoom=1.05+.025*math.sin(t*TAU); panX=math.sin(t*TAU)*14; panY=math.cos(t*TAU)*8
    out=cv2.warpAffine(bg,xf(1,t,zoom,panX,panY),(OW,OH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    L1=np.zeros((H,W,3),np.float32)
    for x,y,b,k,ph,s in stars:
        a=max(0,math.sin(t*TAU*k+ph))**6*I*b
        if a>.02: add(L1,dot,x,y,14*s,14*s,a)
    out+=cv2.warpAffine(L1,xf(1.6,t,zoom,panX,panY),(OW,OH))
    L2=np.zeros((H,W,3),np.float32)
    for fx,fy,ph,dr in flows:
        p=(t*2+ph)%1; p=1-p if dr<0 else p; fade=math.sin(p*math.pi)
        x=hub[0]+(fx-hub[0])*p; y=hub[1]+(fy-hub[1])*p
        add(L2,glow,x,y,44,44,.9*I*fade)
        for j in range(1,8):  # short tail
            q=p-.008*j*dr; add(L2,glow,hub[0]+(fx-hub[0])*q,hub[1]+(fy-hub[1])*q,26,26,.35*I*fade*(1-j/8))
    for x,y,r,ph,k in nodes:
        w=.5+.5*math.sin((t*k+ph)*TAU); R=r*(2.2+1.4*w)
        add(L2,glow,x,y,R*2,R*2,(.25+.55*w)*I)
        fl=w**8*I
        if fl>.03: Lr=r*5; add(L2,glow,x,y,Lr*2,6,fl); add(L2,glow,x,y,6,Lr*2,fl)
    out+=cv2.warpAffine(L2,xf(2.2,t,zoom,panX,panY),(OW,OH))
    fr=(np.clip(out,0,1)*255).astype(np.uint8)
    if f in (0,50): cv2.imwrite(f'frame{f}.jpg',fr)
    ff.stdin.write(fr.tobytes())
ff.stdin.close(); ff.wait()
