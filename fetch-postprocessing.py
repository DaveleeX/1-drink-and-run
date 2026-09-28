from pathlib import Path
import urllib.request,re,concurrent.futures,posixpath
root=Path(__file__).parent/'dist/vendor/addons'
queue=['postprocessing/EffectComposer.js','postprocessing/SSAOPass.js','postprocessing/SSRPass.js','postprocessing/UnrealBloomPass.js','postprocessing/OutputPass.js','postprocessing/ShaderPass.js','loaders/RGBELoader.js'];seen=set()
def fetch(path):
 dest=root/path;dest.parent.mkdir(parents=True,exist_ok=True)
 data=urllib.request.urlopen('https://unpkg.com/three@0.180.0/examples/jsm/'+path,timeout=35).read();dest.write_bytes(data)
 deps=[]
 for p in re.findall(r"from\s+['\"]([^'\"]+)['\"]",data.decode()):
  if p.startswith('.'):deps.append(posixpath.normpath(posixpath.join(posixpath.dirname(path),p)))
 return deps
while queue:
 batch=[q for q in queue if q not in seen];queue=[];seen.update(batch)
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  for deps in ex.map(fetch,batch):queue.extend(deps)
print('Vendored',len(seen),'pinned Three.js r180 addon modules.')
