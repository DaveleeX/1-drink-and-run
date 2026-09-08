import * as T from './vendor/three.module.js';

// Damped shallow slosh modes, effective gravity and volume loss at the rim.
// This is a bounded real-time liquid approximation, not an SPH/Navier–Stokes solver.
export class Slosh {
 constructor(){this.fill=0;this.x=0;this.z=0;this.vx=0;this.vz=0;this.spilled=0;}
 step(dt,gravityX,gravityZ,depth,radius){
  const steps=Math.ceil(dt/(1/120)),h=dt/Math.max(1,steps);let loss=0;
  for(let i=0;i<steps;i++){
   this.vx+=(36*(gravityX-this.x)-3.6*this.vx)*h;this.vz+=(36*(gravityZ-this.z)-3.6*this.vz)*h;
   this.x=T.MathUtils.clamp(this.x+this.vx*h,-2.5,2.5);this.z=T.MathUtils.clamp(this.z+this.vz*h,-2.5,2.5);
   const overflow=Math.max(0,Math.hypot(this.x,this.z)*radius-(1-this.fill)*depth);
   const drained=Math.min(this.fill,overflow*h*.9);this.fill-=drained;loss+=drained;
  }
  this.spilled+=loss;return loss;
 }
}

export function addWhisky({scene,cup,camera,canvas,getCup,onLift}){
 const sim=new Slosh();let lifted=false,pouring=false,pointer=null,last={x:0,y:0},profile=getCup().userData.liquidProfile;
 const aim=new T.Vector2(),previousPosition=new T.Vector3(),velocity=new T.Vector3(),previousVelocity=new T.Vector3();
 const material=new T.MeshPhysicalMaterial({color:'#b45a12',roughness:.065,metalness:0,transmission:.12,ior:1.36,thickness:.5,attenuationColor:new T.Color('#d68a22'),attenuationDistance:.65,envMapIntensity:1.3,side:T.DoubleSide});
 const n=64,rows=10,positions=new Float32Array(((rows+1)*n+1)*3),indices=[];
 for(let j=0;j<rows;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);}
 const center=(rows+1)*n;for(let i=0;i<n;i++)indices.push(center,rows*n+(i+1)%n,rows*n+i);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setIndex(indices);
 const liquid=new T.Mesh(geo,material);liquid.frustumCulled=false;liquid.renderOrder=-2;cup.add(liquid);
 const stream=new T.Mesh(new T.CylinderGeometry(.026,.035,1,12),material);stream.visible=false;cup.add(stream);
 const drops=new T.InstancedMesh(new T.SphereGeometry(1,8,5),material,160);drops.instanceMatrix.setUsage(T.DynamicDrawUsage);drops.frustumCulled=false;drops.count=0;scene.add(drops);
 const puddleMaterial=new T.MeshPhysicalMaterial({color:'#7a4318',roughness:.12,metalness:0,transparent:true,opacity:.58,depthWrite:false});
 const puddles=new T.InstancedMesh(new T.CircleGeometry(1,24),puddleMaterial,32);puddles.frustumCulled=false;puddles.count=0;scene.add(puddles);
 const particles=[],spots=[],dummy=new T.Object3D();let seed=191,accumulator=0,clock=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const ui=document.createElement('div');ui.id='whisky-controls';ui.innerHTML='<button id="pour-whisky">倒入威士忌</button><button id="lift-whisky" aria-pressed="false">拿起酒杯</button><span role="status" id="whisky-status">点击倒酒 · 拿起后拖动晃杯</span>';document.body.append(ui);
 const pour=ui.querySelector('#pour-whisky'),lift=ui.querySelector('#lift-whisky'),status=ui.querySelector('#whisky-status');
 function toggleLift(){lifted=!lifted;pouring=false;pointer=null;aim.set(0,0);lift.textContent=lifted?'放回桌面':'拿起酒杯';lift.setAttribute('aria-pressed',String(lifted));onLift(lifted);}
 lift.onclick=toggleLift;pour.onclick=()=>{if(lifted)toggleLift();pouring=true;aim.set(0,0);};
 canvas.addEventListener('pointerdown',e=>{if(!lifted)return;e.stopImmediatePropagation();e.preventDefault();if(pointer!==null)return;pointer=e.pointerId;last={x:e.clientX,y:e.clientY};canvas.setPointerCapture(pointer);},{capture:true});
 canvas.addEventListener('pointermove',e=>{if(!lifted)return;e.stopImmediatePropagation();e.preventDefault();if(pointer!==e.pointerId)return;
  const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};
  const yaw=Math.atan2(camera.position.x,camera.position.z);
  aim.x=T.MathUtils.clamp(aim.x+(dy*Math.cos(yaw)+dx*Math.sin(yaw))*.008,-1.12,1.12);
  aim.y=T.MathUtils.clamp(aim.y+(-dx*Math.cos(yaw)+dy*Math.sin(yaw))*.008,-1.12,1.12);
 },{capture:true});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(!lifted)return;e.stopImmediatePropagation();if(e.pointerId===pointer){pointer=null;aim.set(0,0);}}, {capture:true});
 function spill(amount,level){
  accumulator+=amount*1800;const count=Math.min(12,Math.floor(accumulator));accumulator-=count;
  const a=Math.atan2(sim.z,sim.x),r=profile.radiusAt(profile.top);
  for(let i=0;i<count&&particles.length<160;i++){
   const angle=a+(random()-.5)*.35;
   const p=new T.Vector3(Math.cos(angle)*r,profile.top,Math.sin(angle)*r).applyMatrix4(cup.matrixWorld);
   const v=new T.Vector3(Math.cos(angle)*(1+random()),.25+random()*.5,Math.sin(angle)*(1+random())).applyQuaternion(cup.quaternion).add(velocity);
   particles.push({p,v,size:.018+random()*.024,age:0});
  }
 }
 function rebuild(){profile=getCup().userData.liquidProfile;aim.set(0,0);sim.x=sim.z=sim.vx=sim.vz=0;}
 return {rebuild,get lifted(){return lifted;},update(dt){
  dt=Math.min(dt,.05);clock+=dt;if(pointer===null)aim.multiplyScalar(Math.exp(-dt*4));
  const blend=1-Math.exp(-dt*9);cup.rotation.x+=(aim.x-cup.rotation.x)*blend;cup.rotation.z+=(aim.y-cup.rotation.z)*blend;
  cup.position.lerp(new T.Vector3(lifted?aim.y*.25:0,lifted?1.25:0,lifted?-aim.x*.25:0),blend);
  if(scene.userData.contactShadowStrength)scene.userData.contactShadowStrength.value=Math.exp(-cup.position.y*3);
  scene.userData.focusPoint=new T.Vector3(0,(profile.top+profile.bottom)/2,0).applyQuaternion(cup.quaternion).add(cup.position);
  velocity.copy(cup.position).sub(previousPosition).divideScalar(Math.max(dt,.001));previousPosition.copy(cup.position);
  const acceleration=velocity.clone().sub(previousVelocity).divideScalar(Math.max(dt,.001));previousVelocity.copy(velocity);
  const effective=new T.Vector3(-T.MathUtils.clamp(acceleration.x,-12,12),-9.81,-T.MathUtils.clamp(acceleration.z,-12,12)).applyQuaternion(cup.quaternion.clone().invert());
  const depth=profile.top-profile.bottom,radius=profile.radiusAt(profile.top);
  const gx=T.MathUtils.clamp(-effective.x/Math.min(-2,effective.y),-2.5,2.5),gz=T.MathUtils.clamp(-effective.z/Math.min(-2,effective.y),-2.5,2.5);
  if(pouring){sim.fill=Math.min(.72,sim.fill+dt*.23);sim.vx+=Math.sin(clock*7)*dt*.3;if(sim.fill>=.72)pouring=false;}
  const loss=sim.step(dt,gx,gz,depth,radius);cup.updateMatrixWorld(true);if(loss>0)spill(loss);
  const level=profile.bottom+depth*sim.fill;liquid.visible=sim.fill>.002;stream.visible=pouring;
  stream.position.set(0,(profile.top+1.4+level)/2,0);stream.scale.y=profile.top+1.4-level;
  for(let i=0;i<n;i++){
   const a=i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);let y=level;
   for(let k=0;k<4;k++)y=T.MathUtils.clamp(level+profile.radiusAt(y)*(sim.x*c+sim.z*s),profile.bottom+.002,profile.top-.006);
   for(let j=0;j<=rows;j++){const h=T.MathUtils.lerp(profile.bottom,y,j/rows),r=profile.radiusAt(h)-.008,idx=(j*n+i)*3;positions[idx]=r*c;positions[idx+1]=h;positions[idx+2]=r*s;}
  }
  positions[center*3]=0;positions[center*3+1]=level;positions[center*3+2]=0;geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();
  for(let i=particles.length-1;i>=0;i--){const d=particles[i];d.age+=dt;d.v.y-=9.81*dt;d.p.addScaledVector(d.v,dt);const ground=Math.abs(d.p.x)<2.9&&Math.abs(d.p.z)<2?.057:-.09;
   if(d.p.y<=ground||d.age>3){if(d.p.y<=ground&&Math.hypot(d.p.x,d.p.z)<5.1){spots.push({x:d.p.x,z:d.p.z,y:ground+.002,r:.055+d.size*2});if(spots.length>32)spots.shift();}particles.splice(i,1);}
  }
  drops.count=particles.length;particles.forEach((d,i)=>{dummy.position.copy(d.p);dummy.rotation.set(0,0,0);dummy.scale.set(d.size,d.size*1.5,d.size);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);});drops.instanceMatrix.needsUpdate=true;
  puddles.count=spots.length;spots.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(p.r*1.4,p.r,1);dummy.updateMatrix();puddles.setMatrixAt(i,dummy.matrix);});puddles.instanceMatrix.needsUpdate=true;
  pour.disabled=pouring||sim.fill>=.715;pour.textContent=pouring?'正在倒入…':'倒入威士忌';status.textContent=`酒量 ${Math.round(sim.fill*100)}% · ${lifted?'拖动晃杯，松手回正':sim.spilled>.01?'酒水已洒出，可继续添酒':'拿起后拖动晃杯'}`;
 }};
}
