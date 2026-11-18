import cv2, numpy as np, math, subprocess
p=cv2.imread('photo.png').astype(np.float32)/255; bg=cv2.imread('bg_plate.png').astype(np.float32)/255
a=cv2.imread('fg_alpha.png',0).astype(np.float32)/255
S=1080; FPS=25; LOOP=8; N=FPS*LOOP; TAU=2*math.pi
rng=np.random.default_rng(3)
# flutes: (top y, bottom y, top x-range, bottom x-range) of the liquid
flutes=[(690,805,(568,628),(588,612)),(752,888,(440,505),(458,488))]
bubbles=[]
for fi,(ty,by,tx,bx) in enumerate(flutes):
    for _ in range(22): bubbles.append((fi,rng.random(),rng.random(),rng.integers(1,3),rng.random()*6.28,0.6+rng.random()*0.8))
def M(scale,dx,dy,cx=540,cy=600):
    return np.float32([[scale,0,cx-cx*scale+dx],[0,scale,cy-cy*scale+dy]])
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{S}x{S}','-r',str(FPS),'-i','-',
 '-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','parallax.mp4'],stdin=subprocess.PIPE)
for f in range(N):
    t=f/N; s=math.sin(t*TAU); c=math.cos(t*TAU)
    B=cv2.warpAffine(bg,M(1.035+0.008*s,9*s,3*c),(S,S),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT)
    fg=p.copy()
    # champagne bubbles drawn onto the foreground before it moves, so they travel with the glass
    for fi,ph,xr,r,wph,sp in bubbles:
        ty,by,tx,bx=flutes[fi]; q=(t*sp*2+ph)%1  # 0 bottom -> 1 top
        y=by-(by-ty)*q; lo=bx[0]+(tx[0]-bx[0])*q; hi=bx[1]+(tx[1]-bx[1])*q
        x=lo+4+(hi-lo-8)*xr+1.2*math.sin(q*12+wph)
        al=0.55*math.sin(q*math.pi)
        cv2.circle(fg,(int(x*4),int(y*4)),int(r*4),(0.97,0.98,1.0),-1,lineType=cv2.LINE_AA,shift=2) if False else None
        ov=fg[int(y)-3:int(y)+4,int(x)-3:int(x)+4]
        yy,xx=np.mgrid[-3:4,-3:4]; d=np.exp(-((xx-(x-int(x)))**2+(yy-(y-int(y)))**2)/(0.5*r*r))[...,None]*al
        fg[int(y)-3:int(y)+4,int(x)-3:int(x)+4]=ov*(1-d)+np.array([0.96,0.98,1.0])*d
    m=M(1.06+0.018*s,-7*s,-2*c)
    F=cv2.warpAffine(fg,m,(S,S),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT)
    A=cv2.warpAffine(a,m,(S,S),flags=cv2.INTER_LINEAR)[...,None]
    out=B*(1-A)+F*A
    fr=(np.clip(out,0,1)*255).astype(np.uint8)
    if f in (0,50,100,150): cv2.imwrite(f'f{f}.jpg',fr)
    ff.stdin.write(fr.tobytes())
ff.stdin.close(); ff.wait()
