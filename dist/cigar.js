import * as T from 'three';
export function addCigar(scene){
 const group=new T.Group();group.position.set(-2.05,.025,.25);group.rotation.y=Math.PI-.35;scene.add(group);
 const ceramic=new T.MeshPhysicalMaterial({color:0x202925,roughness:.38,metalness:.08,clearcoat:.55,clearcoatRoughness:.3});
 ceramic.onBeforeCompile=s=>{
 s.vertexShader='varying vec3 wearPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwearPosition=position;');
 s.fragmentShader='varying vec3 wearPosition;\n'+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 wp=wearPosition.xz;float wr=length(wp);
 float mottling=.5+.5*sin(wp.x*19.+sin(wp.y*13.))*sin(wp.y*23.+sin(wp.x*9.));
 float soot=(1.-smoothstep(.24,.63,wr))*(.35+.65*mottling);
 float scuff=smoothstep(.95,.995,sin(wp.x*115.+wp.y*28.))*smoothstep(.4,.7,wr);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.018,.012,.009),soot*.8);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.15,.12),scuff*.25);`);
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+soot*.38+mottling*.12+scuff*.16,0.,1.);');
 };ceramic.customProgramCacheKey=()=> 'aged-ceramic-v1';
 const profile=[[0,0],[.66,0],[.75,.06],[.78,.21],[.75,.29],[.66,.29],[.59,.12],[0,.12]].map(p=>new T.Vector2(...p));
 const tray=new T.Mesh(new T.LatheGeometry(profile,80),ceramic);tray.castShadow=tray.receiveShadow=true;group.add(tray);
 const tobacco=new T.MeshStandardMaterial({color:0x482313,roughness:.86});tobacco.onBeforeCompile=s=>{s.vertexShader='varying vec3 wrapperPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwrapperPosition=position;');s.fragmentShader='varying vec3 wrapperPosition;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float veins=sin(wrapperPosition.y*95.+atan(wrapperPosition.z,wrapperPosition.x)*5.);float grain=fract(sin(dot(wrapperPosition,vec3(128.1,311.7,74.7)))*43758.5453);float patches=.5+.5*sin(wrapperPosition.y*18.+sin(wrapperPosition.x*35.))*sin(wrapperPosition.z*27.+wrapperPosition.y*9.);
 float seam=smoothstep(.90,.99,sin(wrapperPosition.y*21.+atan(wrapperPosition.z,wrapperPosition.x)*2.));
 diffuseColor.rgb*=.55+.22*grain+.32*patches+.12*smoothstep(.8,1.,veins);
 diffuseColor.rgb*=1.-seam*.25;`);s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(.72+patches*.23+seam*.05,0.,1.);');};tobacco.customProgramCacheKey=()=> 'aged-tobacco-v1';
 const cigar=new T.Group();cigar.position.set(.08,.36,0);cigar.rotation.z=-Math.PI/2+.075;group.add(cigar);
 function part(geometry,material,y){const m=new T.Mesh(geometry,material);m.position.y=y;m.castShadow=m.receiveShadow=true;cigar.add(m);return m;}
 part(new T.CylinderGeometry(.105,.098,1.38,40,24),tobacco,0);
 const band=new T.MeshStandardMaterial({color:0x8d713c,metalness:.55,roughness:.52});part(new T.CylinderGeometry(.107,.107,.18,40),band,-.35);
 const ashMat=new T.MeshStandardMaterial({color:0x88847d,roughness:1});part(new T.CylinderGeometry(.101,.105,.23,32,5),ashMat,.8);
 const emberMat=new T.MeshStandardMaterial({color:0x23110b,emissive:0xff3306,emissiveIntensity:2,roughness:1});part(new T.CylinderGeometry(.095,.098,.025,32),emberMat,.925);
 const ember=new T.PointLight(0xff4a0a,.22,.8,2);ember.position.y=.94;cigar.add(ember);
 for(let i=0;i<32;i++){const a=i*2.39996,r=.09*Math.sqrt((i+.5)/32);const c=part(new T.IcosahedronGeometry(.018+(i%3)*.006,0),ashMat,.945);c.position.x=Math.cos(a)*r;c.position.z=Math.sin(a)*r;}
 for(let i=0;i<25;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.012+(i%4)*.004,0),ashMat);m.position.set(Math.sin(i*12.7)*.4,.14,Math.cos(i*8.3)*.35);group.add(m);}
 const n=56,geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));geo.setAttribute('phase',new T.BufferAttribute(Float32Array.from({length:n},(_,i)=>i/n),1));
 const smokeMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},pixelRatio:{value:1}},vertexShader:`uniform float time,pixelRatio;attribute float phase;varying float age;varying float seed;void main(){age=fract(phase+time*.085);seed=phase*93.;float h=age*2.5;vec3 p=position;p.y+=h;p.x+=sin(h*3.7-time*.6)*(.015+age*.10)-age*age*.45;p.z+=cos(h*4.-time*.4+phase*3.)*age*.13;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((.035+age*.36)*pixelRatio*480./max(.1,-mv.z),1.,160.);}`,fragmentShader:`varying float age,seed;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float wisps=.65+.35*sin(p.x*16.+sin(p.y*12.+seed)*2.+seed);float a=exp(-r*r*4.)*(1.-smoothstep(.6,1.,r))*sin(age*3.14159)*.105*wisps;gl_FragColor=vec4(.61,.66,.69,a);}`});
 const smoke=new T.Points(geo,smokeMat);smoke.frustumCulled=false;scene.add(smoke);group.updateMatrixWorld(true);smoke.position.copy(cigar.localToWorld(new T.Vector3(0,.96,0)));
 const materials=[ceramic,tobacco,band,ashMat,emberMat];
 return {group,smoke,materials,update(time,dpr){smokeMat.uniforms.time.value=time;smokeMat.uniforms.pixelRatio.value=dpr;const pulse=1.7+.3*Math.sin(time*1.5)+.15*Math.sin(time*4.1);emberMat.emissiveIntensity=pulse;ember.intensity=.12*pulse;}};
}
