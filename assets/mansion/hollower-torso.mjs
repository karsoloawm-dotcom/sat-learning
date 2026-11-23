const CENTER = 1.082;
const SAMPLES = 64;
const edge = a => 1 + .037 * Math.sin(7 * a + 1.2) + .027 * Math.sin(13 * a);

// All layers use the same opening in bind space. The garment has a wider, frayed
// edge, while the cavity wall meets the sampled skin at the inner edge.
function cutMaterial(T, source, aperture, stained, depth = false) {
  const material = depth
    ? new T.MeshDepthMaterial({depthPacking: T.RGBADepthPacking})
    : source.clone();
  if (depth) material.side = T.DoubleSide;
  const baseCompile = depth ? null : source.onBeforeCompile;
  material.onBeforeCompile = shader => {
    baseCompile?.call(source, shader);
    shader.uniforms.hollowAperture = aperture;
    shader.vertexShader = 'varying vec3 vHollowRest;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvHollowRest = position;');
    const test = `
      if (hollowAperture.x > 0. && vHollowRest.z > -.032) {
        vec2 xy = (vHollowRest.xy - vec2(0., ${CENTER})) / hollowAperture;
        float a = atan(xy.y, xy.x + .000001);
        float rim = 1. + .037 * sin(7. * a + 1.2) + .027 * sin(13. * a);
        float d = length(xy) - rim;
        if (d < 0.) discard;
        ${stained && !depth ? 'diffuseColor.rgb *= mix(vec3(.40,.095,.11), vec3(1.), smoothstep(.01,.23,d));' : ''}
      }
    `;
    const anchor = depth ? '#include <alphatest_fragment>' : '#include <map_fragment>';
    shader.fragmentShader = 'varying vec3 vHollowRest;\nuniform vec2 hollowAperture;\n' +
      shader.fragmentShader.replace(anchor, anchor + '\n' + test);
  };
  material.customProgramCacheKey = () =>
    'hollower/' + (source?.customProgramCacheKey() || 'depth') + '/' + stained;
  return material;
}

