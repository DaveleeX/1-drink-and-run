import * as T from './vendor/three.module.js';
import {FlareSource} from './flare-source.js';

export function createCinematic(renderer,scene,camera){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthTexture:new T.DepthTexture(1,1)});
 const bloomA=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 const bloomB=bloomA.clone();
 const detectorTarget=new T.WebGLRenderTarget(32,24,{depthBuffer:false});
 const detectorPixels=new Uint8Array(32*24*4),flareSource=new FlareSource();let lastDetection=-1,lastFrame=0;
 const detectorMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{hdr:{value:target.texture}},
 vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:'varying vec2 p;uniform sampler2D hdr;void main(){vec3 c=texture2D(hdr,p).rgb;float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(vec3(clamp(log2(1.+l)/8.,0.,1.)),1.);}'});
 const detectorScene=new T.Scene();detectorScene.add(new T.Mesh(new T.PlaneGeometry(2,2),detectorMaterial));
 const blurUniforms={inputTexture:{value:target.texture},stepSize:{value:new T.Vector2()},extract:{value:1}};
 const blurMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:blurUniforms,
 vertexShader:'varying vec2 uvBlur;void main(){uvBlur=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`varying vec2 uvBlur;uniform sampler2D inputTexture;uniform vec2 stepSize;uniform float extract;
 vec3 sampleLight(vec2 uv){
   vec3 c=texture2D(inputTexture,clamp(uv,vec2(0.),vec2(1.))).rgb;
   float l=dot(c,vec3(.2126,.7152,.0722));
   float knee=clamp(l-.9,0.,.6);float contribution=max(l-1.2,knee*knee/2.4);
   return mix(c,c*max(0.,contribution)/max(l,.0001),extract);
 }
 void main(){vec3 c=vec3(0.);float total=0.;
   for(int i=-4;i<=4;i++){float x=float(i),w=exp(-x*x/8.);c+=sampleLight(uvBlur+stepSize*x)*w;total+=w;}
   gl_FragColor=vec4(c/total,1.);
 }`});
 const blurScene=new T.Scene();blurScene.add(new T.Mesh(new T.PlaneGeometry(2,2),blurMaterial));
 // Display-sRGB creative LUT, sampled only after the single output conversion.
 // Near-white highlights bypass its tint to preserve neutral specular cores.
 const size=16,data=new Uint8Array(size**3*4);let k=0;
 for(let b=0;b<size;b++)for(let g=0;g<size;g++)for(let r=0;r<size;r++){
  const c=[r/15,g/15,b/15],l=c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const grade=[.016*l,-.004,.016*(1-l)-.012*l];
  for(let j=0;j<3;j++)data[k++]=255*T.MathUtils.clamp((c[j]-.5)*1.035+.5+grade[j],0,1);
  data[k++]=255;
 }
 const lut=new T.Data3DTexture(data,size,size,size);lut.format=T.RGBAFormat;lut.minFilter=lut.magFilter=T.LinearFilter;lut.unpackAlignment=1;lut.needsUpdate=true;
 const source=new T.Vector3(-2.5,6,1.3),beamEnd=new T.Vector3(0,1.2,0);
 const beamAxis=source.clone().sub(beamEnd);let beamLength=beamAxis.length(),dustSpeed=1;
 const beamRotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),beamAxis.clone().normalize());
 const uniforms={frame:{value:target.texture},bloomTexture:{value:bloomB.texture},depth:{value:target.depthTexture},lut:{value:lut},resolution:{value:new T.Vector2(1,1)},focus:{value:8},near:{value:camera.near},far:{value:camera.far}};
 Object.assign(uniforms,{bloomStrength:{value:.18},vignetteStrength:{value:.23},dofStrength:{value:1},lutStrength:{value:.35}});
 Object.assign(uniforms,{flareStrength:{value:.35},flareGhosts:{value:.06},flareStretch:{value:1},flarePosition:{value:flareSource.position},flareEnergy:{value:0}});
 const material=new T.ShaderMaterial({glslVersion:T.GLSL3,uniforms,depthTest:false,depthWrite:false,
 vertexShader:'out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`precision highp sampler3D;
 out vec4 cinematicColor;
 #define gl_FragColor cinematicColor
 in vec2 vUv;uniform sampler2D frame,depth,bloomTexture;uniform sampler3D lut;uniform vec2 resolution;uniform float near,far,focus;
 uniform float bloomStrength,vignetteStrength,dofStrength,lutStrength;
 uniform float flareStrength,flareGhosts,flareStretch,flareEnergy;uniform vec2 flarePosition;
 float viewDepth(vec2 uv){float d=texture(depth,uv).r;return near*far/(far-d*(far-near));}
 void main(){
  float z=viewDepth(vUv),coc=clamp(max(0.,abs(z-focus)-.8)/max(z,1.)*.006,0.,.003)*dofStrength;
  vec3 color=texture(frame,vUv).rgb;float weight=1.;
  vec2 aspect=vec2(resolution.y/resolution.x,1.);
  for(int i=0;i<16;i++){
   float a=float(i)*2.399963,r=sqrt((float(i)+.5)/16.);
   vec2 uv=clamp(vUv+vec2(cos(a),sin(a))*aspect*coc*r,vec2(.001),vec2(.999));
   float sampleZ=viewDepth(uv);float w=sampleZ<z-.4?.05:1.;
   color+=texture(frame,uv).rgb*w;weight+=w;
  }
  color/=weight;
  // Bloom comes only from rendered HDR highlights, with no screen-space ghost shapes.
  color+=texture(bloomTexture,vUv).rgb*bloomStrength;
  // A single highlight drives a soft pupil footprint and two faint, filled ghosts.
  vec2 delta=(vUv-flarePosition)/aspect;
  float footprint=max(2./resolution.y,.004);
  float core=exp(-dot(delta,delta)/.0024);
  float streak=exp(-delta.y*delta.y/(footprint*footprint))*exp(-abs(delta.x)/( .045*flareStretch));
  vec3 flareLight=vec3(1.,.84,.64)*(core*.11+streak*.14);
  vec2 field=(flarePosition-.5)/aspect;float fieldLength=length(field);
  vec2 axis=fieldLength>.0001?field/fieldLength:vec2(1.,0.);vec2 tangent=vec2(-axis.y,axis.x);
  for(int i=0;i<2;i++){
   float t=i==0?1.45:1.92;vec2 center=mix(flarePosition,vec2(.5),t);
   vec2 g=(vUv-center)/aspect;float radius=i==0?.06:.10;
   vec2 pupil=vec2(dot(g,axis)/(radius*.65),dot(g,tangent)/radius);
   float shape=exp(-dot(pupil,pupil)*2.);
   flareLight+=shape*(i==0?vec3(.4,.65,.53):vec3(.62,.4,.22))*flareGhosts;
  }
  color+=flareLight*flareStrength*flareEnergy;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float gradeWeight=lutStrength*(1.-smoothstep(.65,.98,min(gl_FragColor.r,min(gl_FragColor.g,gl_FragColor.b))));
  gl_FragColor.rgb=mix(gl_FragColor.rgb,texture(lut,clamp(gl_FragColor.rgb,0.,1.)*(15./16.)+vec3(.5/16.)).rgb,gradeWeight);
  float vignette=1.-vignetteStrength*smoothstep(.18,.75,length((vUv-.5)*vec2(1.,.85)));
  gl_FragColor.rgb*=vignette;
 }`});
 const postScene=new T.Scene();postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));const postCamera=new T.Camera();
 const beamMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
 uniforms:{time:{value:0},strength:{value:.022}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 v;uniform float time,strength;void main(){float edge=pow(sin(v.x*3.14159265),3.);float fade=smoothstep(0.,.15,v.y)*(1.-smoothstep(.87,1.,v.y));gl_FragColor=vec4(vec3(1.,.85,.60),edge*fade*strength);}'});
 const beam=new T.Mesh(new T.CylinderGeometry(.045,.86,beamLength,48,1,true),beamMat);beam.position.copy(source).add(beamEnd).multiplyScalar(.5);beam.quaternion.copy(beamRotation);scene.add(beam);
 const spotlight=new T.SpotLight('#fff0d4',55,12,.20,.65,1.5);spotlight.position.copy(source);spotlight.target.position.copy(beamEnd);scene.add(spotlight,spotlight.target);
 const count=64,particles=new Float32Array(count*3),seeds=[];
 let seed=83;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<count;i++)seeds.push({a:rand()*6.283,r:Math.sqrt(rand()),y:rand(),speed:.013+rand()*.018});
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(particles,3));
 const dustMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
 vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(12./-p.z,1.,2.3);gl_Position=projectionMatrix*p;}',
 fragmentShader:'void main(){float a=exp(-14.*dot(gl_PointCoord-.5,gl_PointCoord-.5));gl_FragColor=vec4(1.,.89,.69,a*.32);}'});
 const dust=new T.Points(geo,dustMat);dust.frustumCulled=false;scene.add(dust);
 return {
  configure(values){
   for(const name of ['bloomStrength','vignetteStrength','dofStrength','lutStrength','flareStrength','flareGhosts','flareStretch'])if(values[name]!==undefined)uniforms[name].value=values[name];
   if(values.beamStrength!==undefined)beamMat.uniforms.strength.value=values.beamStrength;
   if(values.topLight!==undefined)spotlight.intensity=values.topLight;
   if(values.dustCount!==undefined)geo.setDrawRange(0,values.dustCount);
   if(values.dustSpeed!==undefined)dustSpeed=values.dustSpeed;
   if(values.beamAngle!==undefined){
    source.x=-Math.tan(values.beamAngle*Math.PI/180)*(source.y-beamEnd.y);
    beamAxis.copy(source).sub(beamEnd);const length=beamAxis.length();beam.scale.y=length/beamLength;
    beamRotation.setFromUnitVectors(new T.Vector3(0,1,0),beamAxis.clone().normalize());beam.quaternion.copy(beamRotation);
    beam.position.copy(source).add(beamEnd).multiplyScalar(.5);spotlight.position.copy(source);
   }
  },
  resize(w,h){const d=renderer.getPixelRatio();target.setSize(Math.round(w*d),Math.round(h*d));uniforms.resolution.value.set(w*d,h*d);bloomA.setSize(Math.max(1,Math.round(w*d/2)),Math.max(1,Math.round(h*d/2)));bloomB.setSize(bloomA.width,bloomA.height);},
  render(time){
   beamMat.uniforms.time.value=time;
   seeds.forEach((s,i)=>{const t=(s.y+time*s.speed*dustSpeed)%1,r=(.86*(1-t)+.045*t)*s.r,a=s.a+time*.025*dustSpeed;const p=new T.Vector3(Math.cos(a)*r,(t-.5)*beamLength*beam.scale.y,Math.sin(a)*r).applyQuaternion(beamRotation).add(beam.position);particles[i*3]=p.x;particles[i*3+1]=p.y;particles[i*3+2]=p.z;});geo.attributes.position.needsUpdate=true;
   camera.updateMatrixWorld();
   const focal=(scene.userData.focusPoint||new T.Vector3(0,1.25,0)).clone().applyMatrix4(camera.matrixWorldInverse);uniforms.focus.value=-focal.z;
   renderer.setRenderTarget(target);renderer.render(scene,camera);
   if(uniforms.flareStrength.value>0&&time-lastDetection>.15){
    renderer.setRenderTarget(detectorTarget);renderer.render(detectorScene,postCamera);
    renderer.readRenderTargetPixels(detectorTarget,0,0,32,24,detectorPixels);flareSource.detect(detectorPixels,32,24);lastDetection=time;
   }
   flareSource.update(lastFrame?time-lastFrame:1/60);lastFrame=time;uniforms.flareEnergy.value=flareSource.energy;
   // Two separable Gaussian rounds yield a continuous glow, not displaced highlight copies.
   for(let round=0;round<2;round++){
    blurUniforms.inputTexture.value=round===0?target.texture:bloomB.texture;blurUniforms.extract.value=round===0?1:0;
    blurUniforms.stepSize.value.set(1/bloomA.width,0);renderer.setRenderTarget(bloomA);renderer.render(blurScene,postCamera);
    blurUniforms.inputTexture.value=bloomA.texture;blurUniforms.extract.value=0;
    blurUniforms.stepSize.value.set(0,1/bloomA.height);renderer.setRenderTarget(bloomB);renderer.render(blurScene,postCamera);
   }
   renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
  }
 };
}
