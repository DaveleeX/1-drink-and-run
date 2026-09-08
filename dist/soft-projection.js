// Analytic translucent soft shadow, aligned with the main light (-3,5,4).
// Applied to receiver surfaces (including instanced rubber studs), not a floating decal.
export function addSoftProjection(scene){
 const liftFade={value:1};scene.userData.contactShadowStrength=liftFade;
 const materials=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 for(const material of materials){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);
   shader.uniforms.liftFade=liftFade;
   shader.vertexShader='varying vec3 shadowReceiver;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 receiverLocal=vec4(transformed,1.);
    #ifdef USE_INSTANCING
      receiverLocal=instanceMatrix*receiverLocal;
    #endif
    shadowReceiver=(modelMatrix*receiverLocal).xyz;`);
   shader.fragmentShader='varying vec3 shadowReceiver;uniform float liftFade;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    float shade=0.;
    for(int j=0;j<12;j++){
      float height=.10+float(j)*.218;
      vec2 center=vec2(.6,-.8)*max(0.,height-shadowReceiver.y);
      float radius=.87+.06*height;
      float penumbra=.075+.095*height;
      float silhouette=1.-smoothstep(radius-penumbra,radius+penumbra,length(shadowReceiver.xz-center));
      shade=max(shade,silhouette*(.38-.065*height));
    }
    float contact=.20*exp(-3.*dot(shadowReceiver.xz,shadowReceiver.xz));
    float receiverMask=smoothstep(-.5,-.12,shadowReceiver.y);
    outgoingLight*=1.-min(.55,shade+contact)*receiverMask*liftFade;
    #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'walnut-soft-projection-v1';
 }
}
