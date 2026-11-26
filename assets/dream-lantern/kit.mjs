/* Dream Lantern "dream look" kit: one render pipeline and one set of materials, so every scene module looks like the same film.
   createPipeline(): every shot renders into one linear HDR target; the painted back canvas is uploaded and laid under it; then one
   post chain runs over both: a dual-filter blur pyramid feeding bloom (warm halation), a soft full-frame glow, tilt-shift blur,
   light rays and a light leak, a per-section split-tone grade, chromatic softness, a soft highlight roll-off, vignette, dither.
   createKit(): what a module builds with: soft-terminator toon materials with rim light and fog, a gradient twilight sky dome,
   billboard haze and clouds lit from below, GPU particles (glow, sparkle, dust, bokeh, petals) that move as a pure function of
   time, painted textures, and look() for this shot's post settings. The kit tracks what it makes and frees it in dispose(). */
/* per-section palettes (sky top to horizon, key light, shade, rim, fog, ambient sky / ground), after the reference's grading */
export const PALETTE = {
  intro: { sky: ["#020617", "#0b1f45", "#24406e", "#5a6c94", "#f2b07a"], light: "#ffd2a0", shade: "#3a3f78", rim: "#8fb4ff", fog: "#1a2a50", ambSky: "#2a3a70", ambGround: "#140c20" },
  verse1: { sky: ["#040b1e", "#123a6b", "#2f7fb8", "#7fd2ff", "#e7a874"], light: "#d8f2ff", shade: "#2b3f78", rim: "#7fe0ff", fog: "#18406a", ambSky: "#24508a", ambGround: "#10142a" },
  prechorus: { sky: ["#a9b9ea", "#c9c8f0", "#f2d9ea", "#ffe6dc"], light: "#fff1e0", shade: "#8f8ac8", rim: "#ffd6e8", fog: "#e9dcef", ambSky: "#c9c4f0", ambGround: "#8a6f80" },
  chorus1: { sky: ["#1d5fb8", "#3f8bd6", "#8fc3f0", "#eaf3fb"], light: "#fffaf0", shade: "#6f84c8", rim: "#ffffff", fog: "#cfe2f5", ambSky: "#8fb8ee", ambGround: "#4a5070" },
  verse2: { sky: ["#2c3e52", "#567a8c", "#9fbcc4", "#d9d2c2"], light: "#f4e2c4", shade: "#4f6070", rim: "#cfe6ee", fog: "#9fb8bf", ambSky: "#7f9aa8", ambGround: "#3a3430" },
  build: { sky: ["#0d1a2c", "#2b4a66", "#4f7a6a", "#f6c88a"], light: "#ffd9a0", shade: "#2a3a50", rim: "#ffb070", fog: "#2c4a48", ambSky: "#3a5a78", ambGround: "#18201a" },
  chorus2: { sky: ["#2a2350", "#6c6792", "#d78fa8", "#f3b78a", "#ffd9a0"], light: "#ffd2a8", shade: "#5a4c8c", rim: "#ff9ec0", fog: "#b08aa8", ambSky: "#8a78b8", ambGround: "#3a2030" },
  outro: { sky: ["#3d8fe0", "#66a8eb", "#a9d2f5", "#eef5f0"], light: "#fff6e2", shade: "#7a8fb8", rim: "#ffffff", fog: "#cfe4f2", ambSky: "#9cc6f0", ambGround: "#6a7a5a" }
};
/* per-section post defaults; a module's look() overrides any of these for its shot */
const BASE = { exposure: 1, bloom: .7, threshold: .62, glow: .3, tilt: 0, focus: .5, band: .3, chroma: .5, sat: 1.05, vignette: .4,
  rays: 0, rayX: .5, rayY: .2, leak: 0, leakX: 1, leakY: .3, lift: [.02, .02, .05], gain: [1, 1, 1], halation: [1, .55, .42], leakColor: [1, .62, .38] };
