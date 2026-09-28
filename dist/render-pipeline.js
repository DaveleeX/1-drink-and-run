import * as T from 'three';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { SSAOPass } from './vendor/addons/postprocessing/SSAOPass.js';
import { SSRPass } from './vendor/addons/postprocessing/SSRPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { createCinematicPass } from './cinematic-pass.js';
import { createLensFlare } from './lens-flare.js';
import { createFilmOutput } from './film-grade.js';

// SSAO is computed before beauty and applied inside the opaque materials' indirect terms.
// The transparent cup is not treated as a solid opaque occluder.
class AmbientPrepass extends SSAOPass {
 constructor(scene,camera,excluded){super(scene,camera,1,1,24);this.excluded=excluded;this.kernelRadius=.18;this.minDistance=.0002;this.maxDistance=.013;
  this.kernel.forEach((v,i)=>{const p=i*2.39996323,z=(i+.5)/24,r=Math.sqrt(1-z*z);v.set(Math.cos(p)*r,Math.sin(p)*r,z).multiplyScalar(.1+.9*(i/24)**2);});
  const data=this.noiseTexture.image.data;for(let i=0;i<data.length;i++)data[i]=Math.sin(i*127.1+1701)*.5+.5;this.noiseTexture.needsUpdate=true;
 }
 render(renderer){
  const visible=this.excluded.map(o=>o.visible);this.excluded.forEach(o=>o.visible=false);
  try {this._overrideVisibility();this._renderOverride(renderer,this.normalMaterial,this.normalRenderTarget,0x7777ff,1);this._restoreVisibility();}
  finally {this.excluded.forEach((o,i)=>o.visible=visible[i]);}
  this.ssaoMaterial.uniforms.kernelRadius.value=this.kernelRadius;
  this.ssaoMaterial.uniforms.minDistance.value=this.minDistance;
  this.ssaoMaterial.uniforms.maxDistance.value=this.maxDistance;
  this._renderPass(renderer,this.ssaoMaterial,this.ssaoRenderTarget);
  this._renderPass(renderer,this.blurMaterial,this.blurRenderTarget);
 }
}

class WetSSRPass extends SSRPass {
 constructor(options,excluded,mobile){super(options);this.excluded=excluded;this.active=true;this.mobile=mobile;
  // No-hit neighborhoods have alpha=0. The upstream alpha-weighted blur divides
  // by that alpha, producing NaN RGB which contaminates Bloom and the full frame.
  for(const material of [this.blurMaterial,this.blurMaterial2]){
   const old=material.fragmentShader;
   material.fragmentShader=old.replace('/a;', '/max(a, 1e-6);');
   if(material.fragmentShader===old)throw new Error('SSR blur safety patch did not match');
   material.needsUpdate=true;
  }
  // Preserve bright HDR reflected highlights through the reflection and blur passes.
  for(const rt of [this.ssrRenderTarget,this.blurRenderTarget,this.blurRenderTarget2])rt.texture.type=T.HalfFloatType;
  this.ssrMaterial.fragmentShader=this.ssrMaterial.fragmentShader
   .replace('void main(){','void main(){\ngl_FragColor=vec4(0.);')
   .replace('float maxReflectRayLen=maxDistance/dot(-viewIncidentDir,viewNormal);','float facing=dot(-viewIncidentDir,viewNormal); if(facing<=1e-5) return; float maxReflectRayLen=maxDistance/facing;')
   .replace('float totalLen=length(d1-d0);','float totalLen=length(d1-d0); if(totalLen<1e-5) return;')
   .replace('float totalStep=max(abs(xLen),abs(yLen));','float totalStep=max(1e-5,min(max(abs(xLen),abs(yLen)),float(MAX_STEP)));')
   .replace('gl_FragColor.a=op;','float border=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));\ngl_FragColor.a=op*metalness*smoothstep(0.,.08,border);');
 }
 setSize(w,h){super.setSize(w,h);this.ssrMaterial.defines.MAX_STEP=this.mobile?48:144;this.ssrMaterial.needsUpdate=true;}
 withoutAtmosphere(fn){const states=this.excluded.map(o=>o.visible);this.excluded.forEach(o=>o.visible=false);try{return fn();}finally{this.excluded.forEach((o,i)=>o.visible=states[i]);}}
 _renderOverride(...args){return this.withoutAtmosphere(()=>super._renderOverride(...args));}
 _renderMetalness(...args){return this.withoutAtmosphere(()=>super._renderMetalness(...args));}
 render(renderer,writeBuffer,readBuffer,dt,mask){
  if(this.active)return super.render(renderer,writeBuffer,readBuffer,dt,mask);
  renderer.setRenderTarget(this.beautyRenderTarget);renderer.clear();renderer.render(this.scene,this.camera);
  this.copyMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture;this.copyMaterial.blending=T.NoBlending;
  this._renderPass(renderer,this.copyMaterial,writeBuffer);
 }
}

