import {makeTorso} from './hollower-torso.mjs';
import {makeHeadExtraction} from './hollower-head.mjs';
export {playHollowerRebirth} from './hollower-rebirth.mjs';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const ease=(t,a,b)=>smooth((t-a)/(b-a));
function sample(keys,t){
  const i=keys.findIndex(key=>key[0]>t);
  if(i<=0)return keys[i===0?0:keys.length-1].slice(1);
  const a=keys[i-1],b=keys[i],u=ease(t,a[0],b[0]);
  return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);
}

const extractionTime=9.59,liftTime=13.22,duration=17.75;
const cues=[
  [1.26,'drop'],[2.08,'land'],[3.05,'fabric'],[4.42,'tear'],[5.57,'push'],
  [6.49,'tear'],[7.38,'footstep'],[8.08,'footstep'],[8.66,'zip'],[9.08,'zip'],
  [extractionTime,'extract'],[10.34,'dig'],[11.06,'skullLand'],[11.36,'pull'],[12.65,'land'],
  [liftTime,'take'],[14.46,'line']
];
// Stage-local translations and rotations. Each recoil is followed by a hold
// before the next effort. The arms fall only once the skull has cleared.
const rootKeys=[
  [0,0,0,0,0,.08,0],[.84,-.026,.002,.035,.11,-.32,-.12],
  [1.29,.035,-.053,.15,-.29,-.21,.21],[1.57,.06,-.17,.38,-.74,.11,.22],
  [1.92,.05,.069,.82,-1.38,.10,.06],[2.10,.05,.112,.88,-1.54,.08,.018],
  [2.30,.05,.128,.89,-1.49,.08,.093],[2.70,.05,.115,.89,-1.53,.08,.05],
  [4.19,.042,.129,.894,-1.49,.06,.046],[4.62,.065,.115,.914,-1.54,.08,.12],
  [5.20,.055,.14,.917,-1.49,.08,.085],[5.6,.074,.145,.928,-1.49,.11,.018],
  [6.54,.045,.117,.91,-1.54,.10,.018],[7.16,.046,.121,.914,-1.53,.10,.041],
  [8.50,.04,.129,.91,-1.52,.10,.028],[9.17,.04,.133,.908,-1.49,.10,.045],
  [9.48,.04,.128,.912,-1.50,.10,.037],[9.64,.04,.111,.919,-1.54,.10,.026],
  [10.36,.04,.119,.917,-1.53,.10,.029],[10.69,.04,.111,.919,-1.54,.10,.026]
];
const joints={
  head:[[0,0,0,0],[1.04,-.32,-.46,-.14],[1.45,.10,-.31,.18],[2.14,.15,.18,-.23],
    [3.12,-.19,-.48,-.12],[4.52,.28,-.37,-.16],[5.58,-.18,-.38,.05],[6.62,.25,-.15,-.18],
    [7.82,.07,.54,-.13],[8.69,-.12,.47,.10],[9.12,.03,.16,-.12],[9.47,-.09,.14,-.25],[9.84,.16,-.12,-.29]],
  chest:[[0,0,0,0],[1.38,.18,-.13,-.12],[2.14,.02,.05,0],[3.20,.14,.13,-.08],
    [4.52,-.07,-.14,.045],[5.55,.05,.20,-.07],[6.55,-.03,-.04,.015],
    [7.35,.04,.02,-.025],[8.85,-.04,.04,-.02],[9.34,0,0,0]],
  thigh_L:[[0,-.08,0,.035],[1.45,-.55,.10,.13],[2.15,-.32,0,.055],[3.14,-.30,0,.08],
    [4.53,-.43,-.08,.10],[5.59,-.40,.07,.15],[6.57,-.28,0,.055],[8.72,-.26,.04,.084],[9.55,-.05,0,.084]],
  shin_L:[[0,.13,0,0],[1.52,1.07,0,0],[2.19,.48,0,0],[4.52,.63,0,0],[5.62,.58,0,0],
    [6.57,.40,0,0],[8.74,.35,0,0],[9.63,.10,0,0]],
  thigh_R:[[0,-.07,0,-.04],[1.52,-.27,-.11,-.11],[2.14,-.07,.04,-.057],[4.53,-.12,0,-.082],
    [5.61,-.11,.06,-.015],[6.64,-.09,0,-.10],[9.51,-.03,.02,-.11]],
  shin_R:[[0,.08,0,0],[1.57,.63,0,0],[2.21,.19,0,0],[4.53,.27,0,0],
    [5.60,.16,0,0],[6.65,.17,0,0],[9.57,.075,0,0]]
};
const palms=[
  [[1.4,-.17,.29,.12],[1.96,-.24,.033,-.15],[2.37,-.27,.26,-.43],[3.16,-.21,.36,-.34],
   [4.12,-.195,.40,-.31],[4.55,-.26,.27,-.40],[5.56,-.30,.36,-.47],[6.28,-.255,.37,-.38],
   [6.70,-.23,.23,-.47],[7.47,-.22,.27,-.48],[8.35,-.12,.25,-.60],[8.92,-.14,.16,-.57],
   [9.42,-.16,.24,-.53],[9.82,-.28,.07,-.32],[10.10,-.31,.045,-.18]],
  [[1.36,.29,.44,.05],[1.96,.31,.035,-.05],[2.48,.28,.26,-.41],[3.23,.19,.26,-.37],
   [4.66,.21,.21,-.32],[5.15,.15,.27,-.41],[5.60,.095,.39,-.47],[5.90,.13,.34,-.39],
   [6.60,.22,.22,-.31],[7.75,.23,.16,-.52],[8.65,.19,.29,-.60],[9.03,.25,.11,-.43],
   [9.39,.19,.26,-.58],[9.92,.34,.052,-.20]]
];
const apertureKeys=[
  [0,0,0],[4.42,0,0],[4.83,.025,.065],[5.32,.030,.071],[6.23,.031,.081],
  [6.85,.066,.125],[7.46,.071,.139],[9.84,.074,.144],[10.58,.098,.167],[11.47,.111,.182],
  [12.32,.121,.192]
];
const clothKeys=[
  [0,0,0],[3.05,0,0],[3.47,.034,.072],[4.26,.049,.115],[6.24,.057,.130],
  [6.85,.092,.150],[7.46,.098,.166],[9.84,.101,.169],[10.58,.126,.189],[12.32,.141,.205]
];

