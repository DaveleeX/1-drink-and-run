import * as T from './vendor/three.module.js';
// One dominant visible HDR highlight, hysteresis, fade-before-switch, no random flicker.
export class FlareSource {
 constructor(){this.position=new T.Vector2(.5,.5);this.goal=this.position.clone();this.energy=0;this.targetEnergy=0;}
 detect(pixels,width,height){
  let best=0,index=0;
  for(let i=0;i<width*height;i++){const x=(i%width+.5)/width,y=(Math.floor(i/width)+.5)/height;
   const l=Math.pow(2,pixels[i*4]/255*8)-1;
   const score=l*(Math.hypot(x-this.goal.x,y-this.goal.y)<.15?1.25:1);
   if(score>best){best=score;index=i;}
  }
  const px=index%width,py=Math.floor(index/width);let sum=0,x=0,y=0;
  for(let j=Math.max(0,py-1);j<=Math.min(height-1,py+1);j++)for(let i=Math.max(0,px-1);i<=Math.min(width-1,px+1);i++){
   const w=Math.max(0,Math.pow(2,pixels[(j*width+i)*4]/255*8)-1-2);sum+=w;x+=(i+.5)/width*w;y+=(j+.5)/height*w;
  }
  if(sum>0)this.goal.set(x/sum,y/sum);
  this.targetEnergy=T.MathUtils.smoothstep(best,4,16)*.65;
 }
 update(dt){
  dt=Math.max(0,Math.min(dt,.05));const distant=this.position.distanceTo(this.goal)>.14;
  this.energy+=((distant?0:this.targetEnergy)-this.energy)*(1-Math.exp(-dt*(distant?12:4)));
  if(distant&&this.energy<.015)this.position.copy(this.goal);
  else if(!distant)this.position.lerp(this.goal,1-Math.exp(-dt*7));
 }
}
