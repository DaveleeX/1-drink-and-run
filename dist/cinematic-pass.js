import * as T from 'three';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';

// Depth-limited spotlight integration and restrained background defocus in linear HDR.
export function createCinematicPass(camera,depth,light,mobile){
 const pass=new ShaderPass({defines:{VOLUME_STEPS:mobile?8:24},uniforms:{tDiffuse:{value:null},sceneDepth:{value:depth},resolution:{value:new T.Vector2(1,1)},inverseProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},eye:{value:camera.position},lamp:{value:light.position},lampDirection:{value:new T.Vector3().subVectors(light.target.position,light.position).normalize()},lampEnergy:{value:1},time:{value:0},focus:{value:8},blades:{value:6},dofStrength:{value:1},cinematic:{value:1},near:{value:camera.near},far:{value:camera.far}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`
 varying vec2 vUv;uniform sampler2D tDiffuse,sceneDepth;uniform vec2 resolution;
 uniform mat4 inverseProjection,cameraWorld;uniform vec3 eye,lamp,lampDirection;
 uniform float lampEnergy,time,focus,dofStrength,blades,cinematic,near,far;
 float viewDepth(vec2 uv){float d=texture2D(sceneDepth,uv).r;return near*far/(far-d*(far-near));}
 float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 void main(){
  vec3 color=texture2D(tDiffuse,vUv).rgb;float z=viewDepth(vUv);
  // A broad focus band protects the entire crystal vessel, not just one depth slice.
  float blur=clamp((abs(z-focus)-1.35)*3.2,0.,10.)*dofStrength;
  vec3 sum=color;float weight=1.;
  if(blur>.01) for(int i=0;i<12;i++){float a=float(i)*2.39996323;float sector=6.2831853/blades;float aperture=cos(3.14159265/blades)/cos(mod(a+sector*.5,sector)-sector*.5);vec2 uv=clamp(vUv+vec2(cos(a),sin(a))*sqrt((float(i)+.5)/12.)*aperture*blur/resolution,vec2(.001),vec2(.999));float dz=viewDepth(uv);float w=1.-smoothstep(.3,1.5,max(0.,z-dz));sum+=texture2D(tDiffuse,uv).rgb*w;weight+=w;}
  color=mix(color,sum/weight,smoothstep(.2,1.2,blur));
  vec4 v=inverseProjection*vec4(vUv*2.-1.,1.,1.);vec3 viewRay=normalize(v.xyz/v.w);vec3 ray=normalize(mat3(cameraWorld)*viewRay);
  float distance=min(z/max(.001,-viewRay.z),18.);float stepLength=distance/float(VOLUME_STEPS);float scatter=0.;
  for(int i=0;i<VOLUME_STEPS;i++){
   vec3 p=eye+ray*(float(i)+.5)*stepLength;vec3 fromLight=p-lamp;float r2=dot(fromLight,fromLight);float cone=smoothstep(cos(.47),cos(.27),dot(normalize(fromLight),lampDirection));
   float density=.45+.55*noise(p*.65+vec3(time*.025,0.,time*.012));density*=smoothstep(0.,.3,p.y);
   float phase=.7+.3*pow(max(0.,dot(-ray,normalize(fromLight))),4.);
   scatter+=cone*density*phase*stepLength/(1.+r2*.28);
  }
  color+=vec3(1.,.88,.72)*scatter*.06*lampEnergy*cinematic;
  float vignette=smoothstep(.2,.9,length((vUv-.5)*vec2(.9,1.)));color*=1.-vignette*.16*cinematic;
  gl_FragColor=vec4(color,1.);
 }`});
 // ShaderPass clones uniforms. Render-target textures must retain their live identity.
 pass.uniforms.sceneDepth.value=depth;
 pass.setSize=(w,h)=>pass.uniforms.resolution.value.set(w,h);
 pass.update=time=>{
  camera.updateMatrixWorld();
  pass.uniforms.time.value=time;
  pass.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
  pass.uniforms.cameraWorld.value.copy(camera.matrixWorld);
  pass.uniforms.eye.value.copy(camera.position);
  pass.uniforms.lamp.value.copy(light.position);
  pass.uniforms.lampDirection.value.subVectors(light.target.position,light.position).normalize();
  pass.uniforms.focus.value=-new T.Vector3(0,1.28,0).applyMatrix4(camera.matrixWorldInverse).z;
  pass.uniforms.lampEnergy.value=light.intensity>0?1:0;
 };
 return pass;
}
