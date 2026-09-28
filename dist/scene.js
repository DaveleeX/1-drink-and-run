import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RGBELoader } from './vendor/addons/loaders/RGBELoader.js';
import { createPipeline } from './render-pipeline.js';
import { addCaustics } from './caustics.js';
import { buildCup } from './cup-model.js';
import { createWear } from './wear.js';
import { addStory } from './story.js';
import { addCigar } from './cigar.js';
import { GLASS } from './optics.js';

try { await boot(); } catch(e) {console.error(e);document.querySelector('#loading')?.remove();document.querySelector('#error').hidden=false;}
async function boot(){
const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const error = document.querySelector('#error');
const mobile = matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 700px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = { seed:1701, glassIOR:GLASS.ior, glassRoughness:.018, glassDispersion:GLASS.dispersion, absorptionDistance:GLASS.distance, exposure:1.12, light:360, dust:1, woodScale:1, debug:'beauty' };
let seed=params.seed;
const random = () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const scene = new THREE.Scene();
scene.background = new THREE.Color('#08090b');
scene.fog = new THREE.FogExp2('#08090b', .075);
let renderer;
try {
 renderer = new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
} catch(e) {loading.hidden=true;loading.style.display='none';error.hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.AgXToneMapping;
renderer.toneMappingExposure=params.exposure;
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.transmissionResolutionScale=1;
host.appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();error.hidden=false;});
renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
const camera = new THREE.PerspectiveCamera(mobile?43:37,innerWidth/innerHeight,.08,70);
const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;
controls.minDistance=4.7;controls.maxDistance=14;
controls.minPolarAngle=.3;controls.maxPolarAngle=Math.PI/2-.06;
controls.autoRotateSpeed=.28;
function resetView(){const portrait=innerWidth<700;camera.position.set(portrait?3.8:3.45,portrait?3.25:2.95,portrait?7.8:6.65);controls.target.set(0,portrait?1.15:1.10,0);controls.update();}
resetView();

let ready=false;
const manager=new THREE.LoadingManager();
manager.onStart=()=>{ready=false;};manager.onLoad=()=>{ready=true;renderer.shadowMap.needsUpdate=true;};
manager.onError=url=>{console.error('Asset failed',url);loading.style.display='none';error.hidden=false;};
// Real interior-bar radiance participates in illumination and reflections only.
const hdr=await new RGBELoader(manager).loadAsync('./assets/warm-bar.hdr');
hdr.mapping=THREE.EquirectangularReflectionMapping;
const pmrem=new THREE.PMREMGenerator(renderer);
// Static reflection stage: finite light apertures, not a screen-space glow overlay.
const reflectionStage=new THREE.Scene();
const roomShell=new THREE.Mesh(new THREE.SphereGeometry(30,48,24),new THREE.MeshBasicMaterial({map:hdr,side:THREE.BackSide,toneMapped:false}));
roomShell.rotation.y=2.05;reflectionStage.add(roomShell);
const aperture=new THREE.Mesh(new THREE.CircleGeometry(.48,48),new THREE.MeshBasicMaterial({color:new THREE.Color(7,3.5,1.2),toneMapped:false}));
aperture.position.set(3.1,.75,.65);aperture.lookAt(0,0,0);reflectionStage.add(aperture);
const overhead=new THREE.Mesh(new THREE.PlaneGeometry(.18,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(3.5,3.1,2.5),toneMapped:false}));
overhead.position.set(-.6,6.2,-.6);overhead.lookAt(0,0,0);reflectionStage.add(overhead);
const barEnvironment=pmrem.fromScene(reflectionStage,.015,.1,50);
for(const object of [roomShell,aperture,overhead]){object.geometry.dispose();object.material.dispose();}
scene.environment=barEnvironment.texture;scene.environmentIntensity=.55;
scene.environmentRotation.y=0;
pmrem.dispose();hdr.dispose();
// Offline, linear HDR irradiance; not a color decal or prepainted shadow.
const bakeResponse=await fetch('./assets/walnut-indirect.rgba16f');
if(!bakeResponse.ok)throw new Error('Indirect lightmap unavailable');
const bakedIrradiance=new THREE.DataTexture(new Uint16Array(await bakeResponse.arrayBuffer()),128,128,THREE.RGBAFormat,THREE.HalfFloatType);
bakedIrradiance.minFilter=bakedIrradiance.magFilter=THREE.LinearFilter;
bakedIrradiance.channel=1;bakedIrradiance.needsUpdate=true;
const key=new THREE.SpotLight(0xffecd8,params.light,24,.47,.78,2);
key.position.set(-.6,7.3,-.6);key.target.position.set(0,0,0);
key.castShadow=true;key.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
key.shadow.bias=-.00015;key.shadow.normalBias=.025;key.shadow.camera.near=.4;key.shadow.camera.far=16;
scene.add(key,key.target);
const fill=new THREE.DirectionalLight(0xcbd3d8,.20);fill.position.set(-4,3,2);scene.add(fill);
// Narrow warm/cool edge lights reveal the cuts without lighting the black background.
const rim=new THREE.SpotLight(0xe2d8be,24,10,.34,.85,2);rim.position.set(2.6,3.2,-2.8);rim.target.position.set(0,1.4,0);scene.add(rim,rim.target);
// Photo reference: a low amber lamp at camera-right, not a global yellow filter.
// Reuse the existing light so the mobile light count stays unchanged.
const bounce=new THREE.SpotLight(0xffc06a,48,9,.64,.85,2);bounce.position.set(3.1,1.85,.65);bounce.target.position.set(0,.65,0);scene.add(bounce,bounce.target);

