// The crater is the common landmark. Its shore, the leaning island pine and the
// lantern paper recur at different scales over the nine cuts.
const TAU = 2 * Math.PI;
const clamp = x => Math.max(0, Math.min(1, x));
function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function wash(g, x, y, rx, ry, color) {
  g.save();
  g.translate(x, y); g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, color); grad.addColorStop(1, 'transparent');
  g.fillStyle = grad; g.fillRect(-1, -1, 2, 2); g.restore();
}
function stroke(g, x, y, x1, y1, width, color) {
  g.lineWidth = width; g.strokeStyle = color;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
}
// A wind-cut pine, painted from the trunk outwards. Broken fans of needles
// leave small windows of sky between the tiers of the crown.
function paintPine(g, w, h) {
  g.scale(w / 620, h / 420);
  const rng = random(37);
  g.lineCap = 'round';
  function bough(x, y, dx, dy, thick, depth) {
    const bend = (rng() - .48) * .35;
    const mx = x + dx * .57 + dy * bend, my = y + dy * .58 - dx * bend;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x + dx, y + dy);
    g.strokeStyle = '#293d42'; g.lineWidth = thick; g.stroke();
    g.strokeStyle = '#9d9481'; g.lineWidth = thick * .23; g.stroke();
    if (depth > 0) {
      const turn = (a, len, ex, ey, sw) => bough(ex, ey,
        (dx * Math.cos(a) - dy * Math.sin(a)) * len,
        (dx * Math.sin(a) + dy * Math.cos(a)) * len, thick * sw, depth - 1);
      turn((rng() - .52) * .8, .70, x + dx, y + dy, .68);
      const angle = (dx < 0 ? -1 : 1) * (-.52 - rng() * .56);
      turn(angle, .63, mx, my, .49);
    } else {
      const r = 13 + rng() * 14;
      for (let j = 0; j < 95; j++) {
        const a = rng() * TAU, d = Math.sqrt(rng());
        const px = x + dx + Math.cos(a) * d * r * 1.24, py = y + dy + Math.sin(a) * d * r * .45;
        const col = ['#29484b', '#3d5551', '#516c61', '#719180', '#98ab8e'][Math.min(4, Math.floor(rng() * 2.4 + (1 - Math.sin(a) * d) * 1.2))];
        stroke(g, px, py, px + 2 + rng() * 5, py - 2 - rng() * 4, 1.3 + rng() * 2.3, col);
      }
    }
  }
  bough(300, 390, -30, -92, 24, 2);
  bough(273, 303, 48, -66, 18, 3);
  bough(307, 259, 55, -27, 12, 3);
  bough(285, 284, -58, -19, 12, 3);
  bough(317, 240, -48, -41, 11, 3);
  bough(314, 239, 26, -64, 12, 3);
  bough(292, 322, -72, -12, 10, 3);
  for (let i = 0; i < 18; i++) {
    const x = 278 + rng() * 41;
    stroke(g, 298 + rng() * 6, 366, x, 392, 2 + rng() * 3, '#465155');
  }
}
// Painted needles on curved cedar limbs, with light only on the upper tips.
function cedar(g, x, ground, height, width, tone, light, rng) {
  const top = ground - height, lean = (rng() - .5) * width * .4;
  stroke(g, x, ground, x + lean, top, Math.max(.8, width * .038), tone);
  g.lineCap = 'round';
  for (let i = 0; i < 36; i++) {
    const p = (i + .3) / 38, y = top + p * height, base = x + lean * (1 - p);
    for (const side of [-1, 1]) {
      const reach = side * width * (.14 + p * .83) * (.32 + rng() * .60);
      const dip = height * (.02 + p * .08) * (.4 + rng() * .6);
      const tx = base + reach, ty = y + dip * .72;
      g.fillStyle = tone; g.beginPath(); g.moveTo(base, y - height * .027);
      g.quadraticCurveTo(base + reach * .55, y + dip, tx, ty);
      for (let n = 7; n >= 0; n--) {
        const u = n / 8, edge = y + dip * u + height * .024;
        g.lineTo(base + u * reach, edge + rng() * height * .02);
        g.lineTo(base + (u + .03) * reach, edge - height * .014);
      }
      g.fill();
      if (i % 2 === 0) stroke(g, tx, ty, tx - reach * .32, ty - height * .009, Math.max(.6, width * .008), light);
    }
  }
}
function paintForest(g, w, h) {
  const rng = random(425);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#496e81'); sky.addColorStop(.53, '#e9dea9'); sky.addColorStop(1, '#38514b');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  wash(g, w * .67, h * .27, w * .42, h * .64, '#fff4c8');
  for (let layer = 0; layer < 3; layer++) {
    const count = [38, 26, 19][layer], tone = ['#859d95','#536f68','#2d5149'][layer];
    for (let i = 0; i < count; i++) {
      const x = (i + rng()) / count, side = Math.min(1, Math.abs(x - .67) * 3);
      const height = h * (.32 + side * .28 + rng() * .24 + layer * .05);
      const y = h * (.79 + layer * .10);
      cedar(g, x * w, y, height, height * (.10 + rng() * .1), tone, ['#b4bdae','#8b9e7c','#889779'][layer], rng);
    }
  }
  for (const x of [-.02,.06,.13,.91,1.04]) {
    cedar(g, x*w, h*1.12, h*(1.20+rng()*.4), w*(.10+rng()*.08), '#213c38','#5e7253',rng);
  }
  // Translucent sun shafts in the gap in the canopy.
  for (let i=0; i<11; i++) {
    const x = (.62 + rng()*.09)*w, width = (.001+rng()*.013)*w;
    const gr=g.createLinearGradient(0,h*.12,0,h*.90);
    gr.addColorStop(0,'rgba(255,246,182,.13)'); gr.addColorStop(1,'rgba(255,235,173,0)');
    g.fillStyle=gr; g.beginPath();g.moveTo(x,0);g.lineTo(x+width,0);
    g.lineTo(x-w*.38+width*3,h);g.lineTo(x-w*.38,h);g.fill();
  }
}
function paintLeaves(g, w, h) {
  g.scale(w/480,h/300); const rng=random(16); g.lineCap='round';
  function twig(x,y,dx,dy,d) {
    const ex=x+dx, ey=y+dy;
    stroke(g,x,y,ex,ey,d*1.45+.6,'#2c4548');
    if(d) {
      twig(ex,ey,dx*.67+9,(dy+12)*.78,d-1);
      twig(x+dx*.57,y+dy*.57,dx*.35+3,dy*.40+26,d-1);
    }
    for(let i=0;i<7;i++){
      const u=rng(), px=x+dx*u, py=y+dy*u, lx=(rng()-.25)*23, ly=10+rng()*19;
      g.fillStyle=['#263e45','#39595d','#536f70','#6c8884'][Math.floor(rng()*4)];
      g.beginPath();g.moveTo(px,py);g.quadraticCurveTo(px+lx-8,py+ly*.5,px+lx,py+ly);
      g.quadraticCurveTo(px+lx+4,py+ly*.45,px,py);g.fill();
      stroke(g,px,py,px+lx*.72,py+ly*.8,.65,'#84978b');
    }
  }
  twig(-18,9,96,23,4); twig(-15,32,55,34,3);
}
function paintClouds(g,w,h) {
  // A seamless azimuth strip. Broad masses are built first; narrow strokes
  // skim their sunward edges. The same wash appears upside down in the lake.
  const rng=random(93); g.scale(w/1024,h/256);
  for(let i=0;i<88;i++) {
    const cx=rng()*1024, cy=63+rng()*176, size=9+rng()*38;
    for(let j=0;j<20;j++){
      const q=(rng()-.5)*2, x=cx+q*size*1.8, y=cy+q*3+(rng()-.5)*size*.25;
      const rx=(.15+rng()*.56)*size, ry=(.055+rng()*.16)*size*(1-Math.abs(q)*.55);
      g.fillStyle=j<12?'rgba(94,105,133,.19)':'rgba(220,227,219,.20)';
      for(const off of [-1024,0,1024]) {
        g.beginPath();g.ellipse(x+off,y+(j<12?2:-1),rx,ry,-.05,0,TAU);g.fill();
      }
    }
  }
}

