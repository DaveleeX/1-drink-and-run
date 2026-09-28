import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './dist/vendor/three.module.js';
import { buildCup } from './dist/cup-model.js';
import { GLASS } from './dist/optics.js';
const source=fs.readFileSync('dist/scene.js','utf8');
for(const path of ['style.css','scene.js','cup-model.js','optics.js','vendor/three.module.js','vendor/three.core.js','vendor/OrbitControls.js','vendor/Reflector.js','assets/walnut-color.jpg','assets/walnut-height.jpg','assets/walnut-roughness.jpg','assets/wet-mask.png'])assert.ok(fs.statSync('dist/'+path).size>0,path);
for(const mobile of [true,false]){
 const cup=buildCup({mobile});const g=cup.geometry;
 for(const n of g.attributes.position.array)assert.ok(Number.isFinite(n));
 for(const t of g.attributes.opticalThickness.array)assert.ok(Number.isFinite(t)&&t>0);
 assert.ok(g.boundingBox.max.y>2.5&&g.boundingBox.max.x<1.1);
 assert.equal(cup.material.length,3);assert.ok(g.groups.length<12);
 assert.equal(g.groups.reduce((n,v)=>n+v.count,0),g.index.count);
 for(const m of cup.material){
  assert.equal(m.ior,GLASS.ior);assert.equal(m.dispersion,GLASS.dispersion);
  const shader={vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};m.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes('material.thickness = vOpticalThickness;'),'r180 local-thickness compatibility');
  assert.ok(shader.vertexShader.includes('vOpticalThickness=opticalThickness;'));
 }
 console.log(`${mobile?'Mobile':'Desktop'}: ${g.index.count/3} triangles, ${g.groups.length} material groups; finite geometry and thickness, shader integration passed.`);
 g.dispose();cup.material.forEach(m=>m.dispose());
}
assert.ok(source.includes('scene.environment=barEnvironment.texture'));
assert.ok(source.includes('caustics.setVisible(lampOn&&causticsOn)'));
console.log('PASS: cup geometry/material transfer and existing lighting integration.');