const loader=new THREE.TextureLoader(manager);
function tex(file,color=false){const t=loader.load('./assets/'+file);t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
const woodColor=tex('walnut-color.jpg',true),woodHeight=tex('walnut-height.jpg'),woodRough=tex('walnut-roughness.jpg'),wetMask=tex('wet-mask.png');
const woodMat=new THREE.MeshPhysicalMaterial({map:woodColor,lightMap:bakedIrradiance,lightMapIntensity:1,bumpMap:woodHeight,bumpScale:.048,roughnessMap:woodRough,roughness:1,metalness:0,clearcoat:.22,clearcoatRoughness:.3,envMapIntensity:.45});
// The damp parts darken the wood and lower roughness from the exact same wetness mask.
woodMat.onBeforeCompile=s=>{
 s.uniforms.wetMask={value:wetMask};
 // Water fills pores: flatten the wood micro-normal only inside the same wet field.
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, wetness * .64));');
 // The bake replaces diffuse environment irradiance; specular HDR reflection stays live.
 s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_maps>',THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );',''));
 s.fragmentShader='uniform sampler2D wetMask;\n'+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat wetness = texture2D(wetMask,vMapUv).r; diffuseColor.rgb *= mix(1.0,0.52,wetness);');
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor,0.055+roughnessFactor*.08,wetness);');
};
const table=new THREE.Mesh(new THREE.PlaneGeometry(18,18),woodMat);table.geometry.setAttribute('uv1',table.geometry.attributes.uv.clone());table.rotation.x=-Math.PI/2;table.receiveShadow=true;scene.add(table);
const slab=new THREE.Mesh(new THREE.BoxGeometry(18,.45,18),new THREE.MeshStandardMaterial({color:0x1b100b,roughness:.8}));slab.position.y=-.24;scene.add(slab);