export const GRADE = {
  intro: { lift: [.012, .02, .06], gain: [1, .96, .92], glow: .32, bloom: .8 },
  verse1: { lift: [.01, .03, .06], gain: [.95, 1, 1.08], sat: 1.1 },
  prechorus: { lift: [.07, .055, .085], gain: [1.04, .98, 1.02], sat: .92, glow: .42, exposure: 1.06, threshold: .7 },
  chorus1: { lift: [.005, .005, .02], gain: [1, 1, 1.03], sat: 1.12, glow: .26 },
  verse2: { lift: [.035, .045, .055], gain: [.98, 1, 1.02], sat: .9, glow: .32 },
  build: { lift: [.012, .02, .04], gain: [1.04, 1, .95], sat: 1.05 },
  chorus2: { lift: [.055, .03, .075], gain: [1.06, .98, .97], sat: 1.12, glow: .38, bloom: .85 },
  outro: { lift: [.05, .06, .06], gain: [1.02, 1.02, 1], exposure: 1.08, sat: 1.05, glow: .36, threshold: .75 }
};
export const lookFor = (section, over) => Object.assign({}, BASE, GRADE[section] || {}, over || {});
/* shared by every particle material: the current viewport height in pixels, set by the pipeline before each render */
const SHARED = { uViewH: { value: 720 } };

