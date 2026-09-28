import fs from 'node:fs';
import * as T from './dist/vendor/three.module.js';
import { MeshBVH } from './dist/vendor/mesh-bvh.module.js';
import { buildCup } from './dist/cup-model.js';
import { spectralIOR,refract,fresnel,absorption } from './dist/optics.js';
const cup=buildCup();const offset=.02-cup.geometry.boundingBox.min.y;
const bvh=new MeshBVH(cup.geometry,{indirect:true,maxLeafSize:8});
const light=new T.Vector3(-.6,7.3-offset,-.6);
const values=[];let tir=0,entered=0;const side=150,steps=10;
for(let z=0;z<side;z++)for(let x=0;x<side;x++){
 const target=new T.Vector3(((x+.5)/side-.5)*3.5,-offset,((z+.5)/side-.5)*3.5);
 for(let channel=0;channel<3;channel++){
  const ray=new T.Ray(light.clone(),target.clone().sub(light).normalize());
  const ior=spectralIOR(channel);let inside=false,flux=1,crossings=0;
  for(let bounce=0;bounce<steps;bounce++){
   const hit=bvh.raycastFirst(ray,T.DoubleSide,1e-5);
   if(!hit){
    if(crossings<2||inside||ray.direction.y>=-.01)break;
    const t=(.033-offset-ray.origin.y)/ray.direction.y;if(t<=0)break;
    const q=ray.at(t,new T.Vector3());if(Math.hypot(q.x,q.z)>5.15)break;
    const intensity=flux*.7;values.push(q.x,.033,q.z,channel===0?intensity:0,channel===1?intensity:0,channel===2?intensity:0);break;
   }
   const normal=hit.face.normal.clone();if(ray.direction.dot(normal)>0)normal.negate();
   if(inside)flux*=absorption(hit.distance,channel);
   const n1=inside?ior:1,n2=inside?1:ior,cos=-ray.direction.dot(normal);
   const out=refract(ray.direction,normal,n1,n2);
   if(out){flux*=1-fresnel(cos,n1,n2);inside=!inside;ray.direction.copy(out);crossings++;entered++;}
   else{ray.direction.reflect(normal);tir++;}
   if(flux<.008)break;
   ray.origin.copy(hit.point).addScaledVector(ray.direction,.0002);
  }
 }
}
const data=new Float32Array(values);fs.writeFileSync('dist/assets/kiriko-caustics.f32',new Uint8Array(data.buffer));
const meta={photons:values.length/6,launched:side*side*3,totalInternalReflections:tir,maxInterfaces:steps,lightPosition:[-.6,7.3,-.6],receiverY:.033,method:'RGB photon tracing through actual carved mesh with BVH, Snell refraction, Fresnel losses, absorption and bounded TIR; fixed-pose bake',crossings:entered};fs.writeFileSync('dist/assets/kiriko-caustics.json',JSON.stringify(meta,null,2));console.log(meta);
if(meta.photons<100)throw new Error('Insufficient refracted photons');
