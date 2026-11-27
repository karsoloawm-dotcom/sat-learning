/* Dream Lantern v2 scene module "rooms" (plan 8.5): morning rooms.
   One small tatami room, built in 3D and painted on canvas (tatami, plaster, wood grain, shoji with a glass band, fusuma
   with gold mist), with props: a futon and pillow with the cord coiled on it, a bedside shelf with a handless twin-bell
   clock, a low desk with books and an open notebook, an andon, a hand mirror, and two more rooms of sliding doors behind.
   Light is the hero: kit.toon() is extended with sunlight that comes through the shoji's glass band (soft-edged lattice
   patches on everything it reaches, blocked by the futon, desk and shelf) and a lamp; the beams are ray-marched volumes;
   dust is lit only inside them; the paper panes glow in HDR so the post blooms them. The garden seen through the glass is
   painted on back2d. Each setup is a camera, a mood (light, grade, fog) and a few props; update(f) is pure in f. */

/* sunlight through the shoji (the window is the plane z = uWinO.z, light travels along uSunD), box occluders, one lamp */
const LIGHT = `uniform vec3 uWinO,uSunD,uSunC,uLampP,uLampC,uOccA[4],uOccB[4];uniform vec4 uWinR,uGrid;uniform float uLampR,uMir;
float bnd(float x,float a,float b,float s){return smoothstep(a-s,a+s,x)*(1.-smoothstep(b-s,b+s,x));}
float occ(vec3 p){float o=1.;vec3 iv=1./(-uSunD+1e-5);for(int i=0;i<4;i++){vec3 t0=(uOccA[i]-p)*iv,t1=(uOccB[i]-p)*iv,mn=min(t0,t1),mx=max(t0,t1);
  o*=1.-smoothstep(0.,.04,min(min(mx.x,mx.y),mx.z)-max(max(max(mn.x,mn.y),mn.z),0.));}return o;}
float winLit(vec3 p){float d=p.z-uWinO.z;if(d<0.||uWinR.z<=uWinR.x)return 0.;float t=d/max(uSunD.z,.05);vec2 w=(p-uSunD*t-uWinO).xy;float s=.005+t*uGrid.w;
  float r=bnd(w.x,uWinR.x,uWinR.z,s)*bnd(w.y,uWinR.y,uWinR.w,s);
  if(uGrid.x>0.){vec2 g=abs(fract((w-uWinR.xy)/uGrid.xy+.5)-.5)*uGrid.xy;r*=smoothstep(uGrid.z*.5-s,uGrid.z*.5+s,min(g.x,g.y));}
  return r>.001?r*occ(p):0.;}
vec3 lampAt(vec3 p,vec3 n){vec3 l=uLampP-p;float d=length(l)+1e-4;return uLampC*(max(dot(n,l/d),0.)*.75+.25)/(1.+d*d/(uLampR*uLampR));}
`;
/* the light shafts: a box swept from the window opening along the sun, ray-marched through winLit() */
const SHAFT_V = "varying vec3 vL,vW;void main(){vL=position;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}";
const SHAFT_F = LIGHT + `uniform vec3 uCamL,uSize,uBoxO,uCol;uniform float uTime;varying vec3 vL,vW;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){vec3 rd=vL-uCamL+1e-6,iv=1./rd,t0=-uCamL*iv,t1=(1.-uCamL)*iv,mn=min(t0,t1),mx=max(t0,t1);
  float en=max(max(mn.x,mn.y),mn.z),a=max(en,0.),b=min(min(mx.x,mx.y),mx.z);
  if((!gl_FrontFacing&&en>0.)||b<=a)discard;
  float acc=0.,j=h21(gl_FragCoord.xy+fract(uTime));
  for(int i=0;i<STEPS;i++){vec3 p=uCamL+rd*mix(a,b,(float(i)+j)/float(STEPS));vec3 q=uBoxO+vec3(p.xy*uSize.xy,0.)+uSunD*(p.z*uSize.z);
    acc+=winLit(q)*step(0.,q.y)*pow(1.-p.z,1.4)*(.72+.28*sin(q.x*29.+q.y*11.+uTime*.6)*sin(q.z*17.-q.y*5.-uTime*.4));}
  gl_FragColor=vec4(uCol*acc/float(STEPS)*(b-a)*length(vW-cameraPosition),0.);}`;
/* clock numerals: instanced quads into a 4x3 atlas; ink on the face, then glowing petals when they leave */
const NUM_V = "attribute vec2 aCell;attribute vec2 aFx;varying vec2 vUv,vFx;void main(){vUv=(uv+aCell)/vec2(4.,3.);vFx=aFx;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}";
const NUM_F = "uniform sampler2D uMap;uniform vec3 uInk,uGlow;varying vec2 vUv,vFx;void main(){float a=texture2D(uMap,vUv).a*vFx.y;if(a<.02)discard;gl_FragColor=vec4(mix(uInk,uGlow,vFx.x),a);}";
/* lens flare and sun, in camera space: 0 soft ghost, 1 ring, 2 the sun */
const FL_V = "attribute float aK;varying vec2 vUv;varying float vK;varying vec3 vC;void main(){vUv=uv*2.-1.;vK=aK;vC=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}";
const FL_F = `uniform float uI;varying vec2 vUv;varying float vK;varying vec3 vC;void main(){float r=length(vUv),a;
  if(vK<.5)a=exp(-r*r*3.)*(1.-smoothstep(.7,1.,r));else if(vK<1.5)a=exp(-pow((r-.72)*10.,2.))*.7+exp(-r*r*5.)*.08;
  else a=exp(-r*r*60.)*4.+exp(-r*r*7.)*.7+(exp(-abs(vUv.y)*120.)+exp(-abs(vUv.x)*160.)*.5)*exp(-r*1.5)*.9;
  gl_FragColor=vec4(vC*a*uI,0.);}`;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), ease = x => (x = clamp(x), x * x * (3 - 2 * x)), easeIn = x => (x = clamp(x), x * x * x), mix = (a, b, u) => a + (b - a) * u;

