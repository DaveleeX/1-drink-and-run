import * as T from './vendor/three.module.js';
import {GLASS} from './optics.js';

export function mountTuning({scene,renderer,camera,key,rim,cinematic,getCup,rebuild,recaustics,getCaustics}){
 const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='./tuning.css';document.head.append(stylesheet);
 const defaults={background:.12,environment:.28,rotation:2.05,backgroundBlur:.095,exposure:1.15,key:115,rim:48,topLight:55,keyAngle:.24,keySoftness:.75,keyColor:'#fff5e6',
  ior:1.82,dispersion:.9,roughness:.018,transmission:1,reflection:1.4,absorption:1.2,tint:'#e4eff8',
  width:1,height:1,wall:1,baseThickness:.53,cutDepth:1,cutCount:32,
  toneMapping:'agx',bloomStrength:.18,dofStrength:1,lutStrength:.35,vignetteStrength:.23,beamStrength:.022,beamAngle:27.512,dustCount:64,dustSpeed:1,caustics:1,fov:35,flareStrength:.35,flareGhosts:.06,flareStretch:1};
 const toneMappings={agx:T.AgXToneMapping,aces:T.ACESFilmicToneMapping,neutral:T.NeutralToneMapping,linear:T.LinearToneMapping};
 const state={...defaults},fields=new Map();let timer;
 const panel=document.createElement('section');panel.id='tuning';panel.setAttribute('aria-label','场景参数');
 panel.innerHTML='<div class="tune-head"><button id="tune-toggle" aria-expanded="true" aria-controls="tune-body">收起参数 ↓</button><span id="tune-status" role="status">实时调节 · 杯型松手后更新</span><button id="tune-reset">恢复默认</button></div><div id="tune-body"><nav aria-label="参数分类"></nav><div class="tune-fields"></div></div>';
 document.body.append(panel);document.body.classList.add('tuning-open');
 const groups=[
  ['环境与灯光',[
   ['background','背景亮度',0,.7,.01],['environment','环境补光',0,2,.01],['rotation','环境旋转',0,6.28,.01],['backgroundBlur','背景柔化',0,.6,.01],['exposure','曝光',.5,2,.01],['key','主灯亮度',0,240,1],['rim','轮廓灯亮度',0,140,1],['topLight','顶灯亮度',0,160,1],['keyAngle','主灯照射范围',.12,.5,.01],['keySoftness','主灯边缘柔度',0,1,.01],['keyColor','主灯颜色','color']]],
  ['玻璃材质',[
   ['ior','折射率 IOR',1.3,2.42,.01],['dispersion','色散',0,1.8,.01],['roughness','切面粗糙度',.003,.16,.001],['transmission','透射',.75,1,.01],['reflection','环境反射',.3,2.5,.01],['absorption','吸收距离',.3,10,.1],['tint','吸收颜色','color'],['caustics','焦散强度',0,3,.01]]],
  ['杯型与雕刻',[
   ['height','高度比例',.8,1.2,.01],['width','宽度比例',.8,1.2,.01],['wall','杯壁厚度',.7,1.6,.05],['baseThickness','杯底厚度',.38,.7,.01],['cutCount','切纹数量',16,48,4],['cutDepth','切割深度',.6,1.15,.01]]],
  ['后期与氛围',[
   ['toneMapping','色调映射','select',[['agx','AgX · 柔和高光'],['aces','ACES Filmic · 原版'],['neutral','Neutral · 中性'],['linear','线性裁切 · 对照']]],
   ['flareStrength','镜头光晕（0 关闭）',0,1,.01],['flareGhosts','镜片鬼影',0,.3,.01],['flareStretch','光晕拉伸',.5,3,.05],
   ['bloomStrength','辉光 Bloom',0,.5,.01],['dofStrength','景深',0,1.5,.01],['lutStrength','电影调色',0,1,.01],['vignetteStrength','暗角',0,.6,.01],['beamStrength','光束可见度',0,.06,.001],['beamAngle','光束倾斜角度',5,45,1],['dustCount','粉尘数量',0,64,1],['dustSpeed','粉尘速度',0,2,.05],['fov','镜头视角',28,50,1]]]
 ];
 const shapeKeys=new Set(['height','width','wall','baseThickness','cutCount','cutDepth']);
 const opticalKeys=new Set(['ior','dispersion','absorption','tint']);
 const status=panel.querySelector('#tune-status');
 function applyMaterials(){
  GLASS.ior=state.ior;GLASS.dispersion=state.dispersion;GLASS.distance=state.absorption;
  const tint=state.tint===defaults.tint?new T.Color(.78,.87,.94):new T.Color(state.tint);GLASS.attenuation=[tint.r,tint.g,tint.b];
  getCup().material.forEach((m,i)=>{m.ior=state.ior;m.dispersion=state.dispersion;m.roughness=state.roughness*(i===0?1/3:i===2?2/3:1);m.transmission=state.transmission;m.envMapIntensity=state.reflection*(i===0?1.25/1.4:i===2?1.5/1.4:1);m.attenuationColor.copy(tint);m.attenuationDistance=state.absorption;m.needsUpdate=true;});
 }
 function applyAll(){
  scene.backgroundIntensity=state.background;scene.environmentIntensity=state.environment;
  scene.backgroundRotation.y=scene.environmentRotation.y=state.rotation;scene.backgroundBlurriness=state.backgroundBlur;
  renderer.toneMapping=toneMappings[state.toneMapping];renderer.toneMappingExposure=state.exposure;key.intensity=state.key;rim.intensity=state.rim;key.angle=state.keyAngle;key.penumbra=state.keySoftness;key.color.set(state.keyColor);
  camera.fov=state.fov;camera.updateProjectionMatrix();cinematic.configure(state);applyMaterials();getCaustics().material.uniforms.energy.value=state.caustics;
 }
 function commitGeometry(){
  clearTimeout(timer);status.textContent='正在更新杯型与焦散…';
  timer=setTimeout(()=>{rebuild(state);applyAll();recaustics();getCaustics().material.uniforms.energy.value=state.caustics;status.textContent='杯型已更新';},120);
 }
 function sync(){for(const [key,{range,number}] of fields){range.value=state[key];if(number)number.value=state[key];}}
 groups.forEach(([title,items],index)=>{
  const tab=document.createElement('button');tab.textContent=title;tab.setAttribute('aria-pressed',String(index===0));panel.querySelector('nav').append(tab);
  const section=document.createElement('div');section.className='tune-group';section.hidden=index!==0;panel.querySelector('.tune-fields').append(section);
  tab.onclick=()=>{panel.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));panel.querySelectorAll('.tune-group').forEach(g=>g.hidden=g!==section);};
  items.forEach(([name,label,min,max,step])=>{
   const row=document.createElement('label');row.className='tune-row';const text=document.createElement('span');text.textContent=label;row.append(text);
   if(min==='select'){
    const select=document.createElement('select');select.setAttribute('aria-label',label);
    for(const [value,title] of max){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}
    select.value=state[name];select.onchange=()=>{state[name]=select.value;applyAll();status.textContent='色调映射已切换';};
    row.append(select);fields.set(name,{range:select});section.append(row);return;
   }
   const range=document.createElement('input');range.type=min==='color'?'color':'range';range.value=state[name];range.setAttribute('aria-label',label);row.append(range);
   let number;if(min!=='color'){range.min=min;range.max=max;range.step=step;range.value=state[name];number=document.createElement('input');number.type='number';number.min=min;number.max=max;number.step=step;number.value=state[name];number.setAttribute('aria-label',label+' 数值');row.append(number);}
   const update=(input,commit)=>{
    const value=min==='color'?input.value:Number(Math.min(max,Math.max(min,Math.round(Number(input.value)/step)*step)).toFixed(3));
    if(!Number.isFinite(value)&&min!=='color'){sync();return;}state[name]=value;sync();
    if(shapeKeys.has(name)){status.textContent='松手后更新杯型';if(commit)commitGeometry();return;}
    applyAll();if(opticalKeys.has(name)&&commit){clearTimeout(timer);timer=setTimeout(()=>{recaustics();getCaustics().material.uniforms.energy.value=state.caustics;status.textContent='材质与焦散已同步';},120);}
   };
   range.oninput=()=>update(range,false);range.onchange=()=>update(range,true);if(number)number.onchange=()=>update(number,true);
   fields.set(name,{range,number});section.append(row);
  });
 });
 panel.querySelector('#tune-toggle').onclick=()=>{const body=panel.querySelector('#tune-body'),open=body.hidden;body.hidden=!open;document.body.classList.toggle('tuning-open',open);panel.querySelector('#tune-toggle').textContent=open?'收起参数 ↓':'展开参数 ↑';panel.querySelector('#tune-toggle').setAttribute('aria-expanded',String(open));window.dispatchEvent(new Event('resize'));};
 panel.querySelector('#tune-reset').onclick=()=>{Object.assign(state,defaults);sync();commitGeometry();};
 new ResizeObserver(()=>window.dispatchEvent(new Event('resize'))).observe(panel);
 return panel;
}
