import {buildHollowerRig} from './hollower-rig.mjs';

// "The Hollower feeds": the tall shade cuts the crown of her skull and lifts it off,
// the crawler eats her brain and then her eyes, and leaves an emptied, opened skull.
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const ease=(t,a,b)=>smooth((t-a)/(b-a));
function sample(keys,t){
  const i=keys.findIndex(key=>key[0]>t);
  if(i<=0)return keys[i===0?0:keys.length-1].slice(1);
  const a=keys[i-1],b=keys[i],u=ease(t,a[0],b[0]);
  return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);
}

const CUT={y:.150,slope:-.16,rx:.122,rz:.135};   // the saw line, in head bind space: y = CUT.y + CUT.slope*z
export const FEED={cut:[4.55,6.35],lift:[6.55,7.35],feed:[7.7,12.6],death:11.2,eyes:[12.9,14.4],lift2:16.6,duration:20.0};
const cues=[
  [1.26,'drop'],[2.08,'land'],[3.1,'struggle'],[4.55,'saw'],[5.4,'saw'],[6.2,'saw'],[6.7,'lift'],[7.9,'capLand'],
  [8.05,'bite'],[8.7,'bite'],[9.3,'bite'],[9.95,'bite'],[10.6,'bite'],[11.3,'bite'],[12.0,'bite'],
  [FEED.death,'die'],[13.15,'eye'],[14.0,'eye'],[FEED.lift2,'take'],[17.9,'line']
];
// Stage-local root: the fall copies the original Hollower so the two deaths share their opening.
const rootKeys=[
  [0,0,0,0,0,.08,0],[.84,-.026,.002,.035,.11,-.32,-.12],
  [1.29,.035,-.053,.15,-.29,-.21,.21],[1.57,.06,-.17,.38,-.74,.11,.22],
  [1.92,.05,.069,.82,-1.38,.10,.06],[2.10,.05,.112,.88,-1.54,.08,.018],
  [2.30,.05,.128,.89,-1.49,.08,.093],[2.70,.05,.115,.89,-1.53,.08,.05],
  [3.25,.07,.135,.90,-1.47,.10,.13],[3.70,.03,.120,.89,-1.53,.06,-.06],[4.30,.05,.118,.89,-1.52,.08,.03],
  [7.45,.05,.118,.89,-1.52,.08,.03],[7.75,.06,.140,.90,-1.46,.09,.10],[8.25,.05,.118,.89,-1.53,.08,-.02],
  [9.40,.055,.126,.89,-1.50,.08,.07],[10.2,.05,.118,.89,-1.53,.08,.0],[11.2,.05,.112,.89,-1.54,.08,.02]
];
const joints={
  head:[[0,0,0,0],[1.04,-.32,-.46,-.14],[1.45,.10,-.31,.18],[2.14,.15,.18,-.23],
    [2.9,-.12,-.42,-.10],[3.5,.20,.36,-.12],[4.1,-.05,-.05,-.04],[4.45,-.14,0,0],
    [7.3,-.14,0,0],[7.7,.10,.20,.10],[8.3,-.05,-.22,-.04],[9.3,.06,.14,.06],[10.4,-.02,-.06,0],[11.3,-.10,.05,.04]],
  chest:[[0,0,0,0],[1.38,.18,-.13,-.12],[2.14,.02,.05,0],[3.2,.12,.10,-.07],[4.4,0,0,0],
    [7.7,.10,-.06,.05],[8.4,-.03,.05,-.03],[9.5,.06,-.03,.02],[11.2,0,0,0]],
  thigh_L:[[0,-.08,0,.035],[1.45,-.55,.10,.13],[2.15,-.32,0,.055],[3.1,-.62,.05,.10],[3.6,-.20,0,.06],
    [4.6,-.40,0,.08],[7.6,-.38,0,.08],[8.0,-.75,.08,.14],[8.5,-.30,0,.06],[9.2,-.58,.04,.10],[9.9,-.25,0,.06],
    [10.6,-.38,0,.07],[11.4,-.06,0,.08]],
  shin_L:[[0,.13,0,0],[1.52,1.07,0,0],[2.19,.48,0,0],[3.1,1.0,0,0],[3.6,.35,0,0],[4.6,.70,0,0],[7.6,.68,0,0],
    [8.0,1.15,0,0],[8.5,.45,0,0],[9.2,.95,0,0],[9.9,.40,0,0],[10.6,.55,0,0],[11.5,.12,0,0]],
  thigh_R:[[0,-.07,0,-.04],[1.52,-.27,-.11,-.11],[2.14,-.07,.04,-.057],[3.4,-.45,0,-.10],[3.9,-.10,0,-.06],
    [7.6,-.12,0,-.08],[8.2,-.50,0,-.12],[8.8,-.10,0,-.06],[9.6,-.42,0,-.10],[10.3,-.12,0,-.07],[11.5,-.03,.02,-.11]],
  shin_R:[[0,.08,0,0],[1.57,.63,0,0],[2.21,.19,0,0],[3.4,.85,0,0],[3.9,.22,0,0],[7.6,.25,0,0],
    [8.2,.90,0,0],[8.8,.25,0,0],[9.6,.75,0,0],[10.3,.20,0,0],[11.5,.07,0,0]]
};
// Her hands, relative to the crown mark: shoving at the crawler, then clawing at the jaws in her head.
const palms=[
  [[1.4,.10,.30,.60],[2.2,.05,.22,.42],[3.0,-.12,.30,.30],[3.6,-.05,.25,.36],[4.4,.02,.18,.38],[6.4,.04,.20,.38],
   [7.6,-.15,.08,.02],[8.3,-.17,.12,-.02],[9.0,-.14,.07,.04],[9.8,-.18,.11,-.01],[10.7,-.16,.05,.06],[11.3,-.22,.02,.16]],
  [[1.4,.40,.30,.55],[2.2,.30,.20,.42],[3.0,.22,.30,.30],[3.6,.30,.22,.34],[4.4,.30,.18,.40],[6.4,.28,.16,.40],
   [7.6,.15,.08,.02],[8.3,.17,.12,-.02],[9.0,.14,.07,.04],[9.8,.18,.11,-.01],[10.7,.16,.05,.06],[11.3,.24,.02,.16]]
];

