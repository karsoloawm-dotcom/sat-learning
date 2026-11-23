import * as T from "three";
import {garments} from "./nagi-anatomy.mjs";

const ease = n => {
  const x = T.MathUtils.clamp(n, 0, 1);
  return x*x*(3-2*x);
};
const beat = (t, start, end) => ease((t-start)/(end-start));
const organOrder = [
  /airway|trache|bronch|lung|pulmonary|thyroid|diaphragm/,
  /heart|aort|arterio|coronary|vena cava/,
  /liver|gall|stomach|spleen|pancrea/,
  /renal|kidney|ureter/,
  /colon|intestin|bowel|bladder|uterus|ovary|oviduct|umbilic/,
  /./
];
const lines = [
  [0.48,2.5,["Nagi · Hanako. The light is moving.","Nagi · Hanako. Ánh sáng đang di chuyển.","ナギ · 花子。光が動いてる。"]],
  [4.58,6.5,["Nagi · I can still see you.","Nagi · Mình vẫn nhìn thấy cậu.","ナギ · まだ見えるよ。"]],
  [15.2,17.0,["Nagi · Don’t let it hear you breathe.","Nagi · Đừng để nó nghe tiếng cậu thở.","ナギ · 息を聞かれないで。"]]
];

export function makeNagiWhiteThing({actor,layers,face,soul,origin,heading,reduced}){
  const stage=new T.Group();
  stage.name="Nagi · White Thing replay";
  stage.position.copy(origin);stage.rotation.y=heading;
  const geometry=new Set(),materials=new Set();
  for(const mesh of Object.values(layers).flat()){
    geometry.add(mesh.geometry);materials.add(mesh.material);
  }
  geometry.add(face.geometry);materials.add(face.material);
  stage.add(actor.root,soul.root);
  actor.root.name="Nagi · White Thing body";
  soul.root.name="Nagi · White Thing soul";
  const rigMaterial=new T.MeshLambertMaterial({
    color:0xc5e2ff,emissive:0x457bb1,transparent:true,opacity:0,depthWrite:false
  });
  materials.add(rigMaterial);
  soul.model.traverse(o=>{
    if(!o.isMesh)return;
    o.material=rigMaterial;o.castShadow=o.receiveShadow=false;
  });
  soul.root.visible=false;
  actor.animate("Idle",.32,{still:true,expression:"Uneasy"});
  const rest=new Map([...actor.bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
  const skin=new T.Group(),shell=new T.Group();
  skin.name="Nagi · shed skin";shell.name="Nagi · shed muscle shell";
  stage.add(skin,shell);
  skin.visible=shell.visible=false;
  const local=new T.Vector3(),inverse=new T.Matrix4(),world=new T.Matrix4();
  const mainLight=new T.PointLight(0xffddce,2.5,5,2);
  mainLight.position.set(.98,2.36,1.5);stage.add(mainLight);
  const rim=new T.PointLight(0xb4d6ff,1.5,4,2);
  rim.position.set(-1.1,1.7,-.75);stage.add(rim);
  const wall=new T.MeshStandardMaterial({color:0x823d48,roughness:.76});
  const eyeWhite=new T.MeshStandardMaterial({color:0xe2cfc4,roughness:.29});
  const eyeIris=new T.MeshStandardMaterial({color:0x74813e,roughness:.30});
  const pupil=new T.MeshStandardMaterial({color:0x151117,roughness:.20});
  for(const mat of [wall,eyeWhite,eyeIris,pupil])materials.add(mat);
  function addMesh(parent,shape,mat,x,y,z){
    const mesh=new T.Mesh(shape,mat);geometry.add(shape);
    mesh.position.set(x,y,z);parent.add(mesh);
    return mesh;
  }
  const head=actor.bones.get("Head"),eyes=[];
  addMesh(head,new T.SphereGeometry(1,16,12),wall,0,.098,.009).scale.set(.085,.107,.071);
  const muscleHead=head.children.at(-1);
  layers.muscles.push(muscleHead);
  muscleHead.name="Nagi · facial muscle";
  muscleHead.visible=false;
  for(const sign of [-1,1]){
    const eye=new T.Group();eye.name="Nagi · exposed eye";eye.position.set(sign*.048,.109,.078);
    head.add(eye);eyes.push(eye);eye.visible=false;
    addMesh(eye,new T.SphereGeometry(.018,16,12),eyeWhite,0,0,0);
    addMesh(eye,new T.SphereGeometry(.009,12,8),eyeIris,0,0,.014).scale.z=.50;
    addMesh(eye,new T.SphereGeometry(.0044,10,6),pupil,0,0,.018).scale.z=.40;
  }
  const castLight=new T.MeshLambertMaterial({color:0x5d7791,emissive:0x25334c,transparent:true,opacity:1});
  materials.add(castLight);
  const circuit=new T.MeshBasicMaterial({color:0xb8dfff,transparent:true,opacity:0,depthWrite:false});
  materials.add(circuit);
  const ring=addMesh(stage,new T.TorusGeometry(.27,.005,5,36),circuit,0,0,0);
  ring.rotation.x=Math.PI/2;ring.visible=false;
  const peeledSkin=[],peeledMuscle=[],dropped=[],organs=[];
  let age=0,skinOut=false,muscleOut=false,lastGore=true,clothesOut=false;
  let eyeOn=false,finished=false;
  const tempEuler=new T.Euler(),tempQ=new T.Quaternion();
  const fracture={value:0};
  const eventTable=[
    [.54,"recognition"],[1.53,"fabric"],[3.07,"peel"],[4.55,"settleSkin"],
    [6.16,"muscle"],[8.24,"incision"],[9.12,"organs"],[9.74,"organs"],[10.34,"organs"],
    [10.95,"organs"],[11.56,"organs"],[12.70,"settleMuscle"],[14.39,"bone"],
    [15.05,"extract"],[17.55,"swallow"]
  ];

  // Flatten the matrices into the stage so every fold starts from the exact posed surface.
  function bake(source,dest,material){
    const geo=source.geometry.clone();
    geometry.add(geo);
    const pos=geo.getAttribute("position");
    inverse.copy(stage.matrixWorld).invert();
    world.multiplyMatrices(inverse,source.matrixWorld);
    if(source.isSkinnedMesh)source.skeleton.update();
    for(let i=0;i<pos.count;i++){
      source.getVertexPosition(i,local).applyMatrix4(world);
      pos.setXYZ(i,local.x,local.y,local.z);
    }
    geo.deleteAttribute("skinIndex");geo.deleteAttribute("skinWeight");geo.morphAttributes={};
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh=new T.Mesh(geo,material);
    mesh.frustumCulled=false;
    mesh.name=source.name;
    dest.add(mesh);
    return {mesh,pos,rest:pos.array.slice()};
  }
  function clothMat(original,cut=false,mask=false){
    const mat=original.clone();
    mat.side=T.DoubleSide;
    mat.roughness=.84;
    mat.onBeforeCompile=shader=>{
      shader.vertexShader="attribute vec3 whiteSource; varying vec3 clothSource;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nclothSource=whiteSource;");
      shader.fragmentShader="varying vec3 clothSource; uniform float fracture;\n"+shader.fragmentShader;
      shader.uniforms.fracture=fracture;
      if(cut)shader.fragmentShader=shader.fragmentShader.replace("#include <clipping_planes_fragment>",`
        #include <clipping_planes_fragment>
        float cutY = smoothstep(0.92,1.01,clothSource.y) * (1.0-smoothstep(1.61,1.68,clothSource.y));
        if (clothSource.z > .015 && abs(clothSource.x) < cutY * fracture * .024) discard;
      `);
      if(mask)shader.fragmentShader=shader.fragmentShader.replace("#include <clipping_planes_fragment>",`
        #include <clipping_planes_fragment>
        vec2 eye = vec2(abs(clothSource.x)-.047,clothSource.y-1.78);
        vec2 mouth = vec2(clothSource.x,clothSource.y-1.71);
        if (clothSource.z>.035 && (length(eye/vec2(.026,.013))<1. ||
            length(mouth/vec2(.022,.009))<1.)) discard;
      `);
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`
        #include <color_fragment>
        float grain = .96+.04*cos(clothSource.y*56.+clothSource.x*26.);
        diffuseColor.rgb *= grain*(gl_FrontFacing ? vec3(1.) : vec3(.57,.34,.35));
      `);
    };
    mat.customProgramCacheKey=()=>`nagi-white-cloth-${cut}-${mask}`;
    materials.add(mat);
    return mat;
  }
  function addCloth(source,dest,list,kind,byMaterial){
    const original=pale.get(source)||source.material;
    if(!byMaterial.has(original))byMaterial.set(original,clothMat(original,kind==="muscle",kind==="head"));
    const piece=bake(source,dest,byMaterial.get(original));
    piece.kind=kind;
    piece.mesh.geometry.setAttribute("whiteSource",new T.BufferAttribute(piece.rest,3));
    list.push(piece);
    return piece;
  }
  function joint(name,x,y,z){
    const bone=actor.bones.get(name);
    bone.quaternion.copy(rest.get(name)).multiply(tempQ.setFromEuler(tempEuler.set(x,y,z)));
  }
  function pose(t){
    const recoil=beat(t,.40,1.15),held=beat(t,1.15,2.75),fear=1-beat(t,5.7,7.0);
    const fall=beat(t,13.48,14.39),settle=beat(t,14.39,14.97);
    actor.root.position.set(-.06*recoil+.14*held+.34*fall,.25*held-.14*fall-.01*settle,-.10*recoil-.05*fall);
    actor.root.rotation.set(-.10*recoil+.09*held-1.53*fall,
      .22*recoil-.14*held+.55*fall,-.11*recoil+.12*held-.13*fall,"YXZ");
    joint("Spine",.08*recoil-.20*held+.24*fall,0,-.07*recoil);
    joint("Chest",.14*recoil-.10*held+.14*fall,-.16*recoil+.12*held,.13*recoil);
    joint("Head",-.18*recoil+.27*held+.32*fall,.35*recoil-.43*held,-.09*recoil+.15*fall);
    joint("Ponytail",-.36*held+.19*Math.sin(t*6)*recoil*(1-held),0,.23*held);
    for(const [i,side] of ["L","R"].entries()){
      const reach=beat(t,.58+i*.22,1.43+i*.24)*(1-beat(t,2.15+i*.21,3.1+i*.21));
      const free=beat(t,1.77+i*.28,3.03+i*.31);
      const shake=reduced?0:Math.sin(t*(9+2*i))*.035*fear*held;
      joint("UpperArm"+side,(.42+i*.15)*reach-.19*free+.22*fall,0,(i?-.27:.32)*free+shake);
      joint("Forearm"+side,-.75*reach-.17*free-.19*fall,(i?-.22:.22)*reach,shake);
      joint("Hand"+side,-.34*reach+.16*free,0,(i?-.18:.18)*reach);
      joint("Thigh"+side,-.29*recoil*(i?.3:1)+.13*held+.13*i*fall,0,(i?-.08:.08)*fall);
      joint("Shin"+side,.37*recoil*(i?1:.5)-.13*held+.18*fall,0,0);
    }
    actor.express(t<.55?"Uneasy":t<1.58?"Startled":"Wince",1);
    stage.updateMatrixWorld(true);
  }
  function detachClothes(){
    clothesOut=true;
    for(const [index,name] of garments.entries()){
      const pieces=new T.Group();
      const part=actor.parts.get(name);
      pieces.name="Nagi · dropped "+name.toLowerCase();stage.add(pieces);
      let lo=Infinity,hi=-Infinity;
      part.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const piece=bake(mesh,pieces,pale.get(mesh)||mesh.material);
        for(let i=1;i<piece.rest.length;i+=3){
          lo=Math.min(lo,piece.rest[i]);hi=Math.max(hi,piece.rest[i]);
        }
      });
      dropped.push({pieces,pivot:(lo+hi)/2,index});
    }
  }
  function beginSkin(){
    skinOut=true;
    for(const name of ["Body","Head","Hair"]){
      const map=new Map();
      actor.parts.get(name).traverse(o=>{
        if(!o.isMesh||!o.visible)return;
        addCloth(o,skin,peeledSkin,name.toLowerCase(),map);
      });
    }
  }
  function beginMuscle(){
    muscleOut=true;
    const map=new Map();
    for(const mesh of layers.muscles){
      const isTorso=["Chest","Spine","Hips"].includes(mesh.parent.name);
      addCloth(mesh,shell,peeledMuscle,isTorso?"muscle":"limb",map);
    }
    for(const eye of eyes)eye.traverse(o=>{if(o.isMesh)peeledMuscle.push({...bake(o,shell,o.material),kind:"eye"})});
    for(const rx of organOrder){
      const cluster=new T.Group();
      cluster.name="Nagi · organ bundle "+(organs.length+1);
      stage.add(cluster);
      cluster.updateWorldMatrix(true,false);
      const group=layers.organs.filter(o=>!o.userData.staged&&rx.test(o.name.slice(7)));
      for(const m of group){m.userData.staged=true;cluster.attach(m)}
      organs.push(cluster);
    }
  }
  function drape(pieces,flat,fold,t,slit=0,drag=0){
    const turn1=Math.PI*.97*beat(fold,0,.54),turn2=-Math.PI*.96*beat(fold,.46,1);
    for(const {mesh,pos,rest:data,kind} of pieces){
      mesh.visible=kind!=="eye"||fold<.98;
      for(let i=0;i<pos.count;i++){
        const x=data[i*3],y=data[i*3+1],z=data[i*3+2];
        const cutBand=beat(y,.92,1.03)*(1-beat(y,1.56,1.67))*beat(z,-.01,.07);
        const open=(1-flat)*slit*.108*cutBand*Math.tanh(x*66);
        const depth=z*(1-flat*(kind==="hair"?.77:.93));
        const d=Math.max(0,1.88-y),h=.64;
        const mid=Math.min(h,Math.max(0,d-h)),tip=Math.max(0,d-2*h);
        const ripple=reduced?0:.019*Math.sin(y*10+x*14-t*4)*flat*(1-fold);
        pos.setXYZ(i,x*(1-.30*flat)+open+drag*beat(d,.24,1.61),
          y+mid*(1-Math.cos(turn1))+tip*(1-Math.cos(turn1+turn2)),
          depth+mid*Math.sin(turn1)+tip*Math.sin(turn1+turn2)+ripple+.047*d*fold);
      }
      pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  }
  function setExterior(shown,clothed){
    for(const name of ["Body","Head","Hair"])actor.parts.get(name).visible=shown;
    face.visible=shown;
    for(const name of garments)actor.parts.get(name).visible=shown&&clothed;
  }
  function putFabric(group,x,z,turn,fold,yaw){
    const pivot=1.73;
    group.rotation.set(turn,yaw,0,"YXZ");
    const down=T.MathUtils.lerp(pivot,.10,fold);
    const front=-pivot*Math.sin(turn);
    group.position.set(x+Math.sin(yaw)*front,down-pivot*Math.cos(turn),z+Math.cos(yaw)*front);
  }
  const pale=new Map();
  function styleForGore(gore){
    if(gore===lastGore)return;
    lastGore=gore;
    actor.model.traverse(o=>{
      if(!o.isMesh||o===face||!o.isSkinnedMesh)return;
      if(!pale.has(o))pale.set(o,o.material);
      o.material=gore?pale.get(o):castLight;
    });
  }
  function update(dt,gore,emit){
    const old=age;
    age=Math.min(21.4,age+dt);
    const t=age;
    styleForGore(gore);
    pose(t);
    if(!clothesOut&&t>=1.50)detachClothes();
    if(!skinOut&&t>=3.0)beginSkin();
    if(!muscleOut&&t>=6.12)beginMuscle();
    const skinSlide=beat(t,3.00,4.57),skinFold=beat(t,4.59,6.08);
    const muscleSlide=beat(t,6.12,8.04),opening=beat(t,8.24,9.04),muscleFold=beat(t,11.91,13.46);
    fracture.value=opening*(1-muscleFold);
    setExterior(gore?t<3.0:t<6.12,!gore||!clothesOut);
    if(clothesOut)for(const {pieces,pivot,index} of dropped){
      const delay=1.51+index*.19;
      const lift=beat(t,delay,delay+.24),drop=beat(t,delay+.24,delay+.67);
      pieces.visible=gore&&t>=delay;
      if(gore&&t<delay)actor.parts.get(garments[index]).visible=true;
      const side=index%2===0?-1:1;
      pieces.rotation.set((index===3?.04:1.49)*drop,side*(.13+.08*index)*lift,0,"YXZ");
      local.set(0,pivot,0).applyQuaternion(pieces.quaternion);
      pieces.position.set(side*(.18+.13*index)*lift,
        T.MathUtils.lerp(pivot,index===3?.06:.09,drop)+.09*Math.sin(lift*Math.PI),
        .15*lift+(.69+.15*(index%3))*drop).sub(local);
    }
    for(const mesh of layers.muscles)mesh.visible=gore&&skinOut&&!muscleOut;
    for(const mesh of layers.skeleton)mesh.visible=muscleOut;
    for(const eye of eyes)eye.visible=gore&&skinOut&&!muscleOut;
    if(skinOut){
      skin.visible=gore;
      putFabric(skin,-.94*skinSlide,.16*skinSlide+.13*skinFold,-.37*skinSlide-1.16*skinFold,skinFold,-.23*skinSlide);
      if(skinFold<1||!skin.userData.complete){
        drape(peeledSkin,skinSlide,skinFold,t,0,.37*Math.sin(Math.PI*skinSlide));
        skin.userData.complete=skinFold===1;
      }
    }
    if(muscleOut){
      shell.visible=gore;
      putFabric(shell,.91*muscleSlide,.18*muscleSlide+.17*muscleFold,-1.53*muscleFold,muscleFold,.16*muscleSlide);
      if(muscleFold<1||!shell.userData.complete){
        drape(peeledMuscle,muscleFold,muscleFold,t,opening);
        shell.userData.complete=muscleFold===1;
      }
      for(const [i,cluster] of organs.entries()){
        const pull=beat(t,9.02+.54*i,9.85+.54*i),reveal=beat(t,8.46,9.02);
        cluster.visible=gore&&(reveal>.09)&&(i<5||pull>.04);
        cluster.children.forEach(m=>{m.visible=cluster.visible});
        const x=.91*muscleSlide;
        cluster.position.set(T.MathUtils.lerp(x,1.48+(i%2)*.35,pull),
          T.MathUtils.lerp(0,-1.03-(i===5?.19:0)+.09*(i%2),pull)+.18*Math.sin(pull*Math.PI),
          T.MathUtils.lerp(.16,.56+.21*Math.floor(i/2),pull));
        cluster.rotation.y=-(.25+.09*i)*pull;
      }
    }
    const rise=beat(t,15.02,16.2),swallow=beat(t,16.85,17.72);
    soul.root.visible=rise>.002&&swallow<1;
    // Start flat against the bones, then aim the shrinking rig at the eye.
    soul.root.position.set(.42-.27*rise-.54*swallow,.10+.20*rise+1.62*swallow,-.15+.18*rise-.81*swallow);
    soul.root.rotation.set(-1.53*(1-rise)+.22*swallow,.63*(1-rise),-.12*(1-rise)+.18*swallow,"YXZ");
    soul.root.scale.setScalar(1-.93*swallow);
    rigMaterial.opacity=.65*rise*(1-swallow*.81);
    if(soul.root.visible)soul.animate("Idle",dt,{still:true});
    ring.visible=t>=.65&&t<3.12;
    ring.position.set(actor.root.position.x,1.76-1.55*beat(t,.68,2.98),0);
    circuit.opacity=.58*beat(t,.65,.97)*(1-beat(t,2.85,3.12));
    mainLight.intensity=2.5-.62*beat(t,17.71,19);
    eyeOn=t>=.58&&t<17.55;
    for(const [at,event] of eventTable)if(at>old&&at<=t)emit(event,gore);
    finished=t>=21.4;
    const caption=lines.find(([start,end])=>t>=start&&t<end);
    return caption?.[2];
  }
  function dispose(){
    stage.removeFromParent();actor.mixer.stopAllAction();soul.mixer.stopAllAction();
    face.material.map.dispose();
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  return {stage,update,dispose,get time(){return age},get eyeOpen(){return eyeOn},get done(){return finished}};
}
