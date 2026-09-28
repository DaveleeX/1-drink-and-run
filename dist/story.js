import * as T from 'three';
import { createLiquidMotion } from './liquid-motion.js';
// Small shared meshes; the original hero glass keeps its existing optical shader.
export function addStory(scene,cup,loader,wear){
 const root=new T.Group();root.name='Four AM — the unfinished drink';scene.add(root);
 const mats=[];const mat=(p)=>{const m=new T.MeshStandardMaterial(p);mats.push(m);return m;};
 const brass=mat({color:0x97713c,metalness:.78,roughness:.43}),dark=mat({color:0x201710,roughness:.9}),paper=mat({color:0xafa084,roughness:1,side:T.DoubleSide}),blood=mat({color:0x320906,roughness:.32}),gold=mat({color:0x977747,metalness:.8,roughness:.36});
 function mesh(g,m,x,y,z,parent=root){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 // Closed amber volume fitted to the bowl, with a slightly raised meniscus.
 // Let the warm light supply the gold; keep shallow paths clear rather than yellow-painted.
 const liquidMat=new T.MeshPhysicalMaterial({color:0xfff6df,roughness:.025,metalness:0,transmission:1,ior:1.36,thickness:.62,attenuationColor:new T.Color('#c18436'),attenuationDistance:1.05,side:T.DoubleSide,envMapIntensity:1.1});
 const bowl=cup.userData.liquidProfile,level=bowl.bottom+(bowl.top-bowl.bottom)/3;
 const liquidProfile=[[0,bowl.bottom]];
 for(let i=0;i<=24;i++){const y=T.MathUtils.lerp(bowl.bottom,level,i/24);liquidProfile.push([bowl.radiusAt(y)-.008,y]);}
 const surfaceRadius=bowl.radiusAt(level)-.008;
 for(let i=0;i<=24;i++){const r=surfaceRadius*(1-i/24);liquidProfile.push([r,level+.009*Math.exp(-(surfaceRadius-r)*90)]);}
 const liquid=mesh(new T.LatheGeometry(liquidProfile.map(p=>new T.Vector2(...p)),96),liquidMat,0,cup.position.y,0);liquid.castShadow=false;
 const liquidBase=liquid.geometry.attributes.position.array.slice();
 const motion=createLiquidMotion();
 // Odd modes conserve volume approximately; pinned rim preserves the meniscus.
 function ripple(state){const a=liquid.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=liquidBase[i*3],y=liquidBase[i*3+1],z=liquidBase[i*3+2],r=Math.hypot(x,z);if(y>=level-.0001){const edge=Math.max(0,1-Math.pow(r/surfaceRadius,4));a.setY(i,y+edge*(state.x*x/surfaceRadius+state.z*z/surfaceRadius));}}a.needsUpdate=true;liquid.geometry.computeVertexNormals();}
 // Spent case: open mouth, extraction rim and struck primer.
 const shell=new T.Group();root.add(shell);shell.position.set(1.4,.12,.55);shell.rotation.set(0,.6,Math.PI/2);
 mesh(new T.LatheGeometry([[0,0],[.103,0],[.103,.022],[.096,.028],[.076,.03],[.076,.048],[.09,.059],[.087,.12],[.084,.34],[.083,.43],[.067,.43],[.066,.065],[0,.065]].map(p=>new T.Vector2(...p)),64),brass,0,0,0,shell);
 const caseBody=shell.children[0];const ca=caseBody.geometry.attributes.position;for(let i=0;i<ca.count;i++){const x=ca.getX(i),y=ca.getY(i),z=ca.getZ(i),angle=Math.atan2(z,x);const dent=1-.08*Math.exp(-Math.pow((y-.35)/.09,2))*Math.pow(Math.max(0,Math.cos(angle-.7)),16);ca.setXYZ(i,x*dent,y,z*dent);}caseBody.geometry.computeVertexNormals();
 const primer=mesh(new T.CylinderGeometry(.038,.038,.008,20),brass,0,-.005,0,shell);mesh(new T.SphereGeometry(.012,12,8),dark,.004,-.012,0,shell).scale.y=.25;
 mesh(new T.TorusGeometry(.16,.025,10,40),gold,-1.25,.04,1.4).rotation.x=Math.PI/2;
 wear(paper,"paper");
 // Crumpled note and folded unpaid receipt, modeled as paper surfaces.
 function note(x,z,w,h,angle,fold,print){const g=new T.PlaneGeometry(w,h,8,12),a=g.attributes.position;for(let i=0;i<a.count;i++){const px=a.getX(i),py=a.getY(i);a.setZ(i,.012*Math.sin(px*45+py*17)+fold*Math.abs(px));}g.computeVertexNormals();const printed=paper.clone();printed.map=loader.load("./assets/"+print+"-print.jpg");printed.map.colorSpace=T.SRGBColorSpace;printed.color.set(0xffffff);printed.roughnessMap=paper.roughnessMap;printed.normalMap=paper.normalMap;mats.push(printed);const o=mesh(g,printed,x,.045,z);o.rotation.set(-Math.PI/2,0,angle);return o;}
 note(-1.7,-.6,.65,1.05,.2,.18,"receipt");note(.9,1.55,.55,.75,-.3,.06,"note");
 for(let i=0;i<4;i++){const coin=mesh(new T.CylinderGeometry(.09,.09,.012,24),i%2?brass:gold,1.6+i*.13,.025,1.25+Math.sin(i*3)*.13);mesh(new T.TorusGeometry(.065,.003,4,24),dark,coin.position.x,.033,coin.position.z).rotation.x=Math.PI/2;}
 const wood=mat({color:0x6e5433,roughness:1});for(let i=0;i<3;i++){const stick=mesh(new T.BoxGeometry(.32,.018,.018),wood,-1.3+i*.16,.025,1.9+i*.05);stick.rotation.y=i*.7;mesh(new T.SphereGeometry(.025,8,6),dark,stick.position.x+.16*Math.cos(i*.7),.03,stick.position.z-.16*Math.sin(i*.7));}
 // Low, irregular stains follow the tabletop; no gore geometry.
 function stain(x,z,r,m,stretch=1){const shape=new T.Shape();for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,rr=r*(1+.1*Math.sin(a*7)+.06*Math.cos(a*13));const px=Math.cos(a)*rr,pz=Math.sin(a)*rr*stretch;i?shape.lineTo(px,pz):shape.moveTo(px,pz);}const o=mesh(new T.ShapeGeometry(shape),m,x,.012,z);o.rotation.x=-Math.PI/2;o.castShadow=false;return o;}
 stain(1.8,-.05,.14,blood,2.2);for(let i=0;i<12;i++)stain(1.15+i*.095,-.5+Math.sin(i*7)*.28,.012+(i%4)*.009,blood);
 const spill=mat({color:0x3a200b,roughness:.08,metalness:.12});stain(.4,-1.8,.55,spill,.6);
 const glass=new T.MeshPhysicalMaterial({color:0xc5c4b7,roughness:.13,metalness:0,transmission:.85,thickness:.09,ior:1.5});
 const second=mesh(new T.LatheGeometry([[0,0],[.40,0],[.44,.07],[.49,1.05],[.44,1.05],[.36,.13],[0,.13]].map(p=>new T.Vector2(...p)),40),glass,.65,.49,-2.25);second.rotation.z=Math.PI/2;second.rotation.y=.35;second.castShadow=false;
 const ringMat=mat({color:0x241810,roughness:.18});mesh(new T.RingGeometry(.47,.49,48),ringMat,-.6,.014,-1.65).rotation.x=-Math.PI/2;
 // Low-poly insects, each appearing on a separate interval.
 const bugMat=mat({color:0x21130a,roughness:.58});const wingMat=new T.MeshBasicMaterial({color:0x8c8977,transparent:true,opacity:.32,side:T.DoubleSide,depthWrite:false});
 function insect(scale,wings){const g=new T.Group();root.add(g);mesh(new T.SphereGeometry(1,12,8),bugMat,0,.035,0,g).scale.set(.035,.025,.075);const legs=[];for(let i=0;i<6;i++){const leg=mesh(new T.CylinderGeometry(.003,.003,.07,4),bugMat,(i%2?1:-1)*.043,.02,(Math.floor(i/2)-1)*.043,g);leg.rotation.z=(i%2?1:-1)*.9;legs.push(leg);}const ws=[];if(wings)for(let i=0;i<2;i++){const w=mesh(new T.CircleGeometry(.075,12),wingMat,(i?1:-1)*.05,.045,0,g);w.rotation.x=-Math.PI/2;w.scale.x=.5;ws.push(w);}g.scale.setScalar(scale);g.traverse(o=>o.castShadow=false);return {g,legs,ws};}
 const roach=insect(1.6,false);
 // Head, pronotum, paired wing covers, abdominal plates, antennae and jointed legs.
 const rg=roach.g;mesh(new T.SphereGeometry(1,16,10),bugMat,0,.037,-.073,rg).scale.set(.025,.021,.023);
 mesh(new T.SphereGeometry(1,16,10),bugMat,0,.048,-.044,rg).scale.set(.043,.018,.029);
 for(let k=0;k<2;k++)mesh(new T.SphereGeometry(1,16,10),bugMat,(k?1:-1)*.017,.052,.015,rg).scale.set(.022,.009,.059);
 for(let j=0;j<5;j++){const seg=mesh(new T.TorusGeometry(.03-j*.002,.003,4,14,Math.PI),dark,0,.025,.025+j*.009,rg);seg.rotation.x=Math.PI/2;}
 for(let k=0;k<2;k++){const sign=k?1:-1;const curve=new T.CatmullRomCurve3([new T.Vector3(sign*.014,.04,-.082),new T.Vector3(sign*.044,.045,-.13),new T.Vector3(sign*.07,.029,-.19)]);mesh(new T.TubeGeometry(curve,12,.0018,4,false),bugMat,0,0,0,rg);}
 roach.legs.forEach((leg,i)=>{const foot=mesh(new T.CylinderGeometry(.0018,.0025,.06,5),bugMat,0,-.05,0,leg);foot.rotation.z=(i%2?1:-1)*.75;});
 const fly=insect(.65,true),moth=insect(1.5,true);
 const moving=[roach.g,fly.g,moth.g];
 wear(brass,'metal');wear(gold,'metal');wear(paper,'paper');wear(wood,'wood');wear(bugMat,'shell');wear(dark,'shell',{color:false});wear(blood,'shell',{color:false,normal:.08});wear(spill,'wood',{color:false,normal:.025});wear(ringMat,'paper',{color:false,normal:.03});wear(glass,'ceramic',{color:false,normal:.03});
 let lastRipple=0,wasActive=true;
 return {materials:mats,disturb:motion.disturb,excluded:[second,liquid,...moving],update(t){if(t-lastRipple>=1/30){const state=motion.advance(t-lastRipple);if(state.active||wasActive)ripple(state);wasActive=state.active;lastRipple=t;}const a=t%29;const u=a-7;roach.g.visible=u>0&&u<1;roach.g.position.set(8-16*u,.01,2.7+Math.sin(u*5)*.08);roach.g.rotation.y=Math.PI/2;roach.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*85+i*Math.PI)*.5);
 const f=t%37-13;fly.g.visible=f>0&&f<1;fly.g.position.set(-8+f*16,1.6+Math.sin(f*7)*.4,1.8);fly.g.rotation.y=-Math.PI/2;fly.ws.forEach((w,i)=>w.rotation.y=Math.sin(t*90)*(i?1:-1)*.8);
 const m=t%47-23;moth.g.visible=m>0&&m<1;moth.g.position.set(8-m*16,3.7+Math.sin(m*5)*.3,-.8);moth.ws.forEach((w,i)=>w.rotation.y=Math.sin(t*45)*(i?1:-1));}};
}