export function playHollowerFeed(T, site, o){
  const stage=new T.Group();stage.name="Hollower feeding";stage.position.set(site.x,site.y,site.z);o.scene.add(stage);
  const rig=buildHollowerRig(T,stage);
  const {materials,geometries,mat,mesh,segments,lay,V,hunter,head,shade,legs,fore,shadowLegs,shadowArms}=rig;
  const red=mat(0x642335,0x200708), wet=mat(0x5c0f1c,0x1a0205);
  const neck=segments(hunter,[.06,.045]);
  const body=o.makeActor("solid"),soul=o.makeActor("ghost");stage.add(body,soul);
  o.bind(body);body.updateMatrixWorld(true);

  // ---- the head: bind-space helpers ----
  const skin=body.userData.mesh, bone=body.userData.bones.head, original=skin.geometry, source=original.attributes.position;
  const rest=skin.worldToLocal(bone.getWorldPosition(new T.Vector3()));
  const headIndex=skin.skeleton.bones.indexOf(bone);
  const bindToBone=skin.skeleton.boneInverses[headIndex].clone().multiply(skin.bindMatrix);
  const {skinIndex,skinWeight}=original.attributes;
  const headWeight=i=>{let w=0;for(let j=0;j<4;j++)if(skinIndex.getComponent(i,j)===headIndex)w+=skinWeight.getComponent(i,j);return w};
  const above=(x,y,z)=>y-rest.y>CUT.y+CUT.slope*(z-rest.z);
  // The face is a flat atlas on the head shell: find the shell's front surface for marks drawn on it.
  const front=[];
  for(let i=0;i<source.count;i++)if(headWeight(i)>.5)front.push([source.getX(i)-rest.x,source.getY(i)-rest.y,source.getZ(i)-rest.z]);
  const surface=(x,y)=>{let best=-1;for(const p of front)if(Math.abs(p[0]-x)<.012&&Math.abs(p[1]-y)<.012)best=Math.max(best,p[2]);return best<0?.1:best};

  const geometry=new T.BufferGeometry();
  for(const [key,value] of Object.entries(original.attributes))geometry.setAttribute(key,value);
  geometry.setAttribute('feedBind',source);
  geometry.setIndex(original.index);
  for(const {start,count,materialIndex} of original.groups)geometry.addGroup(start,count,materialIndex);
  skin.geometry=geometry;
  const seam={value:0},open={value:0};
  function decorate(material,cap){
    const compile=material.onBeforeCompile, key=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{
      compile?.call(material,shader,renderer);
      shader.uniforms.feedSeam=seam;shader.uniforms.feedOpen=open;
      shader.vertexShader='attribute vec3 feedBind;\nvarying vec3 vFeed;\n'+
        shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFeed = feedBind;');
      shader.fragmentShader=`varying vec3 vFeed;
        uniform float feedSeam;
        uniform float feedOpen;
      `+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec3 h = vFeed - vec3(${rest.x.toFixed(6)},${rest.y.toFixed(6)},${rest.z.toFixed(6)});
        float d = h.y - (${CUT.y.toFixed(4)} + ${CUT.slope.toFixed(4)}*h.z);
        bool head = h.y > -.02 && length(h.xz) < .2;
        ${cap?`if(d < 0. || !head) discard;
        if(!gl_FrontFacing) diffuseColor.rgb = d < .012 ? vec3(.86,.80,.66) : vec3(.30,.045,.06);`:`
        if(feedOpen > 0. && head && d > 0.) discard;
        if(!gl_FrontFacing) {
          if(feedOpen <= 0. || !head) discard;
          diffuseColor.rgb = d > -.010 ? vec3(.86,.80,.66) : vec3(.30,.045,.06);
        }`}
        // The saw line runs once round the head, starting at the brow.
        float travel = mod(atan(h.x, h.z)/6.2832 + 1., 1.);
        if(head && feedSeam > 0. && travel < feedSeam && abs(d) < .0045) diffuseColor.rgb = mix(vec3(.55,.06,.07),vec3(.30,.03,.04),step(.0025,abs(d)));
      `);
    };
    material.side=T.DoubleSide;
    material.customProgramCacheKey=()=>key+'/hollower-feed/'+(cap?'cap':'body');
  }
  const worn=skin.material;
  const twin=m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;return c};
  const cut=worn.map(twin);cut.forEach(m=>decorate(m,false));
  const lid=worn.map(twin);lid.forEach(m=>decorate(m,true));
  let gore=null;
  const wear=on=>{skin.material=on?cut:worn};

  // The cap is the part of the shell above the saw line, as a rigid piece in head space.
  const capGeometry=new T.BufferGeometry(),capIndex=[],index=original.index;
  for(const [key,value] of Object.entries(original.attributes))if(key==='position'||key==='normal'||key==='uv'||key==='color')capGeometry.setAttribute(key,value);
  capGeometry.setAttribute('feedBind',source);
  for(const {start,count,materialIndex} of original.groups){
    const offset=capIndex.length;
    for(let i=start;i<start+count;i+=3){
      const t=[index.getX(i),index.getX(i+1),index.getX(i+2)];
      if(t.every(v=>headWeight(v)>.3)&&t.some(v=>above(source.getX(v),source.getY(v),source.getZ(v))))capIndex.push(...t);
    }
    capGeometry.addGroup(offset,capIndex.length-offset,materialIndex);
  }
  capGeometry.setIndex(capIndex);
  const cap=new T.Mesh(capGeometry,lid);cap.matrixAutoUpdate=false;
  const capRoot=new T.Group();capRoot.add(cap);stage.add(capRoot);

  // Everything inside the head lives in bind space under the head bone.
  const inside=new T.Group();inside.matrixAutoUpdate=false;inside.matrix.copy(bindToBone);bone.add(inside);
  const at=(x,y,z)=>V(rest.x+x,rest.y+y,rest.z+z);
  const brainMat=new T.MeshLambertMaterial({color:0xc98e93,emissive:0x2a0c10,flatShading:true});
  const brainGeo=new T.IcosahedronGeometry(1,2);
  {
    const p=brainGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),fold=1+.09*Math.sin(x*19+z*7)*Math.sin(y*15+x*5)+.05*Math.sin(z*23);
      p.setXYZ(i,x*fold,y*fold,z*fold);
    }
    brainGeo.computeVertexNormals();
  }
  const lobes=[];
  for(let i=0;i<12;i++){
    const side=i%2?1:-1,row=Math.floor(i/2);
    const lobe=new T.Mesh(brainGeo,brainMat);
    lobe.position.copy(at(side*.040,.150-.010*(row%3)-.012*Math.floor(row/3),.085-.034*row));
    lobe.scale.set(.044,.036,.042);
    lobe.userData.size=lobe.scale.clone();
    // Front to back, a bite at a time.
    lobe.userData.eaten=8.05+i*.36+.08*(i%3);
    inside.add(lobe);lobes.push(lobe);
  }
  const fissure=new T.Mesh(new T.BoxGeometry(.004,.03,.20),wet);fissure.position.copy(at(0,.165,-.02));inside.add(fissure);
  const pit=new T.Mesh(new T.SphereGeometry(1,12,8,0,Math.PI*2,Math.PI/2,Math.PI/2),
    new T.MeshLambertMaterial({color:0x3a0710,emissive:0x120104,side:T.DoubleSide}));
  pit.position.copy(at(0,.155,-.010));pit.scale.set(.105,.11,.125);inside.add(pit);
  // Nosebleed: two streams from the nostrils that run down her cheeks as she lies on her back.
  const streams=[-1,1].map(s=>{
    const pts=[[.008,.036],[.010,.024],[.015,.010],[.021,-.008],[.030,-.030]].map(([x,y],k)=>at(s*x,y,surface(s*x,y)+.004-.004*k));
    const g=new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.0036,5,false);
    const m=new T.Mesh(g,wet);inside.add(m);return m;
  });
  const lip=new T.Mesh(new T.SphereGeometry(1,8,6),wet);lip.position.copy(at(0,.030,surface(0,.03)+.002));lip.scale.set(.016,.006,.004);inside.add(lip);

  const pool=mesh(new T.CircleGeometry(.30,21),red,stage,.05,.009,-.62);pool.rotation.x=-Math.PI/2;
  const light=new T.PointLight(0xa9ddd2,7,4);light.position.set(.2,1.6,-.6);stage.add(light);
  const fill=new T.PointLight(0xf0a798,2,3);fill.position.set(.65,.9,.2);stage.add(fill);

  // ---- her ----
  const crown=o.crown(),headMark=V(0,0,0),cutMark=V(0,0,0),capWorld=new T.Matrix4(),stageInverse=new T.Matrix4();
  const shoulder=V(0,0,0),wrist=V(0,0,0),elbow=V(0,0,0),bendAxis=V(0,0,0),direction=V(0,0,0);
  const parentRotation=new T.Quaternion(),desired=new T.Quaternion();
  function aimBone(b,child,from,to,mix){
    b.parent.getWorldQuaternion(parentRotation).invert();
    direction.copy(to).sub(from).normalize().applyQuaternion(parentRotation);
    desired.setFromUnitVectors(child.position.clone().normalize(),direction);
    b.quaternion.slerp(desired,mix);b.updateMatrixWorld(true);
  }
  function reachArm(bones,side,palm,weight){
    if(weight<=0)return;
    const upper=bones['upperarm_'+side],lower=bones['forearm_'+side],hand=bones['hand_'+side];
    upper.getWorldPosition(shoulder);wrist.copy(palm).add(stage.position);
    const a=lower.position.length(),b=hand.position.length();
    const length=Math.min(a+b-.001,Math.max(.06,shoulder.distanceTo(wrist)));
    const axis=wrist.clone().sub(shoulder).normalize(),along=(a*a+length*length-b*b)/(2*length),sign=side==='L'?1:-1;
    bendAxis.set(sign*.76,-.62,.22).addScaledVector(axis,-bendAxis.dot(axis)).normalize();
    elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bendAxis,Math.sqrt(Math.max(0,a*a-along*along)));
    wrist.copy(shoulder).addScaledVector(axis,length);
    aimBone(upper,lower,shoulder,elbow,weight);aimBone(lower,hand,elbow,wrist,weight);
  }
  const ringPoint=(a,out)=>{ // a=0 at the brow, 1 at the back, 2 back at the brow
    const z=CUT.rz*Math.cos(Math.PI*a),x=CUT.rx*Math.sin(Math.PI*a);
    return out.copy(at(x,CUT.y+CUT.slope*z+.006,z)).applyMatrix4(bindToBone);
  };
  let clock=0,gored=false;
  function bodyPose(t){
    o.bind(body);
    const b=body.userData.bones;
    const [x,y,z,rx,ry,rz]=sample(rootKeys,t);
    body.position.set(x,y,z);body.rotation.set(rx,ry,rz);
    for(const [name,keys] of Object.entries(joints))b[name].rotation.fromArray(sample(keys,t));
    // Seizure: small fast shudders once the feeding starts, fading out after death.
    const shake=ease(t,7.7,8.1)*(1-ease(t,FEED.death-.4,FEED.death+1.2));
    b.head.rotation.x+=.05*shake*Math.sin(t*31);b.chest.rotation.z+=.03*shake*Math.sin(t*23);
    const twitch=ease(t,FEED.death,FEED.death+.2)*(1-ease(t,FEED.death+.9,FEED.death+2.6));
    b.thigh_L.rotation.x+=.10*twitch*Math.sin(t*17);b.forearm_R.rotation.z+=.25*twitch*Math.sin(t*13);
    const panic=ease(t,.45,1.22)*(1-ease(t,1.39,2));
    const limp=ease(t,FEED.death+.2,FEED.death+1.6);
    b.upperarm_L.rotation.set(-.23*panic,-.25*panic,-1.37+.80*panic+.42*limp);
    b.upperarm_R.rotation.set(.10*panic,.21*panic,1.36-.62*panic-.42*limp);
    b.forearm_L.rotation.y=.19+.76*panic;b.forearm_R.rotation.y=-.16-.58*panic;
    const face=t<.86?"dread":t<4.4?"panic":t<FEED.cut[1]?"bracing":t<9.6?"panic":t<FEED.death?"rolledEyes":
      !gored?"deathRest":t<13.2?"vacant":t<14.05?"lostEye":"eyeless";
    body.userData.face(face);
    body.updateMatrixWorld(true);
    headMark.copy(crown);bone.localToWorld(headMark).sub(stage.position);
    const reach=ease(t,1.35,1.96)*(1-limp);
    for(const [i,side] of [[0,'R'],[1,'L']])reachArm(b,side,headMark.clone().add(V(...sample(palms[i],t))),reach);
    body.updateMatrixWorld(true);
    headMark.copy(crown);bone.localToWorld(headMark).sub(stage.position);
    ringPoint(2*ease(t,FEED.cut[0],FEED.cut[1]),cutMark);bone.localToWorld(cutMark).sub(stage.position);
  }

  // ---- the crawler ----
  const lowKeys=[ // x,y,z,turn
    [0,-.05,1.96,-1.03,0],[.95,-.05,1.94,-1.01,0],[1.31,-.13,.32,-.37,0],[1.62,-.32,.146,-.40,0],
    [2.22,-.38,.101,-.59,0],[3.0,-.52,.12,-.80,.5],[3.9,-.10,.13,-1.20,0],[FEED.lift[1],-.02,.13,-1.22,0],
    [FEED.feed[0],.03,.14,-1.12,0],[FEED.eyes[0],.03,.15,-1.08,0],[FEED.eyes[1],.03,.16,-1.00,0],
    [15.2,.03,.14,-1.15,0],[16.6,-.45,.12,-1.75,-.6],[17.8,-1.2,.12,-2.6,-.8]
  ];
  const mouthTarget=V(0,0,0),jaw=V(0,0,0),claw=V(0,0,0),lick=V(0,0,0);
  const tongue=segments(hunter,[.020,.017,.013,.009]);tongue.forEach(m=>m.material=wet);
  function lowPerformance(t){
    const [x,y,z,turn]=sample(lowKeys,t);
    hunter.position.set(x,y,z);hunter.rotation.y=turn;hunter.updateMatrixWorld(true);
    // Head: hovers above and behind her crown; a feeding tongue does the eating, a lobe at a time, then the eyes.
    const into=ease(t,FEED.feed[0]-.4,FEED.feed[0]+.2)*(1-ease(t,FEED.eyes[0]-.3,FEED.eyes[0]));
    const eyes=ease(t,FEED.eyes[0]-.3,FEED.eyes[0])*(1-ease(t,FEED.eyes[1],FEED.eyes[1]+.5));
    const feeding=Math.max(into,eyes),bite=Math.max(0,Math.sin(t*9.6))*feeding;
    const next=lobes.find(l=>l.userData.eaten+.3>t)||lobes[lobes.length-1];
    next.getWorldPosition(lick).sub(stage.position);
    if(eyes>0){
      const eyeSide=t<13.6?1:-1;   // her left eye, then her right
      jaw.copy(at(eyeSide*.067,.075,.11)).applyMatrix4(bindToBone);bone.localToWorld(jaw).sub(stage.position);
      lick.lerp(jaw,eyes);
    }
    lick.y+=.035*bite;
    mouthTarget.copy(headMark).add(V(0,.26-.06*eyes,-.20+.16*eyes));
    const rest=V(0,.16+.04*Math.sin(t*2.1),.20);
    head.rotation.set(.25+.55*feeding-.18*bite,.12*Math.sin(t*1.7)*(1-feeding),.10*Math.sin(t*3.1)*into);
    const target=hunter.worldToLocal(mouthTarget.clone().add(stage.position));
    const lean=ease(t,3.4,4.2)*(1-ease(t,15.2,15.9));
    head.position.copy(rest).lerp(target,feeding*.97+.35*lean*(1-feeding));
    head.updateMatrixWorld(true);
    const mouth=hunter.worldToLocal(head.localToWorld(V(0,-.11,.17)));
    const tip=hunter.worldToLocal(lick.clone().add(stage.position)),reach=ease(feeding,.25,1);
    tip.lerp(mouth,1-reach);
    tongue.forEach(m=>m.visible=reach>.01&&o.gore());
    lay(tongue,[mouth,mouth.clone().lerp(tip,.35).add(V(0,.07*reach,0)),mouth.clone().lerp(tip,.7).add(V(0,.04*reach,0)),
      mouth.clone().lerp(tip,.92),tip]);
    lay(neck,[V(0,.24,.18),V(0,.22,.18).lerp(head.position,.55).add(V(0,.06,0)),head.position.clone().add(V(0,0,-.10))]);
    for(let i=0;i<6;i++){
      const s=i<3?-1:1,j=i%3,zl=j*.37-.61;
      const step=ease(t,1.67+j*.11,2.12+j*.11), shuffle=ease(t,3.0+j*.15,3.6+j*.15), exit=ease(t,15.6+j*.12,16.4+j*.12);
      const crawl=ease(t,16.0,16.4)*Math.max(0,Math.sin(t*11+j*2.1+(s<0?0:Math.PI)));
      const arc=.16*Math.sin(Math.PI*step)+.10*Math.sin(Math.PI*shuffle)+.12*Math.sin(Math.PI*exit)+.07*crawl;
      const floor=.018-hunter.position.y*ease(t,1,1.37)+arc;
      const footX=s*(.66+.087*j);
      lay(legs[i],[V(s*.22,.22,zl),V(s*(.51+.08*j),.55+.095*Math.sin(step*Math.PI),zl-.14),
        V(footX,floor+.055,zl+.03),V(footX+s*.095,floor,zl+.16)]);
    }
    // Forelegs: on her shoulders as it lands, then planted on the floor either side of her head.
    const pin=ease(t,1.47,2.24)*(1-ease(t,15.1,15.6)),clamp=ease(t,3.2,3.9);
    for(let i=0;i<2;i++){
      const s=i*2-1,b=body.userData.bones[i?'upperarm_L':'upperarm_R'];
      b.getWorldPosition(claw);
      claw.lerp(V(claw.x+s*.16,stage.position.y+.02,claw.z-.06),clamp);
      const tip=V(s*.42,.57,.44).lerp(hunter.worldToLocal(claw.add(V(0,.03,0))),pin);
      lay(fore[i],[V(.25*s,.24,.07),V(.48*s,.51,.17).lerp(V(.52*s,.36,.40),clamp),tip.clone().add(V(s*.047,.063,-.031)),tip]);
    }
  }

  // ---- the tall shade: saws, lifts the cap away, waits, takes the soul ----
  const fingers=[-.034,0,.034].map(offset=>({offset,parts:segments(shade,[.018,.012])}));
  const cutter=segments(shade,[.022,.012]);
  const capHome=V(.62,.018,-.20),capQuat=new T.Quaternion().setFromEuler(new T.Euler(Math.PI*.92,.4,.1));
  const capPos=V(0,0,0),capRot=new T.Quaternion(),capScale=V(1,1,1),hold=V(0,0,0);
  function tallPerformance(t,take){
    shade.position.fromArray(sample([[0,1.33,0,-1.47],[3.0,1.33,0,-1.47],[3.4,1.26,0,-1.09],[4.05,1.03,0,-.62],
      [4.45,.88,0,-.55],[7.6,.88,0,-.55],[8.3,1.12,0,-.45],[14.9,1.12,0,-.45],[FEED.lift2,1.05,0,-.37],[18.2,1.05,0,-.34],[19.4,1.25,0,-1.2]],t));
    shade.rotation.y=-.68;
    const saw=ease(t,FEED.cut[0]-.25,FEED.cut[0])*(1-ease(t,FEED.cut[1],FEED.cut[1]+.3));
    const grip=ease(t,FEED.lift[0]-.25,FEED.lift[0])*(1-ease(t,7.85,8.2));
    const lift=ease(t,FEED.lift[0],FEED.lift[1]),drop=ease(t,7.35,7.9);
    shade.rotation.z=.19*Math.max(saw,grip)*(1-.6*lift);
    const arm=i=>i===0?V(-.44,.61,.15).lerp(V(-.18,1.63,.62),take):V(.40,.55,.13).lerp(V(.03,1.35,.61),take);
    shade.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      const s=i*2-1,stepIn=ease(t,3.1+.38*i,3.75+.42*i),arc=Math.sin(Math.PI*stepIn);
      const exit=ease(t,18.2+.48*i,19.0+.46*i);
      const foot=V(s*.21,.022+.13*arc+.12*Math.sin(Math.PI*exit),.11+.28*stepIn-.15*i-.14*exit);
      lay(shadowLegs[i],[V(.13*s,.95,0),V(.19*s,.45,-.025+.11*stepIn),foot]);
      const hand=arm(i);
      if(i===0){
        const lifted=headMark.clone().add(V(.30*lift,.50*lift,.06*lift)).lerp(capHome.clone().add(V(0,.10,0)),drop);
        hand.lerp(shade.worldToLocal(lifted.add(stage.position)),grip);
        hold.copy(shade.localToWorld(hand.clone())).sub(stage.position);
        for(const {offset,parts} of fingers){
          const p=hand.clone().add(V(offset,.012,-.008));
          lay(parts,[p,p.clone().add(V(offset*.5,-.072,.012)),p.clone().add(V(-offset*.78,-.084,.061*grip))]);
        }
      }else{
        hand.lerp(shade.worldToLocal(cutMark.clone().add(stage.position)).add(V(.038,.074,0)),saw);
        const tip=hand.clone().add(V(-.041,-.058,.012));
        lay(cutter,[hand,tip,tip.clone().add(V(-.011,-.024,-.003))]);
      }
      const elbow=V(s*.38,1.11,.1).lerp(V(s*.25,1.46,.34),take);
      elbow.lerp(hand.clone().add(V(.31,.58,-.16)),i===0?grip*.8:saw*.85);
      lay(shadowArms[i],[V(.25*s,1.87,.01),elbow,hand]);
    }
    // Cap: rides the head until it is lifted, then the hand, then the floor.
    stageInverse.copy(stage.matrixWorld).invert();
    capWorld.copy(stageInverse).multiply(bone.matrixWorld).multiply(bindToBone);
    capWorld.decompose(capPos,capRot,capScale);
    const crownLocal=V(0,0,0);bone.localToWorld(crownLocal.copy(crown));crownLocal.applyMatrix4(stageInverse);
    capRoot.position.copy(capPos).add(hold.clone().sub(crownLocal).multiplyScalar(lift*(1-drop)));
    capRoot.quaternion.copy(capRot).slerp(new T.Quaternion().setFromEuler(new T.Euler(-.9,.3,.2)).premultiply(capRot),lift*(1-drop));
    if(drop>0){
      const floor=capHome.clone().sub(crownLocal.clone().sub(capPos).applyQuaternion(capQuat.clone().multiply(capRot.clone().invert())));
      capRoot.position.lerp(floor,drop);capRoot.position.y+=.10*Math.sin(Math.PI*drop);
      capRoot.quaternion.slerp(capQuat,drop);
    }
    capRoot.scale.copy(capScale);
    return shade.localToWorld(arm(0)).sub(stage.position);
  }

  function showGore(on){
    gored=on;wear(on);
    const t=clock;
    seam.value=on?ease(t,FEED.cut[0],FEED.cut[1]):0;
    open.value=on&&t>=FEED.lift[0]?1:0;
    capRoot.visible=open.value>0;
    inside.visible=on&&t>=FEED.lift[0]-.05;
    for(const lobe of lobes){
      const k=ease(t,lobe.userData.eaten,lobe.userData.eaten+.32);
      lobe.scale.copy(lobe.userData.size).multiplyScalar(1-k);lobe.visible=k<1;
    }
    fissure.visible=t<10.2;
    pit.visible=inside.visible;
    const bleed=ease(t,8.2,12.8);
    streams.forEach(m=>{m.visible=on&&bleed>0;m.geometry.setDrawRange(0,Math.ceil(16*bleed)*5*6)});
    lip.visible=on&&bleed>0;lip.scale.set(.016,.006,.004).multiplyScalar(.4+.6*bleed);
    pool.visible=on&&t>=FEED.lift[0];pool.scale.setScalar(.15+.85*ease(t,FEED.lift[0],13.5));
  }

  let cueIndex=0,ended=false;
  const flatLook=V(0,0,0),point=V(0,0,0),target=V(0,0,0);
  const cameraKeys=[ // camera offset from the crown mark, then the look offset
    [0,1.0,1.5,3.3,0,.9,.6],[1.54,.95,1.4,2.9,0,.6,.9],[2.71,.85,1.2,1.9,0,.15,.8],
    [4.3,-.14,.50,.34,0,-.02,0],[6.4,-.10,.46,.32,0,-.02,0],[7.4,.08,.55,.32,0,-.02,-.03],
    [8.4,.06,.50,.30,0,-.02,-.03],[11.6,.12,.46,.34,0,-.02,0],[12.6,.10,.48,.36,0,-.03,.04],[14.6,.16,.46,.34,0,-.03,.04],
    [15.3,.06,.42,-.02,0,-.02,-.03],[16.0,.10,.48,.04,0,-.02,-.03],[16.9,.4,1.3,1.6,.2,.9,0],[20,.4,1.3,1.6,.2,.9,0]
  ];

  return {
    frame(t){
      clock=t;
      const on=o.gore(),take=ease(t,FEED.lift2,FEED.lift2+1.6);
      bodyPose(t);
      lowPerformance(t);
      const carry=tallPerformance(t,take);
      showGore(on);
      soul.visible=t>FEED.lift2;
      o.bind(soul);
      const b=soul.userData.bones;
      b.upperarm_L.rotation.z=-1.17-.23*take;b.upperarm_R.rotation.z=1.21+.22*take;
      b.head.rotation.set(.14+.15*take,-.44*take,.22*take);
      soul.userData.face(7);
      soul.scale.setScalar(.87-.47*take);
      soul.rotation.set(-1.54*(1-take),-.18*take,.13*take);
      soul.position.copy(body.position).lerp(carry.add(V(-.018,-.54,.045)),take);
      while(cueIndex<cues.length&&t>=cues[cueIndex][0]){
        const cue=cues[cueIndex++][1];
        if(cue==='die')o.die();else o.cue(cue);
      }
      o.target.copy(stage.position).add(headMark);
      if(t>=FEED.duration&&!ended){ended=true;o.end()}
    },
    camera(t){
      const k=sample(cameraKeys,t),handoff=ease(t,FEED.duration-.7,FEED.duration);
      target.copy(stage.position).add(headMark);
      flatLook.copy(target).add(point.set(k[3],k[4],k[5]));
      o.camera.position.copy(target).add(point.set(k[0],k[1],k[2])).lerp(o.handoff,handoff);
      flatLook.lerp(o.target,handoff);
      o.camera.lookAt(flatLook);
    },
    showGore(on){if(on!==gored)showGore(on)},
    cleanup(){
      skin.geometry=original;skin.material=worn;
      inside.removeFromParent();stage.removeFromParent();
      geometry.dispose();capGeometry.dispose();brainGeo.dispose();brainMat.dispose();
      pit.geometry.dispose();pit.material.dispose();fissure.geometry.dispose();lip.geometry.dispose();
      streams.forEach(m=>m.geometry.dispose());[...cut,...lid].forEach(m=>m.dispose());
      materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());o.disposeActors();
    }
  };
}
