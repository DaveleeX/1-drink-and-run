import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
// Display-referred grading, fused into the existing output shader after AgX + sRGB.
// No extra render target, texture lookup, or full-screen draw.
export function createFilmOutput(){
 const pass=new OutputPass();
 pass.uniforms.gradeStrength={value:.85};
 const marker='gl_FragColor = sRGBTransferOETF( gl_FragColor );';
 if(!pass.material.fragmentShader.includes(marker))throw new Error('Output grading insertion point missing');
 pass.material.fragmentShader=pass.material.fragmentShader.replace('uniform sampler2D tDiffuse;',`uniform sampler2D tDiffuse;
 uniform float gradeStrength;
 vec3 filmGrade(vec3 c){
  c=clamp(c,0.,1.);
  // Bounded S-curve fixes black and white endpoints and preserves shadow gradients.
  c+=.38*c*(1.-c)*(2.*c-1.);
  float l=dot(c,vec3(.2126,.7152,.0722));
  float shadows=(1.-smoothstep(.10,.52,l))*smoothstep(.015,.12,l);
  float highlights=smoothstep(.35,.8,l)*(1.-smoothstep(.86,1.,l));
  c+=vec3(-.006,.006,.012)*shadows+vec3(.014,.005,-.010)*highlights;
  c=clamp(c,0.,1.);l=dot(c,vec3(.2126,.7152,.0722));
  vec3 chroma=c-vec3(l);float hi=max(chroma.r,max(chroma.g,chroma.b));float lo=min(chroma.r,min(chroma.g,chroma.b));
  // Increase saturation within available gamut, avoiding clipped colored highlights.
  float saturation=min(1.20,min((1.-l)/max(hi,1e-6),l/max(-lo,1e-6)));
  return vec3(l)+chroma*saturation;
 }`);
 pass.material.fragmentShader=pass.material.fragmentShader.replace(marker,marker+'\n gl_FragColor.rgb=mix(gl_FragColor.rgb,filmGrade(gl_FragColor.rgb),gradeStrength);');
 return pass;
}
