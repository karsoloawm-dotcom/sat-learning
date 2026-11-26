// A hanging city. One unit box supplies offices, rooftop machinery and radio steel.
const vertexShader = `
  attribute vec4 facade; // family, city-block id, pane spacing, occupancy
  varying vec4 vFacade;
  varying vec2 vWall;
  varying vec3 vSurface;
  varying float vCityX;
  #include <fog_pars_vertex>
  void main() {
    vec3 extent = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz),
                       length(instanceMatrix[2].xyz));
    vec3 city = (instanceMatrix * vec4(position, 1.)).xyz;
    vWall = vec2((normal.x != 0. ? uv.x * extent.z : uv.x * extent.x),
                 uv.y * extent.y);
    vFacade = facade;
    vSurface = normal;
    vCityX = city.x;
    vec4 mvPosition = modelViewMatrix * vec4(city, 1.);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = `
  uniform float phase, accent, seconds;
  varying vec4 vFacade;
  varying vec2 vWall;
  varying vec3 vSurface;
  varying float vCityX;
  #include <fog_pars_fragment>
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031,.11369,.13787));
    q += dot(q, q.yzx + 19.19);
    return fract((q.x + q.y) * q.z);
  }
  void main() {
    float id = vFacade.y;
    float shade = .55 + .32 * vSurface.z - .14 * vSurface.y;
    vec3 wall = mix(vec3(.019,.022,.065),vec3(.021,.085,.104),fract(id*.371)) * shade;
    vec3 col = wall;
    if (vFacade.x < .5 && abs(vSurface.y) < .5) {
      vec2 grid = vWall / vec2(vFacade.z, .82);
      vec2 cell = floor(grid);
      float floorLight = hash(vec2(cell.y,id));
      float room = hash(vec2(floor(cell.x/3.) + id, cell.y));
      float light = hash(cell + id);
      float sweep = fract(phase - (vCityX + 80.) / 160.);
      float wave = 1. - smoothstep(.015,.22,sweep);
      float lit = step(light, vFacade.w + (floorLight-.5)*.44 + (room-.5)*.46 + .33*wave);
      vec2 pane = vec2(.32,.26) - abs(fract(grid)-.5);
      vec2 aa = clamp(fwidth(grid)*.5,vec2(.01),vec2(.45));
      vec2 cover = smoothstep(-aa,aa,pane);
      vec3 glass = mix(vec3(.45,.75,.93),vec3(1.,.55,.21),smoothstep(.35,.8,room));
      col += glass * cover.x * cover.y * (.025 + lit*(.23+.64*floorLight+.62*wave+accent*.95));
    } else if (vFacade.x > 1.5) {
      float blink = pow(max(0.,cos(seconds*3.3+id)),8.);
      col = vec3(.25+2.8*blink,.012,.01);
    } else if (vFacade.x > .5) {
      col = mix(vec3(.16,.066,.057),vec3(.58,.31,.18),fract(id*.37)) * (.7+.22*vSurface.z);
    }
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    col = mix(col, vec3(.09,.105,.20), .62*smoothstep(38.,140.,depth));
    gl_FragColor = vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function create({ THREE, scene, tier, seed = 1 }) {
  let state = seed >>> 0;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  const matrices = [], facades = [];
  const transform = new THREE.Object3D();
  function box(x, y, z, w, h, d, style, rotation) {
    transform.position.set(x,y,z);
    transform.scale.set(w,h,d);
    if (rotation) transform.quaternion.copy(rotation);
    else transform.quaternion.identity();
    transform.updateMatrix();
    matrices.push(transform.matrix.clone());
    facades.push(...style);
  }
  const [rows, columns] = {saver:[3,21], smooth:[6,27], ultra:[10,37]}[tier];
  const step = 156 / columns;
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < columns; i++) {
      const x = -78 + step*(i+.5+(random()-.5)*.17);
      const z = -19 - row*97/(rows-1) - random()*1.3;
      // A break in the front row gives the copper truss its own patch of sky.
      if (Math.abs(x-13)<5 && row === 0) continue;
      const w = step*(.43+.47*random()), d = 2.6+random()*4;
      const height = 6+random()*13+10*Math.pow(random(),3);
      const roof = 45-height;
      const style = [0,1+random()*1024,.58+.58*random(),.23+.25*random()];
      box(x,45-height/2,z,w,height,d,style);
      if (random()<.75) {
        const h = 1.1+random()*4.5;
        box(x-w*.07,roof-h/2,z,w*.66,h,d*.72,style);
        if (random()<.22) {
          box(x-w*.07,roof-h-1,z,.09,2,.09,[1,style[1],1,1]);
          box(x-w*.07,roof-h-2,z,.2,.22,.2,[2,style[1],1,1]);
        }
      }
    }
  }

  // A triangular mast with an offset waist and a suspended tuning fork.
  const up = new THREE.Vector3(0,1,0);
  function beam(a,b,width) {
    const axis = new THREE.Vector3().subVectors(b,a);
    const length = axis.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(up,axis.normalize());
    box((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,width,length,width,[1,matrices.length,1,1],rotation);
  }
  let previous;
  for (const [y,r,offset] of [[45,2.9,0],[39,2.25,.2],[33,1.5,.6],[27,.95,.9],[21,.82,.7],[15,.40,.3]]) {
    const ring = Array.from({length:3},(_,i)=>{
      const a = i*Math.PI*2/3+.31;
      return new THREE.Vector3(13+offset+r*Math.cos(a),y,-30+r*Math.sin(a));
    });
    for (let i=0;i<3;i++) {
      const j=(i+1)%3;
      beam(ring[i],ring[j],.16);
      if (previous) {
        beam(previous[i],ring[i],.19);
        beam(previous[i],ring[j],.11);
      }
    }
    previous=ring;
  }
  for (const [dx,h] of [[-.36,5.7],[.36,3.8]]) {
    box(13.3+dx,15-h/2,-30,.15,h,.15,[1,2,1,1]);
    box(13.3+dx,15-h,-30,.27,.25,.27,[2,1,1,1]);
  }

  const geometry = new THREE.BoxGeometry();
  geometry.setAttribute('facade',new THREE.InstancedBufferAttribute(new Float32Array(facades),4));
  const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  for (const name of ['phase','accent','seconds']) uniforms[name] = {value:0};
  const material = new THREE.ShaderMaterial({vertexShader, fragmentShader, uniforms, fog:true,
    extensions:{derivatives:true}});
  const mesh = new THREE.InstancedMesh(geometry,material,matrices.length);
  matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
  const group = new THREE.Group();
  group.name = 'Tokyo at twilight';
  group.add(mesh);
  scene.add(group);
  return {
    group,
    update(f) {
      uniforms.phase.value = f.beatPhase;
      uniforms.accent.value = f.accent;
      uniforms.seconds.value = f.t;
      const u = f.section === 'chorus2' ? THREE.MathUtils.clamp(f.secT,0,1) : 0;
      group.rotation.z = (25*Math.PI/180)*u*u*(3-2*u);
    },
    setVisible(on) { group.visible = on; },
    dispose() {
      group.removeFromParent();
      group.clear();
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    }
  };
}