/* ---------------- the pipeline (owned by the core, or the module preview) ---------------- */
const FS_V = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
export function createPipeline(THREE, R, tier) {
  const Q = { saver: { scale: .75, levels: 3, samples: 0, rays: 8 }, smooth: { scale: 1, levels: 4, samples: 4, rays: 12 }, ultra: { scale: 1, levels: 5, samples: 4, rays: 20 } }[tier] || {};
  const HF = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const A = new THREE.WebGLRenderTarget(4, 4, HF), down = [], up = [];
  for (let i = 0; i < Q.levels; i++) { down.push(new THREE.WebGLRenderTarget(4, 4, HF)); if (i < Q.levels - 1) up.push(new THREE.WebGLRenderTarget(4, 4, HF)) }
  const back = new THREE.CanvasTexture(document.createElement("canvas"));
  back.colorSpace = THREE.SRGBColorSpace; back.generateMipmaps = false; back.minFilter = THREE.LinearFilter;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; qs.add(quad);
  const mat = (frag, uniforms, defines) => new THREE.ShaderMaterial({ vertexShader: FS_V, fragmentShader: frag, uniforms, defines: defines || {}, depthTest: false, depthWrite: false, toneMapped: false });
  const pre = mat(`uniform sampler2D tS,tB;uniform float uHasB;varying vec2 vUv;
void main(){vec4 s=texture2D(tS,vUv);vec3 b=uHasB>.5?texture2D(tB,vUv).rgb:vec3(0.);gl_FragColor=vec4(s.rgb+b*(1.-s.a),1.);}`, { tS: { value: null }, tB: { value: back }, uHasB: { value: 0 } });
  const dn = mat(`uniform sampler2D tIn;uniform vec2 uT;varying vec2 vUv;
void main(){vec4 s=texture2D(tIn,vUv)*4.;s+=texture2D(tIn,vUv-uT);s+=texture2D(tIn,vUv+uT);s+=texture2D(tIn,vUv+vec2(uT.x,-uT.y));s+=texture2D(tIn,vUv-vec2(uT.x,-uT.y));gl_FragColor=s/8.;}`, { tIn: { value: null }, uT: { value: new THREE.Vector2() } });
  const upm = mat(`uniform sampler2D tIn,tAdd;uniform vec2 uT;uniform float uMix;varying vec2 vUv;
void main(){vec4 s=texture2D(tIn,vUv+vec2(-uT.x*2.,0.))+texture2D(tIn,vUv+vec2(uT.x*2.,0.))+texture2D(tIn,vUv+vec2(0.,-uT.y*2.))+texture2D(tIn,vUv+vec2(0.,uT.y*2.));
s+=(texture2D(tIn,vUv+vec2(-uT.x,uT.y))+texture2D(tIn,vUv+vec2(uT.x,uT.y))+texture2D(tIn,vUv+vec2(-uT.x,-uT.y))+texture2D(tIn,vUv+vec2(uT.x,-uT.y)))*2.;
gl_FragColor=mix(texture2D(tAdd,vUv),s/12.,uMix);}`, { tIn: { value: null }, tAdd: { value: null }, uT: { value: new THREE.Vector2() }, uMix: { value: .62 } });
  /* the look of each half of the frame: 7 vec4 per side, side chosen by the seam */
  const LOOK = Array.from({ length: 14 }, () => new THREE.Vector4());
  const fin = mat(`uniform sampler2D tA,tM1,tU1,tU2;uniform vec4 uL[14];uniform float uSeam,uTime;uniform vec2 uAsp;varying vec2 vUv;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 soft(vec3 c){vec3 k=vec3(.72);return mix(c,k+(1.-k)*(1.-exp(-(c-k)/(1.-k))),step(k,c));}
vec3 toS(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){int o=vUv.x<uSeam?0:7;vec4 a=uL[o],b=uL[o+1],c4=uL[o+2],d=uL[o+3],e=uL[o+4],f=uL[o+5],g=uL[o+6];
  vec2 uv=vUv,dd=uv-.5;float ch=b.w*.006*dot(dd,dd)*4.;
  vec3 col=texture2D(tA,uv).rgb;col.r=texture2D(tA,uv+dd*ch).r;col.b=texture2D(tA,uv-dd*ch).b;
  vec3 m1=texture2D(tM1,uv).rgb,u1=texture2D(tU1,uv).rgb,u2=texture2D(tU2,uv).rgb;
  float tb=b.x*smoothstep(b.z*.5,b.z*.5+.28,abs(uv.y-b.y));col=mix(col,mix(m1,u2,tb),min(1.,tb*1.5));
  col+=u1*a.w*(1.-col/(1.+col));
  col+=max(u1-a.z,0.)*a.y*mix(vec3(1.),f.rgb,.6);
  if(c4.z>0.){vec2 dir=(d.xy-uv)/float(RAYS);vec2 p=uv+dir*h21(uv*977.+uTime);vec3 acc=vec3(0.);float w=1.;for(int i=0;i<RAYS;i++){p+=dir;acc+=max(texture2D(tU2,p).rgb-a.z*.7,0.)*w;w*=.9;}col+=acc*c4.z*(1.6/float(RAYS));}
  vec2 lk=(uv-d.zw)*uAsp;col+=g.rgb*c4.w*exp(-dot(lk,lk)*5.);
  col*=a.x;float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,c4.x)*e.rgb;
  col=soft(col);vec3 lift=vec3(e.w,f.w,g.w);col=col*(1.-lift)+lift;
  float v=smoothstep(.95,.25,length(dd*vec2(1.,.82))*1.3);col*=mix(1.,v,c4.y);
  gl_FragColor=vec4(toS(col)+(h21(uv*vec2(1733.,947.)+uTime)-.5)/255.,1.);}`,
    { tA: { value: A.texture }, tM1: { value: null }, tU1: { value: null }, tU2: { value: null }, uL: { value: LOOK }, uSeam: { value: 2 }, uTime: { value: 0 }, uAsp: { value: new THREE.Vector2(1, 1) } }, { RAYS: Q.rays });
  let W = 4, H = 4, pw = 4, ph = 4, looks = [];
  const pass = (m, target) => { quad.material = m; R.setRenderTarget(target); R.render(qs, qc) };
  function packLook(L, i) {
    const k = i * 7;
    LOOK[k].set(L.exposure, L.bloom, L.threshold, L.glow); LOOK[k + 1].set(L.tilt, L.focus, L.band, L.chroma);
    LOOK[k + 2].set(L.sat, L.vignette, L.rays, L.leak); LOOK[k + 3].set(L.rayX, 1 - L.rayY, L.leakX, 1 - L.leakY);
    LOOK[k + 4].set(L.gain[0], L.gain[1], L.gain[2], L.lift[0]); LOOK[k + 5].set(L.halation[0], L.halation[1], L.halation[2], L.lift[1]);
    LOOK[k + 6].set(L.leakColor[0], L.leakColor[1], L.leakColor[2], L.lift[2]);
  }
  return {
    target: sceneRT, /* render into this when compiling a module's shaders, so they match what part() renders */
    /* W, H in CSS px; the drawing buffer is R's size */
    resize(w, h) {
      W = w; H = h; const s = R.getPixelRatio() * Q.scale; pw = Math.max(4, Math.round(w * s)); ph = Math.max(4, Math.round(h * s));
      sceneRT.setSize(pw, ph); A.setSize(pw, ph);
      down.forEach((t, i) => t.setSize(Math.max(2, pw >> (i + 1)), Math.max(2, ph >> (i + 1))));
      up.forEach((t, i) => t.setSize(Math.max(2, pw >> (i + 1)), Math.max(2, ph >> (i + 1))));
      fin.uniforms.uAsp.value.set(w / h, 1);
    },
    begin() { looks = []; R.setRenderTarget(sceneRT); R.setScissorTest(false); R.setClearColor(0, 0); R.clear() },
    /* one shot (or one half of a split) into the HDR target; vp/clip in CSS px [x, y, w, h], y down */
    part(scene, camera, vp, clip, look) {
      const k = pw / W, x0 = clip ? clip[0] : vp[0], x1 = clip ? clip[1] : vp[0] + vp[2], y = H - vp[1] - vp[3];
      sceneRT.viewport.set(vp[0] * k, y * k, vp[2] * k, vp[3] * k); sceneRT.scissor.set(x0 * k, y * k, (x1 - x0) * k, vp[3] * k); sceneRT.scissorTest = true;
      SHARED.uViewH.value = vp[3] * k;
      R.setRenderTarget(sceneRT); R.render(scene, camera);
      sceneRT.scissorTest = false; sceneRT.viewport.set(0, 0, pw, ph); sceneRT.scissor.set(0, 0, pw, ph);
      looks.push({ look, x0: x0 / W, x1: x1 / W });
    },
    /* composite the painted back canvas under the 3D, run the post chain to the screen; extra: looks for 2D-only parts, [{look, x0, x1}] in 0..1 */
    end(backCanvas, t, extra) {
      if (extra) for (const e of extra) looks.push(e);
      if (backCanvas) { if (back.image !== backCanvas) { back.image = backCanvas; back.dispose() } back.needsUpdate = true }
      pre.uniforms.tS.value = sceneRT.texture; pre.uniforms.uHasB.value = backCanvas ? 1 : 0; pass(pre, A);
      let src = A;
      down.forEach(t => { dn.uniforms.tIn.value = src.texture; dn.uniforms.uT.value.set(.5 / src.width, .5 / src.height); pass(dn, t); src = t });
      for (let i = up.length - 1; i >= 0; i--) { upm.uniforms.tIn.value = src.texture; upm.uniforms.tAdd.value = down[i].texture; upm.uniforms.uT.value.set(.5 / src.width, .5 / src.height); pass(upm, up[i]); src = up[i] }
      looks.sort((a, b) => a.x0 - b.x0);
      const L0 = looks[0] ? looks[0].look : lookFor("intro"), L1 = looks.length > 1 ? looks[looks.length - 1].look : L0;
      packLook(L0, 0); packLook(L1, 1);
      fin.uniforms.uSeam.value = looks.length > 1 ? looks[0].x1 : 2;
      fin.uniforms.tM1.value = down[0].texture; fin.uniforms.tU1.value = (up[0] || down[0]).texture; fin.uniforms.tU2.value = (up[1] || up[0] || down[0]).texture; fin.uniforms.uTime.value = (t || 0) % 7;
      R.setViewport(0, 0, W, H); pass(fin, null);
    },
    dispose() { [sceneRT, A, ...down, ...up].forEach(t => t.dispose()); back.dispose(); [pre, dn, upm, fin].forEach(m => m.dispose()); quad.geometry.dispose() }
  };
}

