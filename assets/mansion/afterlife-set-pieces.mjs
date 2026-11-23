// Landmark warnings are driven by player movement and shared by keyboard and tap.
export function buildSetPieces(T, scene, mansion, payload) {
  const mats=Object.fromEntries(Object.entries(payload.materials).map(([key,color])=>
    [key,new T.MeshLambertMaterial({color,flatShading:true})]));
  function model(name) {
    const group=new T.Group();
    for(const [key,coords] of Object.entries(payload.props[name])){
      const geo=new T.BufferGeometry();
      geo.setAttribute("position",new T.Float32BufferAttribute(coords,3));
      geo.computeVertexNormals();
      const m=new T.Mesh(geo,mats[key]);m.receiveShadow=true;group.add(m);
    }
    return group;
  }
  function marker(color,x,y,z,r) {
    const m=new T.Mesh(new T.RingGeometry(r*.88,r,36),new T.MeshBasicMaterial({
      color,transparent:true,opacity:.67,side:T.DoubleSide,depthWrite:false
    }));
    m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m);return m;
  }
  const bell=model("bell"), portrait=model("portrait");
  const loft={x:0,z:mansion.stairs.wall+.84,y:mansion.stairs.floor(0,mansion.stairs.wall+.84)};
  const sitter={x:10.45,z:mansion.centerZ-19.05,y:.13};
  bell.name="Bell loft prop";portrait.name="Portrait frame prop";
  bell.position.set(loft.x,loft.y+2.62,loft.z-.15);
  portrait.position.set(sitter.x,sitter.y+1.44,sitter.z-.84);
  scene.add(bell,portrait);
  const mount=new T.Mesh(new T.BoxGeometry(3.7,.18,.19),mats.walnut);
  mount.name="Bell loft crossbeam";
  mount.position.set(0,loft.y+2.68,loft.z-.15);scene.add(mount);
  const braceGeometry=new T.BoxGeometry(.14,1.1,.19);
  for(const side of [-1,1]){
    const brace=new T.Mesh(braceGeometry,mats.wood);
    brace.position.set(side*1.57,loft.y+2.31,loft.z-.15);brace.rotation.z=-side*.58;scene.add(brace);
  }
  const threshold=marker(0xd4af6f,loft.x,loft.y+.065,loft.z,.76);
  const chalk=marker(0xbeb1cf,sitter.x,sitter.y+.012,sitter.z,.58);
  const bellLight=new T.PointLight(0xffce90,8,5), portraitLight=new T.PointLight(0xcfabef,7,4);
  bellLight.position.set(.05,loft.y+2,loft.z+1.1);
  portraitLight.position.set(sitter.x-.7,2.4,sitter.z+.65);
  scene.add(bellLight,portraitLight);
  let actor=null, shadow=null, bindActor=null, active=null, clock=0, wait=0, locked=null, second=false;
  const near=(p,a,r)=>Math.hypot(p.x-a.x,p.z-a.z)<r;
  const matching=(p,heading)=>near(p,sitter,.67)&&Math.cos(heading)>.72;
  function restore(){
    active=null;clock=wait=0;second=false;
    threshold.material.opacity=.52;chalk.material.opacity=.62;if(shadow)shadow.visible=false;
    bell.rotation.x=0;portrait.rotation.y=0;
    if(actor){keyPose(bindActor,actor,paintedKeys,0);actor.userData.face(0)}
  }
  return {bell,portrait,loft,sitter,get active(){return active},
    setActor(value,bind){actor=value;bindActor=bind;portrait.add(actor)},
    setShadow(value){shadow=value;scene.add(shadow);shadow.visible=false},
    reset(){locked=null;restore()},
    action(p,heading){return active==="portrait"&&near(p,sitter,1.4)?"portrait_turn":
      !active&&locked!=="portrait"&&matching(p,heading)?"portrait_pose":null},
    use(action,cue) {
      if(action==="portrait_turn"){
        locked="portrait";restore();portrait.rotation.y=.75;
        if(actor)actor.userData.face(4);
        cue("portrait_escape");return;
      }
      active=locked="portrait";clock=0;cue("portrait_warn");
    },
    step(dt,p,enabled,moved,reduced,cue,capture){
      if(!enabled){if(active||wait)restore();return}
      if(locked==="bellLoft"&&!near(p,loft,1.15))locked=null;
      if(locked==="portrait"&&!near(p,sitter,1.44)){locked=null;portrait.rotation.y=0;if(actor)actor.userData.face(0)}
      if(!active){
        const ready=locked!=="bellLoft"&&near(p,loft,.73)&&moved<.045;
        wait=ready?wait+dt:0;
        if(wait<.65)return;
        active=locked="bellLoft";clock=0;cue("bell_first");
      }
      clock+=dt;
      if(active==="bellLoft"){
        if(!near(p,loft,.92)){restore();cue("bell_escape");return}
        const t=second?clock-1.24:clock;
        if(shadow){
          shadow.visible=true;
          shadow.position.set(loft.x-.48,loft.y-.06,loft.z-.66);
          shadow.rotation.set(-Math.PI*.44*(1-smooth(clock/.68)),.2,0);
          keyPose(bindActor,shadow,bellEchoKeys,clock);
        }
        bell.rotation.x=(reduced?.045:.24)*Math.sin(t*7)*Math.exp(-1.65*t);
        threshold.material.opacity=.52+.34*Math.cos(t*7)*Math.exp(-t);
        if(!second&&clock>=1.24){second=true;cue("bell_second")}
        if(clock>=2.75){restore();capture("bellLoft")}
      }else{
        if(!near(p,sitter,1.05)||p.x<sitter.x-.87){restore();cue("portrait_escape");return}
        if(actor){
          keyPose(bindActor,actor,paintedKeys,clock);
          actor.userData.face(clock<1.2?6:clock<2.3?1:7);
          actor.rotation.y=reduced?0:.11*smooth((clock-1.2)/.76);
        }
        chalk.material.opacity=.49+.25*Math.cos(clock*5);
        if(clock>=3.3){restore();capture("portrait")}
      }
    }
  };
}

