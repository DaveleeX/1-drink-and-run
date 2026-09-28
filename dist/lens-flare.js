import * as T from 'three';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';
// Artistic optical ghosts in linear HDR, independent of scene defocus.
export function createLensFlare(camera,light,scene){
 const pass=new ShaderPass({uniforms:{tDiffuse:{value:null},source:{value:new T.Vector2()},aspect:{value:1},energy:{value:0},strength:{value:.65},blades:{value:6}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec2 vUv;uniform sampler2D tDiffuse;uniform vec2 source;uniform float aspect,energy,strength,blades;
 float polygon(vec2 p,float radius){float a=atan(p.y,p.x);float sector=6.2831853/blades;float d=length(p)*cos(mod(a+sector*.5,sector)-sector*.5);return 1.-smoothstep(radius*.86,radius,d);}
 void main(){vec3 color=texture2D(tDiffuse,vUv).rgb;vec2 p=(vUv-.5)*vec2(aspect,1.),s=(source-.5)*vec2(aspect,1.);vec3 flare=vec3(0.);
 for(int i=0;i<5;i++){float f=float(i);vec2 c=s*(.65-f*.43);float radius=.028+f*.017;float mask=polygon(p-c,radius);vec3 tint=.52+.48*cos(vec3(0.,2.,4.)+f*1.7);flare+=tint*mask*(.018+f*.006);}
 vec2 q=p+s*.25;float r=length(q);float arc=exp(-pow((r-(.48+.1*length(s)))/.022,2.));float edge=smoothstep(.28,.65,length(p));vec3 rainbow=.5+.5*cos(vec3(0.,2.094,4.188)+(r-.48)*85.);float facing=.3+.7*max(0.,dot(normalize(q+vec2(.0001)),normalize(s+vec2(.0001))));flare+=rainbow*arc*edge*facing*.22;
 flare+=vec3(1.,.71,.43)*.07*exp(-length(p-s)*7.);gl_FragColor=vec4(color+flare*energy*strength,1.);}`});
 const occluders=[];scene.traverse(o=>{const materials=Array.isArray(o.material)?o.material:[o.material];if(o.isMesh&&materials.every(m=>m&&!m.transparent&&!(m.transmission>0)))occluders.push(o);});
 const position=new T.Vector3(),direction=new T.Vector3(),ray=new T.Raycaster();let smoothed=0,cachedVisibility=0;const lastCamera=new T.Matrix4(),lastProjection=new T.Matrix4(),lastLight=new T.Vector3(Infinity,Infinity,Infinity);
 pass.setSize=(w,h)=>pass.uniforms.aspect.value=w/h;
 pass.update=()=>{camera.updateMatrixWorld();light.getWorldPosition(position);direction.subVectors(position,camera.position);const distance=direction.length();const view=position.clone().applyMatrix4(camera.matrixWorldInverse);const uv=position.clone().project(camera);pass.uniforms.source.value.set(uv.x*.5+.5,uv.y*.5+.5);
  let visibility=view.z<0?1-T.MathUtils.smoothstep(Math.max(Math.abs(uv.x),Math.abs(uv.y)),1.1,3.8):0;
  const changed=!lastCamera.equals(camera.matrixWorld)||!lastProjection.equals(camera.projectionMatrix)||!lastLight.equals(position);
  if(!changed)visibility=cachedVisibility;
  if(changed&&visibility>0){scene.updateMatrixWorld();ray.set(camera.position,direction.normalize());ray.far=Math.max(0,distance-.1);const hit=ray.intersectObjects(occluders,false).some(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex||0]:h.object.material;return m&&!m.transparent&&!(m.transmission>0)&&h.object.isMesh;});if(hit)visibility=0;}
  if(changed){cachedVisibility=visibility;lastCamera.copy(camera.matrixWorld);lastProjection.copy(camera.projectionMatrix);lastLight.copy(position);}
  smoothed+=(visibility*(light.intensity>0?1:0)-smoothed)*.15;pass.uniforms.energy.value=smoothed;
 };return pass;
}