export function playHollower(T, site, o){
  const stage=new T.Group();stage.name="Hollower remains";stage.position.set(site.x,site.y,site.z);o.scene.add(stage);
  const materials=[], geometries=[];
  const mat=(color,emissive=0)=>{const m=new T.MeshLambertMaterial({color,emissive,flatShading:true});materials.push(m);return m};
  const chitin=mat(0x292833,0x080811),joint=mat(0x51414e),mask=mat(0xbca486),eye=mat(0xe9c288,0xb46229);
  const red=mat(0x642335,0x200708);
  function mesh(g,m,parent,x=0,y=0,z=0){
    const a=new T.Mesh(g,m);geometries.push(g);a.position.set(x,y,z);parent.add(a);return a;
  }
  function facet(parent,m,xyz,size){
    const a=mesh(new T.IcosahedronGeometry(1,0),m,parent,...xyz);a.scale.set(...size);return a;
  }
  const up=new T.Vector3(0,1,0),direction=new T.Vector3();
  function segments(parent,radii) {
    return radii.map(r=>mesh(new T.CylinderGeometry(r*.63,r,1,5),chitin,parent));
  }
  function lay(parts,points){
    parts.forEach((m,i)=>{
      const a=points[i],b=points[i+1];
      direction.subVectors(b,a);m.scale.y=direction.length();m.position.copy(a).lerp(b,.5);
      m.quaternion.setFromUnitVectors(up,direction.normalize());
    });
  }
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const hunter=new T.Group(), shade=new T.Group();stage.add(hunter,shade);
  facet(hunter,chitin,[0,.20,-.28],[.4,.27,.54]);
  facet(hunter,joint,[0,.23,-.55],[.28,.19,.35]);
  const head=new T.Group();hunter.add(head);head.position.set(0,.16,.16);
  facet(head,mask,[0,0,0],[.20,.22,.18]);
  for(const s of [-1,1]){
    facet(head,eye,[s*.084,.045,.155],[.045,.022,.025]);
    facet(head,chitin,[s*.099,-.09,.17],[.035,.115,.06]).rotation.z=s*.48;
  }
  const legs=Array.from({length:6},(_,i)=>segments(hunter,[.072,.049,.025]));
  const fore=Array.from({length:2},()=>segments(hunter,[.08,.054,.028]));
  facet(shade,chitin,[0,1.53,0],[.31,.76,.22]);
  facet(shade,mask,[0,2.31,.12],[.23,.24,.18]);
  for(const s of [-1,1]){
    facet(shade,eye,[.071*s,2.34,.26],[.03,.034,.027]);
    facet(shade,mask,[.17*s,2.49,.11],[.066,.30,.07]).rotation.z=-s*.32;
  }
  const shadowLegs=[segments(shade,[.093,.056]),segments(shade,[.093,.056])];
  const shadowArms=[segments(shade,[.075,.045]),segments(shade,[.075,.045])];
  const body=o.makeActor("solid"),soul=o.makeActor("ghost");stage.add(body,soul);
  o.bind(body);
  const headEffect=makeHeadExtraction(T,body,stage,o.crown(),o.addSkull);
  const torso=makeTorso(T,body,headEffect.decorate);
  const pool=mesh(new T.CircleGeometry(.38,23),mat(0x631a28,0x140207),stage,.025,.009,.12);
  pool.rotation.x=-Math.PI/2;
  const outline=pool.geometry.attributes.position;
  for(let i=1;i<outline.count;i++){
    const ripple=1+.075*Math.sin(i*2.57)+.14*Math.sin(i*.67);
    outline.setXY(i,outline.getX(i)*ripple,outline.getY(i)*ripple);
  }
  outline.setXYZ(outline.count-1,outline.getX(1),outline.getY(1),0);
  const stain=mesh(new T.CircleGeometry(.16,11),red,stage,.02,.010,-.55);
  stain.rotation.x=-Math.PI/2;
  const light=new T.PointLight(0xa9ddd2,8,4);
  light.position.set(.12,1.58,-.45);stage.add(light);
  const fill=new T.PointLight(0xf0a798,2.2,3);
  fill.position.set(.65,.88,.58);stage.add(fill);

  const lowKeys=[
    [0,-.05,1.96,-1.03],[.95,-.05,1.94,-1.01],[1.31,-.13,.32,-.37],
    [1.62,-.32,.146,-.40],[2.22,-.38,.101,-.59],[3.38,-.40,.122,-.48],
    [4.37,-.36,.112,-.43],[4.85,-.51,.163,-.49],[5.59,-.59,.20,-.56],
    [6.36,-.39,.126,-.48],[6.90,-.56,.167,-.55],[8.05,-.74,.203,-.57],
    [9.39,-.72,.172,-.57],[10.4,-.42,.108,-.48],[11.12,-.37,.12,-.37],
    [11.84,-.57,.212,-.43],[12.43,-.59,.188,-.44],[13.14,-.62,.122,-.52],
    [15.38,-.71,.139,-.63]
  ];
  const clawKeys=[
    [[2,-.36,.11,-.32],[2.84,-.14,.22,-.24],[3.12,-.056,.23,-.25],[3.67,-.215,.285,-.25],
      [4.30,-.09,.19,-.23],[4.71,-.14,.245,-.26],[5.16,-.22,.27,-.37],[5.56,-.35,.39,-.44],
      [6.21,-.09,.21,-.22],[6.56,-.075,.18,-.28],[7.05,-.24,.36,-.39],[7.51,-.47,.16,-.23],
      [9.63,-.45,.115,-.27],[10.40,-.074,.19,-.24],[10.75,-.098,.26,-.14],[11.26,-.11,.185,-.17],
      [11.68,-.23,.28,-.21],[12.12,-.46,.32,-.18],[12.46,-.59,.188,-.08],[13.2,-.61,.055,-.19]],
    [[2,.14,.09,-.50],[2.88,.095,.21,-.25],[3.19,.052,.23,-.24],[3.82,.135,.27,-.22],
      [4.36,.020,.19,-.22],[4.80,.087,.205,-.23],[5.15,.041,.225,-.38],[5.58,.055,.35,-.47],
      [6.35,.07,.21,-.25],[6.73,.11,.23,-.17],[7.62,-.17,.10,-.39],[9.64,-.19,.12,-.37],
      [10.33,.045,.19,-.16],[10.73,.098,.245,-.08],[11.10,.048,.18,-.11],
      [11.52,.051,.25,-.07],[12.04,-.16,.34,.04],[12.31,-.25,.26,.12],[13.2,-.48,.07,-.07]]
  ];
  const cameraKeys=[
    [0,1.13,1.61,2.89],[1.54,1.02,1.53,2.40],[2.71,.79,1.55,1.58],
    [5.42,.90,1.45,1.43],[6.75,.68,1.51,1.41],[8.12,.57,1.61,2.34],
    [8.73,.40,1.54,.63],[9.49,.43,1.55,.68],[10.26,.68,1.41,1.42],[12.70,.58,1.50,1.63],
    [13.94,.18,1.63,2.79],[15.11,.21,1.66,2.76],[16.55,.57,1.59,1.39],[17.1,.55,1.57,1.38]
  ];
  const aimKeys=[
    [0,0,1.10,-.18],[1.67,0,.75,.11],[2.77,-.075,.34,-.09],
    [6.78,-.145,.32,-.13],[8.13,.25,.91,-.43],[8.74,.125,.29,-.54],[9.77,.22,.46,-.57],
    [10.33,-.13,.26,-.14],[12.63,-.14,.26,-.14],[14.16,.32,.97,-.27],
    [15.12,.27,.91,-.22],[16.61,.014,.15,-.15]
  ];

  const headBone=body.userData.bones.head;
  const flatLook=V(0,0,0),cameraPoint=V(0,0,0),headMark=V(0,0,0),cutMark=V(0,0,0),skullGrip=V(0,0,0);
  const fingers=[-.034,0,.034].map(offset=>({offset,parts:segments(shade,[.018,.012])}));
  const cutter=segments(shade,[.022,.012]);
  const extracts=[
    {organ:torso.fragment,claw:0,start:6.53,release:7.06,land:7.49,to:V(-.45,.043,-.07)},
    {organ:torso.heart,claw:0,start:11.36,release:12.30,land:12.67,to:V(-.59,.046,.13)},
    {organ:torso.bowels,claw:1,start:11.65,release:12.38,land:12.85,to:V(-.29,.036,.31)}
  ];
  for(const item of extracts)item.rest=item.organ.position.clone();
  const wrists=[V(0,0,0),V(0,0,0)];
  const bendAxis=V(0,0,0), shoulder=V(0,0,0), wrist=V(0,0,0), elbow=V(0,0,0);
  const parentRotation=new T.Quaternion(), desired=new T.Quaternion();
  let cueIndex=0,ended=false,open=[0,0],fabric=[0,0],clock=0,visibleGore=null;

  function aimBone(bone,child,from,to,mix){
    bone.parent.getWorldQuaternion(parentRotation).invert();
    direction.copy(to).sub(from).normalize().applyQuaternion(parentRotation);
    desired.setFromUnitVectors(child.position.clone().normalize(),direction);
    bone.quaternion.slerp(desired,mix);
    bone.updateMatrixWorld(true);
  }
  function reachArm(bones,side,palm,weight){
    if(weight<=0)return;
    const upper=bones['upperarm_'+side],lower=bones['forearm_'+side],hand=bones['hand_'+side];
    upper.getWorldPosition(shoulder);
    wrist.copy(palm).add(stage.position);
    const a=lower.position.length(),b=hand.position.length();
    const length=Math.min(a+b-.001,Math.max(.06,shoulder.distanceTo(wrist)));
    const axis=wrist.clone().sub(shoulder).normalize();
    const along=(a*a+length*length-b*b)/(2*length);
    const sign=side==='L'?1:-1;
    bendAxis.set(sign*.76,-.62,.22).addScaledVector(axis,-bendAxis.dot(axis)).normalize();
    elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bendAxis,Math.sqrt(Math.max(0,a*a-along*along)));
    wrist.copy(shoulder).addScaledVector(axis,length);
    aimBone(upper,lower,shoulder,elbow,weight);
    aimBone(lower,hand,elbow,wrist,weight);
    hand.rotation.set(.12*weight,sign*.16*weight,sign*.10*weight);
    const fingertips=bones['fingers_'+side];
    if(fingertips)fingertips.rotation.z=sign*(.20*ease(clock,7.85,8.59)-.24*ease(clock,8.89,9.34));
  }

  function bodyPose(t){
    o.bind(body);
    const b=body.userData.bones;
    const [x,y,z,rx,ry,rz]=sample(rootKeys,t);
    body.position.set(x,y,z);body.rotation.set(rx,ry,rz);
    for(const [name,keys] of Object.entries(joints))b[name].rotation.fromArray(sample(keys,t));
    const panic=ease(t,.45,1.22)*(1-ease(t,1.39,2));
    b.upperarm_L.rotation.set(-.23*panic,-.25*panic,-1.37+.80*panic);
    b.upperarm_R.rotation.set(.10*panic,.21*panic,1.36-.62*panic);
    b.forearm_L.rotation.y=.19+.76*panic;b.forearm_R.rotation.y=-.16-.58*panic;
    const face=t<.86?0:t<2.40?"dread":t<8.28?"panic":t<extractionTime?"bracing":"deathRest";
    body.userData.face(face);
    body.updateMatrixWorld(true);
    const press=ease(t,1.35,1.96);
    reachArm(b,'R',V(...sample(palms[0],t)),press);
    reachArm(b,'L',V(...sample(palms[1],t)),press);
    body.updateMatrixWorld(true);
    headMark.copy(o.crown()).add(V(0,.008,.025));
    headBone.localToWorld(headMark).sub(stage.position);
    cutMark.fromArray(sample([[8.60,.055,.235,.065],[8.86,.054,.210,.091],[9.15,.045,.161,.123],
      [9.35,.035,.126,.126]],t));
    headBone.localToWorld(cutMark).sub(stage.position);
  }

  function lowPerformance(t){
    hunter.position.fromArray(sample(lowKeys,t));
    head.rotation.fromArray(sample([[0,.19,0,0],[1.3,-.28,.22,.15],[2.42,.19,.10,.04],
      [4.31,.43,.35,.18],[5.58,-.32,.30,-.25],[6.51,.54,.31,.23],[7.73,.02,.73,-.21],
      [9.46,.24,.38,.07],[10.56,.54,.48,.14],[12.11,-.28,.82,-.14],[13.27,.42,.55,.07],
      [15.45,.01,1.05,-.16]],t));
    for(let i=0;i<6;i++){
      const s=i<3?-1:1,j=i%3,z=j*.37-.61;
      const step=ease(t,1.67+j*.11,2.12+j*.11), retreat=ease(t,12.73+j*.13,13.58+j*.13);
      const arc=.16*Math.sin(Math.PI*step)+.13*Math.sin(Math.PI*retreat);
      const floor=.018-hunter.position.y*ease(t,1,1.37)+arc;
      const giveRoom=ease(t,7.61,8.32)*(1-ease(t,9.76,10.40));
      const span=s<0?.70:.59-.24*giveRoom;
      const footX=s*(span+.087*j)+.34*(hunter.position.x+.42)-.18*retreat;
      lay(legs[i],[V(s*.22,.22,z),V(s*(.51+.08*j),.55+.095*Math.sin(step*Math.PI),z-.14),
        V(footX,floor+.055,z+.03),V(footX+s*.095,floor,z+.16)]);
    }
    for(let i=0;i<2;i++){
      const s=i*2-1,reach=ease(t,1.47+i*.10,2.24+i*.05);
      const tip=V(s*.42,.57,.44).lerp(V(...sample(clawKeys[i],t)).sub(hunter.position),reach);
      const palm=tip.clone().add(V(s*.047,.063,-.031));
      wrists[i].copy(tip).add(hunter.position);
      lay(fore[i],[V(.25*s,.24,.07),V(.48*s,.51,.17),palm,tip]);
    }
  }

  function tallPerformance(t,take){
    shade.position.fromArray(sample([[0,1.33,0,-1.47],[7.10,1.33,0,-1.47],
      [7.49,1.26,0,-1.09],[8.12,1.03,0,-.54],[8.67,.96,0,-.49],[9.40,.96,0,-.49],
      [13.06,1.05,0,-.37],[14.65,1.04,0,-.34],[16.59,1.21,0,-1.12]],t));
    shade.rotation.y=-.68;
    const grip=ease(t,8.30,8.68)*(1-ease(t,10.54,11.00));
    const unzip=ease(t,8.58,8.77)*(1-ease(t,9.37,9.72));
    const lift=ease(t,9.29,10.03);
    shade.rotation.z=.19*grip*(1-.60*lift);
    const arm=i=>i===0
      ? V(...sample([[0,-.44,.61,.15],[7.91,-.39,.63,.27],[8.28,-.36,1.23,.36],
        [8.59,-.45,1.57,.42],[9.84,-.43,.54,.23]],t)).lerp(V(-.18,1.63,.62),take)
      : V(.40,.55,.13).lerp(V(.03,1.35,.61),take);
    shade.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      const s=i*2-1,step=ease(t,7.13+.38*i,7.75+.42*i),arc=Math.sin(Math.PI*step);
      const exit=ease(t,15.24+.48*i,16.01+.46*i);
      const foot=V(s*.21,.022+.13*arc+.12*Math.sin(Math.PI*exit),.11+.28*step-.15*i-.14*exit);
      lay(shadowLegs[i],[V(.13*s,.95,0),V(.19*s,.45,-.025+.11*step),foot]);
      const hand=arm(i);
      if(i===0){
        const above=headMark.clone().add(V(.36*lift,.56*lift,.08*lift));
        hand.lerp(shade.worldToLocal(above.add(stage.position)),grip);
        skullGrip.copy(shade.localToWorld(hand.clone())).sub(stage.position);
        for(const {offset,parts} of fingers){
          const p=hand.clone().add(V(offset,.012,-.008));
          lay(parts,[p,p.clone().add(V(offset*.5,-.072,.012)),p.clone().add(V(-offset*.78,-.084,.061*grip))]);
        }
      }else{
        hand.lerp(shade.worldToLocal(cutMark.clone().add(stage.position)).add(V(.038,.074,0)),unzip);
        const tip=hand.clone().add(V(-.041,-.058,.012));
        lay(cutter,[hand,tip,tip.clone().add(V(-.011,-.024,-.003))]);
      }
      const elbow=V(s*.38,1.11,.1).lerp(V(s*.25,1.46,.34),take);
      elbow.lerp(hand.clone().add(V(.31,.58,-.16)),i===0?grip*.8:unzip*.85);
      lay(shadowArms[i],[V(.25*s,1.87,.01),elbow,hand]);
    }
    return shade.localToWorld(arm(0)).sub(stage.position);
  }

  function showGore(on){
    visibleGore=on;
    if(clock>=extractionTime)body.userData.face(on?"emptyMouth":"deathRest");
    torso.update(open,fabric,on);
    pool.visible=on&&clock>=4.43;stain.visible=on&&clock>=9.13;
    const zip=.44*ease(clock,8.66,8.97)+.56*ease(clock,9.06,9.33);
    headEffect.update(on,zip,ease(clock,9.32,9.88),ease(clock,10.46,11.06),skullGrip);
  }
  return {
    frame(t){
      clock=t;
      const gore=o.gore(),take=ease(t,liftTime,14.82);
      bodyPose(t);
      lowPerformance(t);
      const carry=tallPerformance(t,take);
      open=sample(apertureKeys,t);fabric=sample(clothKeys,t);
      showGore(gore);
      for(const item of extracts){
        const {organ,claw,start,release,land,rest,to}=item;
        const draw=ease(t,start,start+.41),drop=ease(t,release,land);
        organ.position.copy(rest);
        const point=torso.cavity.localToWorld(rest.clone()).sub(stage.position);
        point.lerp(wrists[claw],draw).lerp(to,drop);
        point.y+=.12*Math.sin(Math.PI*drop);
        organ.position.copy(torso.cavity.worldToLocal(point.add(stage.position)));
        organ.rotation.set(-.52*draw+1.7*drop,-.62*drop,.37*draw+.58*drop);
        organ.scale.setScalar(1-.15*draw);
      }
      const pulse=(1-ease(t,9.42,9.78))*(1+.36*Math.sin(t*8));
      torso.heart.scale.multiplyScalar(1+.053*pulse);
      for(const lung of torso.lungs)lung.scale.set(1,1+.048*(1-ease(t,9.42,9.78))*Math.sin(t*3.4),1);
      const spread=ease(t,4.43,12.35);
      pool.scale.set(.19+.86*spread,.20+1.14*spread,1);
      stain.scale.setScalar(.14+.86*ease(t,9.13,10.4));

      soul.visible=t>liftTime;
      o.bind(soul);
      const b=soul.userData.bones;
      b.upperarm_L.rotation.z=-1.17-.23*take;b.upperarm_R.rotation.z=1.21+.22*take;
      b.forearm_L.rotation.y=.49*(1-take);b.forearm_R.rotation.y=-.31*(1-take);
      b.head.rotation.set(.14+.15*take,-.44*take,.22*take);
      b.thigh_L.rotation.x=-.27*(1-take);b.shin_L.rotation.x=.40*(1-take);
      soul.userData.face(7);
      soul.scale.setScalar(.87-.47*take);
      soul.rotation.set(-1.54*(1-take),-.18*take,.13*take);
      soul.position.copy(body.position).lerp(carry.add(V(-.018,-.54,.045)),take);

      while(cueIndex<cues.length&&t>=cues[cueIndex][0]){
        const cue=cues[cueIndex++][1];
        if(cue==='extract')o.die();
        o.cue(cue);
      }
      o.target.copy(stage.position).add(V(.15,.44,.12));
      if(t>=duration&&!ended){ended=true;o.end()}
    },
    camera(t){
      const handoff=ease(t,duration-.70,duration);
      o.camera.position.copy(stage.position).add(cameraPoint.fromArray(sample(cameraKeys,t))).lerp(o.handoff,handoff);
      flatLook.copy(stage.position).add(cameraPoint.fromArray(sample(aimKeys,t))).lerp(o.target,handoff);
      o.camera.lookAt(flatLook);
    },
    showGore(on){if(on!==visibleGore)showGore(on)},
    cleanup(){
      stage.removeFromParent();torso.dispose();headEffect.dispose();
      materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());o.disposeActors();
    }
  };
}