function makeSceneStain(T, color, size, hand=false, crack=false) {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle=color;
  const mark=(x,y,w,h,angle)=>{ctx.beginPath();ctx.ellipse(x,y,w,h,angle,0,Math.PI*2);ctx.fill()};
  if(crack){
    ctx.strokeStyle=color;ctx.lineCap="round";
    for(let i=0;i<7;i++){
      const a=(i+.5)*Math.PI*2/7;
      ctx.lineWidth=i%2?1.15:2;ctx.beginPath();ctx.moveTo(65,60);
      ctx.lineTo(65+19*Math.cos(a-.15),60+19*Math.sin(a-.15));
      ctx.lineTo(65+43*Math.cos(a),60+43*Math.sin(a));ctx.stroke();
    }
  }else if(hand){
    mark(64,77,17,23,-.2);
    for(let i=0;i<4;i++)mark(44+12*i,42+Math.abs(i-1.4)*6,4,18,-.20+i*.12);
    mark(38,73,5,16,-.83);
    mark(69,102,3.6,17,-.22);
  }else{
    for(let i=0;i<19;i++){
      const a=i*2.39996,r=2.8*i;
      mark(63+r*Math.cos(a),62+r*Math.sin(a),2.5+Math.max(0,12-i),2.4+Math.max(0,8-i),a);
    }
  }
  return new T.Mesh(new T.PlaneGeometry(size, size),new T.MeshBasicMaterial({
    map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2
  }));
}
const smooth=n=>{const t=Math.min(1,Math.max(0,n));return t*t*(3-2*t)};

function sample(keys,t){
  const i=keys.findIndex(k=>k[0]>t);
  if(i<=0)return keys[i===0?0:keys.length-1].slice(1);
  const a=keys[i-1],b=keys[i],u=smooth((t-a[0])/(b[0]-a[0]));
  return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);
}

const restArms={
  upperarm_L:[[0,0,0,-1.37]],upperarm_R:[[0,0,0,1.38]],
  forearm_L:[[0,0,.18,0]],forearm_R:[[0,0,-.19,0]]
};
function keyPose(bind,actor,tracks,t){
  bind(actor);
  for(const [name,keys] of Object.entries(tracks)){
    const angles=sample(keys,t);
    // The exported arm axes point outward along ±X. The keys describe reach
    // toward the performer’s front rather than rotation about that bind axis.
    if(name.startsWith("upperarm_")||name.startsWith("forearm_"))angles[1]=-angles[1];
    actor.userData.bones[name]?.rotation.fromArray(angles);
  }
}