/* ---------------- the module kit ---------------- */
const TOON_V = `#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
varying vec3 vNw,vWp;varying vec2 vUv;
void main(){
#include <color_vertex>
#include <beginnormal_vertex>
#include <defaultnormal_vertex>
#include <begin_vertex>
#include <project_vertex>
#include <fog_vertex>
  vUv=uv;vec4 wp=vec4(transformed,1.);
#ifdef USE_INSTANCING
  wp=instanceMatrix*wp;
#endif
  vWp=(modelMatrix*wp).xyz;vNw=inverseTransformDirection(transformedNormal,viewMatrix);}`;
const TOON_F = `uniform vec3 uColor,uShade,uLight,uRim,uAmbSky,uAmbGround,uEmissive,uLightDir;uniform float uSoft,uRimPow,uRimK,uOpacity,uMapOn,uWrap;uniform sampler2D uMap;
#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
varying vec3 vNw,vWp;varying vec2 vUv;
void main(){vec3 base=uColor;
#if defined(USE_COLOR)||defined(USE_INSTANCING_COLOR)
  base*=vColor;
#endif
  vec4 tx=uMapOn>.5?texture2D(uMap,vUv):vec4(1.);base*=tx.rgb;
  vec3 n=normalize(vNw);if(!gl_FrontFacing)n=-n;
  float nl=(dot(n,normalize(uLightDir))+uWrap)/(1.+uWrap);float lit=smoothstep(-uSoft,uSoft,nl);
  vec3 c=mix(base*uShade,base*uLight,lit)+base*mix(uAmbGround,uAmbSky,n.y*.5+.5);
  vec3 v=normalize(cameraPosition-vWp);c+=uRim*pow(1.-max(dot(n,v),0.),uRimPow)*uRimK*(.35+.65*lit);
  gl_FragColor=vec4(c+uEmissive,uOpacity*tx.a);
#include <fog_fragment>
}`;
const PT_V = `attribute vec3 aVel;attribute vec4 aSeed;uniform float uTime,uSize,uViewH,uWob;uniform vec3 uBox,uCenter;varying vec4 vS;varying float vA;
void main(){vS=aSeed;vec3 p=position+aVel*uTime+uWob*vec3(sin(uTime*(.3+aSeed.y)+aSeed.x*30.),sin(uTime*(.23+aSeed.z)+aSeed.y*40.),cos(uTime*(.27+aSeed.x)+aSeed.z*20.));
  p=uCenter+mod(p-uCenter+uBox*.5,uBox)-uBox*.5;vec4 mv=modelViewMatrix*vec4(p,1.);
  vA=smoothstep(0.,.08,fract((p.y-uCenter.y)/uBox.y+.5))*smoothstep(1.,.92,fract((p.y-uCenter.y)/uBox.y+.5));
  gl_PointSize=min(512.,uSize*(.5+aSeed.w)*projectionMatrix[1][1]*uViewH*.5/max(.05,-mv.z));gl_Position=projectionMatrix*mv;}`;
