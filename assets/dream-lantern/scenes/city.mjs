/* City on the other side. The tower batches extend scene-tokyo's unit boxes,
   per-block facade IDs and grouped window occupancy to an upright, sunlit city. */
const TAU = Math.PI * 2;
const COUNT = { saver: 260, smooth: 800, ultra: 2200 };
const ease = t => (t = Math.max(0, Math.min(1, t)), t*t*(3-2*t));
const riverX = z => 11 + 19*Math.sin(-z*.033 + .45) + .05*z;

// Keep the kit's toon light, atmosphere and fog. The facade ink and lighted
// rooms go on either side of its lighting calculation, in architectural units.
function finishFacades(material, daylight, beat) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uDaylight = daylight;
    shader.uniforms.uWindowBeat = beat;
    shader.vertexShader = 'attribute vec3 building; varying vec3 vBuilding, vFace, vExtent;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('vUv=uv;', `vBuilding=building; vFace=normal;
      vExtent=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));vUv=uv;`);
    shader.fragmentShader = 'uniform float uDaylight,uWindowBeat; varying vec3 vBuilding,vFace,vExtent;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('vec3 n=normalize', `
      float id=floor(vBuilding.x+.5), family=vBuilding.y, side=step(.5,abs(vFace.x));
      vec2 wall=vUv*vec2(mix(vExtent.x,vExtent.z,side),vExtent.y);
      vec2 grid=wall/vec2(mix(.46,.95,fract(id*.37)),mix(.71,.96,fract(id*.57)));
      vec2 cell=floor(grid), frac=fract(grid);
      float room=fract(sin(dot(floor(cell/vec2(2.,1.))+id,vec2(12.7,31.1)))*4375.17);
      float pane=fract(sin(dot(cell+id,vec2(18.3,9.7)))*1763.12);
      vec2 edge=clamp(fwidth(grid)*.65,.014,.48);
      vec2 coverage=smoothstep(-edge,edge,vec2(mix(.31,.445,step(.55,family)),.28)-abs(frac-.5));
      float glass=coverage.x*coverage.y*step(abs(vFace.y),.5)*vBuilding.z;
      float ribbon=smoothstep(.60,.66,family)*step(abs(vFace.y),.5)*vBuilding.z;
      float ledge=smoothstep(.03,.09,frac.y)*(1.-smoothstep(.10,.21,frac.y));
      float front=clamp(.3+vUv.y*.8,0.,1.);
      float blinds=step(.69,pane)*smoothstep(.50,.86,frac.y);
      vec3 glaze=mix(vec3(.045,.115,.19),vec3(.28,.49,.59),front*.56+pane*.32);
      glaze=mix(glaze,vec3(.62,.60,.49),blinds*.7);
      base=mix(base,glaze,glass*uDaylight*.92);
      base*=1.-.35*ribbon*ledge;
      base+=.055*uDaylight*ribbon*smoothstep(.89,.97,frac.y);
      if(vFace.y>.5){
        vec2 lip=min(vUv,1.-vUv)*vExtent.xz;
        float coping=1.-smoothstep(.045,.13,min(lip.x,lip.y));
        base=mix(base*.67,base*1.12,coping);
      }
      float occupancy=smoothstep(.61,.90,.56*room+.44*pane);
      vec3 lamp=mix(vec3(.28,.69,.85),vec3(1.,.54,.22),smoothstep(.37,.68,room));
      vec3 litRooms=glass*occupancy*lamp*(.32+.81*room+.24*uWindowBeat)*(1.-uDaylight);
      vec3 n=normalize`);
    shader.fragmentShader = shader.fragmentShader.replace('c+uEmissive', 'c+uEmissive+litRooms');
  };
}

export async function create({ THREE, scene, camera, ctx2d, kit, tier, seed = 1, base }) {
  const images = await Promise.all(['cloud-day','cloud-night','lookout'].map(name =>
    new THREE.ImageLoader().loadAsync(new URL('scenes/city/'+name+'.webp', base).href)));
  const root = new THREE.Group();
  scene.add(root);
  const own = new Set();
  const geometry = g => (own.add(g), g);
  const subgroup = () => { const g = new THREE.Group(); root.add(g); return g };
  const roof = subgroup(), viaduct = subgroup(), terrace = subgroup(), terrain = subgroup();
  const dayAir = subgroup(), nightAir = subgroup();
  const boxGeo = geometry(new THREE.BoxGeometry()), plane = geometry(new THREE.PlaneGeometry());
  const vec = (x,y,z) => new THREE.Vector3(x,y,z);
  const pose = new THREE.Object3D(), up = vec(0,1,0);
  let state = (seed ^ 41921) >>> 0;
  const rand = () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296;
  function matrix(x,y,z,w,h,d,rotation) {
    pose.position.set(x,y,z); pose.scale.set(w,h,d);
    if (rotation) pose.quaternion.copy(rotation); else pose.quaternion.identity();
    pose.updateMatrix();
    return pose.matrix.clone();
  }
  function mesh(group,g,m,x,y,z) {
    const object = new THREE.Mesh(g,m);
    object.position.set(x,y,z); group.add(object); return object;
  }
  function box(group,m,x,y,z,w,h,d) {
    const o = mesh(group,boxGeo,m,x,y,z); o.scale.set(w,h,d); return o;
  }
  function batch(group,g,m,matrices,colors) {
    const o = new THREE.InstancedMesh(g,m,matrices.length);
    for (let i=0; i<matrices.length; i++) {
      o.setMatrixAt(i,matrices[i]);
      if (colors) o.setColorAt(i,new THREE.Color(colors[i]));
    }
    o.frustumCulled = false; group.add(o); own.add(o); return o;
  }
  function beam(list,a,b,width,depth=width) {
    const axis = b.clone().sub(a), mid = a.clone().lerp(b,.5), h = axis.length();
    list.push(matrix(mid.x,mid.y,mid.z,width,h,depth,new THREE.Quaternion().setFromUnitVectors(up,axis.normalize())));
  }
  // Assign paintings after toon() has cloned its uniforms; the texture remains kit-owned.
  function painted(texture, options={}) {
    const mat = kit.toon({ color:'#ffffff', light:'#ffffff', ambient:0, rimK:0, ...options });
    mat.uniforms.uMapOn.value=1; mat.uniforms.uMap.value=texture;
    return mat;
  }
  function decal(texture, options={}) {
    const m=painted(texture,{shade:'#ffffff', side:THREE.DoubleSide, fog:false,...options});
    m.transparent=true; m.depthWrite=false; return m;
  }
  const [dayCloud,nightCloud,wetStone]=images.map(img=>kit.paint(img.width,img.height,g=>g.drawImage(img,0,0)));
  const daySky=kit.sky({section:'outro',stops:[[0,'#154088'],[.39,'#2868a7'],[.68,'#478fc1'],[.87,'#82c0d5'],[1,'#d9e6df']],sun:.18,sunDir:[.75,.28,-1]});
  const nightSky=kit.sky({section:'verse1',stops:['#02071c','#080d28','#12264d','#23516e','#658a99'],stars:.087,sun:.018,sunColor:'#8ee7ff',sunDir:[.32,.19,-1]});
  dayAir.add(daySky); nightAir.add(nightSky);
  function bank(group,texture,x,y,z,w,h) {
    const o=mesh(group,plane,decal(texture),x,y,z); o.scale.set(w,h,1); o.renderOrder=-5;
  }
  bank(dayAir,dayCloud,-65,65,-330,858,217);
  bank(nightAir,nightCloud,-169,86,-329,861,254);
  const dayMist=kit.haze({section:'outro',count:18,center:[0,11,-110],box:[215,8,100],size:38,
    top:'#e6e3d6',bottom:'#9dbfd4',opacity:.25,drift:[.015,0,0]});
  const nightMist=kit.haze({section:'verse1',count:24,center:[0,10,-73],box:[190,12,110],size:32,
    top:'#639bb1',bottom:'#394b6e',opacity:.32,drift:[.018,0,0]});
  dayAir.add(dayMist); nightAir.add(nightMist);
  const glints=kit.particles({kind:'spark',count:{saver:70,smooth:140,ultra:260}[tier],center:[0,23,0],
    box:[70,38,65],size:.105,drift:[.08,.04,0],color:'#ffdda2',color2:'#96eaff',intensity:2.3,opacity:.64,seed:23});
  root.add(glints);

  const day=kit.palette('outro'), night=kit.palette('verse1');
  const daylight={value:0}, windowBeat={value:0};
  const facade=kit.toon({section:'outro',lightDir:[.80,.63,-.28],rimK:.06,wrap:.04,soft:.28,shade:'#a9b2c6'});
  finishFacades(facade,daylight,windowBeat);
  const towers=[], colors=[], styles=[], rooftops=[], shadows=[], trees=[], roofs=[], tiles=[];
  const shades=['#d9bf9d','#8aa6aa','#b8b8ac','#658694','#c39684','#8895a2','#d8c7ac','#9e97a5'];
  function building(x,y,z,w,h,d,col,id,family,windows=1) {
    towers.push(matrix(x,y,z,w,h,d)); colors.push(col); styles.push(id,family,windows);
  }
  // Populate the foreground first; higher tiers extend the neighbourhood out into the haze.
  const lots=[];
  for (let j=0;j<60;j++) for(let i=-36;i<=36;i++) {
    const x=i*6.5 + 1.25*Math.sin(j*.38), z=-8-j*6.7;
    if (Math.abs(x-riverX(z))<5.8) continue;
    lots.push({x,z,rank:Math.hypot(x*1.2,(z+32)*.79)});
  }
  lots.sort((a,b)=>a.rank-b.rank);
  for (let i=0;i<COUNT[tier];i++) {
    const lot=lots[i], x=lot.x+(rand()-.5)*1.35, z=lot.z+(rand()-.5)*1.2;
    const w=3+rand()*2.1, d=3+rand()*2.15, id=1+rand()*512, family=rand();
    const core=Math.exp(-(((x+15)/25)**2+((z+71)/33)**2));
    const high=rand()>.75, h=2.3+rand()*5.6+(high?4+rand()*14:0)+core*(4+rand()*21);
    const col=shades[Math.floor(rand()*shades.length)];
    building(x,h/2,z,w,h,d,col,id,family);
    const ph=.48+rand()*1.9;
    if(!high && h<9 && i%3!==0){
      roofs.push(matrix(x,h,z,w+.42,ph+.3,d+.46));
      tiles.push(['#627888','#9e766b','#919c9b','#6d7c8b'][i%4]);
    }else{
      building(x-w*.12,h+ph*.5,z,w*(high?.65:.36),ph,d*.65,col,id+.4,family,high?1:0);
    }
    if (high || i<52) {
      rooftops.push(matrix(x+w*.26,h+.25,z+d*.2,w*.23,.48,d*.24));
      if (i%4===0) rooftops.push(matrix(x-w*.12,h+ph+1.1,z,.07,2.2,.07));
    }
    if (i%4===0) trees.push(matrix(x+w*.63,1.2,z+d*.25,1.55,2.3,1.5));
    shadows.push(matrix(x-h*.22,.025,z-h*.09,w+h*.44,.025,d+h*.18));
  }
  const facadeGeo=geometry(new THREE.BoxGeometry());
  facadeGeo.setAttribute('building',new THREE.InstancedBufferAttribute(new Float32Array(styles),3));
  batch(root,facadeGeo,facade,towers,colors);
  const machinery=kit.toon({section:'outro',color:'#718695',rimK:.05});
  batch(root,boxGeo,machinery,rooftops);
  const pitched=geometry(new THREE.BufferGeometry());
  pitched.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,.5,.5,0,.5,0,1,.5,-.5,0,-.5,.5,0,-.5,0,1,-.5],3));
  pitched.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1],2));
  pitched.setIndex([0,1,2,3,5,4,0,2,5,0,5,3,1,4,5,1,5,2]);pitched.computeVertexNormals();
  const tiled=kit.toon({section:'outro',color:'#ffffff',rimK:.025});
  batch(root,pitched,tiled,roofs,tiles);
  const soil=kit.toon({section:'outro',color:'#827e7b',rimK:0});
  box(terrain,soil,0,-.6,-148,510,1,435);
  batch(terrain,boxGeo,kit.toon({section:'outro',color:'#8792a1',rimK:0}),shadows);
  batch(terrain,geometry(new THREE.IcosahedronGeometry(1,0)),kit.toon({section:'outro',color:'#86a177',rimK:.08}),trees);
  function strip(group,mat,path,n,lo,hi,height) {
    const pos=[],uv=[],ix=[];
    for(let i=0;i<=n;i++) {
      const t=i/n;
      for (const side of [lo,hi]) {
        const p=path(t,side,height); pos.push(p.x,p.y,p.z); uv.push(t,side===lo?0:1);
      }
      if(i<n) { const k=i*2; ix.push(k,k+1,k+2,k+1,k+3,k+2) }
    }
    const g=geometry(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(ix); g.computeVertexNormals(); return mesh(group,g,mat,0,0,0);
  }
  const river=(t,offset,y)=>{ const z=27-t*402; return vec(riverX(z)+offset,y,z) };
  const water=kit.toon({section:'outro',color:'#75b4be',rimK:.09,side:THREE.DoubleSide});
  const banks=kit.toon({section:'outro',color:'#b6b69f',rimK:0,side:THREE.DoubleSide});
  strip(terrain,banks,river,110,-5.2,5.2,.08); strip(terrain,water,river,110,-4.38,4.38,.13);
  const bridges=[];
  for(let z=-24;z>-314;z-=37) {
    const x=riverX(z);
    bridges.push(matrix(x,1.2,z,13,.62,1.52),matrix(x,1.66,z-.78,13,.22,.10),matrix(x,1.66,z+.78,13,.22,.10));
  }
  batch(terrain,boxGeo,kit.toon({section:'outro',color:'#a99e94',rimK:.03}),bridges);
  // An old orange radio spire beside the canal catches morning light above
  // the shorter tiled district. Its decks give the skyline a scale reference.
  const spire=[], enamel=[], decks=[];
  const spireX=7, spireZ=-55;
  let ring;
  for(const [h,r] of [[0,4.6],[8,2.54],[14,1.68],[20,1.16],[26,.76],[32,.51],[36,.28]]) {
    const next=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>vec(spireX+a*r,h,spireZ+b*r));
    for(let k=0;k<4;k++) {
      const j=(k+1)%4, steel=h===26||h===36?enamel:spire;
      beam(steel,next[k],next[j],.22);
      if(ring){beam(steel,ring[k],next[k],.26);beam(steel,ring[k],next[j],.15);beam(steel,ring[j],next[k],.15)}
    }
    ring=next;
  }
  for(const [y,w] of [[18.7,4.2],[31.5,2.1]]) {
    decks.push(matrix(spireX,y,spireZ,w,1.17,w));
    enamel.push(matrix(spireX,y+.70,spireZ,w*1.08,.20,w*1.08),matrix(spireX,y-.66,spireZ,w*1.05,.18,w*1.05));
  }
  for(let i=0;i<7;i++) (i%2?enamel:spire).push(matrix(spireX,36.5+i*.9,spireZ,.26-i*.022,.91,.26-i*.022));
  const pier=kit.toon({section:'outro',color:'#c66943',rimK:.09,shade:'#546281'});
  batch(terrain,boxGeo,pier,spire);
  batch(terrain,boxGeo,kit.toon({section:'outro',color:'#fff0d1',rimK:.06}),enamel);
  batch(terrain,boxGeo,kit.toon({section:'outro',color:'#566a7a',rimK:.1}),decks);

  // The roof is a little listening station: cross-braced mast, Yagis and sagging feeds.
  const steel=kit.toon({section:'verse1',color:'#19263e',rimK:.027,lightDir:[.6,.2,-.8]});
  const edgeMetal=kit.toon({section:'verse1',color:'#394657',rimK:.054});
  const frame=[], trim=[];
  const roofY=15;
  frame.push(matrix(-4,roofY-4,-1,24,8,13),matrix(-4,roofY+.15,5,24,.30,.40));
  trim.push(matrix(-4,roofY-.38,5.5,24,.12,.15));
  function mast(x,z,baseY,height,r) {
    let previous;
    for(let j=0;j<=6;j++) {
      const s=j/6, width=r*(1-.85*s), y=baseY+s*height;
      const ring=Array.from({length:3},(_,k)=>vec(x+width*Math.cos(k*TAU/3+.45),y,z+width*Math.sin(k*TAU/3+.45)));
      for(let k=0;k<3;k++) {
        const l=(k+1)%3;
        beam(frame,ring[k],ring[l],.095);
        if(previous) { beam(frame,previous[k],ring[k],.13); beam(trim,previous[k],ring[l],.084) }
      }
      previous=ring;
    }
    frame.push(matrix(x,baseY+height+.57,z,.15,1.22,.15));
  }
  mast(-3,-1,roofY,11,1.5); mast(10,-23,11,8,.85);
  for (const [x,y,z,h] of [[-11,roofY,1,7.8],[2.4,roofY,-1.5,4.7],[11,12,-10,5.4],[-16,14,-13,5]]) {
    const tip=vec(x,y+h,z); beam(frame,vec(x,y,z),tip,.102);
    for(let k=0;k<2;k++) {
      const yy=tip.y-k*.68, length=1.7-k*.3;
      beam(trim,vec(x-length,yy,z-.4),vec(x+length,yy,z+.4),.073);
      for(let a=-3;a<=3;a++) {
        const p=a*length/3;
        beam(trim,vec(x+p-.08,yy,z+.22*p-.48),vec(x+p+.08,yy,z+.22*p+.48),.062);
      }
    }
  }
  for(const [a,b,sag] of [[[-13,23,2],[-3,25.5,-1],1.5],[[-3,24,-1],[11,18,-10],2.6],[[-3,23.6,-1],[11,17.6,-10],2.7],
    [[-23,27.5,7],[2.4,19.6,-1.5],2.3],[[-3,25,-1],[-7,15,1],.4]]) {
    let prev=vec(...a);
    for(let k=1;k<=14;k++) { const s=k/14,p=vec(...a).lerp(vec(...b),s); p.y-=4*s*(1-s)*sag; beam(frame,prev,p,.042); prev=p }
  }
  // A ribbed rooftop cistern on a four-legged stand.
  const tankX=-8.2, tankZ=-2.2;
  for(const dx of [-1,1]) for(const dz of [-1,1]) frame.push(matrix(tankX+dx,16,tankZ+dz,.15,2,.15));
  mesh(roof,geometry(new THREE.CylinderGeometry(1.48,1.4,2.6,20)),edgeMetal,tankX,18.2,tankZ);
  mesh(roof,geometry(new THREE.ConeGeometry(1.57,.64,20)),steel,tankX,19.76,tankZ);
  for(let j=0;j<18;j++){
    const a=TAU*j/18;
    frame.push(matrix(tankX+1.45*Math.cos(a),18.19,tankZ+1.45*Math.sin(a),.035,2.53,.035));
  }
  for(const y of [17.2,18.2,19.2]) mesh(roof,geometry(new THREE.CylinderGeometry(1.49,1.49,.09,20)),steel,tankX,y,tankZ);
  batch(roof,boxGeo,steel,frame); batch(roof,boxGeo,edgeMetal,trim);
  const flare=kit.paint(128,128,(g,w,h)=>{
    const gradient=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    for(const [p,c] of [[0,'#fff1cd'],[.065,'#ff9d70'],[.14,'#ed4c35e6'],[.31,'#fc62465c'],[1,'#fa483900']]) gradient.addColorStop(p,c);
    g.fillStyle=gradient; g.fillRect(0,0,w,h);
  });
  const beaconMat=decal(flare,{light:new THREE.Color(2.4,1.3,1.1),shade:new THREE.Color(2.4,1.3,1.1)});
  beaconMat.blending=THREE.AdditiveBlending;
  const beacon=mesh(roof,plane,beaconMat,-3,27.25,-1); beacon.renderOrder=5;

  // The viaduct is a continuous banked line; its fins, piers and lamp brackets
  // share batches, so the curve retains its rhythm even at the lowest tier.
  const route=new THREE.CatmullRomCurve3([[-33,22,12],[-13,16,8],[5,12.6,-4],[12,11,-24],[4,9,-46],[-16,9,-71],[-16,10,-103]].map(p=>vec(...p)));
  const road=(s,side,h)=>{const p=route.getPoint(s), tangent=route.getTangent(s), n=vec(-tangent.z,0,tangent.x).normalize();return p.addScaledVector(n,side).addScaledVector(up,h+side*.06)};
  const deck=kit.toon({section:'build',color:'#45556a',rimK:.055,side:THREE.DoubleSide});
  strip(viaduct,deck,road,88,-2.35,2.35,0);
  const girders=[], concrete=[], lamps=[];
  for(let j=0;j<74;j++){
    const a=j/74,b=(j+1)/74;
    for(const side of [-2.26,2.26]) {
      beam(girders,road(a,side,.08),road(b,side,.08),.47,.45);
      beam(girders,road(a,side,.88),road(b,side,.88),.065);
      beam(girders,road(a,side,.55),road(b,side,.55),.054);
      if(j%2===0) beam(girders,road(a,side,0),road(a,side,.89),.08);
    }
    if(j%3===0) beam(concrete,road(a,-2.25,-.22),road(a,2.25,-.22),.28,.34);
    if(j%9===2) {
      const p=road(a,0,-2.5); concrete.push(matrix(p.x,p.y/2,p.z,.88,p.y,1.05));
      beam(concrete,p,road(a,-1.84,-.30),.67,.66); beam(concrete,p,road(a,1.84,-.30),.67,.66);
      const mount=road(a,2.32,2.65), tip=road(a,1.3,2.76);
      beam(girders,road(a,2.32,0),mount,.092); beam(girders,mount,tip,.09);
      lamps.push(matrix(tip.x,tip.y-.05,tip.z,.67,.10,.25));
    }
  }
  batch(viaduct,boxGeo,deck,girders); batch(viaduct,boxGeo,edgeMetal,concrete);
  const lampMat=kit.toon({section:'build',emissive:new THREE.Color(2.7,1.35,.46),rimK:0});
  batch(viaduct,boxGeo,lampMat,lamps);
  const trails=[];
  for(const [side,h,color,repeat,speed] of [[2.56,-.34,'#3bdbff',3,-.46],[2.55,-.12,'#9bffff',5,-.55],[2.54,.45,'#ffac50',4,.55],[2.48,.68,'#fa7756',6,.45]]) {
    const tex=kit.paint(256,4,(g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,0);
      for(const [s,a] of [[0,0],[.10,0],[.13,.95],[.25,1],[.65,.52],[1,.015]]) grad.addColorStop(s,'rgba(255,255,255,'+a+')');
      g.fillStyle=grad; g.fillRect(0,0,w,h);
    });
    tex.wrapS=THREE.RepeatWrapping;
    const tint=new THREE.Color(color).multiplyScalar(3.3);
    const mat=decal(tex,{light:tint,shade:tint}); mat.blending=THREE.AdditiveBlending;
    const offset={value:0};
    mat.onBeforeCompile=s=>{s.uniforms.uScroll=offset; s.vertexShader='uniform float uScroll;\n'+s.vertexShader.replace('vUv=uv;', 'vUv=vec2(uv.x*'+repeat.toFixed(1)+'+uScroll,uv.y);')};
    mat.customProgramCacheKey=()=> 'moving-trail-'+repeat;
    strip(viaduct,mat,(t,dy)=>road(t,side,h+dy),88,-.070,.070,0).renderOrder=4;
    trails.push({offset,speed,mat});
  }

  const slab=mesh(terrace,plane,painted(wetStone,{shade:'#ffffff',fog:false}),0,24,16.9);
  slab.rotation.x=-Math.PI/2; slab.scale.set(21,14.8,1);
  const curb=kit.toon({section:'outro',color:'#b6b3a4',rimK:.07});
  box(terrace,curb,0,23.73,16.9,21,.5,14.8);
  const rail=[];
  for(const x of [-10.35,10.35]) {
    rail.push(matrix(x,25.55,16.9,.13,.14,14.8),matrix(x,24.8,16.9,.08,.08,14.8));
    for(const z of [9.65,14,19,24]) rail.push(matrix(x,24.8,z,.16,1.6,.19));
  }
  batch(terrace,boxGeo,curb,rail);
  const lanternPaint=kit.paint(128,192,(g,w,h)=>{
    g.translate(w/2,h/2); g.rotate(Math.PI);
    // The ribs and handle stay legible when foreshortened in the water.
    g.strokeStyle='#724e47'; g.lineWidth=3; g.beginPath();g.ellipse(0,-48,12,17,0,0,TAU);g.stroke();
    const paper=g.createRadialGradient(-6,-6,2,0,0,44);
    paper.addColorStop(0,'#fff8cd');paper.addColorStop(.51,'#ffd986');paper.addColorStop(.85,'#ef925b');paper.addColorStop(1,'#bb5850');
    g.fillStyle=paper;g.beginPath();g.ellipse(0,-2,34,42,0,0,TAU);g.fill();
    for(let y=-34;y<=30;y+=8) {const hw=32*Math.sqrt(1-((y+2)/43)**2);g.strokeStyle='#a8533c99';g.lineWidth=1.8;
      g.beginPath();g.moveTo(-hw,y);g.quadraticCurveTo(0,y+6,hw,y);g.stroke()}
    g.fillStyle='#70454a';g.fillRect(-15,-44,30,5);g.fillRect(-15,36,30,5);
    g.strokeStyle='#b94137';g.lineWidth=2;g.beginPath();g.moveTo(0,41);g.bezierCurveTo(-5,57,8,66,1,73);g.stroke();
    g.fillStyle='#d64d34';g.beginPath();g.ellipse(1,73,3,7,.2,0,TAU);g.fill();
  });
  const reflection=mesh(terrace,plane,decal(lanternPaint,{light:new THREE.Color(1.34,1.15,.96),shade:new THREE.Color(1.34,1.15,.96)}),.1,24.018,17.2);
  reflection.rotation.x=-Math.PI/2; reflection.scale.set(2.47,4.35,1); reflection.renderOrder=2;
  const fogDay=new THREE.FogExp2('#90acbf',.0057), fogNight=new THREE.FogExp2('#1e3652',.014);
  const nightWall=new THREE.Color('#334965'), nightKey=new THREE.Color('#879ec4');
  const white=new THREE.Color('#ffffff');
  function comet(f,low) {
    const g=ctx2d,w=f.W,h=f.H,u=f.shot.u;
    const x=(low?.50+.16*u:.18+1.64*u)*w, y=(low?.20+.055*u:.22+.20*u)*h;
    const dx=(low?.42:.76)*w, dy=(low?.17:.093)*h;
    g.save();g.globalCompositeOperation='screen';
    for(const [width,col,off] of [[.022,'71,125,204',0],[.008,'105,211,255',0],[.002,'230,253,255',0],[.005,'219,156,215',.020]]) {
      const grad=g.createLinearGradient(x-dx,y-dy,x,y);grad.addColorStop(0,'rgba('+col+',0)');grad.addColorStop(.70,'rgba('+col+',.38)');grad.addColorStop(1,'rgba('+col+',.97)');
      g.fillStyle=grad;g.beginPath();g.moveTo(x-dx,y-dy-off*h);g.quadraticCurveTo(x-dx*.35,y-dy*.39+width*h,x,y);
      g.quadraticCurveTo(x-dx*.37,y-dy*.42-width*h,x-dx,y-dy-off*h);g.fill();
    }
    for(let i=0;i<36;i++) {
      const k=(i+.5)/37, a=Math.sin(i*43.7+t*1.4), spread=k*k*h*.026;
      g.fillStyle='rgba(176,219,255,'+((1-k)*(.31+.19*a))+')';
      g.fillRect(x-dx*k+2*Math.sin(i*6.5),y-dy*k+spread*Math.sin(i*17+t*.38),Math.max(.9,h*.0026),Math.max(.9,h*.0019));
    }
    const r=h*.032;const head=g.createRadialGradient(x,y,0,x,y,r);head.addColorStop(0,'#fff');head.addColorStop(.08,'#d4ffff');head.addColorStop(.29,'#80ceff70');head.addColorStop(1,'#449bff00');
    g.fillStyle=head;g.fillRect(x-r,y-r,2*r,2*r);g.restore();
  }
  function ghosts(f) {
    const g=ctx2d,w=f.W,h=f.H,sx=.83-.045*f.shot.u,sy=.14+.04*f.shot.u;
    g.save();g.globalCompositeOperation='screen';
    for(const [s,r,col] of [[.55,.019,'255,211,139'],[.91,.046,'100,204,235'],[1.44,.078,'162,139,226'],[1.78,.105,'109,202,188']]) {
      const x=(sx+(.5-sx)*s)*w,y=(sy+(.5-sy)*s)*h,rad=r*h;
      const grad=g.createRadialGradient(x,y,0,x,y,rad); grad.addColorStop(0,'rgba('+col+',.012)'); grad.addColorStop(.8,'rgba('+col+',.052)');grad.addColorStop(.94,'rgba('+col+',.14)');grad.addColorStop(1,'rgba('+col+',0)');
      g.fillStyle=grad;g.fillRect(x-rad,y-rad,rad*2,rad*2);
    }
    g.restore();
  }
  return {
    update(f) {
      const key=f.shot.key, u=f.shot.u, s=ease(u), t=f.t;
      const bright=key==='lookout'||key==='aerial', low=f.shot.var==='low';
      roof.visible=key==='rooftop'; viaduct.visible=key==='elevated'; terrace.visible=key==='lookout';
      terrain.visible=bright||viaduct.visible; dayAir.visible=bright; nightAir.visible=!bright;
      scene.fog=bright?fogDay:fogNight;
      daylight.value=+bright; windowBeat.value=f.pulse;
      const un=facade.uniforms;
      un.uColor.value.copy(bright?white:nightWall); un.uLight.value.copy(bright?white:nightKey);
      un.uShade.value.set(bright?'#a2aec4':night.shade); un.uRimK.value=bright?.046:.018;
      tiled.uniforms.uColor.value.copy(bright?white:nightWall);
      soil.uniforms.uColor.value.set(bright?'#827e7b':'#17253a');
      machinery.uniforms.uColor.value.set(bright?'#859199':'#34445d');
      if(roof.visible) {
        const a=f.W/Math.max(1,f.H), offset=Math.min(a,1.85)*(low?.30:.23);
        camera.fov=low?57:48;
        camera.position.set(low?-1.9+.6*s:-2.6+.95*s, low?16.7+.20*s:20.0+.23*s,low?16.8:21.7);
        camera.lookAt(-3+offset*9,low?21.45:23.0,-2);
        beacon.quaternion.copy(camera.quaternion); beacon.scale.setScalar(1.02+.95*f.downPulse);
        comet(f,low);
        kit.look({bloom:.82,threshold:.43,glow:.30,tilt:.30,focus:.48,band:.35,rays:.17,rayX:.63,rayY:.29,exposure:.91,lift:[.003,.008,.020]});
      } else if(viaduct.visible) {
        camera.position.set(5.4+1.55*s,8.5+.35*s,15.8-2.9*s);camera.lookAt(1.6,12.6,-17);camera.fov=58;
        for(const trail of trails){trail.offset.value=t*trail.speed;trail.mat.uniforms.uOpacity.value=.78+.22*f.fastPulse}
        kit.look({bloom:.95,threshold:.45,glow:.35,tilt:.30,focus:.53,band:.42,rays:.15,rayX:.67,rayY:.47,lift:[.005,.009,.021]});
      } else if(terrace.visible) {
        const tilt=ease((u-.20)/.66), surge=1-Math.exp(-Math.max(0,f.shot.lt)*3.5);
        camera.position.set(.4+.55*s,30+.3*surge+3.7*tilt,24.7-1.35*surge-11.5*tilt);
        camera.lookAt(.1-4.5*tilt,24.05+4.2*tilt,16.5-83*tilt);camera.fov=54+5*tilt;
        reflection.position.x=.18+.27*Math.sin(t*1.14);reflection.position.z=17.1+.13*Math.sin(t*1.69);
        reflection.rotation.z=.075*Math.sin(t*.9);
        kit.look({threshold:.89,bloom:.39,glow:.18,tilt:.31,focus:.49,band:.36,rays:.14,rayX:.81,rayY:.24,
          leak:.016+.08*f.hit,leakX:.91,leakY:.23,exposure:.88,sat:1.09,lift:[.013,.021,.034],gain:[1.02,1,.98]});
      } else {
        camera.position.set(-10+2.9*s,47+1.7*s,19.0-3.8*s);camera.lookAt(5,16+14*s,-76);camera.fov=64;ghosts(f);
        kit.look({threshold:.86,bloom:.42,glow:.23,tilt:.42,focus:.42,band:.37,rays:.23,rayX:.83,rayY:.17,
          exposure:.90,sat:1.03,leak:.069+.035*f.hit,leakX:.90,leakY:.16,lift:[.021,.029,.039]});
      }
      kit.tick(f,bright?daySky:nightSky,bright?dayMist:nightMist,glints);
    },
    setVisible(on){root.visible=on},
    dispose(){root.removeFromParent();scene.fog=null;for(const resource of own)resource.dispose();own.clear()}
  };
}
