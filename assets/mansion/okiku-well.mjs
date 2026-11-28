// Okiku's well: clean placeholder blocking for the animator to replace.
export const OKIKU_WELL={count:[.8,1.65,2.5,3.35,4.2,5.05,5.9,6.75,7.6],grab:8.5,drag:9.3,death:11.8,ripples:15.2,duration:19};

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const mix=(a,b,t)=>a+(b-a)*smooth(t);

export function playOkikuWell(T,site,o){
  const stage=new T.Group();stage.name="Okiku's well placeholder";stage.position.set(site.x,site.y,site.z);o.scene.add(stage);
  const ring=new T.Mesh(new T.TorusGeometry(.82,.035,6,32),new T.MeshStandardMaterial({color:0x77817b,roughness:.94}));
  ring.rotation.x=Math.PI/2;ring.position.y=.8;stage.add(ring);
  const water=new T.Mesh(new T.CircleGeometry(.75,32),new T.MeshBasicMaterial({color:0x101b25,transparent:true,opacity:.9}));
  water.rotation.x=-Math.PI/2;water.position.y=.72;stage.add(water);
  const ripples=[];
  for(let i=0;i<3;i++){const m=new T.Mesh(new T.RingGeometry(.03,.045,32),new T.MeshBasicMaterial({color:0x9baea8,transparent:true,opacity:.0,side:T.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=.735;stage.add(m);ripples.push(m)}
  const actor=o.makeActor("solid");stage.add(actor);o.bind(actor);actor.position.set(0,0,1.18);actor.rotation.y=Math.PI;
  actor.userData.face?.("dread");
  const bones=actor.userData.bones||{};
  const base={position:actor.position.clone(),rotation:actor.rotation.clone()};
  const boneRest={};for(const key of ["head","chest","thigh_L","thigh_R","shin_L","shin_R"]){const b=bones[key];if(b)boneRest[key]=b.quaternion.clone()}
  const camPos=new T.Vector3(site.x,2.12,site.z+2.75),lookAt=new T.Vector3(site.x,.7,site.z);
  let ended=false,nextCount=0;
  function frame(t){
    while(nextCount<OKIKU_WELL.count.length&&t>=OKIKU_WELL.count[nextCount])o.cue?.(`plate${nextCount+1}`),nextCount++;
    if(t>=OKIKU_WELL.grab&&nextCount===OKIKU_WELL.count.length)o.cue?.("grab"),nextCount++;
    if(t>=OKIKU_WELL.ripples&&nextCount===OKIKU_WELL.count.length+1)o.cue?.("ripples"),nextCount++;
    const grab=smooth((t-OKIKU_WELL.grab)/.65),drag=smooth((t-OKIKU_WELL.drag)/2.8);
    actor.position.y=base.position.y-mix(0,1.1,drag);
    actor.position.z=base.position.z-mix(0,.32,grab);
    actor.rotation.x=mix(0,-.22,grab);
    for(const side of ["L","R"]){const thigh=bones[`thigh_${side}`],shin=bones[`shin_${side}`];if(thigh){thigh.quaternion.copy(boneRest[`thigh_${side}`]||thigh.quaternion);thigh.rotation.x+=-.22*grab+.42*drag}if(shin){shin.quaternion.copy(boneRest[`shin_${side}`]||shin.quaternion);shin.rotation.x+=.25*grab-.2*drag}}
    if(bones.head){bones.head.quaternion.copy(boneRest.head||bones.head.quaternion);bones.head.rotation.x+=.08*grab}
    ripples.forEach((r,i)=>{const phase=Math.max(0,t-OKIKU_WELL.ripples-i*.7);r.scale.setScalar(.2+phase*.32);r.material.opacity=Math.max(0,.55-phase*.12)});
    if(t>=OKIKU_WELL.death&&!ended){ended=true;o.die()}
    if(t>=OKIKU_WELL.duration&&!frame.didEnd){frame.didEnd=true;o.end()}
    o.showGore?.(false);
  }
  function camera(){o.camera.position.copy(camPos);o.camera.lookAt(lookAt)}
  function cleanup(){stage.removeFromParent();for(const prop of [ring,water,...ripples]){prop.geometry.dispose();prop.material.dispose()}o.disposeActors?.()}
  return {frame,camera,showGore(){},cleanup};
}