const PT_F = `uniform vec3 uCol,uCol2;uniform float uTime,uPulse,uTw,uOpacity;varying vec4 vS;varying float vA;
void main(){vec2 p=gl_PointCoord-.5;float r=length(p),a;
#if KIND==1
  a=exp(-r*r*40.)+.5*exp(-abs(p.x)*60.-abs(p.y)*7.)+.5*exp(-abs(p.y)*60.-abs(p.x)*7.);
#elif KIND==2
  a=smoothstep(.5,.4,r)*(.55+.45*smoothstep(.28,.47,r));
#elif KIND==3
  float an=vS.x*6.28+uTime*(vS.y-.5)*2.;vec2 q=mat2(cos(an),-sin(an),sin(an),cos(an))*p;a=smoothstep(1.,.75,length(q*vec2(2.2,4.4)));
#else
  a=exp(-r*r*18.);
#endif
  float tw=1.-uTw+uTw*(.5+.5*sin(uTime*(1.5+vS.z*4.)+vS.x*40.));a*=tw*(1.+uPulse*vS.w)*vA*uOpacity;if(a<.003)discard;
  gl_FragColor=vec4(mix(uCol,uCol2,vS.y)*a,a);}`;
const HZ_V = `attribute vec4 aSeed;uniform float uTime;uniform vec3 uDrift;varying vec2 vUv;varying vec4 vS;varying float vF;
void main(){vUv=uv;vS=aSeed;vec3 c=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz+uDrift*uTime*(.6+aSeed.y*.8);float s=length(instanceMatrix[0].xyz);
  vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]),u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
  vec3 w=c+(r*position.x*(1.+aSeed.z*.6)+u*position.y)*s;vec4 mv=viewMatrix*vec4(w,1.);vF=smoothstep(s*.25,s*1.2,-mv.z);gl_Position=projectionMatrix*mv;}`;
