import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from './dist/vendor/three.module.js';
import { buildCup } from './dist/cup-model.js';
import { addCaustics } from './dist/caustics.js';
import { createPipeline } from './dist/render-pipeline.js';
const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.08,70);
const table=new T.Mesh(new T.PlaneGeometry(18,18),new T.MeshPhysicalMaterial());scene.add(table);
const renderer={getContext:()=>({RENDERBUFFER:1,RGBA16F:2,SAMPLES:3,getInternalformatParameter:()=>[4,2,1]}),getPixelRatio:()=>1,getSize:v=>v.set(400,700),getDrawingBufferSize:v=>v.set(400,700)};
const p=createPipeline({renderer,scene,camera,table,wetMask:new T.Texture(),aoExcluded:[],screenExcluded:[],opaqueMaterials:[table.material],mobile:true,light:new T.SpotLight()});
assert.equal(p.samples,4);assert.equal(p.ssr.beautyRenderTarget.samples,4);assert.equal(p.ssr.ssrRenderTarget.texture.type,T.HalfFloatType);
assert.equal(p.ssr.ssrMaterial.defines.MAX_STEP,48);assert.equal(p.composer.passes.length,5);
camera.position.set(3.8,3.25,7.8);camera.lookAt(0,1.15,0);p.cinema.update(0);assert.ok(Number.isFinite(p.cinema.uniforms.focus.value)&&p.cinema.uniforms.focus.value>0);
assert.equal(p.cinema.material.defines.VOLUME_STEPS,8);p.set('cinematic',false);assert.equal(p.cinema.enabled,true,'DOF remains independent of volume toggle');p.set('cinematic',true);
assert.ok(p.ssr.ssrMaterial.fragmentShader.includes('gl_FragColor=vec4(0.)'));assert.ok(p.ssr.ssrMaterial.fragmentShader.includes('op*metalness'));
const shader={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}};table.material.onBeforeCompile(shader);
assert.ok(shader.fragmentShader.includes('reflectedLight.indirectDiffuse *= screenAmbient;'));assert.ok(!shader.fragmentShader.includes('reflectedLight.directDiffuse *= screenAmbient;'));
table.material.onBeforeRender({getRenderTarget:()=>({width:320,height:560})});assert.equal(shader.uniforms.aoViewport.value.x,320,'AO UVs match transmission target');
p.set('ssao',false);assert.equal(shader.uniforms.screenAOStrength.value,0);p.set('ssao',true);assert.ok(shader.uniforms.screenAOStrength.value>0);
p.set('ssr',false);assert.equal(p.ssr.active,false);p.set('bloom',false);assert.equal(p.bloom.enabled,false);
const cup=buildCup({mobile:true});cup.position.y=.02-cup.geometry.boundingBox.min.y;
const bytes=fs.readFileSync('dist/assets/kiriko-caustics.f32');
const c=addCaustics(scene,new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))); assert.ok(c.count>100,'Top light generates actual facet-derived caustic samples');
for(const v of c.points.geometry.attributes.position.array)assert.ok(Number.isFinite(v));
for(let i=1;i<c.points.geometry.attributes.position.array.length;i+=3)assert.ok(Math.abs(c.points.geometry.attributes.position.array[i]-.033)<1e-5);
const energy=c.points.geometry.attributes.color.array;assert.ok(energy.some(v=>v>0));c.setVisible(false);assert.equal(c.points.visible,false);
assert.equal(fs.statSync('dist/assets/walnut-indirect.rgba16f').size,128*128*4*2);
const meta=JSON.parse(fs.readFileSync('dist/assets/walnut-indirect.json'));assert.equal(meta.directSpotlightIncluded,false);assert.ok(meta.maximum>meta.minimum&&meta.minimum>=0);
console.log(`PASS: 4x HDR target, effect order/toggles, indirect-only SSAO, HDR wet SSR, ${c.count} top-light caustic photons, binary irradiance map.`);


// Reproduce the upstream failure on a completely empty reflection neighborhood.
const taps=Array.from({length:5},()=>[0,0,0,0]);
const alpha=taps.reduce((n,v)=>n+v[3]*.2,0);
assert.ok(Number.isNaN(0/alpha),'The old no-hit blur produces NaN');
for(const m of [p.ssr.blurMaterial,p.ssr.blurMaterial2]){
 assert.ok(m.fragmentShader.includes('/max(a, 1e-6);'),'Both blur passes guard empty neighborhoods');
 assert.ok(!m.fragmentShader.includes(')/a;'));
}
const safeBlur=samples=>{const a=samples.reduce((n,v)=>n+v[3]*.2,0);return [0,1,2].map(c=>samples.reduce((n,v)=>n+v[c]*v[3]*.2,0)/Math.max(a,1e-6)).concat(a);};
assert.deepEqual(safeBlur(taps),[0,0,0,0]);
const mixed=safeBlur([[8,4,2,.5],...taps.slice(1)]);
assert.deepEqual(mixed,[8,4,2,.1]);
const background=[.4,.2,.1];const empty=safeBlur(taps);
assert.deepEqual(background.map((v,c)=>v*(1-empty[3])+empty[c]*empty[3]),background,'No-hit SSR preserves the beauty image');
assert.ok(p.ssr.ssrMaterial.fragmentShader.includes('if(totalLen<1e-5) return;'));
console.log('PASS: zero-alpha SSR regression, HDR reflection preservation, no-hit compositing and degenerate-ray guards.');



// ShaderPass clones input uniforms: verify the depth attachment is explicitly rebound.
assert.equal(p.cinema.uniforms.sceneDepth.value,p.ssr.beautyRenderTarget.depthTexture);
assert.equal(p.cinema.uniforms.dofStrength.value,1,'Requested DOF is enabled by default');
camera.position.set(-2,4,8);camera.aspect=.5;camera.updateProjectionMatrix();camera.lookAt(0,1.28,0);p.cinema.update(1);
assert.ok(p.cinema.uniforms.cameraWorld.value.equals(camera.matrixWorld));
assert.ok(p.cinema.uniforms.inverseProjection.value.equals(camera.projectionMatrixInverse));
assert.ok(p.cinema.uniforms.eye.value.equals(camera.position));
p.set('dof',true);assert.equal(p.cinema.uniforms.dofStrength.value,1);p.set('dof',false);
console.log('PASS: live depth attachment, orbit/resize camera uniforms and optional DOF.');

p.set('flare',false);assert.equal(p.flare.enabled,false);p.set('flare',true);p.flare.update();assert.ok(Number.isFinite(p.flare.uniforms.energy.value));assert.equal(p.flare.uniforms.blades.value,6);
c.dispose();p.dispose();cup.geometry.dispose();cup.material.forEach(m=>m.dispose());