export async function create({ THREE, scene, camera, back2d, kit, tier, timing }) {
  const Q = { saver: 0, smooth: 1, ultra: 2 }[tier] ?? 1, V3 = THREE.Vector3, C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
  let sd = 20261127; const rnd = () => { sd = sd + 0x6D2B79F5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
  const geos = [], mats = [], insts = [], cans = [], G = g => (geos.push(g), g), M = m => (mats.push(m), m);
  const root = new THREE.Group(); scene.add(root);
  const fog = scene.fog = new THREE.Fog(0xcdb8cc, 2.5, 16);

  /* ---------- light uniforms, shared by every material that takes the room's light ---------- */
  const far = () => new V3(1e4, 1e4, 1e4);
  const U = { uWinO: { value: new V3(-1.8, 0, -3.6) }, uSunD: { value: new V3(.3, -.4, 1).normalize() }, uSunC: { value: new THREE.Color() }, uWinR: { value: new THREE.Vector4() }, uGrid: { value: new THREE.Vector4() },
    uLampP: { value: new V3() }, uLampC: { value: new THREE.Color() }, uLampR: { value: 1 }, uMir: { value: 1 }, uOccA: { value: [far(), far(), far(), far()] }, uOccB: { value: [far(), far(), far(), far()] } };
  const MOOD = { uLight: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uAmbSky: { value: new THREE.Color() }, uAmbGround: { value: new THREE.Color() }, uLightDir: { value: new V3(0, 1, 0) } };
  /* occluders (room space): futon with pillow, desk, shelf, and everything beyond the room's back wall */
  [[-.26, 0, -2.78, .88, .22, -.58], [-1.5, 0, -3.33, -.6, .36, -2.87], [1.0, 0, -3.21, 1.5, .34, -2.89], [-9, -9, .03, 9, 9, 99]].forEach((b, i) => { U.uOccA.value[i].set(b[0], b[1], b[2]); U.uOccB.value[i].set(b[3], b[4], b[5]) });
  /* kit.toon() plus the room's sun and lamp; every room material shares one mood */
  function toon(o) {
    const m = kit.toon(Object.assign({ section: "prechorus" }, o)), fs = m.fragmentShader;
    m.fragmentShader = fs.replace("void main(){", LIGHT + "void main(){").replace("gl_FragColor=vec4(c+uEmissive", "vec3 pw=vWp;pw.x*=uMir;vec3 nm=n;nm.x*=uMir;c+=base*(uSunC*winLit(pw)*max(dot(nm,-uSunD),0.)+lampAt(pw,nm));gl_FragColor=vec4(c+uEmissive");
    if (!m.fragmentShader.includes("lampAt(pw")) console.warn("rooms: kit.toon changed; the room light is off");
    Object.assign(m.uniforms, U, MOOD); return m;
  }
  /* kit.particles() lit by the same sun: dust shows only inside the beams */
  function litPoints(o) {
    const p = kit.particles(o), m = p.userData.material;
    m.vertexShader = "varying vec3 vPw;\n" + m.vertexShader.replace("gl_Position=projectionMatrix*mv;}", "vPw=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*mv;}");
    m.fragmentShader = LIGHT + "uniform float uLitAmb,uLitK;varying vec3 vPw;\n" + m.fragmentShader.replace("if(a<.003)discard;", "vec3 pw=vPw;pw.x*=uMir;a*=uLitAmb+uLitK*(winLit(pw)+dot(lampAt(pw,vec3(0.,1.,0.)),vec3(.3)));if(a<.003)discard;");
    Object.assign(m.uniforms, U, { uLitAmb: { value: .05 }, uLitK: { value: 1 } }); return p;
  }

  /* ---------- painted textures (canvas, once) ---------- */
  const px = (a, b, c) => [a, b, c][Q];
  const tex = (w, h, fn, rep) => { const t = kit.paint(Math.round(w), Math.round(h), fn); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t };
  const blob = (g, x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, "0)")); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r) };
  const tatami = tex(px(768, 1280, 2048), px(768, 1280, 2048), (g, w, h) => {
    const k = w / 3.6; g.fillStyle = "#3a3020"; g.fillRect(0, 0, w, h);
    for (const [x0, z0, x1, z1] of [[-1.8, -3.6, 0, -2.7], [0, -3.6, 1.8, -2.7], [-1.8, -2.7, -.9, -.9], [-.9, -2.7, 0, -.9], [0, -2.7, .9, -.9], [.9, -2.7, 1.8, -.9], [-1.8, -.9, 0, 0], [0, -.9, 1.8, 0]]) {
      const X = (x0 + 1.8) * k + 1, Y = (z0 + 3.6) * k + 1, W = (x1 - x0) * k - 2, H = (z1 - z0) * k - 2, vert = H > W, hue = 50 + rnd() * 9, L = 60 + rnd() * 7;
      const gr = g.createLinearGradient(X, Y, X + W, Y + H); gr.addColorStop(0, `hsl(${hue},36%,${L + 5}%)`); gr.addColorStop(1, `hsl(${hue + 5},30%,${L - 5}%)`); g.fillStyle = gr; g.fillRect(X, Y, W, H);
      const step = Math.max(1.6, k * .006);
      for (let o = 0; o < (vert ? H : W); o += step) { g.fillStyle = rnd() < .5 ? `rgba(70,60,20,${.05 + rnd() * .09})` : `rgba(255,250,215,${.05 + rnd() * .08})`; vert ? g.fillRect(X, Y + o, W, step * .5) : g.fillRect(X + o, Y, step * .5, H) }
      for (let i = 0; i < 5; i++) blob(g, X + rnd() * W, Y + rnd() * H, k * (.2 + rnd() * .3), `rgba(255,246,210,${.05 + rnd() * .06})`);
      const hb = .03 * k; g.fillStyle = "#23283a"; vert ? (g.fillRect(X, Y, hb, H), g.fillRect(X + W - hb, Y, hb, H)) : (g.fillRect(X, Y, W, hb), g.fillRect(X, Y + H - hb, W, hb));
      g.fillStyle = "rgba(160,150,190,.35)"; vert ? (g.fillRect(X + hb * .35, Y, hb * .12, H), g.fillRect(X + W - hb * .47, Y, hb * .12, H)) : (g.fillRect(X, Y + hb * .35, W, hb * .12), g.fillRect(X, Y + H - hb * .47, W, hb * .12));
    }
  }, true);
  const wood = tex(px(128, 256, 256), px(256, 512, 512), (g, w, h) => {
    g.fillStyle = "#caa57c"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { let x = rnd() * w; const a = .05 + rnd() * .2, dark = rnd() < .7; g.strokeStyle = dark ? `rgba(105,66,36,${a})` : `rgba(245,222,185,${a})`; g.lineWidth = .5 + rnd() * 2.2 * w / 256; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h + 16; y += 16) { x += Math.sin(y * .012 + i) * 1.1 + (rnd() - .5) * .8; g.lineTo(x, y) } g.stroke() }
  }, true);
  const plaster = tex(px(256, 512, 512), px(256, 512, 512), (g, w, h) => {
    g.fillStyle = "#e3d5b9"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < .5 ? `rgba(150,118,82,${.03 + rnd() * .05})` : `rgba(255,248,230,${.03 + rnd() * .06})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, (1 + rnd() * 12) * w / 512, 0, 7); g.fill() }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(110,80,50,${.15 + rnd() * .2})`; g.fillRect(rnd() * w, rnd() * h, 1, 1) }
  }, true);
  const SW = px(160, 224, 320), paper = tex(SW, SW * 1.47 / .87, (g, w, h) => { /* paper above, glass below (transparent: the garden on back2d shows through), kumiko lattice */
    const k = w / .87, Y = y => h - (y - .3) * k, bw = Math.max(2, .017 * k);
    const pg = g.createLinearGradient(0, 0, 0, Y(.92)); pg.addColorStop(0, "#fffaf2"); pg.addColorStop(1, "#fff2e2"); g.fillStyle = pg; g.fillRect(0, 0, w, Y(.92));
    for (let i = 0; i < 220; i++) { const x = rnd() * w, y = rnd() * Y(.92); g.strokeStyle = `rgba(205,182,150,${.05 + rnd() * .09})`; g.lineWidth = .6 + rnd(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - .5) * 18, y + (rnd() - .5) * 18, x + (rnd() - .5) * 26, y + (rnd() - .5) * 26); g.stroke() }
    g.fillStyle = "#2c2018";
    for (const u of [1 / 3, 2 / 3]) g.fillRect(u * w - bw / 2, 0, bw, h);
    for (let r = 1; r < 4; r++) g.fillRect(0, Y(.92 + r * .2125) - bw / 2, w, bw);
    g.fillRect(0, Y(.6) - bw / 2, w, bw); g.fillRect(0, Y(.935), w, Y(.865) - Y(.935));
  });
  const FW = px(192, 320, 448), fusumaTex = tex(FW, FW * 2, (g, w, h) => {
    const k = w / .9, bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#f4ecd9"); bg.addColorStop(1, "#e8dbc0"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 320; i++) blob(g, rnd() * w, rnd() * h, (3 + rnd() * 14) * w / 448, rnd() < .5 ? "rgba(185,150,100,.06)" : "rgba(255,250,236,.08)");
    g.fillStyle = "rgba(78,96,156,.24)"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 16) g.lineTo(x, h * (.7 + .05 * Math.sin(x / w * 5 + 1) + .025 * Math.sin(x / w * 15))); g.lineTo(w, h); g.fill();
    g.fillStyle = "rgba(78,96,156,.14)"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 16) g.lineTo(x, h * (.62 + .06 * Math.sin(x / w * 3 + 4))); g.lineTo(w, h); g.fill();
    for (const [y, x0, x1, th] of [[.16, -.3, .72, .065], [.38, .3, 1.3, .055], [.55, -.2, .5, .045], [.84, .35, 1.25, .07]]) {
      const Y = y * h, T = th * h, X0 = x0 * w, X1 = x1 * w, gg = g.createLinearGradient(0, Y - T / 2, 0, Y + T / 2);
      gg.addColorStop(0, "#f6dc9c"); gg.addColorStop(.5, "#dfb75e"); gg.addColorStop(1, "#c4943e"); g.fillStyle = gg;
      g.beginPath(); g.moveTo(X0 + T / 2, Y - T / 2); g.lineTo(X1 - T / 2, Y - T / 2); g.arc(X1 - T / 2, Y, T / 2, -Math.PI / 2, Math.PI / 2); g.lineTo(X0 + T / 2, Y + T / 2); g.arc(X0 + T / 2, Y, T / 2, Math.PI / 2, Math.PI * 1.5); g.fill();
      g.strokeStyle = "rgba(140,100,40,.55)"; g.lineWidth = 1 + w / 448; g.stroke();
    }
    for (let i = 0; i < 170; i++) { g.save(); g.translate(rnd() * w, rnd() * h); g.rotate(rnd() * 3); g.fillStyle = `rgba(232,192,96,${.35 + rnd() * .55})`; const s = (2 + rnd() * 6) * w / 448; g.fillRect(-s / 2, -s / 2, s, s * (.5 + rnd())); g.restore() }
    const lw = .022 * k; g.strokeStyle = "#1e1410"; g.lineWidth = lw; g.strokeRect(lw / 2, lw / 2, w - lw, h - lw);
    g.fillStyle = "#2a1c14"; g.beginPath(); g.arc(.085 * k, h - .85 * k, .03 * k, 0, 7); g.fill(); g.strokeStyle = "#c9a058"; g.lineWidth = .007 * k; g.stroke();
  });
  const futonTex = tex(px(256, 384, 512), px(256, 384, 512), (g, w, h) => {
    g.fillStyle = "#dde6f2"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(0, (i + .3) * h / 8, w, h / 40) }
    const flower = (x, y, r) => { g.fillStyle = "#f3c3cd"; for (let p = 0; p < 5; p++) { const a = p * 1.2566 + x; g.beginPath(); g.arc(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .45, 0, 7); g.fill() } g.fillStyle = "#e48c9c"; g.beginPath(); g.arc(x, y, r * .2, 0, 7); g.fill() };
    for (let i = 0; i < 22; i++) { const x = rnd() * w, y = rnd() * h, r = (8 + rnd() * 10) * w / 512; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) flower(x + dx, y + dy, r) }
  }, true);
  const cordTex = tex(64, 16, (g, w, h) => {
    g.fillStyle = "#c21d2b"; g.fillRect(0, 0, w, h);
    for (let x = -h; x < w; x += 6) { g.strokeStyle = "rgba(90,0,12,.55)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); g.strokeStyle = "rgba(255,190,90,.8)"; g.lineWidth = .8; g.beginPath(); g.moveTo(x + 3, 0); g.lineTo(x + 3 - h, h); g.stroke() }
    g.fillStyle = "#2b3c84"; g.fillRect(w * .78, 0, w * .16, h); g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(w * .82, 0, w * .03, h); g.fillRect(w * .88, 0, w * .03, h);
  }, true);
  cordTex.repeat.set(24, 1);
  const CF = px(256, 384, 512), face = tex(CF, CF, (g, w) => {
    const c = w / 2, gr = g.createRadialGradient(c * .9, c * .85, 0, c, c, c); gr.addColorStop(0, "#fffaf0"); gr.addColorStop(.85, "#f1e6cf"); gr.addColorStop(1, "#d9c6a2"); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = "#3a2a20"; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = i % 5 ? c * .9 : c * .85; g.lineWidth = i % 5 ? w / 400 : w / 170; g.beginPath(); g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); g.lineTo(c + Math.sin(a) * c * .95, c - Math.cos(a) * c * .95); g.stroke() }
    g.lineWidth = w / 300; g.beginPath(); g.arc(c, c, c * .55, 0, 7); g.strokeStyle = "rgba(160,120,70,.35)"; g.stroke();
    g.fillStyle = "#c9993f"; g.beginPath(); g.arc(c, c, w * .035, 0, 7); g.fill(); g.fillStyle = "#3a2a1a"; g.beginPath(); g.arc(c, c, w * .012, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = w * .03; g.beginPath(); g.arc(c, c, c * .8, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
  });
  const NC = px(64, 96, 128), nums = tex(NC * 4, NC * 3, g => {
    g.fillStyle = "#fff"; g.font = `600 ${NC * .66}px "Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif`; g.textAlign = "center"; g.textBaseline = "middle";
    for (let k = 0; k < 12; k++) g.fillText(String(k || 12), (k % 4 + .5) * NC, (Math.floor(k / 4) + .54) * NC);
  });
  const NW = px(512, 768, 1024), note = tex(NW, NW * .667, (g, w, h) => {
    g.fillStyle = "#f8f1e2"; g.fillRect(0, 0, w, h);
    const gu = g.createLinearGradient(w * .4, 0, w * .6, 0); gu.addColorStop(0, "rgba(120,96,70,0)"); gu.addColorStop(.5, "rgba(120,96,70,.3)"); gu.addColorStop(1, "rgba(120,96,70,0)"); g.fillStyle = gu; g.fillRect(w * .4, 0, w * .2, h);
    const lh = h / 15; g.strokeStyle = "rgba(110,145,200,.35)"; g.lineWidth = Math.max(1, w / 900);
    for (let y = lh * 1.5; y < h - lh * .5; y += lh) { g.beginPath(); g.moveTo(w * .04, y); g.lineTo(w * .47, y); g.moveTo(w * .53, y); g.lineTo(w * .96, y); g.stroke() }
    g.strokeStyle = "rgba(42,40,62,.72)"; g.lineWidth = Math.max(1, w / 520); g.lineCap = "round";
    for (let line = 0; line < 13; line++) {
      const right = line > 7, y = lh * (1.5 + (right ? line - 8 : line)) - lh * .3, x0 = w * (right ? .56 : .07), x1 = w * (right ? .56 + .3 - rnd() * .2 : .44 - rnd() * .1);
      for (let x = x0; x < x1; x += lh * (.55 + rnd() * .25)) { const s = lh * .42; g.beginPath(); for (let q = 0; q < 2 + (rnd() * 2 | 0); q++) { const ax = x + rnd() * s, ay = y - rnd() * s; g.moveTo(ax, ay); g.quadraticCurveTo(ax + (rnd() - .3) * s, ay + rnd() * s * .6, ax + (rnd() - .5) * s, ay + s * (.3 + rnd() * .5)) } g.stroke() }
    }
  });
  const MW = px(256, 384, 512), dawn = tex(MW, MW, (g, w) => {
    const gr = g.createLinearGradient(0, 0, 0, w); [[0, "#18245e"], [.32, "#5d5296"], [.55, "#d9879c"], [.72, "#ffbe86"], [.86, "#fff0c6"], [1, "#ffe2b0"]].forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${.4 + rnd() * .6})`; g.fillRect(rnd() * w, rnd() * w * .3, 1.4, 1.4) }
    blob(g, w * .5, w * .8, w * .45, "rgba(255,250,225,.9)");
    for (let i = 0; i < 26; i++) { const y = w * (.74 + rnd() * .26), x = rnd() * w; g.fillStyle = `rgba(255,${200 + rnd() * 40 | 0},${200 + rnd() * 30 | 0},${.25 + rnd() * .3})`; g.beginPath(); g.ellipse(x, y, w * (.08 + rnd() * .12), w * (.02 + rnd() * .03), 0, 0, 7); g.fill() }
  });
  const andonTex = tex(128, 224, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * .55, 0, w / 2, h * .55, h * .6); gr.addColorStop(0, "#fff4dc"); gr.addColorStop(1, "#e9cfa0"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a2618"; g.fillRect(0, h * .48, w, 3); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  });
  const shadowTex = tex(64, 64, (g, w) => blob(g, w / 2, w / 2, w / 2, "rgba(0,0,0,1)"));

  /* the garden seen through the glass, painted once per mood on small canvases and blitted to back2d */
  const OW = px(480, 640, 640);
  function outdoor(top, mid, low, leaf, sunX, sunY, sunCol) {
    const c = document.createElement("canvas"); c.width = OW; c.height = OW * 9 / 16 | 0; cans.push(c); const g = c.getContext("2d"), w = c.width, h = c.height;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(.55, mid); gr.addColorStop(1, low); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blob(g, w * sunX, h * sunY, h * .9, sunCol);
    for (let i = 0; i < 46; i++) { const y = h * (.45 + rnd() * .6), r = h * (.08 + rnd() * .18); blob(g, rnd() * w, y, r, leaf[i % leaf.length]) }
    for (let i = 0; i < 24; i++) blob(g, rnd() * w, h * (.3 + rnd() * .5), h * (.02 + rnd() * .05), sunCol);
    return c;
  }
  const OUT = {
    morning: outdoor("#bfe0f2", "#fbf3df", "#e9efd6", ["rgba(120,170,110,.55)", "rgba(170,205,130,.5)", "rgba(90,140,100,.45)"], .25, .15, "rgba(255,252,236,.95)"),
    pale: outdoor("#dce8ee", "#f6f7f3", "#e6ebe4", ["rgba(160,184,170,.4)", "rgba(196,210,190,.4)"], .3, .2, "rgba(255,255,255,.9)"),
    gold: outdoor("#f4b46a", "#ffdca0", "#e9b874", ["rgba(120,80,40,.5)", "rgba(170,110,50,.45)", "rgba(90,60,30,.45)"], .3, .3, "rgba(255,240,200,.95)"),
    dusk: outdoor("#3e4486", "#b47fae", "#e7a68e", ["rgba(40,40,90,.55)", "rgba(70,56,110,.5)"], .7, .75, "rgba(255,196,170,.7)"),
    night: outdoor("#060c22", "#13224a", "#0c1530", ["rgba(4,8,20,.6)", "rgba(10,18,40,.55)"], .75, .2, "rgba(150,180,255,.35)"),
    flare: outdoor("#f2a98e", "#ffe0bd", "#f7c79b", ["rgba(150,100,90,.4)", "rgba(200,140,110,.4)"], .3, .25, "rgba(255,246,222,.95)")
  };

  /* ---------- geometry helpers ---------- */
  const v3 = new V3(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), one = new V3(1, 1, 1), m4 = new THREE.Matrix4();
  const part = (g, x, y, z, color = "#ffffff", o = {}) => ({ g, m: new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)), new V3(1, 1, 1)), c: new THREE.Color(color), uv: o.uv || [1, 1] });
  const box = (w, h, d, x, y, z, color, o = {}) => part(new THREE.BoxGeometry(w, h, d), x, y, z, color, Object.assign({ uv: [Math.max(w, d) / (o.tm || 1), Math.max(h, Math.min(w, d)) / (o.tm || 1)] }, o));
  function merge(list) {
    let nv = 0, ni = 0; for (const p of list) { nv += p.g.attributes.position.count; ni += p.g.index.count }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let v = 0, i = 0;
    for (const p of list) {
      const g = p.g.applyMatrix4(p.m), a = g.attributes, n = a.position.count; pos.set(a.position.array, v * 3); nor.set(a.normal.array, v * 3);
      for (let k = 0; k < n; k++) { uv[(v + k) * 2] = a.uv.array[k * 2] * p.uv[0]; uv[(v + k) * 2 + 1] = a.uv.array[k * 2 + 1] * p.uv[1]; col.set([p.c.r, p.c.g, p.c.b], (v + k) * 3) }
      for (let k = 0; k < g.index.count; k++) idx[i + k] = g.index.array[k] + v;
      v += n; i += g.index.count; g.dispose();
    }
    const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); out.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); out.setAttribute("color", new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
    return G(out);
  }
  /* a rounded box (futon, pillow) with exact normals; bump(x, z) dents the top */
  function soft(w, h, d, r, seg, bump) {
    const g = new THREE.BoxGeometry(w, h, d, seg, Math.max(2, seg >> 2), seg), p = g.attributes.position, nr = g.attributes.normal, c = new V3(), hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v3.fromBufferAttribute(p, i); c.set(clamp(v3.x, -hw, hw), clamp(v3.y, -hh, hh), clamp(v3.z, -hd, hd)); v3.sub(c).normalize(); nr.setXYZ(i, v3.x, v3.y, v3.z); v3.multiplyScalar(r).add(c);
      if (bump && v3.y > 0) v3.y -= bump(v3.x, v3.z) * (v3.y / (h / 2)); p.setXYZ(i, v3.x, v3.y, v3.z);
    }
    return g;
  }
  const mesh = (g, m, parent = root) => { const o = new THREE.Mesh(g, m); parent.add(o); return o };

  /* ---------- the room (x -1.8..1.8, z -3.6..0, the shoji wall at z -3.6) and two more rooms of sliding doors (z 0..5.9) ---------- */
  const woodMat = toon({ map: wood, vertexColors: true, rimK: .35, soft: .3 }), plasterMat = toon({ map: plaster, vertexColors: true, rimK: .15, soft: .35, wrap: .4 }), floorMat = toon({ map: tatami, rimK: .1, soft: .3, wrap: .3 });
  const WOOD = "#ffffff", DARK = "#8a6a52", LACQ = "#5a3a2a";
  const wp = [];
  for (const [x, z] of [[-1.8, -3.6], [1.8, -3.6], [-1.8, 0], [1.8, 0], [-1.8, 1.8], [1.8, 1.8], [-1.8, 3.6], [1.8, 3.6]]) wp.push(box(.12, 2.4, .12, x, 1.2, z, WOOD, { tm: 1.2 }));
  wp.push(box(3.6, .12, .06, 0, 1.86, -3.62, WOOD), box(.06, .12, 3.6, -1.79, 1.86, -1.8, WOOD), box(.06, .12, 3.6, 1.79, 1.86, -1.8, WOOD));
  for (const z of [0, 1.8, 3.6]) wp.push(box(3.6, .12, .1, 0, 1.86, z, WOOD), box(3.6, .025, .1, 0, .0125, z, WOOD));
  wp.push(box(3.6, .03, .08, 0, .015, -3.58, WOOD));
  wp.push(box(3.6, .02, 5.9, 0, 2.41, 2.95, DARK, { tm: 1.5 }), box(3.6, .02, 3.6, 0, 2.41, -1.8, DARK, { tm: 1.5 }));
  for (let i = 0; i < 9; i++) wp.push(box(.03, .03, 3.6, -1.8 + i * .45, 2.39, -1.8, LACQ));
  /* desk, shelf, andon frame, pencil */
  wp.push(box(.9, .03, .45, -1.05, .345, -3.1, LACQ, { tm: .6 }), box(.03, .33, .42, -1.47, .165, -3.1, LACQ), box(.03, .33, .42, -.63, .165, -3.1, LACQ), box(.84, .02, .03, -1.05, .06, -3.1, LACQ));
  wp.push(box(.48, .32, .3, 1.25, .16, -3.05, "#a0785a", { tm: .5 }), box(.5, .02, .32, 1.25, .33, -3.05, "#8a6448"), box(.42, .005, .005, 1.25, .17, -2.898, "#3a2418"));
  for (const [x, z] of [[-1.74, -2.67], [-1.5, -2.67], [-1.74, -2.43], [-1.5, -2.43]]) wp.push(box(.018, .66, .018, x, .33, z, LACQ));
  wp.push(box(.27, .018, .27, -1.62, .65, -2.55, LACQ), box(.27, .018, .27, -1.62, .16, -2.55, LACQ));
  wp.push(part(new THREE.CylinderGeometry(.004, .004, .16, 6), -.76, .366, -2.95, "#e8b83a", { rz: Math.PI / 2, ry: .4 }), part(new THREE.ConeGeometry(.004, .014, 6), -.69, .366, -2.98, "#3a3a3a", { rz: -Math.PI / 2, ry: .4 }));
  const woodMesh = mesh(merge(wp), woodMat);
  const pl = [];
  pl.push(box(.08, 2.4, 3.6, -1.84, 1.2, -1.8, WOOD, { tm: 1.2 }), box(.08, 2.4, 3.6, 1.84, 1.2, -1.8, WOOD, { tm: 1.2 }), box(3.6, .48, .06, 0, 2.16, -3.64, WOOD, { tm: 1.2 }));
  pl.push(box(.08, 2.4, 5.9, -1.84, 1.2, 2.95, "#d8d0e0", { tm: 1.2 }), box(.08, 2.4, 5.9, 1.84, 1.2, 2.95, "#d8d0e0", { tm: 1.2 }));
  for (const z of [0, 1.8, 3.6]) pl.push(box(3.6, .48, .06, 0, 2.16, z, WOOD, { tm: 1.2 }));
  const plasterMesh = mesh(merge(pl), plasterMat);
  const fl = [];
  const floorPart = (z0, z1) => { const g = new THREE.PlaneGeometry(3.6, z1 - z0); g.rotateX(-Math.PI / 2); return part(g, 0, 0, (z0 + z1) / 2, "#ffffff", { uv: [1, (z1 - z0) / 3.6] }) };
  fl.push(floorPart(-3.6, 0), floorPart(0, 1.8), floorPart(1.8, 3.6), floorPart(3.6, 5.9));
  const floorMesh = mesh(merge(fl), floorMat);
  /* shoji: four panels (two tracks), a wooden frame (toon) and the paper (HDR glow, glass cut out) per panel, instanced */
  const fr = [box(.03, 1.8, .03, -.435, .9, .012, WOOD), box(.03, 1.8, .03, .435, .9, .012, WOOD), box(.9, .03, .03, 0, 1.785, .012, WOOD), box(.9, .04, .03, 0, .9, .012, WOOD), box(.9, .3, .022, 0, .15, .01, "#d9bb94", { tm: .6 })];
  const shojiFrame = new THREE.InstancedMesh(merge(fr), woodMat, 4), paperMat = M(new THREE.MeshBasicMaterial({ map: paper, alphaTest: .5, fog: false, color: new THREE.Color(2.4, 2.2, 1.9) }));
  const pg = G(new THREE.PlaneGeometry(.87, 1.47)); pg.translate(0, 1.035, 0);
  const shojiPaper = new THREE.InstancedMesh(pg, paperMat, 4);
  for (const im of [shojiFrame, shojiPaper]) { im.frustumCulled = false; insts.push(im); root.add(im) }
  /* fusuma: three layers of four panels (outer two fixed, middle two slide), instanced */
  const fusumaMat = toon({ map: fusumaTex, rimK: .25, soft: .35, side: THREE.DoubleSide }), fusuma = new THREE.InstancedMesh(G(new THREE.BoxGeometry(.9, 1.8, .022)), fusumaMat, 12);
  fusuma.frustumCulled = false; insts.push(fusuma); root.add(fusuma);
  /* futon: mattress and pillow (dented), comforter with its turned-down edge, the cord coiled on the pillow */
  const futonMat = toon({ vertexColors: true, rimK: .3, soft: .4, wrap: .35 }), coverMat = toon({ map: futonTex, vertexColors: true, rimK: .3, soft: .4, wrap: .35 });
  const seg = px(6, 10, 14);
  mesh(merge([part(soft(1.0, .09, 2.0, .04, seg), .3, .045, -1.75, "#f6f1e8"), part(soft(.52, .12, .3, .05, seg, (x, z) => .03 * Math.exp(-(x * x / .02 + z * z / .008))), .3, .148, -2.47, "#fbf7f0", { ry: .06 })]), futonMat);
  const rum = (x, z) => .012 * Math.sin(x * 9 + z * 4) * Math.sin(z * 7 - x * 3);
  mesh(merge([part(soft(1.12, .12, 1.25, .055, seg, rum), .33, .15, -1.18, "#ffffff", { uv: [2.2, 2.4] }), part(soft(1.12, .05, .3, .025, seg), .33, .228, -1.72, "#f4f2ff", { rx: .05, uv: [2.2, .6] })]), coverMat);
  const cordPts = [[.08, .2, -2.43], [.16, .202, -2.52], [.3, .2, -2.56], [.42, .198, -2.48], [.38, .2, -2.38], [.24, .204, -2.37], [.17, .206, -2.46], [.26, .21, -2.52], [.37, .206, -2.47], [.33, .203, -2.41], [.5, .19, -2.35], [.57, .14, -2.31], [.6, .1, -2.22], [.66, .094, -2.08], [.62, .092, -1.98], [.7, .091, -1.92]].map(p => new V3(...p));
  const cordCurve = new THREE.CatmullRomCurve3(cordPts, false, "centripetal");
  const cord = mesh(G(new THREE.TubeGeometry(cordCurve, px(70, 140, 220), .0058, px(5, 7, 9), false)), toon({ map: cordTex, rimK: .5, rim: "#ffb0a0", emissive: new THREE.Color(.12, .01, .01), soft: .3 }));
  cordTex.repeat.set(cordCurve.getLength() / .02, 1);
  /* bedside shelf with the handless clock (twin bells), books */
  const clock = new THREE.Group(); clock.position.set(1.17, .437, -3.03); clock.rotation.y = -.55; root.add(clock);
  const brass = "#d9a650", cream = "#f2e7d2", bellG = () => new THREE.SphereGeometry(.033, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  mesh(merge([part(new THREE.CylinderGeometry(.085, .085, .045, 40), 0, 0, 0, cream, { rx: Math.PI / 2 }), part(new THREE.TorusGeometry(.083, .0065, 8, 48), 0, 0, .023, brass), part(new THREE.TorusGeometry(.083, .005, 8, 48), 0, 0, -.023, brass),
    part(bellG(), -.058, .09, 0, brass, { rz: .55 }), part(bellG(), .058, .09, 0, brass, { rz: -.55 }), part(new THREE.CylinderGeometry(.004, .004, .03, 6), -.045, .08, 0, brass, { rz: .55 }), part(new THREE.CylinderGeometry(.004, .004, .03, 6), .045, .08, 0, brass, { rz: -.55 }),
    part(new THREE.CylinderGeometry(.003, .003, .05, 6), 0, .11, -.01, brass), part(new THREE.SphereGeometry(.007, 8, 6), 0, .136, -.01, brass), part(new THREE.SphereGeometry(.012, 10, 6), -.055, -.08, 0, brass), part(new THREE.SphereGeometry(.012, 10, 6), .055, -.08, 0, brass)]), toon({ vertexColors: true, rimK: .7, rim: "#fff0d0", soft: .25 }), clock);
  mesh(G(new THREE.CircleGeometry(.0795, 48)), toon({ map: face, rimK: .1, soft: .5, wrap: .5 }), clock).position.z = .0228;
  const numMat = M(new THREE.ShaderMaterial({ vertexShader: NUM_V, fragmentShader: NUM_F, transparent: true, depthWrite: false, uniforms: { uMap: { value: nums }, uInk: { value: new THREE.Color(.03, .018, .012) }, uGlow: { value: new THREE.Color(2.6, 1.5, 1.2) } } }));
  const numGeo = G(new THREE.PlaneGeometry(.024, .024)), cell = new Float32Array(24), fx = new Float32Array(24);
  for (let k = 0; k < 12; k++) cell.set([k % 4, 2 - Math.floor(k / 4)], k * 2);
  numGeo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2)); const fxAttr = new THREE.InstancedBufferAttribute(fx, 2); numGeo.setAttribute("aFx", fxAttr);
  const numerals = new THREE.InstancedMesh(numGeo, numMat, 12); numerals.frustumCulled = false; numerals.renderOrder = 3; insts.push(numerals); clock.add(numerals);
  /* books (desk stack, shelf, floor), instanced with colours */
  const books = new THREE.InstancedMesh(G(new THREE.BoxGeometry(1, 1, 1)), toon({ rimK: .3, soft: .3 }), 8); insts.push(books); root.add(books); books.frustumCulled = false;
  [[-1.33, .372, -3.16, .21, .032, .15, .1, "#2e3f6e"], [-1.32, .404, -3.15, .19, .03, .14, -.12, "#9a3a3a"], [-1.34, .433, -3.16, .17, .028, .13, .2, "#d8c9a0"], [-.66, .41, -3.26, .03, .13, .1, 0, "#5a7a6a"], [-.7, .405, -3.26, .028, .12, .095, 0, "#c9a24a"],
   [1.38, .352, -3.06, .16, .022, .12, .3, "#6a5a8a"], [1.37, .372, -3.06, .15, .02, .11, .1, "#e0d4b8"], [-.35, .012, -3.2, .2, .024, .14, .5, "#7a4a3a"]].forEach(([x, y, z, w, h, d, r, c], i) => { books.setMatrixAt(i, m4.compose(v3.set(x, y, z), q4.setFromEuler(e3.set(0, r, 0)), new V3(w, h, d))); books.setColorAt(i, new THREE.Color(c)) });
  /* the open notebook, the cup, the andon */
  const ng = new THREE.PlaneGeometry(.42, .28, 24, 1); ng.rotateX(-Math.PI / 2); const np = ng.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = Math.abs(np.getX(i)); np.setY(i, .016 * (1 - Math.exp(-x * 30)) - .006 * Math.pow(x / .21, 4)) }
  ng.computeVertexNormals(); const notebook = mesh(G(ng), toon({ map: note, rimK: .2, soft: .5, wrap: .5 })); notebook.position.set(-1.0, .362, -3.05); notebook.rotation.y = .06;
  const cup = mesh(merge([part(new THREE.LatheGeometry([[0, 0], [.026, 0], [.029, .004], [.031, .05], [.033, .07], [.03, .07], [.028, .012], [0, .012]].map(p => new THREE.Vector2(p[0], p[1])), 24), 0, 0, 0, "#7d93a0"), part(new THREE.CircleGeometry(.029, 24), 0, .058, 0, "#6a4a1a", { rx: -Math.PI / 2 })]), toon({ vertexColors: true, rimK: .8, rim: "#ffe0c0", soft: .2 }));
  cup.position.set(-.74, .36, -3.16);
  const andonMat = toon({ map: andonTex, rimK: .2, soft: .5, wrap: .6 }), andon = mesh(G(new THREE.BoxGeometry(.24, .46, .24)), andonMat); andon.position.set(-1.62, .4, -2.55);
  /* the hand mirror: lacquer back, gold rim, handle, and a glass that holds the dawn */
  const mirror = new THREE.Group(); mirror.position.set(-.36, 0, -1.6); mirror.rotation.y = .7; root.add(mirror);
  mesh(merge([part(new THREE.CylinderGeometry(.112, .112, .014, 40), 0, .007, 0, "#3a1016"), part(new THREE.TorusGeometry(.104, .006, 8, 48), 0, .0145, 0, "#e0b060", { rx: Math.PI / 2 }), box(.034, .016, .16, 0, .008, .19, "#2a1010"), box(.036, .018, .02, 0, .008, .13, "#c22a30"), box(.036, .018, .02, 0, .008, .17, "#c22a30")]), toon({ vertexColors: true, rimK: .8, rim: "#ffd0a0", soft: .25 }), mirror);
  const glassMat = M(new THREE.MeshBasicMaterial({ map: dawn, fog: false, color: new THREE.Color(2.2, 2, 1.9) })), glass = mesh(G(new THREE.CircleGeometry(.1, 48)), glassMat, mirror); glass.rotation.x = -Math.PI / 2; glass.position.y = .0146;
  dawn.wrapS = dawn.wrapT = THREE.MirroredRepeatWrapping; dawn.repeat.set(.82, .82);
  /* soft contact shadows under things (no shadow maps; these ground the props) */
  const blobs = new THREE.InstancedMesh(G(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), M(new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x1a1430, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })), 7);
  [[.31, .002, -1.72, 1.35, 2.5], [-1.05, .002, -3.1, 1.15, .7], [1.25, .002, -3.05, .7, .5], [1.17, .3425, -3.03, .24, .14], [-.36, .002, -1.6, .36, .36], [-.74, .3612, -3.16, .1, .1], [-1.62, .002, -2.55, .4, .4]].forEach(([x, y, z, sx, sz], i) => blobs.setMatrixAt(i, m4.compose(v3.set(x, y, z), q4.identity(), new V3(sx, 1, sz))));
  blobs.frustumCulled = false; blobs.renderOrder = 1; insts.push(blobs); root.add(blobs);
  /* light shafts */
  const shaftMat = M(new THREE.ShaderMaterial({ vertexShader: SHAFT_V, fragmentShader: SHAFT_F, defines: { STEPS: px(6, 10, 16) }, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: Object.assign({ uCamL: { value: new V3() }, uSize: { value: new V3(1, 1, 1) }, uBoxO: { value: new V3() }, uCol: { value: new THREE.Color() }, uTime: { value: 0 } }, U) }));
  const shaftGeo = G(new THREE.BoxGeometry(1, 1, 1)); shaftGeo.translate(.5, .5, .5);
  const shaft = mesh(shaftGeo, shaftMat); shaft.matrixAutoUpdate = false; shaft.frustumCulled = false; shaft.renderOrder = 5;
  /* dust (lit only in the beams), sparkles, steam, door puffs */
  const dust = litPoints({ kind: "dust", count: px(300, 1500, 5000), center: [0, .5, -2], box: [2, 1, 2], size: .01, drift: [.004, .012, .002], wobble: .03, color: "#fff2d8", color2: "#ffd8b0", intensity: 2.2, twinkle: .6 });
  const sparks = litPoints({ kind: "spark", count: px(60, 200, 600), center: [0, .5, -2], box: [2, 1, 2], size: .03, drift: [0, .02, 0], wobble: .04, color: "#fff6e0", intensity: 3, on: "fast", beat: 2, twinkle: .8 });
  const steam = kit.particles({ kind: "glow", count: px(30, 60, 120), center: [-.74, .52, -3.16], box: [.05, .3, .05], size: .05, drift: [0, .08, 0], wobble: .02, color: "#ffe6c8", intensity: .35, twinkle: .2, beat: 0 });
  root.add(dust, sparks, steam); dust.renderOrder = sparks.renderOrder = 6;
  const puffs = [0, 1, 2].map(i => { const h = kit.haze({ count: 7, center: [0, 0, 0], box: [.3, 1.5, .12], size: .5, opacity: 0, drift: [0, .05, 0], seed: 11 + i, top: "#fff4e8", bottom: "#c8b8d8" }); root.add(h); return h });
  /* flare: in camera space, only for the flare shot */
  const flareMat = M(new THREE.ShaderMaterial({ vertexShader: FL_V, fragmentShader: FL_F, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, uniforms: { uI: { value: 1 } } }));
  const FLN = 8, flGeo = G(new THREE.PlaneGeometry(1, 1)), flK = new Float32Array(FLN);
  const FLS = [[1, 2, .55, "#fff2dc", 3.2], [.62, 0, .07, "#ffd6a0", .5], [.36, 1, .16, "#a0e0ff", .35], [.12, 0, .05, "#c8ffb0", .45], [-.2, 1, .26, "#ffb0e0", .3], [-.5, 0, .1, "#90b0ff", .45], [-.85, 0, .18, "#ffcf90", .3], [-1.25, 1, .34, "#d0a0ff", .22]];
  FLS.forEach((s, i) => flK[i] = s[1]); flGeo.setAttribute("aK", new THREE.InstancedBufferAttribute(flK, 1));
  const flare = new THREE.InstancedMesh(flGeo, flareMat, FLN); FLS.forEach((s, i) => flare.setColorAt(i, C(s[3], s[4]))); flare.frustumCulled = false; flare.renderOrder = 50; insts.push(flare); scene.add(flare);
  const enfilade = []; /* hidden outside the door shots */

  /* ---------- moods: light, shade, rim, ambient sky/ground, sun, paper glow, fog, the garden ---------- */
  const mood = (o) => ({ light: C(o.light[0], o.light[1]), shade: C(o.shade), rim: C(o.rim[0], o.rim[1]), sky: C(o.sky[0], o.sky[1]), ground: C(o.ground[0], o.ground[1]), sun: C(o.sun[0], o.sun[1]), paper: C(o.paper[0], o.paper[1]), fog: C(o.fog), near: o.near, far: o.far, out: OUT[o.out], dust: C(o.dust || "#fff2d8") });
  const MOODS = {
    honey: mood({ light: ["#ffe6c2", .55], shade: "#6462a8", rim: ["#ffd2a0", .9], sky: ["#a49ad0", .34], ground: ["#704c3c", .3], sun: ["#ffc888", 3.2], paper: ["#ffe6c8", 2.7], fog: "#d8c2cc", near: 2.5, far: 14, out: "morning" }),
    pastel: mood({ light: ["#f8eaff", .5], shade: "#5a68b0", rim: ["#ffd0e0", .8], sky: ["#a8b4ee", .34], ground: ["#7a6070", .28], sun: ["#ffb070", 3.4], paper: ["#fff0f4", 2.5], fog: "#dcd2ea", near: 2, far: 14, out: "morning" }),
    dusk: mood({ light: ["#b0a8e8", .4], shade: "#34407e", rim: ["#ff9ec0", .7], sky: ["#6a6aa8", .32], ground: ["#3a2a40", .25], sun: ["#ff9ab0", 1.7], paper: ["#c8a8e8", 1.5], fog: "#5a5890", near: 2, far: 12, out: "dusk", dust: "#ffd0e8" }),
    night: mood({ light: ["#5a6aa8", .22], shade: "#1a2350", rim: ["#8aa8e8", .5], sky: ["#2a3a78", .26], ground: ["#160e22", .2], sun: ["#a8c0ff", .45], paper: ["#5a78c8", .5], fog: "#0e1734", near: 1.5, far: 9, out: "night", dust: "#ffe0b0" }),
    pale: mood({ light: ["#eef2f2", .7], shade: "#8292a6", rim: ["#ffffff", .6], sky: ["#bcccd6", .42], ground: ["#7a7268", .32], sun: ["#fff4e0", 1.8], paper: ["#f6f8f8", 2.4], fog: "#d6e0e2", near: 1.5, far: 11, out: "pale" }),
    gold: mood({ light: ["#ffc888", .6], shade: "#6c3a56", rim: ["#ffb070", 1.1], sky: ["#c48070", .32], ground: ["#5a2a20", .3], sun: ["#ffae4c", 4.6], paper: ["#ffcc80", 3.6], fog: "#d8946a", near: 1.2, far: 11, out: "gold", dust: "#ffd890" }),
    rose: mood({ light: ["#ffd0b8", .55], shade: "#5c4a8e", rim: ["#ff9ec0", 1], sky: ["#a088c0", .32], ground: ["#4a2a3a", .3], sun: ["#ffc8a0", 4.4], paper: ["#ffd6c4", 3.3], fog: "#c898b0", near: 1.5, far: 12, out: "flare", dust: "#ffe0d0" })
  };

  /* ---------- per-frame helpers ---------- */
  const FA = timing.fast && timing.fast.length ? timing.fast : timing.beats;
  const fastAt = (t0, k) => { let lo = 0, hi = FA.length; while (lo < hi) { const m = (lo + hi) >> 1; if (FA[m] < t0 - .03) lo = m + 1; else hi = m } return FA[lo + k] ?? t0 + k * .337 };
  const prj = new V3(), inv = new THREE.Matrix4(), dir = new V3();
  let side = "F", mir = 1;
  function proj(x, y, z) { prj.set(x * mir, y, z).applyMatrix4(root.matrixWorld).project(camera); let rx = (prj.x + 1) / 2; if (side === "L") rx *= .5; else if (side === "R") rx = .5 + rx * .5; /* shortcut: assumes the seam at the middle; the look is per half anyway */ return [rx, (1 - prj.y) / 2, (prj.y + 1) / 2, prj.z < 1] }
  function cam(p, t, fov, roll = 0) { camera.position.set(p[0] * mir, p[1], p[2]); camera.up.set(0, 1, 0); camera.lookAt(t[0] * mir, t[1], t[2]); if (roll) camera.rotateZ(roll * mir); camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld() }
  const lerp3 = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u)];
  const SLIDE = [0, 0, 0, 0];
  function panels() { for (let i = 0; i < 4; i++) { m4.makeTranslation(-1.35 + .9 * i + SLIDE[i], 0, -3.6 + (i % 2 ? -.034 : 0)); shojiFrame.setMatrixAt(i, m4); shojiPaper.setMatrixAt(i, m4) } shojiFrame.instanceMatrix.needsUpdate = shojiPaper.instanceMatrix.needsUpdate = true }
  /* fusuma: open[k] = how far layer k's middle panels are open (1 open, 0 shut) */
  function doors(open) {
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
      const z = [0, 1.8, 3.6][k], sgn = j < 2 ? -1 : 1, mid = j === 1 || j === 2, x = mid ? sgn * mix(.45, 1.31, open[k]) : sgn * 1.35;
      m4.compose(v3.set(x, .9, z + (mid ? -.028 : .006)), q4.identity(), one.set(j < 2 ? 1 : -1, 1, 1)); fusuma.setMatrixAt(k * 4 + j, m4);
    }
    one.set(1, 1, 1); fusuma.instanceMatrix.needsUpdate = true;
  }
  function sun(dx, dy, kind, a = 0) {
    U.uSunD.value.set(dx, dy, 1).normalize();
    if (kind === "glass") { U.uWinR.value.set(0, .3, 3.6, .9); U.uGrid.value.set(.3, .3, .022, .009) }
    else if (kind === "slit") { U.uWinR.value.set(a, 0, a + .09, 1.8); U.uGrid.value.set(0, 0, 0, .012) }
    else if (kind === "gap") { U.uWinR.value.set(a, 0, a + .9, 1.8); U.uGrid.value.set(0, 0, 0, .008) }
    else U.uWinR.value.set(0, 0, 0, 0);
  }
  let garden = null;
  function applyMood(m, sunK = 1) {
    garden = m.out;
    MOOD.uLight.value.copy(m.light); MOOD.uShade.value.copy(m.shade); MOOD.uRim.value.copy(m.rim); MOOD.uAmbSky.value.copy(m.sky); MOOD.uAmbGround.value.copy(m.ground);
    U.uSunC.value.copy(m.sun).multiplyScalar(sunK); paperMat.color.copy(m.paper); fog.color.copy(m.fog); fog.near = m.near; fog.far = m.far;
    dust.userData.material.uniforms.uCol.value.copy(m.dust).multiplyScalar(2.2); dust.userData.material.uniforms.uCol2.value.copy(m.dust).multiplyScalar(1.8);
  }
  const keyDir = (x, y, z) => MOOD.uLightDir.value.set(x * mir, y, z).normalize();
  function lamp(x, y, z, col, k, r) { U.uLampP.value.set(x, y, z); U.uLampC.value.set(col).multiplyScalar(k); U.uLampR.value = r }
  function motes(c, b, size, lit = .05, k = 1) { const u = dust.userData.material.uniforms; u.uCenter.value.set(...c); u.uBox.value.set(...b); u.uSize.value = size; u.uLitAmb.value = lit; u.uLitK.value = k }
  function glints(c, b, size, lit = 0, k = 1, col = "#fff6e0", up = .02) { const u = sparks.userData.material.uniforms; u.uCenter.value.set(...c); u.uBox.value.set(...b); u.uSize.value = size; u.uLitAmb.value = lit; u.uLitK.value = k; u.uCol.value.set(col).multiplyScalar(3); u.uCol2.value.set(col).multiplyScalar(2.2) }
  /* numerals: k leaves at tk (or never); mode "petal" drifts off glowing, "fall" drops */
  const ORDER = [5, 8, 2, 10, 4, 7, 1, 11, 3, 9, 6], RANK = []; ORDER.forEach((k, i) => RANK[k] = i);
  function clockFace(f, mode) {
    const t0 = f.shot.t0, per = mode === "fall" ? 4 : 2;
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, bx = Math.sin(a) * .061, by = Math.cos(a) * .061, r = RANK[k];
      let x = bx, y = by, z = .0245, rx = 0, ry = 0, rz = 0, s = 1, glow = 0, al = 1;
      if (mode && r !== undefined) {
        const age = f.t - (fastAt(t0, 1 + Math.floor(r / per)) + (r % per) * .06), ph = k * 1.7;
        if (age > 0) {
          const pop = 1 - Math.exp(-age * 18);
          if (mode === "petal") { x += (.05 + .03 * Math.sin(ph)) * age + .012 * Math.sin(age * 4 + ph) + .006 * pop * Math.sign(bx || 1); y += .03 * age + .008 * Math.sin(age * 5 + ph) * age; z += .07 * age + .01 * pop; rz = age * (2 + k % 3) * (k % 2 ? 1 : -1); ry = Math.sin(age * 6 + ph) * 1.1; rx = age * 1.5; glow = ease(age / .35); al = 1 - ease((age - .9) / .7); s = 1 - .25 * ease(age) }
          else { y -= .45 * age * age + .004 * pop; x += .015 * Math.sin(age * 7 + ph) + .01 * age * Math.sin(ph); z += .02 * age + .01 * pop; rz = Math.sin(age * 8 + ph) * .8; rx = age * 2.5; glow = .55 * ease(age / .4); al = 1 - ease((age - .7) / .5) }
        }
      }
      numerals.setMatrixAt(k, m4.compose(v3.set(x, y, z), q4.setFromEuler(e3.set(rx, ry, rz)), one.set(s, s, s))); fx[k * 2] = glow; fx[k * 2 + 1] = al;
    }
    one.set(1, 1, 1); numerals.instanceMatrix.needsUpdate = true; fxAttr.needsUpdate = true;
  }
  /* a door slam: ease-in close that lands on time tS, a tiny bounce, a puff of dust at the seam */
  const slam = (t, tS, dur = .3) => { const u = clamp((t - (tS - dur)) / dur); const age = t - tS; return age < 0 ? 1 - easeIn(u) : .012 * Math.sin(age * 40) * Math.exp(-age * 16) };
  function puff(i, t, tS, z) { const p = puffs[i], age = t - tS, m = p.userData.material.uniforms; p.visible = age > 0 && age < 1.6; m.uOpacity.value = age > 0 ? .55 * Math.exp(-age * 2.4) * ease(age / .05) : 0; p.position.set(0, .95, z + .1); p.scale.setScalar(1 + age * 1.1); m.uTime.value = age }
  function drawOut(f, img, par) {
    if (!img) return; const W = f.W, H = f.H, s = Math.max(W / img.width, H / img.height) * 1.25, w = img.width * s, h = img.height * s;
    back2d.save(); if (mir < 0) { back2d.translate(W, 0); back2d.scale(-1, 1) } back2d.drawImage(img, (W - w) / 2 + par * W * .08, (H - h) / 2, w, h); back2d.restore();
  }

  /* ---------- the setups ---------- */
  const SET = {
    /* honey morning: low by the futon, the pillow with the cord, the shoji glowing, sun through the glass band, dust */
    shoji(f, lt, u) {
      applyMood(MOODS.honey); sun(.36, -.4, "glass"); keyDir(-.3, .55, -.8);
      const p = lerp3([1.0, .3, -.42], [.9, .34, -.78], ease(u * .9 + .05)); p[1] += Math.sin(f.t * .7) * .006;
      cam(p, lerp3([.1, .2, -2.75], [.05, .24, -2.85], ease(u)), 46, .025);
      motes([.3, .45, -2.3], [2.4, .9, 2], .011); glints([.3, .4, -2.3], [2, .8, 1.8], .02);
      const w = proj(-.4, .62, -3.6), pi = proj(.3, .2, -2.47);
      return { bloom: .95, glow: .45, rays: .55, rayX: w[0], rayY: w[1], leak: .35 + .25 * f.pulse, leakX: .05, leakY: .12, tilt: .55, focus: pi[2], band: .25, exposure: 1.04, sat: 1.04, gain: [1.07, 1, .9], lift: [.05, .035, .07], halation: [1, .6, .42] };
    },
    "shoji:wide"(f, lt, u) {
      applyMood(MOODS.pale); sun(.28, -.32, "glass"); keyDir(-.2, .6, -.8);
      cam(lerp3([1.5, 1.28, -.28], [1.38, 1.24, -.34], ease(u)), [-.35, .78, -3.6], 56);
      motes([0, .6, -2.4], [3.4, 1.2, 2.4], .014); glints([0, .5, -2.4], [3, 1, 2], .025);
      const w = proj(-.2, 1.1, -3.6);
      return { bloom: .8, glow: .55, rays: .35, rayX: w[0], rayY: w[1], exposure: 1.1, sat: .82, gain: [.98, 1.01, 1.03], lift: [.07, .075, .08], threshold: .7, tilt: .2, focus: .45 };
    },
    "shoji:gold"(f, lt, u) {
      applyMood(MOODS.gold); sun(.62, -.3, "glass"); keyDir(-.4, .4, -.8);
      cam(lerp3([-1.45, .62, -.42], [-1.32, .66, -.52], ease(u)), lerp3([1.3, .9, -3.3], [1.35, .95, -3.25], ease(u)), 52, -.02);
      motes([.4, .6, -2.4], [3, 1.2, 2.4], .014); glints([.4, .5, -2.4], [3, 1, 2.4], .03, 0, 1.3, "#ffe0a0");
      const w = proj(-.6, .7, -3.6);
      return { bloom: 1.05, glow: .5, rays: .8, rayX: w[0], rayY: w[1], leak: .6 + .3 * f.downPulse, leakX: .1, leakY: .2, leakColor: [1, .66, .3], exposure: 1.05, sat: 1.12, gain: [1.1, .98, .82], lift: [.07, .035, .05], halation: [1, .55, .3] };
    },
    "shoji:flare"(f, lt, u) {
      applyMood(MOODS.rose); SLIDE[1] = .9; keyDir(-.2, .5, -.8);
      const p = lerp3([.36, .15, -1.98], [.32, .17, -2.06], ease(u)), sp = [-.45, 1.32, -3.6]; dir.set(p[0] - sp[0], p[1] - sp[1], p[2] - sp[2]);
      sun(dir.x / dir.z, dir.y / dir.z, "gap", .9);
      cam(p, lerp3([-.38, .92, -3.6], [-.4, .98, -3.6], ease(u)), 52, -.07);
      motes([-.2, .6, -2.8], [1.6, 1.2, 1.6], .012); glints([-.2, .6, -2.8], [1.4, 1, 1.4], .025, 0, 1.2, "#ffe8d8");
      const s = proj(sp[0], sp[1], sp[2]); flare.visible = true; flareMat.uniforms.uI.value = 1 + .5 * f.fastPulse;
      const th = Math.tan(camera.fov * Math.PI / 360), nx = s[0] * 2 - 1, ny = 1 - s[1] * 2;
      FLS.forEach((d, i) => flare.setMatrixAt(i, m4.compose(v3.set(nx * d[0] * th * camera.aspect, ny * d[0] * th, -1), q4.identity(), one.set(d[2], d[2], 1))));
      one.set(1, 1, 1); flare.instanceMatrix.needsUpdate = true; flare.position.copy(camera.position); flare.quaternion.copy(camera.quaternion);
      return { bloom: 1.15, glow: .55, rays: 1.1, rayX: s[0], rayY: s[1], leak: 1.1 + .4 * f.fastPulse, leakX: s[0], leakY: s[1], leakColor: [1, .7, .5], exposure: 1.06, sat: 1.1, gain: [1.06, .98, .94], lift: [.07, .045, .07], halation: [1, .6, .45] };
    },
    clock(f, lt, u, mode = "petal") {
      const close = mode === "fall"; applyMood(close ? MOODS.pastel : MOODS.honey); sun(.3, -.42, "glass"); keyDir(-.5, .5, -.7);
      clockFace(f, mode);
      if (close) cam(lerp3([.97, .475, -2.7], [.985, .47, -2.725], ease(u)), [1.17, .44, -3.03], 27);
      else cam(lerp3([.62, .53, -2.3], [.66, .51, -2.37], ease(u)), [1.17, .45, -3.03], 34, .02);
      motes([1.05, .5, -2.85], [.9, .5, .8], .006); glints([1.08, .48, -2.9], [.5, .35, .4], .012, .02, 1.2, "#ffe8f0");
      const c = proj(1.17, .44, -3.03), w = proj(.2, .6, -3.6);
      return { bloom: .95, glow: .42, rays: .45, rayX: w[0], rayY: w[1], tilt: .65, focus: c[2], band: close ? .16 : .22, exposure: 1.04, sat: close ? .95 : 1.04, gain: close ? [1.04, .98, 1.03] : [1.07, 1, .9], lift: close ? [.08, .06, .1] : [.05, .035, .07] };
    },
    "clock:close"(f, lt, u) { return SET.clock(f, lt, u, "fall") },
    desk(f, lt, u, v = "") {
      const m = v === "cool" ? MOODS.dusk : v === "night" ? MOODS.night : MOODS[v === "warm" ? "honey" : "pastel"]; applyMood(m); keyDir(-.3, .6, -.7);
      if (v === "night") { sun(.2, -.36, "glass"); lamp(-1.62, .42, -2.55, "#ffb468", 3.2 + .3 * f.pulse, .75); andonMat.uniforms.uEmissive.value.setRGB(2.6, 1.45, .6).multiplyScalar(1 + .06 * Math.sin(f.t * 23) * Math.sin(f.t * 7)); steam.visible = true }
      else if (v) sun(v === "cool" ? .5 : .3, v === "cool" ? -.26 : -.4, "glass");
      else { SLIDE[1] = .09; const sw = ease(u * 1.1 - .05) + .15 * f.downPulse; sun(mix(-.95, .45, sw), -.42, "slit", .9) }
      if (v === "night") cam(lerp3([-.5, .8, -2.58], [-.56, .76, -2.66], ease(u)), [-.95, .38, -3.1], 38);
      else if (v) cam(lerp3([-.5, .64, -2.4], [-.53, .62, -2.45], ease(u)), [-1.06, .37, -3.13], 42);
      else cam(lerp3([-.6, .43, -2.6], [-.67, .425, -2.68], ease(u)), [-1.2, .39, -3.3], 40, .015);
      motes([-1, .6, -3], [1.4, .8, 1.2], .008, v === "night" ? .0 : .03); glints([-1, .55, -3], [1.2, .6, 1], .015);
      const n = proj(-1.0, .37, -3.05), w = proj(v ? -.6 : -.85, .6, -3.6), a = proj(-1.62, .42, -2.55);
      if (v === "night") return { bloom: 1.05, glow: .5, rays: .4, rayX: a[0], rayY: a[1], tilt: .5, focus: n[2], exposure: 1.02, sat: 1.05, gain: [1.08, .98, .92], lift: [.015, .025, .06], halation: [1, .55, .35] };
      if (v === "cool") return { bloom: .85, glow: .45, rays: .35, rayX: w[0], rayY: w[1], tilt: .45, focus: n[2], exposure: .98, sat: .95, gain: [.92, .96, 1.1], lift: [.04, .04, .09] };
      if (v === "warm") return { bloom: .9, glow: .42, rays: .45, rayX: w[0], rayY: w[1], tilt: .45, focus: n[2], exposure: 1.05, sat: 1.04, gain: [1.08, 1, .88], lift: [.06, .045, .06] };
      return { bloom: .9, glow: .4, rays: .5, rayX: w[0], rayY: w[1], tilt: .5, focus: n[2], exposure: 1.02, sat: .98, gain: [1.02, .98, 1.06], lift: [.05, .05, .1] };
    },
    "desk:warm"(f, lt, u) { return SET.desk(f, lt, u, "warm") }, "desk:cool"(f, lt, u) { return SET.desk(f, lt, u, "cool") }, "desk:night"(f, lt, u) { return SET.desk(f, lt, u, "night") },
    /* three layers of fusuma shut toward the camera, one per beat; the far room glows until the first one closes */
    fusuma(f, lt, u) {
      applyMood(MOODS.pastel); sun(.3, -.38, "glass"); keyDir(0, .35, 1); enfilade.forEach(o => o.visible = true);
      const tS = [fastAt(f.shot.t0, 2), fastAt(f.shot.t0, 4), fastAt(f.shot.t0, 5)], open = tS.map(t => slam(f.t, t, .32));
      doors(open); tS.forEach((t, i) => puff(i, f.t, t, [0, 1.8, 3.6][i]));
      lamp(0, 1.1, -1.4, "#ffd0a8", 2.4 * mix(.3, 1, clamp(open[0])), 3.2);
      let sh = 0; tS.forEach((t, i) => { const a = f.t - t; if (a > 0) sh += (.002 + i * .002) * Math.sin(a * 70) * Math.exp(-a * 14) });
      cam(lerp3([0, .98, 5.75], [0, .96, 5.3], ease(u)).map((x, i) => i === 1 ? x + sh : x), [0, .9 + sh * .5, -3.6], 42);
      motes([0, .9, 2.5], [3.4, 1.8, 6], .014, .15); glints([0, .9, 3], [3, 1.6, 4], .03, .25, 1, "#fff0e0");
      const w = proj(0, .8, -3.6);
      return { bloom: .9, glow: .45, rays: .55 * clamp(open[0]), rayX: w[0], rayY: w[1], tilt: .3, focus: .5, exposure: 1.04, sat: .98, gain: [1.04, .99, 1.02], lift: [.06, .05, .09], leak: .2 * f.downPulse };
    },
    "fusuma:wide"(f, lt, u) {
      applyMood(MOODS.rose); sun(.34, -.36, "glass"); keyDir(0, .4, 1); enfilade.forEach(o => o.visible = true);
      const tS = f.shot.t0 + (f.shot.t1 - f.shot.t0) * .78, o = slam(f.t, tS, .3) * .62; doors([o, 1, 1]); puff(0, f.t, tS, 0); puffs[1].visible = puffs[2].visible = false;
      lamp(0, 1.1, -1.4, "#ffc8a8", 2.6 * mix(.35, 1, o / .62), 3);
      cam(lerp3([.18, 1.06, 1.6], [.12, 1.03, 1.45], ease(u)), [-.1, .78, -3.6], 50);
      motes([0, .7, -1.5], [3.2, 1.4, 3.4], .014, .1); glints([0, .7, -1.8], [3, 1.2, 3], .03, .1);
      const w = proj(0, .8, -3.6);
      return { bloom: 1, glow: .5, rays: .6 * (o / .62), rayX: w[0], rayY: w[1], exposure: 1.04, sat: 1.08, gain: [1.06, .98, .98], lift: [.06, .035, .075], leak: .3, leakX: .5, leakY: .5 };
    },
    /* night room, moonlight through the glass; the mirror on the tatami holds the dawn */
    mirror(f, lt, u) {
      applyMood(MOODS.night); sun(.22, -.34, "glass"); keyDir(-.3, .6, -.7); mirror.visible = true;
      lamp(-.36, .1, -1.6, "#ffc890", 2.4 + .6 * f.hit, .38);
      cam(lerp3([-.06, .8, -1.16], [-.14, .68, -1.3], ease(u)), [-.36, 0, -1.6], 42, .03);
      dawn.offset.set(.09 + (camera.position.x + .36) * .2, .09 + (camera.position.z + 1.6) * .2);
      motes([-.3, .4, -2], [2, .8, 2], .01, .02); glints([-.36, .25, -1.6], [.35, .5, .35], .012, 1, 0, "#ffe2b0");
      const c = proj(-.36, .015, -1.6);
      return { bloom: 1.2, glow: .55, rays: .7, rayX: c[0], rayY: c[1], tilt: .45, focus: c[2], exposure: 1.06, sat: 1.08, gain: [.94, .97, 1.1], lift: [.012, .022, .06], halation: [1, .62, .4] };
    }
  };

  enfilade.push(fusuma, ...puffs);
  return {
    update(f) {
      side = f.shot.side || "F"; const key = f.shot.key + (f.shot.var ? ":" + f.shot.var : ""), fn = SET[key] || SET[f.shot.key] || SET.shoji;
      mir = key === "desk:cool" && side === "R" ? -1 : 1; root.scale.x = mir; U.uMir.value = mir;
      const len = Math.max(.1, f.shot.t1 - f.shot.t0), lt = f.shot.lt, u = clamp(lt / len);
      /* defaults, then the setup changes what it needs */
      SLIDE.fill(0); for (const o of enfilade) o.visible = false; mirror.visible = steam.visible = flare.visible = false;
      lamp(0, 0, 0, 0x000000, 0, 1); andonMat.uniforms.uEmissive.value.setRGB(0, 0, 0); clockFace(f, null); doors([1, 1, 1]);
      root.updateMatrixWorld(true);
      const look = fn(f, lt, u);
      panels();
      /* the shafts follow the window opening along the sun */
      const R = U.uWinR.value, D = U.uSunD.value, w = R.z - R.x, h = R.w - R.y, L = (R.w + .05) / Math.max(.05, -D.y);
      shaft.visible = w > 0; shaft.matrix.makeBasis(v3.set(w, 0, 0), new V3(0, h, 0), dir.copy(D).multiplyScalar(L)).setPosition(-1.8 + R.x, R.y, -3.6); shaft.matrixWorldNeedsUpdate = true;
      root.updateMatrixWorld(true);
      const su = shaftMat.uniforms; su.uSize.value.set(w, h, L); su.uBoxO.value.set(-1.8 + R.x, R.y, -3.6); su.uTime.value = f.t;
      su.uCol.value.copy(U.uSunC.value).multiplyScalar(.075 * (1 + .25 * f.pulse)); su.uCamL.value.copy(camera.position).applyMatrix4(inv.copy(shaft.matrixWorld).invert());
      kit.tick(f, dust, sparks, steam);
      drawOut(f, garden, camera.position.x * .2);
      kit.look(look);
    },
    setVisible(on) { root.visible = on; if (!on) flare.visible = false },
    dispose() {
      scene.remove(root, flare); scene.fog = null;
      for (const im of insts) im.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const c of cans) c.width = 0;
      geos.length = mats.length = insts.length = cans.length = 0; /* kit materials, paintings and particles: kit.dispose() */
    }
  };
}
