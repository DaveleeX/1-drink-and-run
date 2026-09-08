import * as T from './vendor/three.module.js';
import { buildCup } from './cup-model.js';
import { addBarStage } from './bar-stage.js';
import { addCaustics } from './caustics.js';
import { addSoftProjection } from './soft-projection.js';
import { createCinematic } from './cinematic.js';
import { mountTuning } from './tuning.js';
import { addWhisky } from './whisky.js';
const host=document.querySelector('#stage'), loading=document.querySelector('#loading');
try { await boot(); } catch(e){console.error(e);loading.textContent='三维场景加载失败，请刷新页面或使用支持 WebGL 2 的浏览器。';}
async function boot(){
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.05,100);
loading.textContent='正在载入 360° 酒吧 HDR 环境…';
await addBarStage(scene,renderer);
addSoftProjection(scene);
const cup=new T.Group();scene.add(cup);
let cupMesh=buildCup({mobile:matchMedia('(max-width: 700px)').matches});cup.add(cupMesh);
for(const material of cupMesh.material)material.envMap=scene.environment;
const key=new T.SpotLight('#fff5e6',115,14,.24,.75,1.5);key.name='Crystal key light';key.position.set(-3,5,4);key.target.position.set(0,1.1,0);scene.add(key,key.target);const rim=new T.SpotLight('#d7e7ff',48,12,.22,.8,1.5);rim.position.set(3,3,-3);rim.target.position.set(0,1.4,0);scene.add(rim,rim.target);scene.add(new T.HemisphereLight('#fff4db','#3a2513',.16));
let caustics=addCaustics(scene,cupMesh);
const cinematic=createCinematic(renderer,scene,camera);
let whisky;
mountTuning({scene,renderer,camera,key,rim,cinematic,getCup:()=>cupMesh,getCaustics:()=>caustics,
 rebuild:params=>{const next=buildCup({...params,mobile:matchMedia('(max-width: 700px)').matches});for(const m of next.material)m.envMap=scene.environment;cup.remove(cupMesh);cupMesh.geometry.dispose();cupMesh.material.forEach(m=>m.dispose());cupMesh=next;cup.add(cupMesh);whisky?.rebuild();},
 recaustics:()=>{const next=addCaustics(scene,cupMesh);caustics.dispose();caustics=next;}
});
// Highlights now come from modeled facets, with no time-driven sparkle particles.
// Soft contact shadow keeps the transparent foot grounded without masking the reference mat.
const shadowGeo=new T.PlaneGeometry(3.1,3.1);const shadowMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;void main(){float r=length((v-.5)*2.);gl_FragColor=vec4(.015,.012,.009,.52*(1.-smoothstep(.15,1.,r)));}'});const shadow=new T.Mesh(shadowGeo,shadowMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;scene.add(shadow);
let yaw=.17,pitch=1.06,distance=8.5,targetDistance=8.5,auto=!matchMedia('(prefers-reduced-motion: reduce)').matches,detail=false;
const spin=document.querySelector('#spin');spin.setAttribute('aria-pressed',auto);spin.onclick=()=>{auto=!auto;spin.setAttribute('aria-pressed',auto);};
whisky=addWhisky({scene,cup,camera,canvas:renderer.domElement,getCup:()=>cupMesh,onLift:()=>{auto=false;spin.setAttribute('aria-pressed','false');}});
document.querySelector('#close').onclick=()=>{detail=!detail;targetDistance=detail?5.6:8.5;if(detail)pitch=.48;document.querySelector('#close').setAttribute('aria-pressed',detail);};
document.querySelector('#reset').onclick=()=>{yaw=.17;pitch=1.06;detail=false;targetDistance=8.5;document.querySelector('#close').setAttribute('aria-pressed','false');};
document.querySelector('#lighting').oninput=e=>{const n=+e.target.value;renderer.toneMappingExposure=n;caustics.material.uniforms.energy.value=n;document.querySelector('#lightValue').value=Math.round(n*100)+'%';};
const pointers=new Map();let lastPinch=0;const c=renderer.domElement;c.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);if(pointers.size===1){yaw-=(e.clientX-old.x)*.007;pitch=T.MathUtils.clamp(pitch+(e.clientY-old.y)*.005,.3,1.49);}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)targetDistance=T.MathUtils.clamp(targetDistance*lastPinch/d,4.3,11);lastPinch=d;}});for(const ev of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(ev,e=>{pointers.delete(e.pointerId);lastPinch=0;});c.addEventListener('wheel',e=>{e.preventDefault();targetDistance=T.MathUtils.clamp(targetDistance+e.deltaY*.006,4.3,11);},{passive:false});
let mobile=false;function resize(){const w=innerWidth,h=Math.max(180,innerHeight-(document.querySelector('#tuning')?.offsetHeight||0));mobile=w<700;renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();cinematic.resize(w,h);}addEventListener('resize',resize);resize();
let previous=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.05);previous=now;if(auto&&!whisky.lifted&&pointers.size===0)yaw+=dt*.13;distance+=(targetDistance-distance)*.07;whisky.update(dt);caustics.setVisible(cup.position.y<.08);shadow.visible=cup.position.y<.08;const target=new T.Vector3(mobile?-.08:-.95,(detail?1.05:1.25)+cup.position.y*.7,0);const d=distance*(mobile?1.12:1);camera.position.set(target.x+Math.sin(yaw)*d*Math.sin(pitch),target.y+Math.cos(pitch)*d,Math.cos(yaw)*d*Math.sin(pitch));camera.lookAt(target);cinematic.render(now*.001);}loading.remove();requestAnimationFrame(animate);
c.addEventListener('webglcontextlost',e=>{e.preventDefault();const error=document.createElement('div');error.id='loading';error.textContent='图形连接已暂停，请刷新页面恢复预览。';document.body.appendChild(error);});
}