const HZ_F = `uniform sampler2D uTex;uniform vec3 uTop,uBot;uniform float uOpacity;varying vec2 vUv;varying vec4 vS;varying float vF;
void main(){vec2 q=vUv;if(vS.x>.5)q.x=1.-q.x;float a=texture2D(uTex,q).a*uOpacity*vF;if(a<.003)discard;gl_FragColor=vec4(mix(uBot,uTop,smoothstep(.2,.85,vUv.y))*a,a);}`;
const SKY_F = `uniform sampler2D uRamp;uniform vec3 uSunDir,uSunCol;uniform float uSun,uStars,uTime;varying vec3 vD;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){vec3 d=normalize(vD);float y=clamp(d.y,-.2,1.);vec3 c=texture2D(uRamp,vec2(.5,1.-pow(max(y,0.),.6))).rgb;
  float s=max(dot(d,normalize(uSunDir)),0.);c+=uSunCol*(pow(s,600.)*8.+pow(s,24.)*.5+pow(s,4.)*.12)*uSun;
  vec2 g=vec2(atan(d.z,d.x),asin(y))*180.;vec2 ce=floor(g);float r=h21(ce);
  c+=vec3(.9,.92,1.)*uStars*step(1.-.025,r)*smoothstep(.05,.35,y)*(.5+.5*sin(uTime*(1.+r*4.)+r*50.))*smoothstep(.4,0.,length(fract(g)-.5))*3.;
  gl_FragColor=vec4(c,1.);}`;

/* a soft cloud puff (alpha), painted once per kit */
function puffCanvas() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  for (let i = 0; i < 26; i++) { const x = 128 + (Math.random() - .5) * 120, y = 140 + (Math.random() - .5) * 70, r = 30 + Math.random() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256) }
  return c;
}

