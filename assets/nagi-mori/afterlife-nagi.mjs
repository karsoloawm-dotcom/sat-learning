
import * as THREE from "three";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import {clone} from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js";
import {fitNagiAnatomy,garments} from "./nagi-anatomy.mjs?v=white-thing";
import {createNagiFaces,attachNagiFace} from "./nagi-face.mjs?v=white-thing";
import {makeNagiWhiteThing} from "./nagi-white-thing.mjs?v=white-thing";

const patrol=[
  [.86,6.8],[.82,2.5],[.68,-3.7],[.65,-5.35],
  [-.66,-5.35],[-.8,-1.6],[-.87,4.8],[-.85,6.8]
];
const livingLines=[
  ["Nagi · Is that pocket full of grave dirt, or is it a fashion choice?","Nagi · Túi cậu đầy đất nghĩa trang hay đó là gu thời trang vậy?","ナギ · ポケットの土、墓地の？ それともそういうファッション？"],
  ["Nagi · I was looking for the last train. This place has terrible signage.","Nagi · Mình đi tìm chuyến tàu cuối. Chỗ này biển chỉ đường tệ thật.","ナギ · 終電を探してた。ここ、案内がひどいね。"],
  ["Nagi · If you hear three notes in a row, that's me. Four means run.","Nagi · Nghe ba nốt liên tiếp là mình. Bốn nốt thì chạy đi.","ナギ · 三音続けて聞こえたら私。四音なら逃げて。"]
];
const soulLines=[
  ["Nagi · I can still hear the grass. I thought losing my ears would take care of that.","Nagi · Mình vẫn nghe tiếng cỏ. Tưởng mất tai thì sẽ hết chứ.","ナギ · まだ草の音がする。耳がなくなれば聞こえなくなると思ったのに。"],
  ["Nagi · You can stop staring. I'm still here.","Nagi · Cậu đừng nhìn chằm chằm nữa. Mình vẫn ở đây.","ナギ · もうそんなに見なくていいよ。まだここにいるから。"]
];
const warning=["Nagi · Don't come any closer. It's looking right at me.","Nagi · Đừng lại gần. Nó đang nhìn thẳng vào mình.","ナギ · 近づかないで。こっちを見てる。"];
const sunrise=["Nagi · Yeah. Find us somewhere the sun hits first.",
  "Nagi · Ừ. Tìm cho hai đứa một chỗ đón nắng đầu tiên nhé.","ナギ · うん。いちばん先に朝日が当たる場所、探しておいて。"];
const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=n=>{const u=cap(n,0,1);return u*u*(3-2*u)};
const turnDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const isHeadPart=o=>o.userData.nagiPart==="Head"||o.userData.nagiPart==="Hair";
const livingExpressions=["Smirk","Focused","Uneasy"];
const soulExpressions=["Relieved","Smirk"];
const carryLines=[
  ["Nagi · I’ll walk with you. I’m still angry.","Nagi · Mình sẽ đi với cậu. Mình vẫn còn giận.","ナギ · 一緒に行く。でも、まだ怒ってるから。"],
  ["Nagi · You came back for me. I’ll stay close.","Nagi · Cậu quay lại tìm mình. Mình sẽ đi bên cậu.","ナギ · 迎えに来てくれたんだ。そばにいるね。"],
  ["Nagi · You can set me down if you need both hands.","Nagi · Cứ đặt mình xuống nếu cậu cần rảnh tay.","ナギ · 両手が必要なら、私を置いていっていいよ。"]
];
const comfortLines=[
  ["Nagi · Hanako? I’m here. You can wake up now.","Nagi · Hanako? Mình ở đây. Cậu tỉnh lại được rồi.","ナギ · 花子？ ここにいるよ。もう起きていいよ。"],
  ["Nagi · I saved you a spot. You still owe me a sunrise.","Nagi · Mình giữ chỗ cho cậu rồi. Cậu vẫn nợ mình một bình minh.","ナギ · 場所、取っておいたよ。まだ一緒に朝日を見る約束、残ってるからね。"]
];

const ASSET_PARTS=new Set(["Body","Head","Hair","Shirt","Tie","Trousers","Shoes","Bra","Briefs"]);

function rigParts(root,parser){
  for(const [o,ref] of parser.associations){
    if(ref.nodes===undefined||o.isBone)continue;
    const name=parser.json.nodes[ref.nodes]?.name;
    if(ASSET_PARTS.has(name))o.userData.nagiPart=name;
  }
  root.traverse(o=>{
    if(o.isSkinnedMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true}
  });
}

