import * as T from './vendor/three.module.js';
// Fixed-pose RGB photons traced offline through the actual cut-glass mesh.
// Reprojected in world space, so orbiting does not move the light pattern.
export function addCaustics(scene,data){
 const count=data.length/6,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
 for(let i=0;i<count;i++){positions.set(data.subarray(i*6,i*6+3),i*3);colors.set(data.subarray(i*6+3,i*6+6),i*3);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));
 const material=new T.ShaderMaterial({transparent:false,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{energy:{value:.65},pixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.75)}},
 vertexShader:'attribute vec3 color;varying vec3 flux;uniform float pixelRatio;void main(){flux=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(26.*pixelRatio/-mv.z,1.,9.);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying vec3 flux;uniform float energy;void main(){vec2 p=gl_PointCoord-.5;float w=exp(-22.*dot(p,p));gl_FragColor=vec4(flux*energy*w,1.);}'
 });
 const points=new T.Points(geometry,material);points.name='Baked RGB cut-crystal photons';points.renderOrder=1;scene.add(points);
 return {points,material,count,setVisible(value){points.visible=value;},dispose(){scene.remove(points);geometry.dispose();material.dispose();}};
}
