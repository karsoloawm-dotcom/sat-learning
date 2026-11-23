export const STAIR_IMPACT=1.64;
export const STAIR_TWITCH_END=STAIR_IMPACT+3;
export const STAIR_END=5.85;

// Pelvis and contact points are relative to the bottom riser. A repeated
// contact holds its world position while the body moves around it.
const poseKeys=[
  // seconds, pelvis x/y/z, pitch, yaw, roll
  [0, .03,1.43,-.96,-.03,2.87,.01],
  [.53,.02,1.72,-1.52,-.05,2.68,-.035],
  [.76,.10,1.66,-1.49,-.13,2.16,.13],
  [1.08,.12,1.48,-1.42,-.44,1.20,.18],
  [1.35,.10,1.43,-1.58,-.46,1.06,.18],
  [1.64,.005,1.53,-1.73,-.30,1.24,.15],
  [1.77,.02,1.49,-1.51,.13,1.04,.35],
  [2.02,.21,1.00,-.96,.78,.43,.43],
  [2.28,.24,.67,-.44,1.02,.18,.40],
  [2.59,.17,.38,.08,1.26,-.08,.40],
  [2.89,.13,.21,.64,1.51,-.15,.35],
  [3.22,.13,.19,.80,1.56,-.18,.34],
  [3.65,.13,.19,.80,1.56,-.18,.34]
];
const feet={
  L:[[0,-.17,-1.15,0],[.12,-.17,-1.15,0],[.31,-.21,-1.56,.12],[.53,-.17,-1.80,0],
    [1.66,-.17,-1.80,0],[1.89,-.30,-1.32,.13],[2.16,-.34,-1.07,0],[2.54,-.35,-.59,0],[2.93,-.28,.17,0]],
  R:[[0,.19,-.74,0],[.66,.19,-.74,0],[.9,.37,-.79,.07],[1.03,.38,-.69,0],
    [1.73,.38,-.69,0],[2.01,.50,-.49,.10],[2.18,.52,-.21,0],[2.55,.56,.04,0],[2.98,.48,.30,0]]
};
const braceHands={
  // seconds, x, z, clearance, influence
  L:[[0,-.36,-1.55,.36,0],[.73,-.38,-1.67,.36,0],[1.22,.05,-2.14,.044,1],
    [1.70,.05,-2.14,.044,1],[1.98,-.54,-1.26,.11,.8],[2.18,-.64,-.88,.04,1],
    [2.37,-.64,-.88,.04,1],[2.72,-.53,.48,.04,1],[3.25,-.62,.71,.04,1]],
  R:[[0,.40,-.85,.50,0],[1.63,.46,-1.03,.47,0],[1.89,.65,-.43,.15,.85],
    [2.14,.72,-.28,.045,1],[2.39,.72,-.28,.045,1],[2.73,.92,.54,.045,1],[3.25,.86,1.0,.045,1]]
};

// Some sock and shoe vertices reference joints on the opposite leg.
// Keep the authored garment triangles and correct their joint indices here.
export function stairFootWeights(source, skeleton) {
  const geometry=source.clone();
  const position=geometry.attributes.position,joints=geometry.attributes.skinIndex;
  const jointIndex=name=>skeleton.bones.findIndex(b=>b.name===name);
  const leg=["thigh","shin","foot"].map(name=>[jointIndex(name+"_L"),jointIndex(name+"_R")]);
  const left=new Map(leg.map(([l,r])=>[r,l])),right=new Map(leg);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i);
    if(Math.abs(x)<.027||position.getY(i)>.54)continue;
    const mapping=x>0?left:right;
    for(let j=0;j<4;j++){
      const index=mapping.get(joints.getComponent(i,j));
      if(index!==undefined)joints.setComponent(i,j,index);
    }
  }
  return geometry;
}