export function createKit(THREE, tier, section = "intro") {
  const owned = new Set(), keep = o => (owned.add(o), o);
  let puff = null;
  const C = v => v && v.isColor ? v : new THREE.Color(v);
  let look = null;
  const kit = {
    tier, PALETTE,
    palette: sec => PALETTE[sec] || PALETTE.intro,
    /* this shot's post look: section defaults plus your overrides (call it in update) */
    look(over) { look = Object.assign(look || {}, over || {}) },
    takeLook(sec) { const l = lookFor(sec, look); look = null; return l },
    /* soft cel / ramp shading: shade colour on the dark side (never black), soft terminator, rim light, sky/ground ambient, fog */
    toon(o = {}) {
      const P = PALETTE[o.section || section] || PALETTE.intro;
      const m = new THREE.ShaderMaterial({
        vertexShader: TOON_V, fragmentShader: TOON_F, fog: o.fog !== false, vertexColors: !!o.vertexColors, transparent: (o.opacity ?? 1) < 1, side: o.side ?? THREE.FrontSide,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
          uColor: { value: C(o.color ?? "#ffffff") }, uShade: { value: C(o.shade ?? P.shade) }, uLight: { value: C(o.light ?? P.light) }, uRim: { value: C(o.rim ?? P.rim) },
          uAmbSky: { value: C(o.ambSky ?? P.ambSky).multiplyScalar(o.ambient ?? .35) }, uAmbGround: { value: C(o.ambGround ?? P.ambGround).multiplyScalar(o.ambient ?? .35) },
          uEmissive: { value: C(o.emissive ?? "#000000") }, uLightDir: { value: new THREE.Vector3(...(o.lightDir || [-.4, .6, .5])).normalize() },
          uSoft: { value: o.soft ?? .22 }, uWrap: { value: o.wrap ?? .25 }, uRimPow: { value: o.rimPow ?? 3 }, uRimK: { value: o.rimK ?? .6 }, uOpacity: { value: o.opacity ?? 1 },
          uMapOn: { value: o.map ? 1 : 0 }, uMap: { value: o.map || null }
        }])
      });
      return keep(m);
    },
    /* a gradient sky dome: stops top to horizon (CSS colours), optional sun glow and twinkling stars */
    sky(o = {}) {
      const P = PALETTE[o.section || section] || PALETTE.intro, ramp = kit.ramp(o.stops || P.sky);
      const m = keep(new THREE.ShaderMaterial({ vertexShader: "varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}", fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uRamp: { value: ramp }, uSunDir: { value: new THREE.Vector3(...(o.sunDir || [.3, .08, -1])).normalize() }, uSunCol: { value: C(o.sunColor ?? P.light) }, uSun: { value: o.sun ?? 1 }, uStars: { value: o.stars ?? 0 }, uTime: { value: 0 } } }));
      const mesh = new THREE.Mesh(keep(new THREE.SphereGeometry(o.radius || 1500, 32, 16)), m); mesh.renderOrder = -10; mesh.frustumCulled = false;
      mesh.userData.update = f => { m.uniforms.uTime.value = f.t };
      return mesh;
    },
    /* a 1D gradient texture from CSS colour stops (even spacing, or [[0..1, colour], ...]) */
    ramp(stops, n = 256) {
      const st = stops.map((s, i) => Array.isArray(s) ? [s[0], new THREE.Color(s[1])] : [i / Math.max(1, stops.length - 1), new THREE.Color(s)]), d = new Uint8Array(n * 4), c = new THREE.Color();
      for (let i = 0; i < n; i++) { const u = i / (n - 1); let k = 0; while (k < st.length - 2 && st[k + 1][0] < u) k++; const [a, ca] = st[k], [b, cb] = st[Math.min(k + 1, st.length - 1)]; c.copy(ca).lerp(cb, b > a ? Math.min(1, Math.max(0, (u - a) / (b - a))) : 0).convertLinearToSRGB(); d[i * 4] = c.r * 255; d[i * 4 + 1] = c.g * 255; d[i * 4 + 2] = c.b * 255; d[i * 4 + 3] = 255 }
      const t = keep(new THREE.DataTexture(d, 1, n)); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
    },
    /* a texture painted once with 2D canvas calls: paint(w, h, (g, w, h) => {...}) */
    paint(w, h, fn) { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.userData.canvas = c; return t },
    /* soft billboard puffs: haze banks, mist, or clouds lit from below (top / bottom colours). Returns an object; call .update(f) */
    haze(o = {}) {
      const P = PALETTE[o.section || section] || PALETTE.intro, n = o.count ?? ({ saver: 16, smooth: 40, ultra: 90 }[tier]), box = o.box || [80, 6, 80], at = o.center || [0, 2, -30];
      if (!puff) { puff = keep(new THREE.CanvasTexture(puffCanvas())); puff.userData.canvas = puff.image }
      const geo = keep(new THREE.PlaneGeometry(1, .62)), seed = new Float32Array(n * 4), M = new THREE.Matrix4();
      const m = keep(new THREE.ShaderMaterial({ vertexShader: HZ_V, fragmentShader: HZ_F, transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uTex: { value: puff }, uTop: { value: C(o.top ?? P.fog) }, uBot: { value: C(o.bottom ?? P.shade) }, uOpacity: { value: o.opacity ?? .6 }, uTime: { value: 0 }, uDrift: { value: new THREE.Vector3(...(o.drift || [.4, 0, 0])) } } }));
      const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; im.renderOrder = o.renderOrder ?? 2;
      const rnd = mulberry(o.seed ?? 3);
      for (let i = 0; i < n; i++) { const s = (o.size ?? 14) * (.6 + rnd() * .8); M.makeScale(s, s, s).setPosition(at[0] + (rnd() - .5) * box[0], at[1] + (rnd() - .5) * box[1], at[2] + (rnd() - .5) * box[2]); im.setMatrixAt(i, M); seed.set([rnd(), rnd(), rnd(), rnd()], i * 4) }
      geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4)); keep(im);
      im.userData.update = f => { m.uniforms.uTime.value = f.t }; im.userData.material = m;
      return im;
    },
    /* GPU particles: kind "glow" | "spark" | "dust" | "bokeh" | "petal". They drift through a wrapping box, purely from f.t. */
    particles(o = {}) {
      const P = PALETTE[o.section || section] || PALETTE.intro, n = o.count ?? ({ saver: 600, smooth: 2500, ultra: 9000 }[tier]), box = o.box || [40, 20, 40], at = o.center || [0, 5, -15];
      const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), seed = new Float32Array(n * 4), rnd = mulberry(o.seed ?? 9), v = o.drift || [0, .3, 0];
      for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { pos[i * 3 + k] = at[k] + (rnd() - .5) * box[k]; vel[i * 3 + k] = v[k] * (.5 + rnd()) } seed.set([rnd(), rnd(), rnd(), rnd()], i * 4) }
      const geo = keep(new THREE.BufferGeometry()); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3)); geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
      const kind = { glow: 0, spark: 1, bokeh: 2, petal: 3, dust: 4 }[o.kind || "glow"] ?? 0;
      const m = keep(new THREE.ShaderMaterial({ vertexShader: PT_V, fragmentShader: PT_F, defines: { KIND: kind }, transparent: true, depthWrite: false, blending: kind === 3 ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: { uViewH: SHARED.uViewH, uTime: { value: 0 }, uSize: { value: o.size ?? .15 }, uWob: { value: o.wobble ?? .3 }, uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3(...at) },
          uCol: { value: C(o.color ?? P.light).multiplyScalar(o.intensity ?? 1.6) }, uCol2: { value: C(o.color2 ?? o.color ?? P.rim).multiplyScalar(o.intensity ?? 1.6) }, uPulse: { value: 0 }, uTw: { value: o.twinkle ?? .5 }, uOpacity: { value: o.opacity ?? 1 } } }));
      const pts = keep(new THREE.Points(geo, m)); pts.frustumCulled = false;
      pts.userData.update = f => { m.uniforms.uTime.value = f.t; m.uniforms.uPulse.value = (o.beat ?? 1) * (o.on === "fast" ? f.fastPulse : f.pulse) };
      pts.userData.material = m;
      return pts;
    },
    /* call each kit object's per-frame update: kit.tick(f, obj1, obj2, ...) */
    tick(f, ...objs) { for (const o of objs) o && o.userData.update && o.userData.update(f) },
    /* free everything the kit made (the core also calls this when it disposes the module) */
    dispose() { for (const o of owned) { if (o.isInstancedMesh) o.dispose(); else if (o.dispose) o.dispose(); if (o.userData && o.userData.canvas) o.userData.canvas.width = 0 } owned.clear(); puff = null }
  };
  return kit;
}
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