function makeActor(model,clips){
  const root=new THREE.Group();
  root.add(model);
  const mixer=new THREE.AnimationMixer(model);
  const actions=new Map(clips.map(clip=>[clip.name,mixer.clipAction(clip)]));
  const bones=new Map(),parts=new Map(),faceMeshes=[];
  const expressionWeights=new Map();
  model.traverse(o=>{
    if(o.isBone)bones.set(o.name,o);
    if(o.userData.nagiPart)parts.set(o.userData.nagiPart,o);
    if(o.morphTargetDictionary&&o.morphTargetInfluences){
      const channels=Object.entries(o.morphTargetDictionary);
      faceMeshes.push({channels,weights:o.morphTargetInfluences});
      for(const [name] of channels)expressionWeights.set(name,0);
    }
  });
  let active=null;
  const hair=bones.get("Ponytail");
  const restore=new THREE.Quaternion(),bend=new THREE.Quaternion();
  const windAxis=new THREE.Vector3(1,0,0),turnAxis=new THREE.Vector3(0,0,1);
  let sx=0,sz=0,vx=0,vz=0,oldHeading=root.rotation.y,oldSpeed=0;
  function express(name,blend){
    actor.faceTexture?.(name);
    for(const [key,weight] of expressionWeights){
      expressionWeights.set(key,THREE.MathUtils.lerp(weight,name===key?1:0,blend));
    }
    for(const {channels,weights} of faceMeshes){
      for(const [key,index] of channels)weights[index]=expressionWeights.get(key);
    }
  }
  function animate(name,dt,{freeze=false,speed=0,still=false,expression="Neutral"}={}){
    if(freeze)return;
    const next=actions.get(name);
    if(next&&next!==active){
      if(active)active.fadeOut(.20);
      next.reset().setEffectiveWeight(1).fadeIn(active ? .20 : 0).play();
      active=next;
    }
    if(hair)hair.quaternion.copy(restore);
    mixer.update(dt);
    faceClock+=dt;
    express(expression==="Neutral"&&faceClock%4.9<.12?"Blink":expression,1-Math.exp(-dt*12));
    if(!hair)return;
    restore.copy(hair.quaternion);
    const delta=turnDelta(oldHeading,root.rotation.y),accel=speed-oldSpeed;
    oldHeading=root.rotation.y;oldSpeed=speed;
    if(still)return;
    const x=cap(-accel/Math.max(dt,.016)*.035,-.24,.24);
    const z=cap(-delta/Math.max(dt,.016)*.058,-.33,.33);
    const damping=Math.exp(-dt*7);
    vx=(vx+(x-sx)*dt*46)*damping;
    vz=(vz+(z-sz)*dt*46)*damping;
    sx+=vx*dt;sz+=vz*dt;
    hair.quaternion.multiply(bend.setFromAxisAngle(windAxis,sx));
    hair.quaternion.multiply(bend.setFromAxisAngle(turnAxis,sz));
  }
  function face(from,dt,rate=4){
    const p=root.position;
    const yaw=Math.atan2(from.x-p.x,from.z-p.z);
    root.rotation.y+=cap(turnDelta(root.rotation.y,yaw),-rate*dt,rate*dt);
  }
  let faceClock=1.5;
  const actor={root,model,mixer,bones,parts,animate,face,express};
  return actor;
}



export function makeNeckWound(){
  const wound=new THREE.Group();
  wound.name="Nagi · exposed neck";
  const skin=new THREE.MeshStandardMaterial({color:0xa86555,roughness:.61,flatShading:true});
  const bed=new THREE.MeshStandardMaterial({color:0x501320,roughness:.39,flatShading:true});
  const muscle=new THREE.MeshStandardMaterial({color:0x9f3847,roughness:.40,flatShading:true});
  const fiber=new THREE.MeshStandardMaterial({color:0xd27476,roughness:.45});
  const bone=new THREE.MeshStandardMaterial({color:0xe1bfaa,roughness:.61,flatShading:true});
  const cord=new THREE.MeshStandardMaterial({color:0xe5afa1,roughness:.49});

  function add(geometry,material,x=0,y=0,z=0){
    const part=new THREE.Mesh(geometry,material);
    part.position.set(x,y,z);
    wound.add(part);
    return part;
  }

  // Rings shape a rolled skin edge around a recessed cut surface.
  const sides=18;
  function section(rings,material){
    const points=[],triangles=[];
    for(const [rx,rz,y,ripple] of rings){
      for(let i=0;i<sides;i++){
        const a=i*Math.PI*2/sides,uneven=Math.sin(a*5+.7)*.64+Math.sin(a*3-1)*.36;
        points.push(Math.cos(a)*rx,y+uneven*ripple,Math.sin(a)*rz);
      }
    }
    for(let row=0;row<rings.length-1;row++)for(let i=0;i<sides;i++){
      const a=row*sides+i,b=row*sides+(i+1)%sides;
      triangles.push(a,a+sides,b,b,a+sides,b+sides);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
    geometry.setIndex(triangles);geometry.computeVertexNormals();
    add(geometry,material);
  }
  section([[.046,.043,-.009,.002],[.049,.045,.001,.004],[.044,.041,.010,.004],
    [.038,.035,.009,.003]],skin);
  section([[.040,.037,.009,.003],[.031,.030,.004,.003],[.021,.019,.001,.002],
    [.001,.001,.001,0]],bed);

  function strand(points,radius,material){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve,5,radius,5,false),material);
  }

  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7+.23,dx=Math.cos(a),dz=Math.sin(a);
    const lobe=add(new THREE.IcosahedronGeometry(1,1),muscle,dx*.027,.008,dz*.025);
    lobe.scale.set(.015,.005+(i%3)*.002,.008);
    lobe.rotation.y=-a;
    for(const side of [-1,1]){
      strand([[dx*.039+side*dz*.0025,.010,dz*.036-side*dx*.0025],
        [dx*.029+side*dz*.0035,.015,dz*.027-side*dx*.0035],
        [dx*.016+side*dz*.002,.009,dz*.016-side*dx*.002]],.0018,fiber);
    }
  }
  // The vertebral body and pale cord are separated by a dark channel.
  for(let i=0;i<2;i++){
    const segment=add(new THREE.CylinderGeometry(.014-i*.0015,.017-i*.002,.009,8),
      bone,.002,.010+i*.010,-.014+i*.002);
    segment.scale.z=.78;segment.rotation.z=-.10+i*.20;
  }
  strand([[.002,.010,-.004],[.003,.023,-.004],[.006,.040,-.002],[.002,.049,.001]],.0042,cord);
  for(const side of [-1,1]){
    strand([[side*.004,.025,-.002],[side*.012,.020,.004],[side*.020,.011,.011]],.0018,cord);
  }
  wound.visible=false;
  return wound;
}

