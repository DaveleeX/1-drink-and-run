// Shared linear-space optical parameters; one scene unit is roughly 35 mm.
// Art-directed dense cut crystal: stronger interface reflection and thickness absorption.
// Not a claim that this glass has the measured optical constants of diamond.
export const GLASS={ior:1.82,dispersion:.9,attenuation:[.78,.87,.94],distance:1.2};
export const spectralIOR=channel=>GLASS.ior+(channel-1)*(GLASS.ior-1)*.025*GLASS.dispersion;
export function refract(direction,normal,n1,n2){
 const eta=n1/n2,cos=Math.max(0,Math.min(1,-normal.dot(direction)));
 const k=1-eta*eta*(1-cos*cos);
 return k<0?null:direction.clone().multiplyScalar(eta).addScaledVector(normal,eta*cos-Math.sqrt(k)).normalize();
}
export function fresnel(cos,n1,n2){
 cos=Math.max(0,Math.min(1,cos));
 const sin2=(n1/n2)**2*(1-cos*cos);if(sin2>=1)return 1;
 const ct=Math.sqrt(1-sin2);
 const rs=(n1*cos-n2*ct)/(n1*cos+n2*ct),rp=(n2*cos-n1*ct)/(n2*cos+n1*ct);
 return (rs*rs+rp*rp)/2;
}
export const absorption=(distance,channel)=>Math.pow(GLASS.attenuation[channel],Math.max(0,distance)/GLASS.distance);