const bellKeys={
  head:[[0,.07,-.20,0],[.58,-.38,-.07,-.09],[1.17,-.26,.34,.06],[1.75,-.53,.03,.04],
    [2.24,-.37,.03,.09],[2.37,.33,-.28,-.24],[2.90,.19,-.31,.15],[3.77,.18,.29,.19],[4.46,.18,.33,.19]],
  chest:[[0,.015,0,0],[.74,-.09,.11,-.05],[1.57,.11,-.22,.09],[2.21,.06,-.14,-.08],
    [2.41,-.19,.18,.13],[3.12,.19,-.08,-.05],[3.84,.04,0,0]],
  upperarm_L:[[0,.08,.08,-1.30],[.77,.05,.26,-1.26],[1.72,0,1.09,-.38],[2.20,.24,1.38,.37],
    [2.47,-.29,.38,-.46],[3.11,.17,.10,-1.06],[3.80,0,0,-1.14]],
  upperarm_R:[[0,-.08,-.20,1.31],[.67,-.24,-.41,1.18],[1.58,.17,-.27,1.47],[2.21,-.16,-.66,.90],
    [2.46,.26,-.24,.47],[3.22,-.42,-.19,1.05],[3.48,-.23,-.10,1.13],[4.04,0,0,1.20]],
  forearm_L:[[0,0,.28,0],[1.64,.26,.74,-.11],[2.16,-.14,.87,.18],[2.52,.25,.39,-.12],[3.79,.04,.17,-.05]],
  forearm_R:[[0,0,-.74,.13],[1.64,.05,-.43,.12],[2.15,-.25,-.66,.03],[2.46,.17,-.26,.08],[3.77,.02,-.15,0]],
  thigh_L:[[0,-.09,0,.12],[1.52,.21,0,.13],[2.13,-.29,.06,.10],[2.49,-.48,0,.14],[3.18,-.23,0,.09],[4.02,-.08,0,.14]],
  shin_L:[[0,.15,0,0],[1.52,.41,0,0],[2.15,.49,0,0],[2.54,.68,0,0],[3.24,.26,0,0],[4.05,.12,0,0]],
  thigh_R:[[0,-.08,0,-.08],[1.66,-.31,0,-.11],[2.16,-.11,0,-.10],[2.48,-.20,0,-.09],[3.11,-.42,0,-.14],[3.94,-.07,0,-.13]],
  shin_R:[[0,.16,0,0],[1.77,.41,0,0],[2.22,.14,0,0],[2.55,.31,0,0],[3.15,.59,0,0],[4.07,.10,0,0]]
};
const bellRoot=[
  [0,0,0,.04,0,.22,0],[.65,.02,0,.025,-.085,.18,.06],
  [1.32,-.035,-.028,.06,.09,.38,.04],[1.88,-.14,-.077,.27,.19,.28,.12],
  [2.21,-.17,-.102,.29,.13,.11,.035],[2.43,-.12,-.08,.44,-.48,.22,.17],
  [2.75,.01,.05,.59,-1.04,.21,.26],[3.18,.17,.11,.65,-1.51,.19,.15],
  [3.42,.16,.115,.64,-1.46,.19,.15],[3.91,.16,.092,.64,-1.53,.19,.12]
];
const bellEchoKeys={
  ...restArms,
  head:[[0,.32,-.38,-.16],[.74,-.23,.09,-.17],[1.62,-.48,.21,.09],[2.28,-.24,.35,.23],[3.28,.19,-.12,.26]],
  upperarm_L:[[0,0,.09,-1.28],[.81,.12,.81,-.57],[1.64,.22,.49,-.91],[2.29,0,1.13,-.36],[3.29,0,.23,-1.28]],
  upperarm_R:[[0,0,0,1.39],[1.51,-.18,-.69,.81],[2.34,.25,-.36,1.13],[3.26,0,-.21,1.31]],
  thigh_L:[[0,-.04,0,.09],[1.65,-.32,-.11,.08],[3.25,.18,0,.05]],
  shin_L:[[0,.08,0,0],[1.62,.40,0,0],[3.25,.16,0,0]]
};
const portraitKeys={
  head:[[0,.02,.11,-.03],[.55,-.10,-.16,-.16],[1.27,.07,.28,-.07],[1.93,-.12,-.24,.12],
    [2.48,-.10,.05,-.08],[2.70,.27,.18,.21],[3.39,.16,-.32,.23],[4.10,.11,-.29,.24]],
  chest:[[0,0,0,0],[1.07,.07,-.11,-.07],[1.58,.14,-.27,.08],[2.19,-.08,.28,.09],
    [2.60,.27,.05,-.09],[3.16,.32,-.21,-.17],[3.57,.10,-.10,.05],[4.25,.02,0,0]],
  upperarm_L:[[0,0,.12,-1.36],[.71,0,.84,-.91],[1.42,.12,1.12,-.54],[1.90,.26,.61,-1.00],
    [2.43,.04,1.39,-.35],[2.59,.13,1.43,-.16],[3.10,-.20,.51,-.64],[3.88,-.12,.10,-1.14]],
  upperarm_R:[[0,0,-.15,1.34],[.90,-.13,-.26,1.39],[1.55,.30,-.68,.87],[2.33,-.04,-.91,.47],
    [2.67,-.11,-1.28,.30],[3.15,-.25,-.58,.73],[4.03,.02,-.16,1.17]],
  forearm_L:[[0,0,.27,0],[1.22,-.19,.61,-.06],[2.24,.39,.92,-.15],[2.66,.20,.16,0],[3.89,-.08,.26,0]],
  forearm_R:[[0,0,-.18,0],[1.65,.09,-.62,.10],[2.43,-.11,-.51,.10],[3.41,-.12,-.31,.19],[4.1,0,-.14,0]],
  thigh_L:[[0,-.14,0,.09],[1.25,-.32,-.06,.11],[2.03,.12,.11,.15],[2.74,-.46,.10,.21],[3.25,-.25,.05,.17],[4.07,-.04,0,.14]],
  shin_L:[[0,.18,0,0],[1.21,.36,0,0],[1.98,.64,0,0],[2.66,.78,0,0],[3.24,.39,0,0],[4.11,.08,0,0]],
  thigh_R:[[0,-.02,0,-.09],[1.58,-.25,.09,-.13],[2.12,-.13,-.05,-.13],[2.74,.17,-.15,-.20],[3.49,-.09,0,-.11]],
  shin_R:[[0,.13,0,0],[1.56,.47,0,0],[2.09,.27,0,0],[2.75,.43,0,0],[3.52,.12,0,0]]
};
const portraitRoot=[
  [0,.035,0,.10,0,3.07,0],[.57,.015,0,.075,.063,3.17,-.04],[1.34,-.078,-.01,-.066,.17,3.24,-.11],
  [1.97,.06,-.105,.13,-.15,3.01,.17],[2.31,-.015,-.065,.035,.10,3.19,.05],
  [2.61,-.14,-.15,-.27,.41,3.35,-.20],[2.83,-.19,-.24,-.30,.86,3.43,-.35],
  [3.14,-.19,-.30,-.13,1.11,3.45,-.32],[3.55,-.22,.08,.31,-1.26,3.30,.28],
  [3.94,-.21,.071,.35,-1.50,3.26,.11],[4.32,-.21,.064,.35,-1.53,3.27,.08]
];
const paintedKeys={
  ...restArms,
  head:[[0,.12,-.21,-.07],[.51,.04,.10,.08],[1.08,-.11,.41,.13],[1.43,.01,.33,.14],
    [1.93,.13,.02,-.04],[2.48,.21,-.21,-.17],[2.70,.16,-.12,-.08],[3.44,-.04,.19,.08],[4.17,.025,0,-.02],[5.24,.035,-.18,.03]],
  chest:[[0,.04,0,0],[1.28,-.08,.18,.02],[2.49,.15,-.23,-.08],[3.19,.24,-.12,.09],[3.94,.01,.04,0]],
  upperarm_L:[[0,0,.06,-1.36],[.68,.10,.84,-.83],[1.42,.13,1.17,-.38],[2.15,.07,1.36,-.21],
    [2.67,-.11,1.47,-.08],[3.22,.19,.76,-.68],[3.85,.11,.42,-1.11],[4.54,.12,0,-1.41]],
  upperarm_R:[[0,0,-.08,1.38],[1.41,.14,-.29,1.23],[2.38,.13,-.83,.64],[3.10,-.12,-.58,.94],[4.24,0,-.12,1.40]],
  forearm_L:[[0,.01,.18,0],[1.62,.16,.63,-.13],[2.59,-.08,.17,-.08],[3.31,.25,.87,-.04],[4.27,0,.27,-.12]],
  hand_L:[[0,0,0,0],[1.46,.22,-.12,.09],[2.61,.30,.11,-.40],[3.31,.15,.03,.25],[4.24,0,0,0]]
};