function makeCollapsePose(bones){
  const specs=[
    ["Spine",.13,.11,.00,.044,.78],["Chest",.09,.14,.12,.063,.86],
    ["UpperArm.L",-.25,-.17,.53,.22,1.00],["Forearm.L",-.36,.04,.25,.27,.95],
    ["UpperArm.R",-.22,.13,-.31,.26,.86],["Forearm.R",.31,-.08,-.18,.27,.80],
    ["Hand.L",.25,.03,.07,.075,1.10],["Hand.R",-.19,-.04,-.06,.096,1.00],
    ["Thigh.R",.16,.06,-.09,.13,.87],["Shin.R",-.19,.00,.05,.16,.91],
    ["Thigh.L",.08,-.08,.06,.095,.70],["Shin.L",-.10,.00,-.04,.12,.75]
  ];
  const joints=specs.map(([name,...pose])=>{
    const bone=bones.get(THREE.PropertyBinding.sanitizeNodeName(name));
    return bone?{bone,pose,rest:bone.quaternion.clone()}:null;
  }).filter(Boolean);
  const euler=new THREE.Euler(),offset=new THREE.Quaternion();
  function pulse(t,mid,width){
    const u=1-Math.abs(t-mid)/width;
    return u>0?ease(u):0;
  }
  return (t,reduced)=>{
    const rest=ease((t-.11)/1.06);
    const strength=reduced ? .25 : 1;
    for(const {bone,pose,rest:base} of joints){
      const [x,y,z,amount,delay]=pose;
      const shock=pulse(t,.17+delay*.055,.13)*.85
        -pulse(t,.92+delay*.10,.14)
        +pulse(t,1.45+delay*.16,.18)*.60
        -pulse(t,2.14+delay*.17,.19)*.31
        +pulse(t,2.58+delay*.13,.12)*.14;
      const bend=shock*amount*strength;
      euler.set(rest*x+bend,rest*y+bend*.29,rest*z+bend*.52);
      bone.quaternion.copy(base).multiply(offset.setFromEuler(euler));
    }
  };
}