function frontSurface(T, mesh) {
  const position = mesh.geometry.attributes.position, indices = mesh.geometry.index;
  const cell = v => Math.floor(v * 100);
  const rows = new Map();
  // Bin front-facing skin triangles by y. Sampling in bind space also works with
  // Model Lab variants, and interpolating the posed triangle follows skinning.
  const skin = mesh.geometry.groups.find(g => g.materialIndex === 0);
  for (let i = skin.start; i < skin.start + skin.count; i += 3) {
    const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    const [a,b,c] = ids.map(id => new T.Vector3().fromBufferAttribute(position,id));
    const minY = Math.min(a.y,b.y,c.y), maxY = Math.max(a.y,b.y,c.y);
    if (maxY < .86 || minY > 1.29 || Math.max(a.z,b.z,c.z) < -.032) continue;
    const minX = Math.min(a.x,b.x,c.x), maxX = Math.max(a.x,b.x,c.x);
    if (minX > .15 || maxX < -.15) continue;
    const det = (b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if (Math.abs(det) < 1e-9) continue;
    const triangle = {ids,a,b,c,minX,maxX,det};
    for (let row = cell(minY); row <= cell(maxY); row++) {
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(triangle);
    }
  }
  const v = new T.Vector3();
  return (x,y,out) => {
    let best, u0, v0, w0, front = -.032;
    for (const triangle of rows.get(cell(y)) || []) {
      const {a,b,c,minX,maxX,det} = triangle;
      if (x < minX || x > maxX) continue;
      const u = ((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det;
      const v = ((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det;
      const w = 1-u-v;
      if (Math.min(u,v,w) < -1e-5) continue;
      const z = a.z*u + b.z*v + c.z*w;
      if (z <= front) continue;
      best = triangle; u0 = u; v0 = v; w0 = w; front = z;
    }
    if (!best) return out.set(x,y,.039);
    out.set(0,0,0);
    [u0,v0,w0].forEach((weight,i) => {
      const id = best.ids[i];
      mesh.applyBoneTransform(id,v.fromBufferAttribute(position,id));
      out.addScaledVector(v,weight);
    });
    return out;
  };
}

export function makeTorso(T, body, decorate=()=>{}) {
  const skinAperture = {value: new T.Vector2()}, clothAperture = {value: new T.Vector2()};
  const mesh = body.userData.mesh, original = mesh.material;
  const skin = cutMaterial(T, original[0], skinAperture, true);
  const face = original[1].clone();
  face.onBeforeCompile = original[1].onBeforeCompile;
  face.customProgramCacheKey = original[1].customProgramCacheKey;
  decorate(skin);
  decorate(face,true);
  const cloth = cutMaterial(T, original[2], clothAperture, true);
  const wounded = [skin,face,cloth];
  const depth = cutMaterial(T, null, skinAperture, false, true);
  const surface = frontSurface(T, mesh);
  const cavity = new T.Group();
  cavity.name = 'Hollower torso interior';
  body.userData.bones.chest.add(cavity);
  body.updateMatrixWorld(true);
  const bind = mesh.getWorldPosition(new T.Vector3());
  cavity.parent.worldToLocal(bind);
  cavity.position.copy(bind);
  const shell = new T.BufferGeometry();
  const layers = 4;
  const points = new T.BufferAttribute(new Float32Array((SAMPLES * layers + 1) * 3),3);
  const indices = [], colors = [];
  for (const [layer, color] of [0x8b2837,0x902534,0x501427,0x290b19].entries()) {
    const tint = new T.Color(color);
    for (let i = 0; i < SAMPLES; i++) {
      const shade = .89 + .11 * Math.sin(i*2.36+layer);
      colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
      const a = i+SAMPLES*layer, b = (i+1)%SAMPLES+SAMPLES*layer;
      if (layer < layers-1) indices.push(a,b,a+SAMPLES,b,b+SAMPLES,a+SAMPLES);
      else indices.push(a,b,layers*SAMPLES);
    }
  }
  colors.push(.012,.004,.009);
  shell.setIndex(indices);
  shell.setAttribute('position', points.setUsage(T.DynamicDrawUsage));
  shell.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  const lining = new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,emissive:0x1a060d});
  const inner = new T.Mesh(shell,lining);
  inner.frustumCulled = false;
  cavity.add(inner);

  const materials = [skin,face,cloth,depth,lining], geometries = [shell];
  const tissue = (color,gloss=18) => {
    const m = new T.MeshPhongMaterial({color,shininess:gloss,flatShading:true,emissive:0x100408});
    materials.push(m);return m;
  };
  const bone = tissue(0xc5ad91,6), lung = tissue(0xa15b6b), heartM = tissue(0x9f263c);
  const vessel = tissue(0x78314c), liverM = tissue(0x6f2529), kidneyM = tissue(0x872f39);
  const gut = tissue(0xca726d), uterus = tissue(0xb35973), cartilage = tissue(0xb27b81);
  function organ(name, position) {
    const group = new T.Group();group.name = name;group.position.fromArray(position);cavity.add(group);
    return group;
  }
  function add(parent, geometry, material, position=[0,0,0]) {
    const part = new T.Mesh(geometry,material);part.position.fromArray(position);parent.add(part);
    geometries.push(geometry);return part;
  }
  function lobe(parent, material, p, scale, roll=0) {
    const part = add(parent,new T.IcosahedronGeometry(1,1),material,p);
    part.scale.fromArray(scale);part.rotation.z = roll;return part;
  }
  function tube(parent, material, coords, radius) {
    const curve = new T.CatmullRomCurve3(coords.map(p => new T.Vector3(...p)));
    return add(parent,new T.TubeGeometry(curve,Math.max(5,coords.length*3),radius,5,false),material);
  }
  const ribs = organ('Broken ribs and thoracic spine',[0,0,0]);
  const fragment = organ('Loose rib ends',[0,1.158,.025]);
  for (let i = 0; i < 8; i++) {
    const y = 1.222-i*.015;
    lobe(ribs,bone,[0,y,-.060],[.016,.007,.011]);
    for (const s of [-1,1]) {
      const width = .077 + .029*Math.sin((i+1)*.26);
      const end = .040 + .009*Math.sin(i*1.7+s);
      tube(ribs,bone,[[s*.012,y,-.061],[s*.071,y+.002,-.047],[s*width,y-.012,-.017],
        [s*(width-.019),y-.018,.018],[s*end,y-.022,.032]],.0037);
      if (i < 4 && s < 0) {
        tube(fragment,bone,[[-end,y-1.18,.005],[-.026,y-1.183,.003],[-.012,y-1.180,0]],.0032);
      }
    }
  }
  const lungs = [-1,1].map(s => {
    const group = organ(s < 0 ? 'Right lung' : 'Left lung',[s*.052,1.174,-.021]);
    lobe(group,lung,[s*.006,.012,0],[.031,.059,.031],s*.21);
    lobe(group,lung,[-s*.003,-.031,.004],[.028,.031,.028],-s*.15);
    tube(group,cartilage,[[-s*.037,.048,-.008],[-s*.017,.038,-.010],[-s*.002,.021,-.005]],.0048);
    return group;
  });
  const heart = organ('Heart',[.017,1.149,.019]);
  lobe(heart,heartM,[0,0,0],[.024,.035,.022],.31);
  lobe(heart,heartM,[-.009,.015,-.002],[.018,.015,.019]);
  tube(heart,vessel,[[.001,.011,-.002],[.002,.031,.003],[-.009,.037,.003],[-.016,.029,-.007]],.0052);
  const liver = organ('Liver',[-.041,1.086,.013]);
  lobe(liver,liverM,[-.006,0,0],[.049,.025,.027],.21);
  lobe(liver,liverM,[.033,.005,.001],[.030,.016,.019],-.27);
  const stomach=lobe(cavity,gut,[.046,1.075,-.015],[.030,.034,.026],.38);
  stomach.name = 'Stomach';
  const bowels = organ('Small and large intestine',[0,1.003,.006]);
  tube(bowels,gut,[[-.058,-.041,-.010],[-.066,0,.003],[-.066,.040,.002],
    [0,.049,.006],[.060,.036,.004],[.064,-.016,.004],[.041,-.038,.001],[.018,-.050,-.013]],.011);
  tube(bowels,cartilage,[[-.043,.025,.002],[.021,.030,.012],[.042,.011,.018],
    [-.047,.006,.015],[-.038,-.013,.017],[.036,-.018,.016],[.025,-.034,.012],[-.020,-.031,.012]],.010);
  const kidneys=[];
  for (const s of [-1,1]) {
    const kidney = organ(s < 0 ? 'Right kidney' : 'Left kidney',[s*.051,1.036,-.035]);
    kidneys.push(kidney);
    lobe(kidney,kidneyM,[0,0,0],[.018,.030,.014],s*.31);
    lobe(kidney,kidneyM,[s*.007,-.010,.002],[.013,.017,.012]);
    tube(kidney,cartilage,[[0,0,.004],[-s*.014,-.007,.010],[-s*.016,-.035,.001]],.0028);
  }
  const pelvic = organ('Uterus and ovaries',[0,.934,-.019]);
  lobe(pelvic,uterus,[0,.006,0],[.024,.018,.014]);
  tube(pelvic,uterus,[[0,.012,0],[0,-.004,.006],[0,-.018,0]],.009);
  for (const s of [-1,1]) {
    tube(pelvic,uterus,[[s*.009,.014,0],[s*.026,.024,-.003],[s*.046,.015,-.005]],.003);
    lobe(pelvic,cartilage,[s*.046,.013,-.005],[.008,.005,.006]);
  }

  const lip = new T.Vector3(), xform = new T.Matrix4();
  function update(open, fabric, on) {
    const visible = on && open[0] > 0;
    cavity.visible = visible;
    mesh.material = on && fabric[0] > 0 ? wounded : original;
    mesh.customDepthMaterial = visible ? depth : undefined;
    skinAperture.value.fromArray(open);
    clothAperture.value.fromArray(fabric);
    if (!visible) return;
    xform.copy(cavity.matrixWorld).invert().multiply(mesh.matrixWorld);
    for (let i = 0; i < SAMPLES; i++) {
      const a = i/SAMPLES*Math.PI*2, r = edge(a);
      const x = open[0]*r*Math.cos(a), y = open[1]*r*Math.sin(a);
      surface(x*1.011,CENTER+y*1.011,lip).applyMatrix4(xform);
      points.setXYZ(i,lip.x,lip.y,lip.z-.0005);
      points.setXYZ(SAMPLES+i,lip.x*.95,CENTER+(lip.y-CENTER)*.97,lip.z-.013);
      points.setXYZ(2*SAMPLES+i,x*.89,CENTER+y*.92,-.039);
      points.setXYZ(3*SAMPLES+i,x*.66,CENTER+y*.72,-.081);
    }
    points.setXYZ(SAMPLES*layers,0,CENTER,-.086);
    points.needsUpdate = true;
    shell.computeVertexNormals();
  }
  return {
    cavity, fragment, heart, lungs, liver, bowels, update,
    viscera:[ribs,...lungs,heart,liver,stomach,bowels,...kidneys,pelvic],
    dispose() {
      mesh.material = original;
      mesh.customDepthMaterial = undefined;
      materials.forEach(m => m.dispose());
      geometries.forEach(g => g.dispose());
    }
  };
}