const MOODS = {
  lanterns: { sky:['#03091c','#0a1734','#153863','#35658a'], fog:'#294d71', water:'#112941', sun:'#c6eaff', glow:.10, stars:.85, ridge:'#587d97' },
  mist: { sky:['#829fa9','#a7bcc1','#d1d6d2','#d5e0dc'], fog:'#afc8c9', water:'#688890', sun:'#eaf5ec', glow:.09, stars:0, ridge:'#9daea9' },
  tree: { sky:['#689caa','#88b7c0','#bcd5cf','#dbe4d8'], fog:'#accbc8', water:'#5e9497', sun:'#e7fae4', glow:.11, stars:0, ridge:'#80a5a3' },
  drift: { sky:['#78a2b1','#9bbfc4','#c6d7cf','#d8e1d5'], fog:'#b4ccca', water:'#639295', sun:'#fff0d7', glow:.09, stars:0, ridge:'#8aa6a0' },
  rim: { sky:['#202447','#505583','#938bac','#eed0bb'], fog:'#9998b3', water:'#4d597f', sun:'#ffdcbd', glow:.15, stars:.12, ridge:'#858197' },
  night: { sky:['#070f26','#142344','#2d4366','#7385a2'], fog:'#384c68', water:'#24496a', sun:'#a0c9ff', glow:.12, stars:.75, ridge:'#3f5871' },
  mirror: { sky:['#1a2549','#464776','#a28aa1','#d7a8a0'], fog:'#8f839e', water:'#464663', sun:'#f9c6b3', glow:.10, stars:.21, ridge:'#827d95' },
  day: { sky:['#5c97b6','#95bdc9','#dbe2c9','#e6dfc0'], fog:'#b8c6b6', water:'#61969a', sun:'#fff4bd', glow:.19, stars:0, ridge:'#698354' }
};
const WATER_V = `
varying vec3 vWorld;
varying vec4 vClip;
void main(){
  vWorld=(modelMatrix*vec4(position,1.)).xyz;
  vClip=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  gl_Position=vClip;
}`;
const WATER_F = `
uniform sampler2D uReflection,uSky;
uniform vec3 uWater,uSun,uLight,uLantern;
uniform vec2 uRippleCenter;
uniform float uTime,uMotion,uPulse,uRing,uSunPower,uHero;
varying vec3 vWorld;
varying vec4 vClip;
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  vec4 h=fract(sin(dot(i,vec2(121.3,37.7))+vec4(0.,121.3,37.7,159.))*43758.545);
  return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
}
void main(){
  vec2 p=vWorld.xz;
  vec3 eye=vWorld-cameraPosition, ray=normalize(eye);
  float att=1./(1.+length(eye)*.036);
  float brush=noise2(p*vec2(.78,2.8)+vec2(uTime*.14,0.));
  float wave=sin(p.y*3.+brush*6.+uTime*.32);
  float ink=(brush-.5)*uMotion;
  vec2 off=vec2(ink,wave*uMotion)*(.004*att);
  vec2 uv=.5+.5*vClip.xy/vClip.w;
  float rad=length(p-uRippleCenter);
  float crest=(rad-uRing*3.2)*8.;
  float ring=exp(-crest*crest)*exp(-max(uRing,0.)*1.85)*step(0.,uRing);
  off.y+=ring*.006;
  vec3 refl;
#ifdef LIVE_MIRROR
  refl=texture2D(uReflection,clamp(uv+off,.001,.999)).rgb;
#else
  vec3 reflected=reflect(ray,normalize(vec3(ink*.07,1.,wave*.016*uMotion)));
  refl=texture2D(uSky,vec2(.5,1.-pow(max(reflected.y,0.),.6))).rgb;
  float hills=.042+.021*sin(reflected.x*29.)+.013*sin(reflected.x*63.+reflected.z*8.);
  refl=mix(refl*.45,refl,smoothstep(hills-.003,hills+.003,reflected.y));
  float dist=dot(uLantern-vWorld,reflected);
  vec3 gap=vWorld+max(dist,0.)*reflected-uLantern;
  float body=length(gap/vec3(.34,.49,.34));
  refl+=vec3(1.35,.58,.15)*uHero*step(0.,dist)*(1.-smoothstep(.80,1.04,body)+.20*exp(-body*body*.65));
#endif
  float grazing=pow(1.-max(-ray.y,0.),2.);
  vec3 color=mix(uWater,refl,.32+.55*grazing);
  vec3 halfVec=normalize(uLight-ray);
  float glint=pow(max(dot(halfVec,normalize(vec3(ink*.072,1.,wave*.043*uMotion))),0.),340.);
  color+=uSun*uSunPower*glint*(.35+brush*.9);
  float fleck=smoothstep(.65,.92,brush)*smoothstep(.5,.96,wave)*att;
  color+=(uWater+.12)*fleck*(.35+uPulse*.12)*uMotion;
  color+=vec3(.35,.30,.24)*ring*.54;
  gl_FragColor=vec4(color,1.);
}`;
function lakeSurface(THREE, tier) {
  const target=tier==='saver'?null:new THREE.WebGLRenderTarget(1,1,{ type:THREE.HalfFloatType });
  const uniforms = {
    uReflection:{value:target?.texture || null},uSky:{value:null},uWater:{value:new THREE.Color()},
    uSun:{value:new THREE.Color()},uLight:{value:new THREE.Vector3()},uRippleCenter:{value:new THREE.Vector2()},
    uTime:{value:0},uMotion:{value:1},uPulse:{value:0},uRing:{value:-1},uSunPower:{value:0},
    uLantern:{value:new THREE.Vector3()},uHero:{value:0}
  };
  const material = new THREE.ShaderMaterial({uniforms, defines:target?{LIVE_MIRROR:1}:{},
    vertexShader:WATER_V,fragmentShader:WATER_F});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(600,600).rotateX(-Math.PI/2),material);
  mesh.renderOrder=-5;
  return {target,uniforms,mesh};
}
function paintPaper(g,w,h) {
  const rng=random(64), grad=g.createLinearGradient(0,0,0,h);
  for(const [y,c] of [[0,'#563342'],[.05,'#be5529'],[.26,'#ffb75a'],[.49,'#ffe5a0'],[.72,'#ffd184'],[.92,'#f09041'],[1,'#523642']]) grad.addColorStop(y,c);
  g.fillStyle=grad;g.fillRect(0,0,w,h);
  for(let i=0;i<1600;i++){
    const x=rng()*w,y=rng()*h;
    stroke(g,x,y,x+rng()*4,y-rng()*4,.65,i%3?'rgba(112,64,36,.12)':'rgba(255,246,204,.62)');
  }
  for(let i=1;i<=13;i++) {
    const y=i*h/14;
    stroke(g,0,y,w,y,h*.007,'rgba(130,56,34,.57)');
    stroke(g,0,y+h*.007,w,y+h*.007,h*.008,'rgba(255,237,186,.65)');
  }
  for(let i=0;i<8;i++) {
    const x=i*w/8;stroke(g,x,0,x,h,1.4,'rgba(131,78,38,.37)');
  }
  // An original sheaf of reeds stencilled into the lower band of the paper.
  for(let i=0;i<24;i++){
    const x=(i+.4)*w/24, y=h*(.66+rng()*.10);
    stroke(g,x,h*.9,x+4,y,1,'#b46d42');stroke(g,x+2,h*.81,x-3,y+2,1.4,'#cb8f54');
  }
}
function terrainWash(g,w,h) {
  const rng=random(85);
  g.fillStyle='#f0eddf';g.fillRect(0,0,w,h);
  for(let i=0;i<12500;i++){
    const x=rng()*w,y=rng()*h, size=.2+rng()*w*.007;
    stroke(g,x,y,x+size,y-size*(rng()*.9),.6+rng()*1.6,i%4?'rgba(69,88,74,.22)':'rgba(255,253,213,.63)');
  }
}
function tintTopography(THREE, geo) {
  const pos=geo.attributes.position;
  geo.computeVertexNormals();
  const norm=geo.attributes.normal, colors=new Float32Array(pos.count*3), uv=new Float32Array(pos.count*2);
  const low=new THREE.Color('#7d9b61'), woods=new THREE.Color('#3f7463'), crag=new THREE.Color('#b3afa1'), color=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i);
    const grove=.52+.22*Math.sin(x*.22+Math.cos(z*.36))+.25*Math.sin(z*.28+x*.12);
    color.copy(low).lerp(woods,clamp(grove)).lerp(crag,clamp((1-norm.getY(i))*2.8+(y-18)*.035));
    color.multiplyScalar(.90+.1*Math.sin(x*.85+z*.31));
    color.toArray(colors,i*3);uv.set([(x+131)/262,(z+131)/262],i*2);
    // Lower the outermost edge of the rectangular Blender grid into far fog.
    const boundary=Math.max(Math.abs(x),Math.abs(z));
    if(boundary>96) pos.setY(i,y*(1-.8*clamp((boundary-96)/28)));
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geo.computeVertexNormals();
}
function paperShape(THREE,segments) {
  const profile=[[0,-.5],[.23,-.49],[.34,-.38],[.40,-.13],[.40,.14],[.34,.38],[.23,.48],[0,.49]];
  return new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);
}
function pointPositions(pts,coords) {
  const attr=pts.geometry.attributes.position;
  for(let i=0;i<coords.length;i++)attr.setXYZ(i,...coords[i]);
  attr.needsUpdate=true;
}
// Fixed kit particles can act as a soft halo on a specific lantern or window.
function fixedGlow(kit, coords, options) {
  const points=kit.particles({kind:'glow',count:coords.length,box:[480,480,480],center:[0,0,0],
    drift:[0,0,0],wobble:0,twinkle:.12,beat:.12,...options});
  pointPositions(points,coords);return points;
}
export async function create({THREE,scene,camera,back2d,ctx2d,renderer,kit,tier,seed,timing,base,jsm}) {
  const {GLTFLoader}=await import(jsm+'loaders/GLTFLoader.js');
  const gltf=await new GLTFLoader().loadAsync(base+'lake.glb');
  const rng=random(392+(seed||0)), root=new THREE.Group(), world=new THREE.Group(), geos=new Set(), instances=[];
  root.add(world);scene.add(root);
  const geom=g=>(geos.add(g),g);
  const group=p=>{const o=new THREE.Group();p.add(o);return o};
  const mesh=(p,g,m)=>{const o=new THREE.Mesh(geom(g),m);p.add(o);return o};
  const inst=(p,g,m,n)=>{const o=new THREE.InstancedMesh(geom(g),m,n);p.add(o);instances.push(o);o.frustumCulled=false;return o};
  const dummy=new THREE.Object3D();
  function stamp(o,i,x,y,z,sx,sy=sx,sz=sx,angle=0) {
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,angle,0);
    dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);
  }
  function painted(options,texture){
    const mat=kit.toon(options);
    mat.uniforms.uMapOn.value=1;mat.uniforms.uMap.value=texture;return mat;
  }
  const sky=kit.sky({section:'verse1',stops:MOODS.lanterns.sky});world.add(sky);
  const cloud=kit.paint(768,192,paintClouds);cloud.wrapS=THREE.RepeatWrapping;
  const skyM=sky.material, skyU=skyM.uniforms;
  skyU.uCloud={value:cloud};skyU.uCloudInk={value:new THREE.Color()};skyU.uCloudLight={value:new THREE.Color()};
  skyM.fragmentShader='uniform sampler2D uCloud; uniform vec3 uCloudInk,uCloudLight;\n'+skyM.fragmentShader.replace('gl_FragColor=vec4(c,1.);',`
    vec2 q=vec2(atan(d.z,d.x)/6.2831853+.5+uTime*.00021,clamp(d.y*1.55+.16,0.,1.));
    vec4 cloud=texture2D(uCloud,q);
    float lit=smoothstep(.21,.65,cloud.r);
    c=mix(c,mix(uCloudInk,uCloudLight,lit),cloud.a*.74);
    gl_FragColor=vec4(c,1.);`);
  const ramps={};for(const [name,m] of Object.entries(MOODS))ramps[name]=kit.ramp(m.sky);
  const lake=lakeSurface(THREE,tier), water=lake.mesh, wu=lake.uniforms;root.add(water);
  const basin=group(world);
  const terrain=gltf.scene.getObjectByName('terrain'), gate=gltf.scene.getObjectByName('torii'), stone=gltf.scene.getObjectByName('toro');
  const oldMaterials=new Set();
  gltf.scene.traverse(o=>{if(o.isMesh){geos.add(o.geometry);oldMaterials.add(o.material)}});
  oldMaterials.forEach(m=>m.dispose());
  tintTopography(THREE,terrain.geometry);
  const land=painted({section:'outro',vertexColors:true,lightDir:[-.65,.48,-.51],soft:.23,rimK:.12,ambient:.42},kit.paint(512,512,terrainWash));
  terrain.material=land;basin.add(terrain);
  // Water is the only surface with a specialised shader. Clip the submerged
  // lake floor out of the reflected terrain, including when looking straight down.
  land.uniforms.uReflect={value:0};
  land.fragmentShader='uniform float uReflect;\n'+land.fragmentShader.replace('void main(){','void main(){if(uReflect>.5 && vWp.y>.015) discard;');
  const clay=kit.toon({vertexColors:true,section:'build',shade:'#994c52',light:'#ffe2bb',ambient:.48,rimK:.20,lightDir:[.6,.7,-.25]});
  gate.geometry.computeVertexNormals();stone.geometry.computeVertexNormals();gate.material=clay;stone.material=clay;
  const shrine=group(world);shrine.add(gate);
  const steps=inst(shrine,new THREE.BoxGeometry(1,1,1),kit.toon({section:'build',color:'#848379',shade:'#615e72',rimK:.10}),12);
  for(let i=0;i<12;i++)stamp(steps,i,0,-.12-i*.115,1.5+i*.73,5.2+.7*i,.25,.88);
  for(const [x,z,s] of [[-3.4,2,1],[3.5,2,1],[-4.3,5.7,.92],[4.3,5.7,.92]]) {
    const o=stone.clone();o.position.set(x,.13-(z-2)*.18,z);o.scale.setScalar(s);shrine.add(o);
  }
  const paper=painted({section:'build',light:'#ffe8c8',shade:'#cd835d',rim:'#ffdd86',ambient:.4,rimK:.24,
    emissive:new THREE.Color(.34,.11,.018)},kit.paint(256,192,paintPaper));
  const hero=group(world);mesh(hero,paperShape(THREE,32),paper);
  const wood=kit.toon({section:'build',color:'#59403f',rim:'#e5b886',rimK:.12});
  const cap=geom(new THREE.CylinderGeometry(.24,.24,.055,24));
  for(const y of [-.49,.49])mesh(hero,cap,wood).position.y=y;
  const loop=new THREE.CatmullRomCurve3([[-.18,.50,0],[-.16,.65,0],[0,.73,0],[.16,.65,0],[.18,.50,0]].map(v=>new THREE.Vector3(...v)));
  mesh(hero,new THREE.TubeGeometry(loop,16,.012,5,false),wood);
  const lanternGlow=fixedGlow(kit,[[0,0,0]],{color:'#ffaf52',size:2.1,opacity:.36,intensity:2.4});
  hero.add(lanternGlow);
  const flotilla=group(world), count={saver:150,smooth:450,ultra:1400}[tier];
  const fleet=inst(flotilla,paperShape(THREE,tier==='ultra'?10:8),paper,count), lights=[];
  for(let i=0;i<count;i++) {
    const a=rng()*TAU, r=8+Math.sqrt(rng())*32;
    const x=Math.cos(a)*r, z=-6+Math.sin(a)*r, s=(.12+rng()*.62)*(i<140?1:.43);
    const y=.22+Math.pow(rng(),4.8)*(i%4===0?12:4.6)+s*.45;
    stamp(fleet,i,x,y,z,s,s*1.06,s,rng()*TAU);lights.push([x,y,z]);
  }
  const fleetGlow=fixedGlow(kit,lights,{color:'#ffbc6a',color2:'#ffd58a',size:1.1,opacity:.33,intensity:2,on:'fast'});
  flotilla.add(fleetGlow);

  const island = group(world);
  const bank = mesh(island, new THREE.SphereGeometry(1, 28, 12), kit.toon({
    section:'verse2', color:'#5d7970', shade:'#698282', light:'#d3d8bd', rimK:.12
  }));
  bank.scale.set(3.2, .66, 1.65);
  bank.position.y = -.32;
  island.position.set(0, 0, -13);
  const pine = painted({section:'verse2', side:THREE.DoubleSide, ambient:.46, rimK:0}, kit.paint(480, 325, paintPine));
  pine.fragmentShader = pine.fragmentShader.replace('base*=tx.rgb;', 'if(tx.a<.45)discard;base*=tx.rgb;');
  const crown = mesh(island, new THREE.PlaneGeometry(9.4, 6.35), pine);
  crown.position.y = 3.08;

  const mist = kit.haze({
    center:[0,.7,-18], box:[82,1.7,49], top:'#c9deda', bottom:'#a0bcbc',
    size:11, opacity:.28, drift:[.17,0,0], seed:29
  });
  // The kit uses camera-facing puffs. Compress their vertical extent into lake mist.
  mist.material.vertexShader = mist.material.vertexShader.replace('u*position.y', 'u*position.y*.32');
  world.add(mist);
  const ridgeFog = kit.haze({
    center:[0,18,-62], box:[156,7,12], size:21, opacity:.21,
    top:'#e0c8d7', bottom:'#968bab', drift:[.12,0,0], seed:53
  });
  world.add(ridgeFog);

  const settlements = [];
  for (let i = 0; i < 360; i++) {
    const town = Math.floor(i / 30), a = town * TAU / 12 + (rng() - .5) * .22;
    const r = 36.5 + rng() * 6.1;
    settlements.push([Math.cos(a) * r, 1.8 + (r - 36.5) * .52, Math.sin(a) * r]);
  }
  const townLights = fixedGlow(kit, settlements, {
    color:'#ffa65d', color2:'#ffe2b1', size:.53, opacity:.76, intensity:3.4
  });
  world.add(townLights);

  const forest = kit.paint(1024, 660, paintForest).image;
  const leaves = kit.paint(480, 300, paintLeaves).image;
  const fogStrip = kit.paint(640, 64, (g,w,h) => {
    const rnd = random(50);
    for (let i = 0; i < 100; i++) {
      wash(g, rnd()*w, (.37+rnd()*.26)*h, (rnd()*.14+.035)*w,
        (rnd()*.15+.08)*h, 'rgba(213,233,228,.11)');
    }
  }).image;

  const light = new THREE.Vector3();
  const subject = new THREE.Vector3();
  const target = lake.target;
  const poses = {
    lanterns:{ from:[0,3.2,16], travel:[2,.45,-3], aim:[0,2.9,-20], fov:43 },
    mist:{ from:[7,2.65,17], travel:[-2,.05,-1.8], aim:[-2,1.3,-18], fov:41 },
    tree:{ from:[4,2.2,4], travel:[-1.3,.2,-2.6], aim:[0,2.05,-13], fov:37 },
    drift:{ from:[-3,1.55,4], travel:[.75,.09,-1.2], aim:[-.30,1.5,-9], fov:39 },
    torii:{ from:[-2.6,1.7,12.7], travel:[1.1,.22,-1.9], aim:[.1,3.06,0], fov:46 },
    rim:{ from:[-51,32,58], travel:[10,-1,-8], aim:[-1,10,-21], fov:48 },
    night:{ from:[14,62,64], travel:[3,30,27], aim:[0,1.5,-6], fov:49 },
    mirror:{ from:[.2,1.66,9.1], travel:[.13,-.52,-4.9], aim:[.35,.30,-4], fov:35 },
    day:{ from:[-44,83,73], travel:[17,-6,-10], aim:[0,3,-4], fov:52 }
  };
  const fog = new THREE.FogExp2('#a7c2c4', .018);
  scene.fog = fog;

  function paintAir(f, name, u) {
    const {W:w,H:h} = f;
    if (name === 'torii') {
      const width = Math.max(w * 1.06, h * 1.55);
      back2d.drawImage(forest, (w-width)*.55-u*w*.035, -h*.04, width, h*1.09);
      const flare = .2 + .25 * f.downPulse;
      wash(ctx2d, w*.66, h*.34, h*.21, h*.12, `rgba(255,213,135,${flare})`);
      wash(ctx2d, w*.40, h*.60, h*.044, h*.026, `rgba(168,221,188,${flare*.24})`);
    } else if (mist.visible) {
      ctx2d.save();
      ctx2d.globalAlpha = name === 'mist' ? .49 : .29;
      ctx2d.drawImage(fogStrip, -w*(.17+u*.10), h*.41, w*1.39, h*.15);
      ctx2d.drawImage(fogStrip, -w*(.17-u*.08), h*.55, w*1.37, h*.20);
      if (name === 'mist') {
        ctx2d.globalAlpha = .91;
        const width = Math.min(w*.52,h*.77);
        ctx2d.drawImage(leaves, -width*(.11+u*.07), h*.044, width, width*.64);
        ctx2d.translate(w, h*.17);
        ctx2d.scale(-1,1);
        ctx2d.drawImage(leaves, -width*.25, -h*.09, width*.68, width*.41);
      }
      ctx2d.restore();
    } else if (name === 'lanterns') {
      const x = w*(.61+u*.14), y = h*(.25+u*.07), dx = Math.min(w*.44,h*.30);
      wash(ctx2d, x, y, h*.027, h*.020, 'rgba(137,220,255,.37)');
      for (const [dy, opacity, width] of [[0,.86,1.05],[-.009,.32,.56],[.007,.44,.73]]) {
        const tail = ctx2d.createLinearGradient(x-dx,y-h*.1,x,y);
        tail.addColorStop(0,'rgba(108,194,251,0)');
        tail.addColorStop(.72,`rgba(120,207,255,${opacity*.47})`);
        tail.addColorStop(1,`rgba(209,248,255,${opacity})`);
        stroke(ctx2d,x-dx,y-h*(.105-dy),x,y+h*dy,Math.max(1,h*.0016*width),tail);
      }
    }
  }

  function reflect(f) {
    const width = Math.max(1, f.W >> 1), height = Math.max(1, f.H >> 1);
    target.setSize(width, height);
    const previous = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    // Mirror the world around y=0 with the original camera. This preserves the
    // viewport's projection and leaves the reflection aligned with the shore.
    world.scale.y = -1;
    water.visible = false;
    land.uniforms.uReflect.value = 1;
    const viewHeight = lanternGlow.material.uniforms.uViewH;
    const previousHeight = viewHeight.value;
    viewHeight.value = height;
    try {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene,camera);
    } finally {
      viewHeight.value = previousHeight;
      land.uniforms.uReflect.value = 0;
      water.visible = true;
      world.scale.y = 1;
      renderer.setRenderTarget(previous,cubeFace,mip);
    }
  }

  root.visible = false;
  return {
    update(f) {
      const {key, var:variant, u, lt} = f.shot;
      const name = variant || key;
      const mood = MOODS[name] || MOODS.day;
      const pose = poses[name] || poses.day;
      const eased = u*u*(3-2*u);
      const travel = eased + .11*(lt - u*(f.shot.t1-f.shot.t0));
      camera.position.fromArray(pose.from);
      subject.fromArray(pose.travel);
      camera.position.addScaledVector(subject, travel);
      // Keep the focal action inside narrow split viewports.
      camera.fov = Math.min(70,pose.fov + (name === 'lanterns' ? Math.max(0,.72-camera.aspect)*18 : 0));
      camera.lookAt(...pose.aim);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      shrine.visible = name === 'torii';
      sky.visible = basin.visible = water.visible = !shrine.visible;
      mist.visible = key === 'mist';
      ridgeFog.visible = key === 'crater';
      island.visible = mist.visible;
      flotilla.visible = name === 'lanterns';
      hero.visible = name === 'mirror' || name === 'drift';
      townLights.visible = name === 'night';
      hero.position.set(name === 'drift' ? 1.12-eased*.92 : .35, .90+.024*Math.sin(f.t*1.3),
        name === 'drift' ? -4.7-travel*3.05 : -4);
      crown.rotation.y = Math.atan2(camera.position.x-island.position.x,camera.position.z-island.position.z);
      fog.color.set(mood.fog);
      fog.density = mist.visible ? .033 : name === 'torii' ? .006 : .0065;
      land.uniforms.uColor.value.set(mood.ridge);
      land.uniforms.uLight.value.set(name === 'day' ? '#fff9e4' : mood.fog);
      land.uniforms.uShade.value.set(name === 'day' ? '#8ba2a0' : '#7793b2');
      paper.uniforms.uEmissive.value.setRGB(.34,.11,.018).multiplyScalar(1+.23*f.fastPulse);
      light.set(name === 'day' ? -.42 : .26, name === 'day' ? .29 : .094,-1).normalize();
      skyU.uRamp.value = ramps[name] || ramps.day;
      skyU.uSunDir.value.copy(light);
      skyU.uSunCol.value.set(mood.sun);
      skyU.uSun.value = mood.glow;
      skyU.uStars.value = mood.stars;
      skyU.uCloudInk.value.set(mood.sky[1]).multiplyScalar(.70);
      skyU.uCloudLight.value.set(mood.sky[2]).multiplyScalar(1.14);
      kit.tick(f,sky,mist,ridgeFog,lanternGlow,fleetGlow,townLights);
      wu.uTime.value = f.t;
      wu.uWater.value.set(mood.water);
      wu.uSky.value = skyU.uRamp.value;
      wu.uMotion.value = name === 'mirror' || name === 'drift' ? 0 : mist.visible ? .32 : .69;
      wu.uLight.value.copy(light);
      wu.uSun.value.set(mood.sun);
      wu.uSunPower.value = name === 'day' ? 1.1 : .42;
      wu.uPulse.value = f.pulse;
      wu.uHero.value = Number(hero.visible);
      wu.uLantern.value.copy(hero.position);
      wu.uRippleCenter.value.set(hero.position.x,hero.position.z);
      // Find the first downbeat after the cut so the reflection carries one ring.
      const downbeat = name === 'mirror' ? timing.downbeats.find(t => t >= f.shot.t0 && t < f.shot.t1) : undefined;
      wu.uRing.value = downbeat === undefined ? -1 : f.t-downbeat;

      if (target && water.visible) reflect(f);
      paintAir(f,name,travel);
      subject.copy(hero.position).project(camera);
      const rays = hero.visible ? {rays:.13, rayX:.5+.5*subject.x, rayY:.5+.5*subject.y} : {};
      kit.look({
        bloom: name === 'day' ? .29 : .41, glow:mist.visible ? .33 : .24,
        tilt:name === 'day' || name === 'night' ? .13 : .05, focus:.51,
        sat: name === 'mist' ? .72 : name === 'day' ? 1.02 : .92,
        exposure:name === 'day' ? 1.15 : name === 'night' ? 1.03 : 1.09,
        ...(name === 'torii' ? {leak:.14+.18*f.downPulse,leakX:.66,leakY:.66,rays:.17,rayX:.66,rayY:.66} : rays)
      });
    },
    setVisible(on) { root.visible = on },
    dispose() {
      scene.remove(root);
      scene.fog = null;
      for (const instance of instances) instance.dispose();
      for (const geometry of geos) geometry.dispose();
      water.geometry.dispose();
      water.material.dispose();
      target?.dispose();
    }
  };
}
