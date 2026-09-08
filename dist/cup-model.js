import * as T from './vendor/three.module.js';
import {GLASS} from './optics.js';

// Inferred from the supplied dark reference, not measured manufacturing geometry.
// One closed shell avoids intersecting cylinders, discs and duplicated glass walls.
export function buildCup({mobile=false,width=1,height=1,cutDepth=1,cutCount=32,wall=1,baseThickness=.53}={}){
  const baseY=baseThickness+.075,heelY=baseY+.115;
  const smooth=new T.MeshPhysicalMaterial({color:'#fbfdff',roughness:.006,metalness:0,
    transmission:1,thickness:1,ior:GLASS.ior,dispersion:GLASS.dispersion,envMapIntensity:1.25,
    attenuationColor:new T.Color(...GLASS.attenuation),attenuationDistance:GLASS.distance,side:T.FrontSide});
  const cut=smooth.clone();cut.flatShading=true;cut.roughness=.018;cut.envMapIntensity=1.4;
  const base=cut.clone();base.roughness=.012;base.envMapIntensity=1.5;
  // Retain Three's physical Fresnel, GGX and Beer-Lambert shader; supply local wall thickness.
  for(const material of [smooth,cut,base]){
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float opticalThickness; varying float vOpticalThickness;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOpticalThickness=opticalThickness;');
      shader.fragmentShader='varying float vOpticalThickness;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_fragment>',T.ShaderChunk.transmission_fragment.replace('material.thickness = thickness;','material.thickness = vOpticalThickness;'));
    };
    material.customProgramCacheKey=()=> 'kiriko-local-thickness-v1';
  }
  const segments=mobile?576:768, outerRows=mobile?240:320;
  const rings=[],positions=[],indices=[],groups=[];
  const tri=x=>1-Math.abs((((x%1)+1)%1)*2-1);
  const clamp=T.MathUtils.clamp;
  const outer=(y,a)=>{
    let r=.88+.16*y/2.55;
    if(y<.16) return r-.025*(1-y/.16);
    if(y<.44){ // Deep basal flutes with narrow polished shoulders.
      const f=tri(a/(2*Math.PI)*cutCount);
      return r-.085*cutDepth*f*Math.sin(Math.PI*(y-.16)/.28);
    }
    if(y<2.37){
      const u=a/(2*Math.PI)*cutCount, v=(y-.44)/.225;
      const edge=Math.min(tri(u+v),tri(u-v));
      // Broad V-grooves bound hundreds of raised diamond facets.
      const deep=.084*clamp((.44-edge)/.44,0,1);
      // Fine parallel cuts sit inside each diamond, not floating above the wall.
      const fineEdge=Math.min(tri((u+v)*4),tri((u-v)*4));
      const fine=.017*clamp((.38-fineEdge)/.38,0,1)*clamp(edge/.3,0,1);
      // Eight fan-cut medallions interrupt the uniform lattice on the shoulder.
      const panel=((a/(2*Math.PI)*8+.5)%1+1)%1-.5;
      const py=(y-1.85)/.40,px=panel*2.0;
      const rr=Math.sqrt(px*px+py*py);
      const fan=.026*tri(Math.atan2(py,px)/Math.PI*12)*clamp(1-rr,0,1);
      const fade=Math.min(clamp((y-.44)/.08,0,1),clamp((2.37-y)/.10,0,1));
      return r-(deep+fine+fan)*fade*cutDepth;
    }
    return r;
  };
  const innerRadius=(y,a)=>{
    const t=clamp((2.55-y)/(2.55-heelY),0,1);
    return .939-.24*t-.070*Math.sin(Math.PI*Math.min(t*4,1)/2)-.060*wall*Math.sin(Math.PI*t)-.021*clamp((heelY+.42-y)/.42,0,1)*tri(a/(2*Math.PI)*cutCount);
  };
  // Local radial wall / vertical base estimate, not a multi-bounce path length.
  const thicknessAt=p=>{
    const a=Math.atan2(p.z,p.x),r=Math.hypot(p.x,p.z);
    if(p.y>2.55)return .098;
    if(p.y>=heelY)return clamp(outer(p.y-.055,a)-innerRadius(p.y,a),.035,.5);
    return clamp(baseThickness-.07*Math.sin(Math.PI*clamp(r/.524,0,1)),baseThickness-.11,baseThickness);
  };
  function ring(y,radius,material){rings.push({y,radius,material});}
  // Walk continuously: underside centre -> outer foot -> rim -> inner wall -> floor centre.
  ring(.075,()=>0,2);
  for(let j=1;j<=32;j++){
    const r=.88*j/32;
    ring(.075,(a)=>r,2);
    rings[rings.length-1].height=(a)=>.075+.03*tri(a/(2*Math.PI)*32)*Math.sin(Math.PI*r/.88);
  }
  for(let j=0;j<=outerRows;j++){
    const y=.055+j/outerRows*2.495;
    ring(y,a=>outer(y-.055,a),y<1.27?2:y<2.36?1:0);
  }
  // Elliptical rolled rim: outer and inner radii meet without stacked torus meshes.
  for(let j=1;j<=16;j++){
    const a=Math.PI*j/16;
    ring(2.55+.044*Math.sin(a),()=>.988+.049*Math.cos(a),0);
  }
  for(let j=1;j<=112;j++){
    const t=j/112,y=2.55-t*(2.55-heelY);
    ring(y,a=>innerRadius(y,a),y<.96?1:0);
  }
  // Curved bowl heel transitions into the thick optical floor.
  for(let j=1;j<=12;j++){
    const a=j/12*Math.PI/2;
    ring(heelY-.115*Math.sin(a),()=>.629-.105*(1-Math.cos(a)),0);
  }
  // Shallow multi-ring rosette: crossing radial flutes and staggered diamond facets.
  // These surfaces supply the dense interior highlight ring visible in the video.
  for(let j=1;j<=96;j++){
    const r=.524*(1-j/96);
    ring(baseY,()=>r,2);
    rings[rings.length-1].height=a=>{
      const radial=tri(a/(2*Math.PI)*48);
      const diamond=Math.min(tri(a/(2*Math.PI)*48+r*24),tri(a/(2*Math.PI)*48-r*24));
      const fade=Math.sin(Math.PI*r/.524);
      return baseY-.050*radial*fade-.026*diamond*fade+.012*Math.sin(r*78)*fade;
    };
  }
  rings.forEach(r=>{for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,rad=r.radius(a);positions.push(rad*Math.cos(a),r.height?r.height(a):r.y,rad*Math.sin(a));}});
  for(let j=0;j<rings.length-1;j++){
    const start=indices.length;
    for(let i=0;i<segments;i++){
      const a=j*(segments+1)+i,b=a+segments+1;
      // Winding follows the shell path; outward outside, inward at the cavity.
      indices.push(a,b,a+1,a+1,b,b+1);
    }
    groups.push({start,count:indices.length-start,material:rings[j+1].material});
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const thickness=[];for(let i=0;i<positions.length;i+=3)thickness.push(thicknessAt({x:positions[i],y:positions[i+1],z:positions[i+2]}));
  geometry.setAttribute('opticalThickness',new T.Float32BufferAttribute(thickness,1));
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setXYZ(i,pos.getX(i)*width,.055+(y-.055)*height,pos.getZ(i)*width);geometry.attributes.opticalThickness.setX(i,thickness[i]*(y<heelY?height:width));}
  geometry.computeVertexNormals();
  groups.forEach(g=>geometry.addGroup(g.start,g.count,g.material));
  // Merge adjacent material ranges to avoid a draw call per ring.
  const merged=[];for(const g of geometry.groups){const last=merged[merged.length-1];if(last&&last.materialIndex===g.materialIndex)last.count+=g.count;else merged.push({...g});}geometry.groups=merged;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,[smooth,cut,base]);mesh.name='Continuous cut-glass shell';
  mesh.userData.thicknessAt=p=>{const y=.055+(p.y-.055)/height;return thicknessAt({x:p.x/width,y,z:p.z/width})*(y<heelY?height:width);};
  mesh.userData.liquidProfile={bottom:.055+(baseY+.018-.055)*height,top:.055+(2.55-.055)*height,radiusAt:y=>{const local=.055+(y-.055)/height;return (local<heelY?T.MathUtils.lerp(.524,.608,T.MathUtils.clamp((local-baseY)/.115,0,1)):innerRadius(local,0)-.024)*width;}};
  return mesh;
}