// Wet-film roughness and the SSR receiver share wetMask; no stacked planar reflector.
// Directly reused from the user's Edo Kiriko project: geometry and local-thickness materials.
const cup=buildCup({mobile});
// Place the lowest modeled point just above the existing contact layer.
cup.position.y=.02-cup.geometry.boundingBox.min.y;
scene.add(cup);
const glassMaterials=cup.material;
// Very low-amplitude handling marks; preserve the original optical shader and modeled cuts.
for(const m of glassMaterials){const opticalHook=m.onBeforeCompile.bind(m);m.onBeforeCompile=shader=>{opticalHook(shader);
 shader.vertexShader='varying vec3 crystalPosition;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncrystalPosition=position;');
 shader.fragmentShader='varying vec3 crystalPosition;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float thumb=exp(-pow((crystalPosition.y-1.6)*4.,2.)-pow((crystalPosition.x-.65)*6.,2.))*smoothstep(.1,.8,crystalPosition.z);
  // Broad, low-contrast handling haze and fine wiping traces affect roughness only.
  float haze=.5+.5*sin(crystalPosition.y*11.+sin(crystalPosition.x*9.))*sin(crystalPosition.z*13.+crystalPosition.x*7.);
  float wiping=smoothstep(.94,.995,sin(crystalPosition.y*145.+sin(crystalPosition.x*18.)+crystalPosition.z*12.));
  float handling=smoothstep(.25,.8,crystalPosition.y)*(1.-smoothstep(2.1,2.5,crystalPosition.y));
  roughnessFactor+=.004+haze*.009+thumb*.022+wiping*handling*.007;
 `);
};m.customProgramCacheKey=()=> 'kiriko-local-thickness-handling-v3';}
const causticResponse=await fetch('./assets/kiriko-caustics.f32');
if(!causticResponse.ok)throw new Error('Caustic bake unavailable');
const caustics=addCaustics(scene,new Float32Array(await causticResponse.arrayBuffer()));
// The cup must not cast an opaque silhouette; localized base contact is a separate approximation.
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
const cc=contactCanvas.getContext('2d');const grad=cc.createRadialGradient(64,64,25,64,64,63);grad.addColorStop(0,'rgba(0,0,0,.18)');grad.addColorStop(.65,'rgba(0,0,0,.31)');grad.addColorStop(1,'rgba(0,0,0,0)');cc.fillStyle=grad;cc.fillRect(0,0,128,128);
const contact=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.016;scene.add(contact);

// Tiny scattered crumb geometry, clustered organically rather than a uniform sprinkle.
const crumbGeo=new THREE.IcosahedronGeometry(1,0);
const crumbColors=[0x9e7441,0x675035,0xc29b63,0x382416];
const debris=new THREE.Group();scene.add(debris);
for(let k=0;k<4;k++){
 const mat=new THREE.MeshStandardMaterial({color:crumbColors[k],roughness:.97});
 const mesh=new THREE.InstancedMesh(crumbGeo,mat,38);const dummy=new THREE.Object3D();
 for(let i=0;i<38;i++){
  let x=(random()-.5)*6,z=(random()-.5)*4.2;
  if(Math.hypot(x,z)<1.12){x+=x<0?-1.2:1.2;}
  if(i<23){x=1.5+(random()-.5)*1.2;z=.72+(random()-.5)*.75;}
  const s=.008+Math.pow(random(),2)*.047;
  dummy.position.set(x,s*.5+.015,z);dummy.rotation.set(random()*3,random()*6,random()*2);dummy.scale.set(s*(1+random()),s*.5,s*(.6+random()));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 mesh.castShadow=true;mesh.receiveShadow=true;debris.add(mesh);
}
// Torn herbs and a small citrus-pith scrap make the residue recognizable at close range.
for(let i=0;i<11;i++){
 const shape=new THREE.Shape();shape.moveTo(-.04,0);shape.quadraticCurveTo(-.055,.07,0,.16);shape.quadraticCurveTo(.07,.055,.025,0);shape.closePath();
 const leaf=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:i%2?0x3d4323:0x5a5630,roughness:.95,side:THREE.DoubleSide}));leaf.rotation.set(-Math.PI/2,0,random()*6);leaf.position.set(1.0+random()*1.4,.022,.45+random()*.9);leaf.scale.setScalar(.35+random()*.7);debris.add(leaf);
}
const rindMat=new THREE.MeshStandardMaterial({color:0x8d612d,roughness:.89});
const rindCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.7,.04,.7),new THREE.Vector3(-1.6,.07,.83),new THREE.Vector3(-1.35,.045,.87),new THREE.Vector3(-1.24,.04,.8)]);
const rind=new THREE.Mesh(new THREE.TubeGeometry(rindCurve,18,.028,5,false),rindMat);rind.castShadow=true;debris.add(rind);

// Flattened clear beads sit on the tabletop, distinct from the broad wet film.
const dropGeo=new THREE.SphereGeometry(1,12,8);
const dropMat=new THREE.MeshPhysicalMaterial({color:0xe1ded1,roughness:.06,metalness:0,transmission:.92,thickness:.06,ior:1.333,envMapIntensity:1.4});
const drops=new THREE.InstancedMesh(dropGeo,dropMat,60);const dummy=new THREE.Object3D();
for(let i=0;i<60;i++){let a=random()*Math.PI*2,r=1.1+random()*1.7,s=.015+random()*.035;dummy.position.set(Math.cos(a)*r,s*.32+.01,Math.sin(a)*r*.75);dummy.scale.set(s,s*.42,s*.8);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);}scene.add(drops);

// Sparse airborne particles; brightness is driven by distance to the overhead light cone.
const count=mobile?420:720;
const dustGeo=new THREE.BufferGeometry(),dustPos=new Float32Array(count*3),dustSeeds=new Float32Array(count);
for(let i=0;i<count;i++){dustPos[i*3]=(random()-.5)*9;dustPos[i*3+1]=random()*7;dustPos[i*3+2]=(random()-.5)*7;dustSeeds[i]=random();if(i%3!==0){dustPos[i*3]=(random()-.5)*3.5-.3;dustPos[i*3+1]=.4+random()*4.8;dustPos[i*3+2]=(random()-.5)*3.5-.3;}}
dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));dustGeo.setAttribute('phase',new THREE.BufferAttribute(dustSeeds,1));
const dustMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},strength:{value:1},pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:`
 uniform float time; uniform float pixelRatio; attribute float phase; varying float light;
 void main(){vec3 p=position;p.x+=sin(time*.11+phase*30.)*.22;p.z+=cos(time*.085+phase*20.)*.15;p.y=mod(p.y+time*(.018+phase*.018),7.);
 float radius=(7.3-p.y)*.40;float axis=length(p.xz-vec2(-.6));light=(1.-smoothstep(radius*.15,max(radius,.01),axis))*(.22+phase*.78);
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((.018+phase*.025)*pixelRatio*210./-mv.z,1.,3.7);}`,fragmentShader:`
 uniform float strength; varying float light;
 void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*4.)*(1.-smoothstep(.75,1.,r));gl_FragColor=vec4(vec3(.9,.82,.70),a*light*.72*strength);}`});
const dust=new THREE.Points(dustGeo,dustMat);scene.add(dust);

// Atmosphere now uses scene depth in the cinematic pass.
const cigar=addCigar(scene);
const wear=createWear(loader);
const story=addStory(scene,cup,loader,wear);
// Tap, not orbit dragging: use a cheap world-space bowl bound rather than raycasting its dense cuts.
const tapRay=new THREE.Raycaster(),tapUV=new THREE.Vector2(),tapHit=new THREE.Vector3();
const cupBounds=new THREE.Box3().setFromObject(cup);
let tapStart=null,touchCount=0;
renderer.domElement.addEventListener('pointerdown',e=>{touchCount++;tapStart=touchCount===1?{x:e.clientX,y:e.clientY,time:performance.now()}:null;});
renderer.domElement.addEventListener('pointercancel',()=>{touchCount=0;tapStart=null;});
renderer.domElement.addEventListener('pointerup',e=>{
 touchCount=Math.max(0,touchCount-1);const start=tapStart;tapStart=null;
 if(!start||!controls.enabled||reducedMotion||performance.now()-start.time>350||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return;
 const rect=renderer.domElement.getBoundingClientRect();tapUV.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);tapRay.setFromCamera(tapUV,camera);
 if(tapRay.ray.intersectBox(cupBounds,tapHit))story.disturb(.5+tapHit.x*.3,.25+tapHit.z*.3);
});
for(const [i,m] of cigar.materials.entries())wear(m,i===0?"ceramic":i===2?"metal":"shell",{color:i<3,normal:.15});
for(const m of glassMaterials)wear(m,"ceramic",{color:false,normal:.025});
const opaqueMaterials=[woodMat,slab.material,rindMat,...cigar.materials,...story.materials];
debris.traverse(o=>{if(o.isMesh)opaqueMaterials.push(o.material);});
const screenExcluded=[dust,contact,caustics.points,cigar.smoke,...story.excluded.slice(2)];
const pipeline=createPipeline({renderer,scene,camera,table,wetMask,mobile,opaqueMaterials,light:key,
 aoExcluded:[cup,drops,...story.excluded,...screenExcluded],screenExcluded});
let lampOn=true;let causticsOn=true;
document.querySelector('#lightToggle').addEventListener('click',e=>{lampOn=!lampOn;caustics.setVisible(lampOn&&causticsOn);key.intensity=lampOn?params.light:0;renderer.shadowMap.needsUpdate=true;dustMat.uniforms.strength.value=lampOn?1:.1;e.currentTarget.setAttribute('aria-pressed',String(lampOn));});
document.querySelector('#reset').addEventListener('click',()=>{controls.autoRotate=false;resetView();});
function resize(){camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?43:37;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);pipeline.resize();if(introStarted&&!introDone){introEnd.set(innerWidth<700?3.8:3.45,innerWidth<700?3.25:2.95,innerWidth<700?7.8:6.65);}}
addEventListener('resize',resize);
// Inspectable deterministic controls for material validation without crowding the viewing surface.
window.nocturne={params,scene,camera,renderer,pipeline,caustics,resetView,setDebug(mode){table.material=mode==='wetness'?new THREE.MeshBasicMaterial({map:wetMask}):mode==='roughness'?new THREE.MeshBasicMaterial({map:woodRough}):woodMat;},setGlass({ior=params.glassIOR,roughness=params.glassRoughness,dispersion=params.glassDispersion}={}){glassMaterials.forEach((material,i)=>{material.ior=THREE.MathUtils.clamp(ior,1.3,2.42);material.roughness=THREE.MathUtils.clamp(roughness,.003,.5)*(i===0?1/3:i===2?2/3:1);material.dispersion=THREE.MathUtils.clamp(dispersion,0,1.8);});}};

for(const name of ['bloom','ssao','ssr','cinematic','dof','flare']){
 document.querySelector('#fx-'+name)?.addEventListener('change',e=>pipeline.set(name,e.target.checked));
}
document.querySelector('#fx-blades')?.addEventListener('change',e=>{const n=Number(e.target.value);pipeline.flare.uniforms.blades.value=n;pipeline.cinema.uniforms.blades.value=n;});
document.querySelector('#fx-grade').addEventListener('input',e=>pipeline.output.uniforms.gradeStrength.value=Number(e.target.value));
document.querySelector('#fx-flare-strength').addEventListener('input',e=>pipeline.flare.uniforms.strength.value=Number(e.target.value));
document.querySelector('#fx-smoke')?.addEventListener('change',e=>cigar.smoke.visible=e.target.checked);
document.querySelector('#fx-caustics')?.addEventListener('change',e=>{causticsOn=e.target.checked;caustics.setVisible(lampOn&&causticsOn);});
document.querySelector('#fx-bake')?.addEventListener('change',e=>{woodMat.lightMapIntensity=e.target.checked?1:0;});
const clock=new THREE.Clock();
let lastFrame=-Infinity,previousTime=0,introElapsed=0,introStarted=false,introDone=false;
const introEnd=new THREE.Vector3(),introTarget=new THREE.Vector3();
const introStart=new THREE.Vector3(-4.6,2.1,7.9),introMiddle=new THREE.Vector3(-.8,2.55,8.7);
const skip=document.querySelector('#skip-intro'),hint=document.querySelector('#gesture-hint');
controls.enabled=false;document.body.classList.add('opening');
function finishIntro(){resetView();introDone=true;controls.enabled=true;skip.hidden=true;document.body.classList.remove('opening');hint.classList.add('visible');setTimeout(()=>hint.classList.remove('visible'),4500);}
skip.addEventListener('click',finishIntro);
controls.addEventListener('start',()=>{hint.classList.remove('visible');document.querySelector('#effects').open=false;});
function frame(now){
 if(document.hidden||now-lastFrame<(mobile?1000/30:1000/60)-1)return;
 lastFrame=now;const t=clock.getElapsedTime(),dt=Math.min(.05,Math.max(0,t-previousTime));previousTime=t;
 if(ready&&!introStarted){introStarted=true;resetView();introEnd.copy(camera.position);introTarget.copy(controls.target);loading.style.opacity='0';setTimeout(()=>loading.remove(),900);if(reducedMotion)finishIntro();else skip.hidden=false;}
 if(introStarted&&!introDone){
  introElapsed+=dt;const u=Math.min(1,introElapsed/4.2),e=u*u*(3-2*u),v=1-e;
  camera.position.copy(introStart).multiplyScalar(v*v).addScaledVector(introMiddle,2*v*e).addScaledVector(introEnd,e*e);
  controls.target.set(0,THREE.MathUtils.lerp(.72,introTarget.y,e),0);camera.lookAt(controls.target);
  if(u===1)finishIntro();
 }else if(introDone)controls.update();
 dustMat.uniforms.time.value=reducedMotion?0:t;cigar.update(reducedMotion?2:t,renderer.getPixelRatio());story.update(reducedMotion?0:t);pipeline.render(reducedMotion?0:t);
}
renderer.setAnimationLoop(frame);

}
