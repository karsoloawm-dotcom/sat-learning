// Anatomy is baked once per rig. Each rigid section stays on the same joint as the skin.
export function anatomyBuilder(T, header, names, ivory, socket) {
  const groups = new Map(), up = new T.Vector3(0,1,0);
  const V = a => new T.Vector3(...a);
  function bake(owner, region, geometry, position, scale, rotation, material=ivory) {
    const key = [owner,region,material.id].join('/');
    if(!groups.has(key)) groups.set(key,{owner,region,material,positions:[],normals:[]});
    const batch=groups.get(key), flat=geometry.index?geometry.toNonIndexed():geometry;
    flat.applyMatrix4(new T.Matrix4().compose(position,rotation||new T.Quaternion(),scale));
    batch.positions.push(...flat.attributes.position.array);
    batch.normals.push(...flat.attributes.normal.array);
    flat.dispose(); if(flat!==geometry) geometry.dispose();
  }
  function oval(owner,region,p,scale,mat) {
    bake(owner,region,new T.SphereGeometry(1,10,7),V(p),V(scale),null,mat);
  }
  function rod(owner,region,a,b,r,s=r) {
    const A=V(a), B=V(b), delta=B.clone().sub(A);
    bake(owner,region,new T.CylinderGeometry(s,r,delta.length(),7),A.lerp(B,.5),V([1,1,1]),new T.Quaternion().setFromUnitVectors(up,delta.normalize()));
  }
  function curve(owner,region,points,r) {
    bake(owner,region,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),12,r,5,false),V([0,0,0]),V([1,1,1]));
  }
  // Cross-sections are deliberately unequal. The hip wings flare outward
  // while the sockets sit over the actual femoral heads in bind space.
  function loft(owner,region,rings){
    const vertices=[],indices=[],segments=12;
    for(const [x,y,z,rx,rz] of rings){
      for(let i=0;i<segments;i++){
        const a=2*Math.PI*i/segments;
        vertices.push(x+rx*Math.cos(a),y,z+rz*Math.sin(a));
      }
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
      const a=j*segments+i,b=j*segments+(i+1)%segments;
      indices.push(a,a+segments,b,b,a+segments,b+segments);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    bake(owner,region,g,V([0,0,0]),V([1,1,1]));
  }
  for(const joint of header.bones){
    if(joint.p<0)continue;
    const owner=names[joint.p], t=joint.t;
    if(/^(hips|spine|spine2|chest|neck)$/.test(owner)&&/^(spine|spine2|chest|neck|head)$/.test(joint.n)){
      const n=Math.ceil(t[1]/.021);
      for(let i=0;i<n;i++){
        const f=(i+.5)/n, z=t[2]*f;
        oval(owner,'vertebrae',[0,t[1]*f,z],[.016,t[1]/n*.55,.014]);
        rod(owner,'vertebrae',[0,t[1]*f,z],[0,t[1]*f-.006,z-.023],.008,.003);
      }
    }
    if(/^(forearm|shin|hand|foot)\./.test(joint.n)){
      const paired=/^(hand|foot)/.test(joint.n),arm=owner.includes('arm');
      for(const shift of paired?[-1,1]:[0]){
        const offset=shift*(arm?.009:.012);
        const a=arm?[0,offset*.27,offset]:[offset*.72,0,0];
        const b=arm?[t[0],t[1]+offset*.62,t[2]+offset]:[t[0]+offset,t[1],t[2]+offset*.42];
        const radius=arm?(paired?.008:.012):(paired?(shift===1?.014:.007):.017);
        rod(owner,'limb',a,b,radius,radius*.8);
      }
      oval(owner,'joint',t,arm?[.017,.014,.016]:[.024,.018,.024]);
    }
  }
  for(const s of [-1,1]){
    const side=s===1?'L':'R';
    curve('chest','clavicles',[[0,.078,.045],[s*.047,.085,.037],[s*.092,.071,.014],[s*.125,.05,.008]],.007);
    oval('chest','scapulae',[s*.061,.031,-.026],[.035,.045,.008]);
    for(let i=0;i<10;i++){
      const y=.061-i*.016, w=.066+.036*Math.sin((i+1)*Math.PI/13);
      curve('chest','ribs',[[s*.012,y,-.012],[s*w*.77,y+.003,-.025],[s*w,y-.016,.022],[s*w*.71,y-.029,.061],[s*(i<7?.009:.022+(i-7)*.009),y-.014,.074-i*.001]],.0048);
    }
    loft('hips','pelvis',[
      [s*.072,-.062,.001,.014,.016],[s*.073,-.042,-.002,.022,.025],
      [s*.06,-.018,-.009,.029,.037],[s*.062,.017,-.016,.043,.037],
      [s*.069,.037,-.022,.044,.029],[s*.073,.045,-.024,.033,.018],
      [s*.074,.048,-.025,.023,.011]]);
    rod('hips','hip socket',[s*.073,-.052,0],[s*.088,-.077,-.001],.019,.014);
    oval('thigh_'+side,'femoral head',[0,0,0],[.02,.023,.02]);
    oval('upperarm_'+side,'humeral head',[0,0,0],[.019,.02,.021]);
    oval('shin_'+side,'kneecap',[0,-.006,.011],[.018,.019,.011]);
    oval('foot_'+side,'heel',[0,-.022,-.009],[.019,.021,.031]);
    rod('foot_'+side,'arch',[0,-.019,-.006],[0,-.031,.047],.015,.009);
    curve('hips','pelvis',[[s*.083,-.014,0],[s*.072,-.057,.013],[s*.042,-.074,.038],[0,-.044,.057]],.011);
    for(let f=0;f<5;f++){
      const z=(f-2)*.009;
      curve('hand_'+side,'palm',[[0,0,0],[s*.03,0,z],[s*.049,-.002,z*1.28]],.004);
      const finger=names.includes('fingers_'+side);
      const offset=finger?0:.049;
      curve((finger?'fingers_':'hand_')+side,'digits',[[s*offset,0,z*1.28],[s*(offset+.02),-.003,z*1.36],[s*(offset+.038-Math.abs(f-2)*.006),-.009,z*1.39]],.0033);
      curve('foot_'+side,'instep',[[0,-.03,-.022],[z,-.032,.036],[z*1.25,-.039,.082]],.005);
      const toe=names.includes('toe_'+side);
      rod((toe?'toe_':'foot_')+side,'toes',[z*1.25,toe?0:-.038,toe?.006:.082],[z*1.45,toe?-.004:-.042,toe?.036:.112],.004);
    }
    oval('head','orbits',[s*.034,.097,.088],[.023,.019,.009],socket);
    curve('head','cheeks',[[s*.06,.108,.079],[s*.066,.081,.066],[s*.043,.071,.086]],.008);
    curve('head','mandible',[[s*.062,.081,.03],[s*.056,.041,.042],[s*.029,.03,.086],[0,.03,.091]],.009);
  }
  rod('head','atlas',[0,0,0],[0,.053,.003],.013,.016);
  rod('chest','sternum',[0,-.078,.069],[0,.061,.074],.007,.01);
  oval('head','cranium',[0,.124,.016],[.084,.091,.082]);
  loft('head','nasal bridge',[[0,.065,.09,.006,.004],[0,.075,.094,.011,.009],[0,.098,.085,.005,.005]]);
  loft('hips','sacrum',[[0,-.05,-.027,.005,.008],[0,-.018,-.025,.025,.012],[0,.017,-.022,.032,.015]]);
  oval('head','maxilla',[0,.061,.065],[.043,.018,.025]);
  const sections=[...groups.values()].map(({owner,region,material,positions,normals})=>{
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    return {owner,region,material,geometry};
  });
  return function attach(actor, filter=()=>true){
    const out=sections.filter(({owner,region})=>filter(owner,region)).map(({owner,region,geometry,material})=>{
      const mesh=new T.Mesh(geometry,material);mesh.name=region+' / '+owner;
      actor.userData.bones[owner].add(mesh);return mesh;
    });
    return {out,remove(){out.forEach(mesh=>mesh.removeFromParent());}};
  };
}
