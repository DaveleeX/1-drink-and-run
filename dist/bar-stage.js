import * as T from './vendor/three.module.js';
import {HDRLoader} from './vendor/HDRLoader.js';

export async function addBarStage(scene,renderer){
  const hdr=await new HDRLoader().setDataType(T.HalfFloatType).loadAsync('./warm-bar.hdr');
  hdr.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(renderer);
  const light=pmrem.fromEquirectangular(hdr);
  scene.background=hdr;
  scene.environment=light.texture;
  scene.backgroundBlurriness=.095;
  scene.backgroundIntensity=.12;
  scene.environmentIntensity=.28;
  scene.backgroundRotation.y=2.05;
  scene.environmentRotation.y=2.05;
  pmrem.dispose();

  // North-American walnut appearance: long pores, cathedral grain and satin finish.
  const wood=new T.MeshPhysicalMaterial({color:'#65412c',roughness:.34,metalness:0,clearcoat:.3,clearcoatRoughness:.25});
  wood.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 grainPosition;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngrainPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 grainPosition;
      float wh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float wn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wh(i),wh(i+vec2(1,0)),f.x),mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x),f.y);}
      float walnut(vec3 p){
        float plank=floor((p.x+5.2)/1.35);
        float z=p.z+wh(vec2(plank,3.))*6.;
        float x=p.x+sin(z*.44+plank)*.10;
        float cathedral=sqrt(pow(fract((p.x+5.2)/1.35)-.5,2.)*3.+pow(z*.11,2.));
        float flow=cathedral*70.+wn(vec2(x*3.,z*.25))*4.;
        float grain=pow(.5+.5*sin(flow),7.);
        float pores=pow(wn(vec2(x*170.,z*5.)),8.);
        return .77+.20*wn(vec2(x*5.,z*.45))-.23*grain-.17*pores;
      }`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float timber=walnut(grainPosition);
      float plankTone=wh(vec2(floor((grainPosition.x+5.2)/1.35),2.));
      diffuseColor.rgb*=timber*mix(vec3(.82,.73,.66),vec3(1.14,1.02,.86),plankTone);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float microHeight=walnut(grainPosition)*.003;
      vec3 sdX=dFdx(vViewPosition),sdY=dFdy(vViewPosition);
      vec3 r1=cross(sdY,normal),r2=cross(normal,sdX);
      float det=dot(sdX,r1);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(microHeight)*r1+dFdy(microHeight)*r2));
    `);
  };
  const edge=[new T.Vector2(0,-.43),new T.Vector2(5.08,-.43),new T.Vector2(5.18,-.40),new T.Vector2(5.25,-.33),new T.Vector2(5.26,-.20),new T.Vector2(5.22,-.125),new T.Vector2(5.15,-.094),new T.Vector2(0,-.094)];
  const counter=new T.Mesh(new T.LatheGeometry(edge,192),wood);counter.name='Walnut round tabletop';scene.add(counter);
  const apron=new T.Mesh(new T.CylinderGeometry(4.9,4.8,.33,128),wood);apron.position.y=-.59;scene.add(apron);
  const pedestal=new T.Mesh(new T.LatheGeometry([new T.Vector2(.85,-.74),new T.Vector2(.68,-1),new T.Vector2(.38,-1.9),new T.Vector2(.43,-2.9),new T.Vector2(.8,-3.1)],64),wood);scene.add(pedestal);
  const rubber=new T.MeshStandardMaterial({color:'#17191a',roughness:.66,metalness:0});
  const radius=.16,w=2.95,d=2.0;
  const shape=new T.Shape();shape.moveTo(-w+radius,-d);shape.lineTo(w-radius,-d);shape.quadraticCurveTo(w,-d,w,-d+radius);shape.lineTo(w,d-radius);shape.quadraticCurveTo(w,d,w-radius,d);shape.lineTo(-w+radius,d);shape.quadraticCurveTo(-w,d,-w,d-radius);shape.lineTo(-w,-d+radius);shape.quadraticCurveTo(-w,-d,-w+radius,-d);
  const slab=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.036,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.015,bevelThickness:.012,curveSegments:12}),rubber);slab.rotation.x=-Math.PI/2;slab.position.y=-.079;slab.name='Molded drainage mat';scene.add(slab);
  // Molded tapered fingers, broad channels every eight rows and raised perimeter walls.
  const cols=64,rows=42;
  const studs=new T.InstancedMesh(new T.CylinderGeometry(.022,.029,.086,10),rubber,cols*rows);
  const dummy=new T.Object3D();let n=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    dummy.position.set((i-(cols-1)/2)*.082+(Math.floor(i/8)-3.5)*.040,.008,(j-(rows-1)/2)*.082+(Math.floor(j/8)-2.5)*.045);
    dummy.scale.set(1,1,1);dummy.updateMatrix();studs.setMatrixAt(n++,dummy.matrix);
  }
  studs.instanceMatrix.needsUpdate=true;studs.computeBoundingSphere();scene.add(studs);
  for(const z of [-1.92,1.92]){const rail=new T.Mesh(new T.BoxGeometry(5.68,.066,.045),rubber);rail.position.set(0,-.01,z);scene.add(rail);}
  for(const x of [-2.85,2.85]){const rail=new T.Mesh(new T.BoxGeometry(.045,.066,3.80),rubber);rail.position.set(x,-.01,0);scene.add(rail);}
  const channels=new T.InstancedMesh(new T.BoxGeometry(5.55,.014,.018),rubber,6);
  for(let j=0;j<6;j++){dummy.position.set(0,-.027,(j-2.5)*.60);dummy.updateMatrix();channels.setMatrixAt(j,dummy.matrix);}
  channels.instanceMatrix.needsUpdate=true;scene.add(channels);
  return {hdr,light};
}