export function playSetPiece(T, stage, id, options) {
  const {makeActor,makeShell,makeRibs,bind,cue,die,end,camera,target,gore,reduced}=options;
  const bell=id==="bellLoft", site=bell?stage.loft:stage.sitter;
  const ground=site.y, center=new T.Vector3(site.x,ground,site.z);
  const scenery=bell?stage.bell:stage.portrait;
  const cast=new T.Group();cast.name=bell?"Bell loft remains":"Portrait remains";
  options.scene.add(cast);
  const living=makeActor("solid"),body=bell?living:makeShell(),echo=makeActor("ghost");
  const paper=new T.Mesh(new T.PlaneGeometry(.15,.22),new T.MeshLambertMaterial({color:0xd7c595,side:T.DoubleSide}));
  const stain=makeSceneStain(T,bell?"#711525":"#8e283e",bell?.66:.54,!bell);
  const fracture=makeSceneStain(T,"#dbc3ef",bell?.85:.70,false,true);
  const ribs=bell?makeRibs():null;
  const pigment=new T.Group();
  const chips=new T.BufferGeometry(), positions=new Float32Array(19*3);
  chips.setAttribute("position",new T.BufferAttribute(positions,3));
  const flecks=new T.Points(chips,new T.PointsMaterial({color:0xcf9bb4,size:.038,transparent:true,depthWrite:false}));
  pigment.add(flecks);
  const strokeGeometry=new T.PlaneGeometry(1.22,.022);
  const strokeMaterial=new T.MeshBasicMaterial({color:0xbc87a8,side:T.DoubleSide,transparent:true,opacity:.76,depthWrite:false});
  const strokes=Array.from({length:3},(_,i)=>{
    const mesh=new T.Mesh(strokeGeometry,strokeMaterial);
    mesh.position.set(site.x,ground+.89+i*.34,site.z-.665);
    mesh.rotation.z=(i-1)*.24-.1;
    pigment.add(mesh);return mesh;
  });
  cast.add(body,living,echo,paper,pigment);
  scenery.add(stain,fracture);
  if(ribs)cast.add(ribs);
  if(bell){
    stain.position.set(0,-.81,.39);stain.rotation.x=.62;
    fracture.position.set(0,-.80,.403);fracture.rotation.z=.38;
  }else{
    stain.position.set(-.41,.33,.25);stain.rotation.z=-.27;
    fracture.position.set(-.42,.3,.25);
  }
  function performer(actor,t){
    keyPose(bind,actor,bell?bellKeys:portraitKeys,t);
    const [x,y,z,rx,ry,rz]=sample(bell?bellRoot:portraitRoot,t);
    actor.position.set(site.x+x,ground+y,site.z+z);
    actor.rotation.set(rx,ry,rz,"YXZ");
    actor.updateMatrixWorld(true);
  }
  let hit=false, settled=false, line=false, lastBeat=-1;
  const contact=bell?2.25:2.6, duration=bell?7.6:8.2;
  const paperOrigin=new T.Vector3();
  function showGore(on){
    stain.visible=hit&&on;
    fracture.visible=hit&&!on;
    if(ribs)ribs.visible=hit&&on;
  }
  function renderFrame(t){
    const drop=smooth((t-contact)/1.42);
    const current=bell||hit?body:living;
    performer(current,t);
    living.visible=bell||!hit;body.visible=bell||hit;
    if(!bell&&hit)body.scale.set(1-.10*drop,1-.13*drop,1-.78*drop);
    const expression=t<.48?0:hit?(t<contact+.48?"rolledEyes":"deathRest"):
      t<1.52?"dread":t<contact-.19?"panic":"bracing";
    living.userData.face(expression);
    if(!bell&&hit)echo.userData.face(t<contact+.39?"rolledEyes":"vacant");
    current.userData.bones.head.getWorldPosition(target);target.y+=.22;
    if(bell){
      const [tilt,height]=sample([[0,.025,2.62],[.36,-.24,2.62],[.77,.12,2.62],[1.18,-.07,2.62],
        [1.72,-.57,2.59],[2.02,-.43,2.48],[2.25,.31,1.97],[2.60,.59,2.36],
        [3.18,-.18,2.61],[3.85,.10,2.62],[4.51,0,2.62]],t);
      scenery.rotation.x=tilt*(reduced?.66:1);
      scenery.position.y=ground+height;
      keyPose(bind,echo,bellEchoKeys,t);
      const [x,y,z,lean]=sample([[0,-.54,.012,-.24,-.66],[.90,-.63,.018,-.28,-.08],
        [2.05,-.54,.06,-.28,.08],[2.32,-.39,.31,-.47,-.24],[2.81,-.23,.84,-.38,-.50],
        [3.69,-.11,1.48,-.18,-.32]],t);
      echo.visible=t<3.71;echo.position.set(site.x+x,ground+y,site.z+z);echo.rotation.set(lean,.32,.18*drop);
      echo.scale.setScalar(1-.74*smooth((t-2.33)/1.39));
      if(!hit)body.userData.bones.hand_R.localToWorld(paperOrigin.set(-.044,0,.014));
      const slip=smooth((t-contact)/.96);
      paper.position.copy(paperOrigin).lerp(center.clone().add(new T.Vector3(-.29,.047,.40)),slip);
      paper.position.y+=.105*Math.sin(Math.PI*slip);
      paper.rotation.set(1.42*slip,.32-.68*slip,.36+.76*slip);
    }else{
      const painter=options.painter;
      keyPose(bind,painter,paintedKeys,t);
      painter.userData.face(hit?t>contact+2.65?2:4:t<1.15?6:1);
      painter.rotation.y=sample([[0,-.13],[1.4,.10],[2.58,-.05],[3.22,.19],[4.16,0]],t)[0];
      target.set(site.x,ground+1.29,site.z-.27);
      paper.visible=false;
      const draw=smooth((t-contact)/.78);
      echo.visible=hit&&t<3.41;
      if(echo.visible){
        performer(echo,2.6+draw*.85);
        echo.position.lerp(center.clone().add(new T.Vector3(-.08,.40,-.69)),draw);
        echo.rotation.set(.48*draw,Math.PI*(1-draw),-.12*draw);
        echo.scale.set(1-.34*draw,1-.38*draw,1-.89*draw);
      }
    }
    const scatter=Math.max(0,t-contact);
    strokes.forEach((m,i)=>{m.visible=!bell&&t>.55+i*.58&&t<contact+.2;m.scale.x=smooth((t-.55-i*.58)/.4)});
    flecks.visible=hit&&scatter<2;
    flecks.material.opacity=1-smooth(scatter/2);
    for(let i=0;i<positions.length;i+=3){
      const a=i*2.39996,v=(reduced?.24:.61)*scatter;
      positions[i]=site.x+Math.cos(a)*v;
      positions[i+1]=ground+Math.max(.07,1.5+Math.sin(a)*v-scatter*scatter*.62);
      positions[i+2]=site.z-.3+Math.sin(a*.92)*v;
    }
    chips.attributes.position.needsUpdate=true;flecks.frustumCulled=false;
    if(ribs){
      ribs.position.copy(center).add(new T.Vector3(.25*smooth(scatter),Math.max(.12,1.19-scatter*scatter*.87),.14+.15*smooth(scatter/1.3)));
      ribs.rotation.set(.5+Math.min(1.3,scatter*1.6),.2,-.24);
    }
    showGore(gore());
  }
  return {
    frame(t){
      const beat=t>=contact?3:t>=1.75?2:t>=1.0?1:0;
      if(beat!==lastBeat){lastBeat=beat;cue(bell?(beat===3?"bell_contact":beat===0?"bell_ring":beat===1?"bell_second":"bell_swing"):"portrait_stroke")}
      if(t>=contact&&!hit){hit=true;die(center)}
      if(t>=contact+1.25&&!line){line=true;cue(bell?"bell_line":"portrait_line")}
      renderFrame(t);
      if(t>=duration&&!settled){settled=true;end()}
    },
    camera(t){
      const h=smooth((t-contact)/2);
      if(bell)camera.position.set(1.33-.28*h,ground+1.59-.42*h,site.z+2.75+.15*h);
      else camera.position.set(site.x-1.94-.26*h,ground+1.74-.40*h,site.z+1.95+.18*h);
      camera.position.lerp(options.handoff,smooth((t-duration+.9)/.9));
      if(bell)camera.lookAt(.13,ground+1.02-.39*h,site.z+.33*h);
      else camera.lookAt(site.x,ground+1.17-.37*h,site.z-.31);
    },
    showGore,
    cleanup(){
      cast.removeFromParent();
      scenery.rotation.set(0,0,0);
      if(bell)scenery.position.y=ground+2.62;
      else {keyPose(bind,options.painter,paintedKeys,0);options.painter.userData.face(0);options.painter.rotation.y=0}
      for(const decal of [stain,fracture]){decal.removeFromParent();decal.geometry.dispose();decal.material.map.dispose();decal.material.dispose()}
      paper.geometry.dispose();paper.material.dispose();chips.dispose();flecks.material.dispose();strokeGeometry.dispose();strokeMaterial.dispose();
      options.disposeActors();
    }
  };
}
