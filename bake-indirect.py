"""Offline deterministic cosine-weighted irradiance bake for the walnut countertop.
Integrates the actual Warm Bar HDR and one diffuse bounce from a bounded bar-room proxy.
No direct spotlight is stored here, so its switch stays physically independent.
"""
from pathlib import Path
import numpy as np,json,re
from scipy.ndimage import gaussian_filter
root=Path(__file__).parent; assets=root/'dist/assets'
def read_rgbe(path):
 with open(path,'rb') as f:
  while f.readline().strip():pass
  dims=f.readline().decode();h,w=map(int,re.findall(r'\d+',dims));out=np.empty((h,w,4),np.uint8)
  for y in range(h):
   header=f.read(4);assert header[:2]==b'\x02\x02' and header[2]*256+header[3]==w
   for c in range(4):
    x=0
    while x<w:
     n=f.read(1)[0]
     if n>128:count=n-128;out[y,x:x+count,c]=f.read(1)[0]
     else:count=n;out[y,x:x+count,c]=np.frombuffer(f.read(count),np.uint8)
     x+=count
 return out[:,:,:3].astype(np.float32)*np.exp2(out[:,:,3].astype(np.float32)-136)[...,None]
hdr=read_rgbe(assets/'warm-bar.hdr');H,W=hdr.shape[:2]
rng=np.random.default_rng(1701);size=128;samples=512
# A conservative room proxy used only for the bake; it is not visible geometry.
# The open service side receives HDR directly. Dark walls/ceiling contribute one diffuse bounce.
rotation=2.05; intensity=.55

def env(d):
 xx=np.cos(rotation)*d[...,0]+np.sin(rotation)*d[...,2]
 zz=-np.sin(rotation)*d[...,0]+np.cos(rotation)*d[...,2]
 u=(np.arctan2(zz,xx)/(2*np.pi)+.5)%1
 v=np.arccos(np.clip(d[...,1],-1,1))/np.pi
 return hdr[np.minimum((v*H).astype(int),H-1),np.minimum((u*W).astype(int),W-1)]*intensity

def hemi(count,normal):
 u=(np.arange(count)+.5)/count;phi=np.arange(count)*2.399963229728653
 local=np.stack([np.sqrt(u)*np.cos(phi),np.sqrt(1-u),np.sqrt(u)*np.sin(phi)],-1)
 n=np.asarray(normal,float);helper=np.array([0,0,1.]) if abs(n[2])<.9 else np.array([1.,0,0]);t=np.cross(n,helper);t/=np.linalg.norm(t);b=np.cross(t,n)
 return local[:,0,None]*t+local[:,1,None]*n+local[:,2,None]*b
normals=[(1,0,0),(-1,0,0),(0,0,1),(0,-1,0)]
wallRadiance=np.array([env(hemi(8192,n)).mean(0)*np.array([.16,.115,.085]) for n in normals])
# Use stratified cosine-weighted rays: irradiance estimator = pi * mean(incoming radiance).
dirs=hemi(samples,(0,1,0)); result=np.zeros((size,size,3),np.float32)
xx,zz=np.meshgrid((np.arange(size)+.5)/size*18-9,9-(np.arange(size)+.5)/size*18)
orig=np.stack([xx,np.zeros_like(xx)+.012,zz],-1).reshape(-1,3)
# Plane UV row 0 is v=0 => world z=+9 for Three's X-rotated PlaneGeometry.

for d in dirs:
 radiance=np.broadcast_to(env(d),(len(orig),3)).copy();near=np.full(len(orig),np.inf);idx=np.full(len(orig),-1)
 for k,(axis,val) in enumerate([(0,-11),(0,11),(2,-11),(1,8)]):
  if abs(d[axis])<1e-7:continue
  t=(val-orig[:,axis])/d[axis];hit=orig+t[:,None]*d
  valid=(t>0)&(hit[:,1]>=0)&(hit[:,1]<=8)&(np.abs(hit[:,0])<=11)&(np.abs(hit[:,2])<=11)
  use=valid&(t<near);near[use]=t[use];idx[use]=k
 for k in range(4):radiance[idx==k]=wallRadiance[k]
 result+=radiance.reshape(size,size,3)
result*=np.pi/samples
# Irradiance is linear HDR, no albedo or direct spot baked into this texture.
result=gaussian_filter(result,(.7,.7,0));rgba=np.concatenate([result,np.ones((size,size,1))],-1).astype('<f2')
rgba.tofile(assets/'walnut-indirect.rgba16f')
meta={'width':size,'height':size,'format':'RGBA16F little endian','colorSpace':'linear','samplesPerTexel':samples,'seed':1701,'environmentRotation':rotation,'environmentIntensity':intensity,'method':'cosine-weighted Monte Carlo, HDR visibility plus one diffuse bounce from room proxy','directSpotlightIncluded':False,'minimum':float(result.min()),'maximum':float(result.max()),'meanRGB':result.mean((0,1)).tolist()}
(assets/'walnut-indirect.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2))