export function createPipeline({renderer,scene,camera,table,wetMask,aoExcluded,screenExcluded,opaqueMaterials,mobile,light}){
 const gl=renderer.getContext();
 const supported=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
 const samples=supported.includes(4)?4:Math.max(0,...supported.filter(n=>n<4));
 const ao=new AmbientPrepass(scene,camera,aoExcluded);
 const aoUniforms={screenAO:{value:ao.blurRenderTarget.texture},aoViewport:{value:new T.Vector2()},screenAOStrength:{value:.72}};
 for(const material of new Set(opaqueMaterials)){
  const before=material.onBeforeRender.bind(material);
  material.onBeforeRender=(r,...args)=>{before(r,...args);const active=r.getRenderTarget();if(active)aoUniforms.aoViewport.value.set(active.width,active.height);else r.getDrawingBufferSize(aoUniforms.aoViewport.value);};
  const materialKey=material.customProgramCacheKey();
  const old=material.onBeforeCompile.bind(material);material.onBeforeCompile=shader=>{old(shader);Object.assign(shader.uniforms,aoUniforms);
   shader.fragmentShader='uniform sampler2D screenAO; uniform vec2 aoViewport; uniform float screenAOStrength;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
    float screenAmbient=mix(1.0,texture2D(screenAO,gl_FragCoord.xy/aoViewport).r,screenAOStrength);
    reflectedLight.indirectDiffuse *= screenAmbient;
    reflectedLight.indirectSpecular *= mix(1.0,screenAmbient,0.3);`);
  };material.customProgramCacheKey=()=>materialKey+'-screen-ao-indirect-v2';material.needsUpdate=true;
 }
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 const composer=new EffectComposer(renderer,target);composer.setPixelRatio(1);
 const ssr=new WetSSRPass({renderer,scene,camera,width:1,height:1,selects:[table]},screenExcluded,mobile);
 ssr.beautyRenderTarget.samples=samples;
 ssr.metalnessOnMaterial.map=wetMask;ssr.metalnessOnMaterial.toneMapped=false;
 ssr.metalnessOffMaterial.toneMapped=false;
 ssr.opacity=.5;ssr.maxDistance=5;ssr.thickness=.09;ssr.resolutionScale=mobile?.4:.65;
 ssr.blur=true;ssr.fresnel=true;ssr.distanceAttenuation=true;ssr.bouncing=false;
 const bloom=new UnrealBloomPass(new T.Vector2(1,1),.14,.28,1.4);
 const cinema=createCinematicPass(camera,ssr.beautyRenderTarget.depthTexture,light,mobile);
 const flare=createLensFlare(camera,light,scene);
 const output=createFilmOutput();composer.addPass(ssr);composer.addPass(cinema);composer.addPass(bloom);composer.addPass(flare);composer.addPass(output);
 const state={ssao:true,ssr:true,bloom:true,cinematic:true,dof:true,flare:true};
 let aoDirty=true;const aoCamera=new T.Matrix4(),aoProjection=new T.Matrix4();
 function resize(){aoDirty=true;const size=renderer.getDrawingBufferSize(new T.Vector2());composer.setSize(size.x,size.y);ao.setSize(Math.round(size.x*(mobile?.45:.6)),Math.round(size.y*(mobile?.45:.6)));aoUniforms.aoViewport.value.copy(size);}
 resize();
 return {state,ssr,ao,bloom,cinema,flare,output,samples,composer,
  resize,
  set(name,enabled){if(!(name in state))return;state[name]=enabled;if(name==='ssao')aoDirty=true;ssr.active=state.ssr;bloom.enabled=state.bloom;flare.enabled=state.flare;cinema.enabled=state.cinematic||state.dof;cinema.uniforms.cinematic.value=state.cinematic?1:0;cinema.uniforms.dofStrength.value=state.dof?1:0;aoUniforms.screenAOStrength.value=state.ssao?.72:0;},
  render(time=0){cinema.update(time);if(state.flare)flare.update();const previous=renderer.getRenderTarget();if(state.ssao&&(aoDirty||!aoCamera.equals(camera.matrixWorldInverse)||!aoProjection.equals(camera.projectionMatrix))){ao.render(renderer);aoCamera.copy(camera.matrixWorldInverse);aoProjection.copy(camera.projectionMatrix);aoDirty=false;}renderer.setRenderTarget(previous);composer.render();},
  dispose(){ao.dispose();ssr.dispose();bloom.dispose();cinema.dispose();flare.dispose();output.dispose();composer.dispose();}
 };
}