export async function createNagi({scene,occluders,reduced,language,goreEnabled}){
  const gltf=await new GLTFLoader().loadAsync(new URL("./Nagi Mori.glb",import.meta.url).href);
  rigParts(gltf.scene,gltf.parser);
  const whiteThingModel=clone(gltf.scene);
  const group=new THREE.Group();
  group.name="Nagi Mori";
  const body=makeActor(gltf.scene,gltf.animations);
  body.root.name="Nagi · living";
  body.root.position.set(patrol[0][0],0,patrol[0][1]);
  body.root.rotation.y=Math.PI;
  const ghost=makeActor(clone(gltf.scene),gltf.animations);
  ghost.root.name="Nagi · soul";
  ghost.root.visible=false;
  const ghostMats=new Map();
  ghost.model.traverse(o=>{
    if(!o.isMesh)return;
    const material=m=>{
      if(!ghostMats.has(m)){
        const color=m.color.clone().lerp(new THREE.Color(0x8ec9ff),.66);
        ghostMats.set(m,new THREE.MeshLambertMaterial({
          color,emissive:0x3b6692,opacity:0,transparent:true,depthWrite:false
        }));
      }
      return ghostMats.get(m);
    };
    o.userData.originalFaceMaterial=o.material?.name;
    o.material=Array.isArray(o.material)?o.material.map(material):material(o.material);
    o.castShadow=o.receiveShadow=false;
  });
  group.add(body.root,ghost.root);
  const faceAtlas=createNagiFaces();
  let faceSource;
  body.parts.get("Head").traverse(o=>{if(o.isMesh&&o.material?.name==="Warm porcelain")faceSource=o});
  const bodyFace=attachNagiFace(body,faceSource,faceAtlas),ghostFace=attachNagiFace(ghost,faceSource,faceAtlas,true);
  const anatomy=fitNagiAnatomy(body);
  const inspectionLight=new THREE.PointLight(0xffddc8,2.15,2.2,2);
  inspectionLight.position.set(.14,.1,.64);inspectionLight.visible=false;body.bones.get("Chest").add(inspectionLight);
  const offClothes=new Set();
  function inspect(mode){
    const open=mode!=="exterior";
    inspectionLight.visible=open;
    body.parts.get("Body").visible=!open;
    body.parts.get("Head").visible=!open&&!wound;
    body.parts.get("Hair").visible=!open&&!wound;
    bodyFace.visible=!open&&!wound;
    for(const name of garments)body.parts.get(name).visible=!open&&!offClothes.has(name);
    for(const layer of Object.keys(anatomy)){
      const visible=mode===layer||mode==="inside"&&layer!=="muscles";
      for(const mesh of anatomy[layer])mesh.visible=visible&&(!wound||mesh.parent.name!=="Head");
    }
  }
  const sparkle=new THREE.PointLight(0x83c9ff,0,2.5,2);
  sparkle.position.y=.95;ghost.root.add(sparkle);
  scene.add(group);
  const ray=new THREE.Raycaster();
  const rayStart=new THREE.Vector3(),rayDirection=new THREE.Vector3(),headPoint=new THREE.Vector3();
  const detached=new THREE.Group();
  detached.name="Nagi · detached head";
  detached.visible=false;
  group.add(detached);
  const token=new THREE.Mesh(new THREE.IcosahedronGeometry(.092,1),new THREE.MeshLambertMaterial({color:0xa9cced,emissive:0x6781a3,transparent:true,opacity:.75}));
  token.name="Nagi · spectral remains";token.visible=false;group.add(token);
  const cervical=new THREE.Group();cervical.name="Nagi · recovered spine";detached.add(cervical);
  const spineMat=new THREE.MeshStandardMaterial({color:0xcdb7a4,roughness:.69});
  const spineGeo=new THREE.IcosahedronGeometry(1,1);
  for(let i=0;i<10;i++){
    const bone=new THREE.Mesh(spineGeo,spineMat);
    bone.position.set(.009*Math.sin(i*.5),-.031-i*.022,-.019+i*.002);
    bone.scale.set(.017,.009,.012);cervical.add(bone);
  }
  const velocity=new THREE.Vector3(),fallDir=new THREE.Vector3(),soulDrift=new THREE.Vector3(),deathSpot=new THREE.Vector3();
  const floorY=.005;
  let life="live",age=0,time=0,cursor=1,speed=0,chat=0,cooldown=0,line=0,activeLine=null;
  let expression="Neutral";
  let landed=false,headStopped=false,alert=false,frozenYaw=0,collapsePose=null,wound=null;
  const cutAxis=new THREE.Vector3(),neckPoint=new THREE.Vector3(),bleedPoint=new THREE.Vector3();
  const bleedDirection=new THREE.Vector3(),woundQ=new THREE.Quaternion();
  const waypoint=new THREE.Vector3();
  let strangler=null,sunriseWait=0,sunrisePromised=false,comfort=null;
  let carried=false,remainsReady=false,playerKilled=false,talkOnFollow=false;
  const remainsAt=new THREE.Vector3(),followGoal=new THREE.Vector3();
  const grabWrist=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
  const shoulderPoint=new THREE.Vector3(),elbowPoint=new THREE.Vector3(),handPoint=new THREE.Vector3();
  const armAim=new THREE.Vector3(),pole=new THREE.Vector3(),gripNeck=new THREE.Vector3();
  const inView=(g,p,d)=>{
    const aim=Math.atan2(p.x-g.position.x,p.z-g.position.z);
    if(d>15||Math.abs(turnDelta(g.rotation.y,aim))>Math.PI*.39)return false;
    rayStart.set(g.position.x,g.position.y+1.96,g.position.z);
    // Test face and chest separately so a low marker doesn't hide her head.
    for(const y of [1.46,1.11]){
      rayDirection.set(p.x-rayStart.x,p.y+y-rayStart.y,p.z-rayStart.z);
      ray.far=rayDirection.length()-.13;
      if(ray.far<=.025)return true;
      ray.set(rayStart,rayDirection.normalize());
      if(!ray.intersectObjects(occluders,true).length)return true;
    }
    return false;
  };

  function isTarget(g,player){
    const p=body.root.position,d=distance(g.position,p);
    return life==="live"&&group.visible&&d<distance(g.position,player)&&inView(g,p,d);
  }

  function prepare(){
    alert=true;
    cooldown=5;chat=1.25;activeLine=warning;
  }

  function strike(direction){
    if(life!=="live")return null;
    life="fallen";age=0;alert=false;chat=0;activeLine=null;
    deathSpot.copy(body.root.position);
    frozenYaw=body.root.rotation.y;
    body.root.updateWorldMatrix(true,true);
    const head=body.bones.get("Head");
    head.getWorldPosition(headPoint);
    const neck=body.bones.get("Neck");
    cutAxis.subVectors(headPoint,neck.getWorldPosition(neckPoint)).normalize();
    wound=makeNeckWound();
    body.root.add(wound);
    wound.position.copy(body.root.worldToLocal(headPoint.clone().addScaledVector(cutAxis,.031)));
    body.root.getWorldQuaternion(woundQ).invert();
    wound.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),
      cutAxis.clone().applyQuaternion(woundQ));
    neck.attach(wound);
    wound.visible=goreEnabled();
    collapsePose=makeCollapsePose(body.bones);
    body.express("Wince",1);
    detached.position.copy(headPoint);
    detached.updateWorldMatrix(true,false);
    const copy=clone(body.model);
    body.root.add(copy);
    detached.attach(copy);
    copy.traverse(o=>{if(o.userData.nagiPart)o.visible=isHeadPart(o)});
    body.parts.forEach((o,name)=>{if(name==="Head"||name==="Hair")o.visible=false});
    bodyFace.visible=false;
    detached.visible=true;
    velocity.copy(direction).multiplyScalar(reduced?1.1:2.05);
    velocity.y=reduced?1.45:2.25;
    fallDir.set(-Math.sin(frozenYaw),0,-Math.cos(frozenYaw));
    soulDrift.copy(fallDir).addScaledVector(direction,-.88).setY(0).normalize();
    ghost.root.position.copy(deathSpot);
    ghost.root.rotation.y=frozenYaw;
    return {
      point:wound.getWorldPosition(new THREE.Vector3()),
      getPoint:()=>group.visible?wound.getWorldPosition(bleedPoint):null,
      getDirection:()=>bleedDirection.set(0,1,0).applyQuaternion(wound.getWorldQuaternion(woundQ))
    };
  }

  function grabByHollower(attacker){
    if(life!=="live")return false;
    life="held";strangler=attacker;age=0;chat=0;alert=false;activeLine=null;playerKilled=true;
    deathSpot.copy(body.root.position);
    return true;
  }
  function offerSunrise(){
    if(life!=="live"||sunriseWait>0)return false;
    sunriseWait=2.35;chat=0;activeLine=null;
    return true;
  }
  function aimGrabJoint(bone,child,from,to,weight){
    bone.parent.getWorldQuaternion(parentQ).invert();
    armAim.subVectors(to,from).normalize().applyQuaternion(parentQ);
    grabWrist.setFromUnitVectors(child.position.clone().normalize(),armAim);
    bone.quaternion.slerp(grabWrist,weight);
    bone.updateWorldMatrix(false,true);
  }
  function stopComfort(){
    if(!comfort)return;
    if(comfort.gripped)comfort.head.userData.held=false;
    body.root.position.y=0;body.root.rotation.x=body.root.rotation.z=0;
    if(comfort.rest)for(const [bone,q] of comfort.rest)bone.quaternion.copy(q);
    comfort=null;
  }
  function comfortHead(head,dt,route,walk,mature){
    if(comfort&&comfort.head!==head)stopComfort();
    if(!head){return null}
    if(!comfort)comfort={head,t:0,rest:null,gripped:false,point:new THREE.Vector3()};
    const c=comfort,p=body.root.position;
    if(!c.gripped)head.getWorldPosition(c.point);
    if(!c.rest&&distance(p,c.point)>.63){
      const approach=Math.atan2(p.x-c.point.x,p.z-c.point.z);
      let goal=null;
      for(const offset of [0,-.85,.85,-1.65,1.65,Math.PI]){
        const a=approach+offset;
        goal=route(p,{x:c.point.x+Math.sin(a)*.52,z:c.point.z+Math.cos(a)*.52});
        if(goal)break;
      }
      if(!goal)return null;
      body.face(goal,dt,5);
      const dx=goal.x-p.x,dz=goal.z-p.z,len=Math.hypot(dx,dz)||1;
      walk(p,.92*dt*dx/len,.92*dt*dz/len);
      body.animate("Walk",dt,{speed:.92,still:reduced,expression:"Uneasy"});
      return null;
    }
    if(!c.rest){
      body.face(c.point,1,7);body.animate("Idle",0,{still:true});
      c.rest=[...body.bones.values()].map(b=>[b,b.quaternion.clone()]);
      c.origin=head.getWorldPosition(new THREE.Vector3());c.startRotation=head.getWorldQuaternion(new THREE.Quaternion());
    }
    c.t+=dt;
    const t=c.t,bend=ease((t-.24)/1.02),lift=ease((t-1.65)/1.10),hold=ease((t-2.60)/.58);
    const offset=new THREE.Quaternion(),angles=new THREE.Euler();
    const keyed={Spine:[.43,0,.06],Chest:[.18,0,-.13],Head:[.22,-.14,.14],
      ThighL:[-1.10,.13,-.10],ShinL:[1.24,0,0],ThighR:[-.75,-.15,.13],ShinR:[1.51,0,.05],
      FootR:[-.52,0,0],FootL:[-.31,0,0]};
    for(const [bone,q] of c.rest){
      bone.quaternion.copy(q);
      const values=keyed[bone.name];
      if(values){
        const weight=bone.name==="Head"?bend+.19*hold:bend*(1-.13*lift);
        angles.set(...values.map(x=>x*weight));bone.quaternion.multiply(offset.setFromEuler(angles));
      }
    }
    p.y=-.36*bend+.025*lift;
    body.root.updateWorldMatrix(true,true);
    const sole=Math.min(body.bones.get("FootL").getWorldPosition(shoulderPoint).y,
      body.bones.get("FootR").getWorldPosition(elbowPoint).y)-.058;
    const knee=body.bones.get("ShinR").getWorldPosition(handPoint).y-.038;
    p.y-=cap(Math.min(sole,knee),-.11,.17)*bend;
    body.root.updateWorldMatrix(true,true);
    body.express(hold>.5?"Soothe":"Uneasy",1);
    const chest=body.bones.get("Chest");
    const cradle=chest.localToWorld(new THREE.Vector3(.074,-.07,.24));
    const headCenter=c.origin.clone().lerp(cradle,lift);
    for(const side of ["L","R"]){
      const sign=side==="L"?1:-1;
      const arm=body.bones.get("UpperArm"+side),fore=body.bones.get("Forearm"+side),hand=body.bones.get("Hand"+side);
      arm.getWorldPosition(shoulderPoint);fore.getWorldPosition(elbowPoint);
      pole.set(sign*.094,-.048,side==="L"?.012:-.037).applyQuaternion(body.root.quaternion);
      handPoint.copy(headCenter).add(pole);
      elbowPoint.lerp(handPoint.clone().lerp(shoulderPoint,.5).add(pole.set(sign*.13,-.08,.06).applyQuaternion(body.root.quaternion)),.78);
      const reach=ease((t-.62-(side==="R"?.13:0))/.87);
      aimGrabJoint(arm,fore,shoulderPoint,elbowPoint,reach);
      fore.getWorldPosition(elbowPoint);aimGrabJoint(fore,hand,elbowPoint,handPoint,reach);
    }
    if(t>=1.61&&head.parent){
      c.gripped=true;head.userData.held=true;
      head.position.copy(head.parent.worldToLocal(headCenter));
      head.parent.getWorldQuaternion(parentQ).invert();
      const turn=body.root.getWorldQuaternion(new THREE.Quaternion())
        .multiply(offset.setFromEuler(angles.set(-.24,Math.PI,-.15)));
      head.quaternion.copy(parentQ).multiply(c.startRotation.clone().slerp(turn,lift));
    }
    return t>2.36&&t<6.4?{p,y:1.65,text:language(comfortLines[mature&&sunrisePromised?1:0])}:null;
  }
  function struggle(dt){
    age+=dt;
    body.face(strangler,dt,8);
    body.animate("Idle",dt,{still:true,expression:age<.55?"Startled":"Wince"});
    const brace=ease(age/.52),slump=ease((age-1.73)/.62);
    const motion=(reduced?0:.12)*Math.sin(age*13)*brace*(1-slump);
    body.root.rotation.x=-.17*brace+.28*slump+motion;
    body.root.rotation.z=.13*brace-.18*slump;
    body.root.updateWorldMatrix(true,true);
    body.bones.get("Neck").getWorldPosition(gripNeck);
    for(const side of ["L","R"]){
      const sign=side==="L"?1:-1;
      const arm=body.bones.get("UpperArm"+side),fore=body.bones.get("Forearm"+side),hand=body.bones.get("Hand"+side);
      if(!arm||!fore||!hand)continue;
      arm.getWorldPosition(shoulderPoint);fore.getWorldPosition(elbowPoint);
      pole.set(sign*.13,-.20,.22).applyQuaternion(body.root.quaternion);
      elbowPoint.lerp(gripNeck.clone().add(pole),.71);
      handPoint.copy(gripNeck).add(pole.set(sign*.079,-.078,.081).applyQuaternion(body.root.quaternion));
      const grip=ease((age-(sign<0?.15:0))/.51)*(1-slump)*.82;
      aimGrabJoint(arm,fore,shoulderPoint,elbowPoint,grip);
      fore.getWorldPosition(elbowPoint);
      aimGrabJoint(fore,hand,elbowPoint,handPoint,grip);
    }
    if(age<2.23)return;
    life="fallen";age=0;headStopped=true;strangler=null;
    frozenYaw=body.root.rotation.y;collapsePose=makeCollapsePose(body.bones);
    fallDir.set(-Math.sin(frozenYaw),0,-Math.cos(frozenYaw));
    soulDrift.copy(fallDir);ghost.root.position.copy(deathSpot);ghost.root.rotation.y=frozenYaw;
  }

  function fall(dt){
    const p=body.root.position;
    const recoil=ease(age/.16),drop=ease((age-.12)/.67);
    const settle=Math.exp(-Math.max(0,age-.80)*8)*Math.sin(Math.max(0,age-.80)*19);
    const impact=age>.80?settle*(reduced ? .02 : .071):0;
    body.root.rotation.set(-.15*recoil-1.32*drop+impact,frozenYaw,.19*drop,"YXZ");
    p.copy(deathSpot).addScaledVector(fallDir,.08*recoil+.22*drop);
    p.y=floorY+.10*drop+Math.abs(impact)*.35;
    collapsePose(age,reduced);
    if(wound)wound.visible=goreEnabled();
    if(!headStopped){
      velocity.y-=dt*9.4;
      detached.position.addScaledVector(velocity,dt);
      detached.rotateX(dt*(reduced?2.2:6.6));
      detached.rotateZ(dt*(reduced?1.2:4.3));
      if(detached.position.y<.115){
        detached.position.y=.115;
        if(!landed){landed=true;velocity.y=Math.max(0,-velocity.y*.16);velocity.x*=.41;velocity.z*=.41}
        else{velocity.y=0;velocity.x*=Math.exp(-dt*14);velocity.z*=Math.exp(-dt*14)}
        if(velocity.lengthSq()<.024)headStopped=true;
      }
    }
  }

  function step(dt,player,{quiet=false,threat=null,heading=0,head=null,route,walk,mature=false}={}){
    time+=dt;
    if(life==="held"){struggle(dt);return null}
    if(life==="live"){
      if(head&&!quiet&&!threat)return comfortHead(head,dt,route,walk,mature);
      stopComfort();
      if(quiet){
        sunriseWait=0;
        speed=0;chat=0;alert=false;activeLine=null;
        body.animate("Idle",dt,{still:reduced});
        return null;
      }
      const p=body.root.position,d=distance(player,p);
      const approaching=threat&&distance(threat,p)<4.5;
      if(sunriseWait>0){
        if(approaching||d>3.7)sunriseWait=0;
        else{
          sunriseWait=Math.max(0,sunriseWait-dt);
          if(sunriseWait>0){
            body.face(player,dt);body.animate("Idle",dt,{still:reduced,expression:"Smirk"});return null;
          }
          activeLine=sunrise;expression="Smirk";chat=3.65;cooldown=8;sunrisePromised=true;
        }
      }
      if(!threat)alert=false;
      if(approaching){
        body.face(threat,dt,5.5);speed=0;
        if(alert)chat=Math.max(0,chat-dt);else chat=0;
        body.animate(alert?"Talk":"Idle",dt,{
          still:reduced,expression:alert?"Startled":"Uneasy"
        });
      }else{
        chat=Math.max(0,chat-dt);cooldown=Math.max(0,cooldown-dt);
        if(!chat&&cooldown===0&&d<2.65){
          const index=line++%livingLines.length;
          activeLine=livingLines[index];expression=livingExpressions[index];
          chat=2.8;cooldown=6.3;
        }
        if(chat&&d<3.7){body.face(player,dt);speed=0}
        else if(d>=1.45){
          waypoint.set(patrol[cursor][0],0,patrol[cursor][1]);
          if(distance(waypoint,p)<.12)cursor=(cursor+1)%patrol.length;
          speed=Math.min(.95,speed+dt*1.76);body.face(waypoint,dt,3.2);
          const align=1-Math.min(1,Math.abs(turnDelta(body.root.rotation.y,
            Math.atan2(waypoint.x-p.x,waypoint.z-p.z)))/1.35);
          p.x+=Math.sin(body.root.rotation.y)*speed*dt*align;
          p.z+=Math.cos(body.root.rotation.y)*speed*dt*align;
        }else speed=0;
        const speaking=chat>0&&d<3.7;
        body.animate(speaking?"Talk":speed>.075?"Walk":"Idle",dt,{
          speed,still:reduced,expression:speaking?expression:undefined
        });
      }
      return chat&&d<7&&activeLine?{p,y:1.94,text:language(activeLine)}:null;
    }
    age+=dt;fall(dt);
    if(!remainsReady&&age>2.55&&(!wound||headStopped||age>5)){
      if(wound){headStopped=true;remainsAt.copy(detached.position)}
      else remainsAt.copy(deathSpot).setY(.15);
      remainsReady=true;
    }
    const physical=wound&&goreEnabled();
    detached.visible=!!physical&&!carried;
    token.visible=remainsReady&&!physical&&!carried;
    if(token.visible){token.position.copy(remainsAt);token.position.y=.16+.035*Math.sin(time*2.4);token.rotation.y=time*.8}
    if(age>2.55){
      if(!ghost.root.visible){
        chat=3.35;activeLine=soulLines[0];expression=soulExpressions[0];cooldown=7.5;line=1;
      }
      const p=ghost.root.position,u=ease((age-2.55)/1.45),alpha=ease((age-2.55)/.70);
      ghost.root.visible=true;
      if(!quiet){
        if(carried)followGoal.set(player.x-.78*Math.cos(heading)+.72*Math.sin(heading),player.y-1.29,
          player.z+.78*Math.sin(heading)+.72*Math.cos(heading));
        else if(remainsReady)followGoal.copy(remainsAt).addScaledVector(soulDrift,.89).setY(.34);
        else followGoal.copy(deathSpot).addScaledVector(soulDrift,1.12*u).setY(.34*u);
        if(carried&&distance(p,followGoal)>13)p.copy(followGoal);
        else p.lerp(followGoal,1-Math.exp(-dt*(carried?3.1:5)));
      }
      if(!reduced)p.y+=(Math.sin(time*2.05)*.033)*dt;
      ghostMats.forEach(m=>m.opacity=.57*alpha);sparkle.intensity=.62*alpha;
      ghostFace.material.opacity=.76*alpha;
      ghost.face(player,dt,2.8);
      if(quiet||threat&&threat!==player){
        ghost.animate("Idle",dt,{still:reduced,expression:"Relieved"});
        return null;
      }
      chat=Math.max(0,chat-dt);cooldown=Math.max(0,cooldown-dt);
      const d=distance(player,p);
      if(talkOnFollow){
        talkOnFollow=false;activeLine=carryLines[playerKilled?0:1];expression=playerKilled?"Uneasy":"Relieved";
        chat=3.7;cooldown=7.5;
      }
      if(!chat&&cooldown===0&&d<2.8){
        const index=line++%soulLines.length;
        activeLine=carried&&index===0?carryLines[2]:soulLines[index];expression=soulExpressions[index];chat=2.8;cooldown=7.5;
      }
      ghost.animate(chat?"Talk":"Idle",dt,{still:reduced,expression:chat?expression:"Relieved"});
      if(chat&&d<8)return {p,y:1.94,text:language(activeLine)};
    }
    return null;
  }

  return {group,body,ghost,isTarget,prepare,strike,step,grabByHollower,offerSunrise,inspect,
    whiteThing(origin,heading){
      const actor=makeActor(clone(whiteThingModel),gltf.animations);
      const layers=fitNagiAnatomy(actor);
      let skin;
      actor.parts.get("Head").traverse(o=>{if(o.isMesh&&o.material.name==="Warm porcelain")skin=o});
      const face=attachNagiFace(actor,skin,faceAtlas);
      const soul=makeActor(clone(whiteThingModel),gltf.animations);
      return makeNagiWhiteThing({actor,layers,face,soul,origin,heading,reduced});
    },
    garment(name,visible){if(!garments.includes(name))return;if(visible)offClothes.delete(name);else offClothes.add(name)},
    get carried(){return carried},
    get remains(){return remainsReady&&!carried?remainsAt:null},
    collect(){if(!remainsReady||carried)return false;carried=true;token.visible=false;detached.visible=false;talkOnFollow=true;return true},
    setDown(position){
      if(!carried)return false;
      carried=false;remainsAt.copy(position).setY(.140);detached.position.copy(remainsAt);
      detached.rotation.set(.09,0,.40);chat=0;return true;
    },
    neckPoint(out){return body.bones.get("Neck").getWorldPosition(out)},
    get isAlive(){return life==="live"},
    dispose(){group.removeFromParent();body.mixer.stopAllAction();ghost.mixer.stopAllAction();
      const sets={geometry:new Set(),material:new Set()};
      group.traverse(o=>{if(o.geometry)sets.geometry.add(o.geometry);
        if(o.material)for(const m of [].concat(o.material))sets.material.add(m)});
      sets.geometry.forEach(g=>g.dispose());sets.material.forEach(m=>{m.map?.dispose();m.dispose()});faceAtlas.texture.dispose();
    }};
}
