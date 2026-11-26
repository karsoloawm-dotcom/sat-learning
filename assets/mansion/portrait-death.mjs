// Scaffold performance for the portrait-frame death. Replace placeholder motion and final pose
// with the animator's keyed performance; keep the set-piece API and gore-free behavior.
export const PORTRAIT={turn:[.55,1.45],reach:[1.45,3.1],pull:[3.1,4.55],die:4.8,paint:5.25,duration:7.2};
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=(t,a,b)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x)};
const V=(T,x=0,y=0,z=0)=>new T.Vector3(x,y,z);

export function playPortrait(T,site,o){
  const stage=new T.Group();stage.name="Portrait death placeholder stage";stage.position.set(site.x,site.y,site.z);o.scene.add(stage);
  const actor=o.makeActor("solid");stage.add(actor);o.bind(actor);
  const bones=actor.userData.bones, painter=o.painter;
  const painterBones=painter?.userData.bones;
  const bodyStart=V(T,0,0,.7),framePoint=V(T,0,.88,-.72);
  const look=V(T),cameraOffset=V(T),target=V(T),handoff=o.handoff.clone();
  let clock=0,died=false,ended=false,painted=false,cueIndex=0;
  const cues=[[.56,"turn"],[1.5,"reach"],[3.15,"pull"]];
  function poseBody(t){
    o.bind(actor);
    const turn=ease(t,...PORTRAIT.turn),reach=ease(t,...PORTRAIT.reach),pull=ease(t,...PORTRAIT.pull);
    actor.position.copy(bodyStart).lerp(framePoint,pull*.86);
    actor.rotation.y=-.22*turn-.18*pull;
    bones.head.rotation.set(-.12*turn,-.42*turn,.08*turn);
    bones.chest.rotation.set(.06*pull,-.08*turn,0);
    bones.upperarm_L.rotation.set(-.1,.26*reach,-1.2+1.05*reach);
    bones.upperarm_R.rotation.set(.1,-.28*reach,1.2-1.02*reach);
    bones.forearm_L.rotation.y=.2+.4*reach;bones.forearm_R.rotation.y=-.2-.4*reach;
    bones.thigh_L.rotation.x=-.18*pull;bones.thigh_R.rotation.x=-.14*pull;
    actor.scale.setScalar(1-.78*pull);
    actor.visible=pull<.94;
    if(painter&&painterBones){
      painter.visible=true;
      o.bind(painter);
      painterBones.head.rotation.set(-.12*turn,-.28*turn,.05*turn);
      painterBones.upperarm_L.rotation.z=-1.25+.32*reach;
      painterBones.upperarm_R.rotation.z=1.24-.28*reach;
      painterBones.forearm_L.rotation.y=.18*reach;painterBones.forearm_R.rotation.y=-.18*reach;
      painterBones.chest.rotation.y=.08*turn;
      // TODO(Claude animator): render Hanako's final posed rig to a CanvasTexture/RenderTarget
      // and map it to the canvas plane, preserving the frame's lighting and material.
      if(t>=PORTRAIT.paint)painted=true;
    }
    actor.updateMatrixWorld(true);
  }
  return {
    frame(t){
      clock=t;poseBody(t);
      while(cueIndex<cues.length&&t>=cues[cueIndex][0])o.cue(cues[cueIndex++][1]);
      if(t>=PORTRAIT.die&&!died){died=true;o.die()}
      target.copy(stage.position).add(framePoint);
      if(t>=PORTRAIT.duration&&!ended){ended=true;o.end()}
    },
    camera(t){
      const settle=ease(t,PORTRAIT.duration-.65,PORTRAIT.duration);
      target.copy(stage.position).add(framePoint);
      cameraOffset.set(.24,.55,4.4).lerp(V(T,.12,.28,3.15),ease(t,1.35,3.7));
      o.camera.position.copy(target).add(cameraOffset).lerp(handoff,settle);
      look.copy(target).lerp(o.target,settle);o.camera.lookAt(look);
    },
    showGore(){},
    cleanup(){
      stage.removeFromParent();
      o.disposeActors();
      if(painter){painter.userData.holdPose?.();o.bind(painter);}
    }
  };
}
