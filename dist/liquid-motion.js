// Two damped surface modes; an economical approximation, not a fluid solver.
export function createLiquidMotion(){
 let x=.006,z=-.003,vx=0,vz=0;
 return {
  disturb(dx=.5,dz=.3){vx=Math.max(-.14,Math.min(.14,vx+dx*.09));vz=Math.max(-.14,Math.min(.14,vz+dz*.09));},
  advance(dt){const n=Math.max(1,Math.ceil(Math.min(dt,.1)/.008)),h=Math.min(dt,.1)/n;
   for(let i=0;i<n;i++){vx+=(-45*x-2.9*vx)*h;vz+=(-62*z-3.3*vz)*h;x+=vx*h;z+=vz*h;}
   if(Math.abs(x)+Math.abs(z)+Math.abs(vx)+Math.abs(vz)<.00004)x=z=vx=vz=0;
   return {x,z,active:x!==0||z!==0||vx!==0||vz!==0};
  }
 };
}