export function createStairPerformance(THREE, actor, stair, reduced) {
  const {mesh,bones}=actor.userData;
  const V=()=>new THREE.Vector3(), Q=()=>new THREE.Quaternion();
  const rest=Object.values(bones).map(bone=>[bone,bone.quaternion.clone()]);
  const axis=V(), pole=V(), joint=V(), root=V(), end=V(), target=V(), base=V(), local=V(), probe=V();
  const parent=Q(), tilt=Q(), bank=Q(), yaw=Q(), toe=Q();
  const xAxis=new THREE.Vector3(1,0,0), yAxis=new THREE.Vector3(0,1,0), zAxis=new THREE.Vector3(0,0,1);
  const smooth=t=>t*t*(3-2*t);
  const clamp=THREE.MathUtils.clamp;
  const lerp=THREE.MathUtils.lerp;
  const pelvisFrame=[], footFrame=[], handFrame=[];
  const supports=[];
  const vertices=mesh.geometry.attributes.position;
  const interval=Math.max(1,Math.floor(vertices.count/370));
  // Probe the lower torso and limbs against the actual treads during a roll.
  for(let i=0;i<vertices.count;i+=interval)if(vertices.getY(i)<1.48)supports.push(i);
  function sample(keys,t,output) {
    let i=1;
    while(i<keys.length-1&&t>keys[i][0])i++;
    const a=keys[i-1],b=keys[i],u=smooth(clamp((t-a[0])/(b[0]-a[0]),0,1));
    for(let k=1;k<a.length;k++)output[k-1]=lerp(a[k],b[k],u);
    return output;
  }
  function aim(bone,child,point) {
    bone.parent.getWorldQuaternion(parent).invert();
    bone.getWorldPosition(base);
    local.copy(point).sub(base).applyQuaternion(parent).normalize();
    bone.quaternion.setFromUnitVectors(end.copy(child.position).normalize(),local);
  }
  function limb(a,b,c,point,bend) {
    a.getWorldPosition(root);
    axis.subVectors(point,root);
    const first=b.position.length(),second=c.position.length();
    const length=clamp(axis.length(),Math.abs(first-second)+.002,first+second-.001);
    axis.normalize();
    pole.copy(bend).addScaledVector(axis,-bend.dot(axis)).normalize();
    const along=(first*first-second*second+length*length)/(2*length);
    joint.copy(root).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,first*first-along*along)));
    aim(a,b,joint);aim(b,c,point);
  }
  const bend=V();
  function feetAt(t,heading,twitch) {
    for(const side of ["L","R"]){
      const [x,z,lift]=sample(feet[side],t,footFrame),worldZ=stair.start+z;
      target.set(x,stair.surface(x,worldZ)+.142+lift+Math.max(0,twitch)*(side==="L"?.035:.067),worldZ);
      const foot=bones["foot_"+side];
      bend.set(Math.sin(heading)+.18*(side==="L"?-1:1),t>1.7?.52:0,Math.cos(heading));
      limb(bones["thigh_"+side],bones["shin_"+side],foot,target,bend);
      const recline=smooth(clamp((t-1.78)/1.06,0,1));
      const turn=heading+(Math.PI-.25-heading)*recline;
      toe.setFromAxisAngle(yAxis,turn).multiply(tilt.setFromAxisAngle(xAxis,.29*recline+(side==="L"?-.15:.23)*twitch));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(parent).invert()).multiply(toe);
    }
  }
  function handsAt(t,twitch) {
    for(const side of ["L","R"]){
      const [x,z,lift,weight]=sample(braceHands[side],t,handFrame);
      if(weight===0)continue;
      const hand=bones["hand_"+side],worldZ=stair.start+z;
      hand.getWorldPosition(target);
      target.lerp(probe.set(x,stair.surface(x,worldZ)+lift+Math.abs(twitch)*(side==="L"?.05:.10),worldZ),weight);
      bend.set(side==="L"?-.94:.94,.42,.40);
      limb(bones["upperarm_"+side],bones["forearm_"+side],hand,target,bend);
      // Point the fingers away from the elbow along the tread without
      // twisting the skin weights around the wrist.
      hand.rotateX(-.15*weight+twitch*(side==="L"?-.18:.32));
    }
  }
  function frame(t) {
    for(const [bone,q] of rest)bone.quaternion.copy(q);
    const [x,y,z,pitch,heading,roll]=sample(poseKeys,t,pelvisFrame);
    const elapsed=t-STAIR_IMPACT;
    const active=clamp(elapsed,0,3);
    const strength=(1-active/3)**.88*smooth(clamp(elapsed/.075,0,1));
    // Uneven contractions are visible during the tumble. Once grounded, the
    // wrist and boot finish in smaller spasms within the same three seconds.
    const settle=reduced?0:strength*(.72*Math.sin(active*18+1.3*Math.sin(active*4))+.28*Math.sin(active*33));
    const look=smooth(clamp((t-.62)/.44,0,1));
    actor.quaternion.copy(tilt.setFromAxisAngle(xAxis,pitch+.055*settle))
      .multiply(bank.setFromAxisAngle(zAxis,roll+.033*settle)).multiply(yaw.setFromAxisAngle(yAxis,heading));
    actor.position.set(x,y,stair.start+z);
    bones.hips.getWorldPosition(root);actor.position.add(base.copy(actor.position).sub(root));
    bones.upperarm_L.rotateZ(-.98);bones.upperarm_R.rotateZ(1.04);
    bones.forearm_L.rotateY(-.24);bones.forearm_R.rotateY(.20);
    if(t<STAIR_IMPACT){
      bones.head.rotateY(-.30*look);
      bones.head.rotateX(-.47*smooth(clamp((t-1.06)/.38,0,1)));
      bones.upperarm_R.rotateZ(.18*look);
    }else{
      bones.head.rotateX(.2);
      bones.forearm_R.rotateX(.20*settle);
    }
    feetAt(t,heading,settle);
    handsAt(t,settle);
    if(t>1.77){
      actor.updateMatrixWorld(true);
      let correction=0;
      for(const i of supports){
        mesh.getVertexPosition(i,probe).applyMatrix4(mesh.matrixWorld);
        correction=Math.max(correction,stair.surface(probe.x,probe.z)+.007-probe.y);
      }
      const contact=smooth(clamp((t-1.77)/.23,0,1));
      actor.position.y+=Math.min(correction,.28)*contact;
    }
    actor.updateMatrixWorld(true);
  }
  return {frame};
}
