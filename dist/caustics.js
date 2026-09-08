import * as T from './vendor/three.module.js';
import {spectralIOR,refract,fresnel,absorption} from './optics.js';

// Surface-normal photon projection: two-interface approximation, not path tracing.
// Deterministic samples are anchored to the modeled cuts and fixed light direction.
export function addCaustics(scene,cupMesh){
 const g=cupMesh.geometry, p=g.attributes.position, ix=g.index.array;
 const positions=[],powers=[];
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
 const incident=new T.Vector3(3,-5,-4).normalize();
 let totalInternalReflections=0;
 for(let i=0;i<ix.length;i+=3*29){
  a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);
  ab.subVectors(b,a);ac.subVectors(c,a);normal.crossVectors(ab,ac);
  const area=normal.length()/2;if(area<1e-9)continue;normal.normalize();
  const origin=a.clone().add(b).add(c).multiplyScalar(1/3);
  if(origin.y<.16||origin.y>1.55||normal.y>.8)continue;
  const cosine=-normal.dot(incident);if(cosine<.04)continue;
  for(let channel=0;channel<3;channel++){
   const ior=spectralIOR(channel),inside=refract(incident,normal,1,ior);if(!inside)continue;
   const path=cupMesh.userData.thicknessAt(origin)/Math.max(.2,-inside.dot(normal));
   const exit=origin.clone().addScaledVector(inside,path);
   // Approximate the smooth exit interface; TIR photons are not falsely transmitted.
   const inner=new T.Vector3(-exit.x,-.05,-exit.z).normalize();
   if(inside.dot(inner)>0)inner.negate();
   const exitCos=-inside.dot(inner),ray=refract(inside,inner,ior,1);
   if(!ray){totalInternalReflections++;continue;}if(ray.y>-.06)continue;
   const receiverY=.053,t=(receiverY-exit.y)/ray.y;
   if(t<0||t>6)continue;
   const hit=exit.clone().addScaledVector(ray,t);
   const onMat=Math.abs(hit.x)<2.88&&Math.abs(hit.z)<1.94;
   if(!onMat){const t2=(-.094-exit.y)/ray.y;hit.copy(exit).addScaledVector(ray,t2);}
   if(Math.hypot(hit.x,hit.z)>5.15)continue;
   positions.push(hit.x,hit.y+.004,hit.z);
   const energy=3.2*Math.min(.5,area*220)*cosine*(1-fresnel(cosine,1,ior))*(1-fresnel(exitCos,ior,1))*absorption(path,channel);
   powers.push(channel===0?energy:0,channel===1?energy:0,channel===2?energy:0);
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(powers,3));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
  uniforms:{energy:{value:1},pixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.75)}},
  vertexShader:'attribute vec3 color;varying vec3 flux;uniform float pixelRatio;void main(){flux=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(32.*pixelRatio/-mv.z,2.,12.);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying vec3 flux;uniform float energy;void main(){vec2 p=gl_PointCoord-.5;float w=exp(-18.*dot(p,p));gl_FragColor=vec4(flux*energy*w,1.);}'
 });
 const photons=new T.Points(geometry,material);photons.name='Refracted facet caustics';scene.add(photons);
 return {material,count:positions.length/3,totalInternalReflections,setVisible:value=>{photons.visible=value;},dispose(){scene.remove(photons);geometry.dispose();material.dispose();}};
}
