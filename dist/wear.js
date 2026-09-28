import * as T from 'three';
export function createWear(loader){
 const cache=new Map();
 function texture(file,color=false){if(cache.has(file))return cache.get(file);const t=loader.load('./assets/'+file);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(color)t.colorSpace=T.SRGBColorSpace;cache.set(file,t);return t;}
 return (material,kind,{color=true,bump=.008,normal=.18}={})=>{
  if(color){material.map=texture(`wear-${kind}-color.jpg`,true);material.color.set(0xffffff);}
  material.roughnessMap=texture(`wear-${kind}-orm.jpg`);material.metalnessMap=material.roughnessMap;
  material.normalMap=texture(`wear-${kind}-normal.png`);material.normalScale.setScalar(normal);
  // Three uses the normal map in preference to bump when both are supplied.
  material.bumpMap=texture(`wear-${kind}-height.png`);material.bumpScale=bump;
  material.needsUpdate=true;return material;
 };
}
