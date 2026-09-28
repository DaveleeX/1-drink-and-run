"""Deterministic black walnut PBR maps; same grain drives color, height and roughness."""
import numpy as np
from scipy.ndimage import gaussian_filter,map_coordinates
from PIL import Image,ImageDraw
from pathlib import Path
out=Path(__file__).parent/'dist/assets';out.mkdir(exist_ok=True)
rng=np.random.default_rng(1701);n=1536
y,x=np.mgrid[0:n,0:n]/n
def noise(sy,sx):
 a=gaussian_filter(rng.normal(size=(n,n)).astype('float32'),(sy,sx),mode='wrap');return a/(a.std()+1e-6)
warp=noise(110,60)*.007+noise(30,140)*.004
v=y+warp+.012*np.sin(x*7+y*10)
# Elliptical growth rings, with irregular pores aligned along the grain.
for cx,cy in [(.3,.24),(.75,.68),(.09,.83)]:
 dx=(x-cx)*.48;dy=y-cy
 v+=.028*np.exp(-(dx*dx/.03+dy*dy/.005))*np.sin(np.arctan2(dy,dx)*2)
grain=np.sin(v*950+noise(5,85)*1.9)*.19+noise(2,100)*.30+noise(.55,16)*.17
broad=noise(40,200)*.11
pores=np.maximum(noise(.4,6)-1.5,0)*.08
value=np.clip(.51+grain*.28+broad-pores,.1,.9)
board=np.floor(y*5).astype(int);tones=np.array([.93,1.03,.88,1.08,.97,1.]);value*=tones[board]
seam=(np.mod(y*5,1)<.003);value[seam]*=.23
# Cross-grain scratches and embedded dirt, generated together in height and color.
scratch=Image.new('L',(n,n),0);d=ImageDraw.Draw(scratch)
for _ in range(190):
 xx,yy=rng.integers(0,n,2);length=int(rng.integers(3,130));d.line((xx,yy,xx+length,yy+int(rng.normal()*8)),fill=int(rng.integers(20,105)),width=1)
s=np.asarray(scratch)/255;value=np.clip(value+s*.19,0,1)
col=np.stack([value*.44+.042,value*.29+.025,value*.19+.017],axis=-1)
Image.fromarray(np.uint8(np.clip(col,0,1)*255)).save(out/'walnut-color.jpg',quality=95)
height=np.clip(.49+grain*.09+s*.2-pores,.05,.95);height[seam]=.22
Image.fromarray(np.uint8(height*255)).save(out/'walnut-height.jpg',quality=95)
rough=np.clip(.65+noise(12,40)*.12-grain*.035+s*.1,.25,.93)
Image.fromarray(np.uint8(rough*255)).save(out/'walnut-roughness.jpg',quality=93)
# A shared irregular wetness field: patches, droplets, smears and a partial glass ring.
a=np.zeros_like(x)
for cx,cy,rx,ry in [(.56,.50,.087,.043),(.40,.42,.032,.061),(.49,.58,.062,.028),(.61,.63,.05,.019)]:
 q=((x-cx)/rx)**2+((y-cy)/ry)**2;a=np.maximum(a,np.clip((1-q+noise(10,10)*.13)*6,0,1))
for _ in range(85):
 cx,cy=rng.uniform(.32,.68,2);r=rng.uniform(.0007,.0036);q=((x-cx)/r)**2+((y-cy)/r)**2;a=np.maximum(a,np.clip((1-q)*3,0,1))
rr=np.sqrt(((x-.41)*1.0)**2+((y-.56)*1.0)**2)
ring=np.exp(-((rr-.048)/.0014)**2)*np.clip(noise(18,18)+.8,0,1)
a=np.maximum(a,ring*.65)
Image.fromarray(np.uint8(a*255)).save(out/'wet-mask.png')
print('Generated four shared-field walnut and wetness maps.')
