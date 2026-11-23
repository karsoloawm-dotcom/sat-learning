import * as T from "three";

export const garments=["Shirt","Tie","Trousers","Shoes","Bra","Briefs"];

export function fitNagiAnatomy(actor){
  const {root,bones}=actor;
  root.updateWorldMatrix(true,true);
  const groups={skeleton:[],organs:[],muscles:[]};
  const v=(x,y,z)=>new T.Vector3(x,y,z),up=v(0,1,0);
  const makeMat=(color,roughness)=>new T.MeshStandardMaterial({color,roughness,flatShading:true});
  const ivory=makeMat(0xe0cbb0,.63),cartilage=makeMat(0xa9a59e,.72);
  const muscle=makeMat(0xa44951,.63),tendon=makeMat(0xd49f92,.72);
  const deep=makeMat(0x73363e,.70),fascia=makeMat(0xb57776,.71);
  const lung=makeMat(0xb17687,.62),heart=makeMat(0x9a3446,.52),liver=makeMat(0x713840,.57);
  const gut=makeMat(0xbb7a72,.55),brain=makeMat(0xbd8c9c,.64);
  const colon=makeMat(0x965a59,.57),kidney=makeMat(0x874854,.56);
  const artery=makeMat(0xbc5360,.58),vein=makeMat(0x71506e,.56),duct=makeMat(0xb8a674,.62);
  const sphere=new T.IcosahedronGeometry(1,1),shaft=new T.CylinderGeometry(.82,1,1,7);
  const point=(owner,xyz)=>bones.get(owner).worldToLocal(root.localToWorld(v(...xyz)));
  function mesh(group,owner,geometry,material,name){
    const piece=new T.Mesh(geometry,material);piece.name="Nagi · "+name;
    bones.get(owner).add(piece);groups[group].push(piece);piece.visible=false;
    return piece;
  }
  function oval(group,owner,name,p,dimensions,mat){
    const piece=mesh(group,owner,sphere,mat,name);
    piece.position.copy(point(owner,p));piece.scale.fromArray(dimensions);
    // The authored ellipsoids use the character's bind axes, including along the torso.
    piece.quaternion.copy(bones.get(owner).getWorldQuaternion(new T.Quaternion()).invert())
      .multiply(root.getWorldQuaternion(new T.Quaternion()));
  }
  function arc(group,owner,name,points,radius,mat){
    const curve=new T.CatmullRomCurve3(points.map(p=>point(owner,p)));
    mesh(group,owner,new T.TubeGeometry(curve,Math.max(10,points.length*4),radius,7,false),mat,name);
  }
  const tissueMaterials=new Map(),strandTint=new T.Color(0xe9b9aa);
  // Tapered cross-sections describe attachment and volume independently. The
  // longitudinal colors follow the mesh into its tendon without extra surfaces.
  function loft(group,owner,name,sections,mat,fibers=false,local=false){
    const rings=sections.map(([x,y,z,w,d])=>({center:local?v(x,y,z):point(owner,[x,y,z]),w,d}));
    const front=local?v(0,0,1):point(owner,[0,0,1]).sub(point(owner,[0,0,0])).normalize();
    const verts=[],colors=[],indices=[],sides=12,tint=new T.Color();
    rings.forEach(({center,w,d},i)=>{
      const axis=rings[Math.min(i+1,rings.length-1)].center.clone().sub(rings[Math.max(0,i-1)].center).normalize();
      const side=axis.clone().cross(front);
      if(side.lengthSq()<1e-5)side.crossVectors(axis,up);
      side.normalize();
      const depth=side.clone().cross(axis).normalize();
      const u=i/(rings.length-1);
      for(let j=0;j<sides;j++){
        const a=j/sides*Math.PI*2;
        const shape=1+.046*Math.sin(a*3+.42*i);
        const p=center.clone().addScaledVector(side,w*Math.cos(a)*shape).addScaledVector(depth,d*Math.sin(a)*shape);
        verts.push(p.x,p.y,p.z);
        const end=Math.max(0,1-Math.min(u,1-u)*6);
        tint.copy(mat.color).multiplyScalar(.91+.13*Math.sin(2.3*j+.20*i));
        if(fibers)tint.lerp(strandTint,.57*end+.091*(.5+.5*Math.cos(j*4.7+.13*i)));
        colors.push(tint.r,tint.g,tint.b);
        if(i<rings.length-1){
          const first=i*sides+j,next=i*sides+(j+1)%sides;
          indices.push(first,first+sides,next,next,first+sides,next+sides);
        }
      }
    });
    for(let j=1;j<sides-1;j++){
      const last=(rings.length-1)*sides;
      indices.push(0,j,j+1,last,last+j+1,last+j);
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(verts,3));
    geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    if(!tissueMaterials.has(mat)){
      const colored=mat.clone();colored.color.setHex(0xffffff);colored.vertexColors=true;colored.flatShading=false;
      tissueMaterials.set(mat,colored);
    }
    mesh(group,owner,geo,tissueMaterials.get(mat),name);
  }
  const bundles={
    UpperArm:[["biceps",.013,.010,.024,.020,.44],["triceps",-.006,-.016,.026,.022,.36],["brachialis",-.016,.010,.013,.013,.60]],
    Forearm:[["forearm flexors",.009,.011,.020,.019,.29],["forearm extensors",-.011,-.012,.017,.018,.36],["brachioradialis",.016,-.011,.012,.014,.22]],
    Thigh:[["rectus femoris",.002,.026,.026,.025,.37],["vastus lateralis",.030,.005,.025,.027,.42],
      ["vastus medialis",-.023,.013,.022,.023,.65],["hamstrings",.001,-.026,.031,.025,.43]],
    Shin:[["outer gastrocnemius",.013,-.017,.019,.023,.30],["inner gastrocnemius",-.012,-.020,.020,.026,.36],
      ["tibialis anterior",.005,.016,.017,.016,.31]]
  };
  function link(owner,child,radius){
    const end=bones.get(child).position,axis=end.clone().normalize();
    const boneMesh=mesh("skeleton",owner,shaft,ivory,owner+" bone");
    boneMesh.position.copy(end).multiplyScalar(.5);boneMesh.quaternion.setFromUnitVectors(up,axis);
    boneMesh.scale.set(radius,end.length(),radius);
    const joint=mesh("skeleton",owner,sphere,cartilage,owner+" joint");
    joint.position.copy(end);joint.scale.setScalar(radius*1.4);
    const sign=owner.endsWith("L")?1:-1,len=end.length(),kind=owner.slice(0,-1);
    const fill={Thigh:1.3,Shin:1.15,UpperArm:1.05,Forearm:1.1}[kind];
    for(const [i,[name,x,z,w0,d0,peak]] of bundles[kind].entries()){
      const w=w0*fill,d=d0*fill;
      loft("muscles",owner,name,[
        [sign*x*.44,-.014,z*.48,w*.22,d*.26],
        [sign*x*.86,len*peak*.54,z*.90,w*.75,d*.77],
        [sign*x,len*peak,z,w,d],
        [sign*x*.83,len*(peak+.20),z*.83,w*.72,d*.76],
        [sign*x*.55,len*.86,z*.56,w*.24,d*.39],
        [sign*x*.39,len*1.02,z*.43,w*.15,d*.23]
      ],i%2===0?muscle:deep,true,true);
    }
  }
  for(const s of ["L","R"]){
    link("UpperArm"+s,"Forearm"+s,.014);
    link("Forearm"+s,"Hand"+s,.011);
    link("Thigh"+s,"Shin"+s,.019);
    link("Shin"+s,"Foot"+s,.014);
    const joint=bones.get("Hand"+s);
    for(let i=0;i<4;i++){
      const digit=mesh("skeleton","Hand"+s,sphere,ivory,"hand phalanx");
      digit.position.set((i-1.5)*.010,.040+.007*(i%2),0);
      digit.scale.set(.004,.033,.004);
    }
    for(let i=0;i<5;i++){
      const toe=mesh("skeleton","Foot"+s,sphere,ivory,"foot rays");
      toe.position.set((i-2)*.009,.067,-.004);
      toe.scale.set(.0045,.033,.005);
    }
    const palm=mesh("skeleton",joint.name,sphere,ivory,"metacarpals");
    palm.position.y=.030;palm.scale.set(.023,.031,.011);
  }
  for(let i=0;i<21;i++){
    const y=.883+i*.0228,owner=y>1.34?"Neck":y>1.15?"Chest":y>.99?"Spine":"Hips";
    oval("skeleton",owner,"vertebra",[0,y,-.039],[.015,.009,.012],ivory);
  }
  for(let i=0;i<5;i++)oval("skeleton","Neck","cervical vertebra",[0,1.350+i*.020,-.027+i*.003],
    [.011,.009,.010],ivory);
  oval("skeleton","Head","atlas joint",[0,1.451,-.012],[.022,.015,.019],cartilage);
  loft("muscles","Neck","deep neck flexors",[[0,1.331,-.002,.036,.032],[0,1.377,.002,.037,.034],
    [0,1.418,.002,.032,.030],[0,1.450,-.002,.026,.024]],deep,true);
  loft("muscles","Neck","splenius",[[0,1.325,-.032,.034,.014],[0,1.380,-.034,.036,.016],
    [0,1.430,-.030,.032,.015],[0,1.470,-.026,.024,.011]],muscle,true);
  loft("muscles","Chest","intercostal layer",[[0,1.119,-.008,.070,.043],[0,1.172,-.006,.091,.052],
    [0,1.245,-.001,.096,.054],[0,1.301,-.003,.078,.044],[0,1.331,-.004,.046,.028]],deep,true);
  loft("muscles","Spine","abdominal wall",[[0,.928,-.002,.074,.035],[0,.984,.003,.077,.042],
    [0,1.054,.002,.073,.043],[0,1.125,-.001,.080,.041],[0,1.151,-.002,.078,.030]],deep,true);
  loft("muscles","Hips","pelvic muscles",[[0,.824,-.013,.047,.032],[0,.869,-.019,.091,.048],
    [0,.921,-.013,.105,.043],[0,.948,-.011,.079,.033]],deep,true);
  for(const side of [-1,1]){
    const hand=side===1?"HandL":"HandR",foot=side===1?"FootL":"FootR";
    for(let i=0;i<9;i++){
      const y=1.296-i*.022,w=.070+.025*Math.sin((i+1)*.28);
      arc("skeleton","Chest","rib",[[side*.013,y,-.039],[side*w*.70,y-.004,-.042],
        [side*w,y-.022,-.004],[side*w*.68,y-.033,.041],[side*(i<6?.013:.038),y-.028,.045]],.0044,ivory);
    }
    arc("skeleton","Chest","clavicle",[[0,1.336,.045],[side*.057,1.337,.032],[side*.115,1.318,.012]],.006,ivory);
    oval("skeleton","Hips","ilium",[side*.064,.895,-.013],[.043,.046,.040],ivory);
    arc("skeleton","Hips","pubic arch",[[side*.081,.890,-.017],[side*.072,.829,.021],[side*.031,.826,.039],[0,.842,.048]],.009,ivory);
    const lower=side>0?1.140:1.134;
    const lungName=side>0?"left lung":"right lung";
    loft("organs","Chest",lungName,[[side*.049,lower,-.015,.017,.021],[side*.052,1.158,-.008,.034,.032],
      [side*.055,1.191,-.006,.034,.035],[side*.055,1.211,-.009,.027,.031],
      [side*.049,1.255,-.009,.029,.029],[side*.045,1.280,-.012,.021,.022],
      [side*.041,1.309,-.018,.008,.008],[side*.039,1.315,-.020,.001,.001]],lung);
    arc("organs","Chest","lung fissure",[[side*.078,1.225,.006],[side*.070,1.204,.020],
      [side*.053,1.197,.027],[side*.031,1.187,.019]],.0018,vein);
    if(side<0)arc("organs","Chest","right upper-lobe fissure",[[-.083,1.233,.001],[-.069,1.235,.020],[-.040,1.230,.018]],.0018,vein);
    arc("organs","Chest","main bronchus",[[0,1.308,.015],[side*.014,1.293,.009],
      [side*.027,1.276,.001],[side*.043,1.253,-.006]],.004,cartilage);
    arc("organs","Chest","pulmonary vessels",[[side*.021,1.241,.019],[side*.028,1.224,.020],[side*.040,1.209,.024]],.0027,artery);
    loft("organs","Spine","kidney",[[side*.054,1.024,-.034,.006,.005],[side*.055,1.038,-.033,.017,.012],
      [side*.061,1.055,-.033,.013,.013],[side*.055,1.069,-.035,.017,.012],[side*.050,1.078,-.035,.006,.006]],kidney);
    arc("organs","Spine","renal artery",[[0,1.067,-.022],[side*.025,1.065,-.023],[side*.047,1.053,-.025]],.0029,artery);
    arc("organs","Spine","ureter",[[side*.048,1.048,-.024],[side*.040,1.017,-.025],
      [side*.035,.984,-.030],[side*.024,.946,-.023],[side*.018,.900,.005]],.0020,duct);
    loft("muscles","Chest","pectoral",[[side*.010,1.253,.050,.011,.008],[side*.027,1.251,.054,.040,.0165],
      [side*.058,1.255,.049,.042,.018],[side*.090,1.267,.038,.031,.016],
      [side*.119,1.279,.019,.018,.013],[side*.143,1.291,.008,.009,.007]],muscle,true);
    loft("muscles","Chest","trapezius",[[side*.010,1.192,-.041,.010,.010],[side*.021,1.239,-.048,.024,.014],
      [side*.044,1.284,-.047,.033,.015],[side*.066,1.320,-.032,.034,.012],
      [side*.109,1.326,-.018,.016,.007]],deep,true);
    loft("muscles","Chest","latissimus",[[side*.024,1.120,-.032,.016,.008],[side*.047,1.161,-.047,.036,.014],
      [side*.065,1.196,-.045,.033,.015],[side*.089,1.243,-.031,.026,.012],
      [side*.113,1.286,-.016,.010,.006]],muscle,true);
    loft("muscles","UpperArm"+(side>0?"L":"R"),"deltoid",[
      [side*.115,1.330,-.008,.012,.011],[side*.137,1.317,-.006,.029,.027],
      [side*.146,1.290,-.004,.030,.026],[side*.160,1.265,-.002,.022,.019],
      [side*.172,1.232,-.003,.009,.011]],muscle,true);
    loft("muscles","Hips","gluteus medius",[[side*.060,.829,-.036,.015,.012],[side*.087,.871,-.044,.032,.018],
      [side*.088,.912,-.034,.035,.025],[side*.069,.939,-.018,.023,.016]],deep,true);
    loft("muscles","Hips","gluteus maximus",[[side*.018,.930,-.046,.012,.009],[side*.045,.895,-.054,.036,.018],
      [side*.071,.848,-.052,.040,.020],[side*.092,.800,-.036,.023,.014],[side*.098,.772,-.020,.010,.007]],muscle,true);
    loft("muscles","Thigh"+(side>0?"L":"R"),"adductors",[[side*.030,.838,.018,.012,.012],[side*.046,.780,.008,.028,.028],
      [side*.058,.700,.000,.026,.026],[side*.068,.620,-.002,.017,.019],[side*.073,.550,.000,.007,.007]],deep,true);
    loft("muscles","Spine","external oblique",[[side*.083,.930,.009,.012,.010],[side*.073,.976,.025,.024,.017],
      [side*.070,1.030,.029,.025,.017],[side*.083,1.075,.013,.022,.021],[side*.080,1.141,-.003,.014,.011]],muscle,true);
    for(let i=0;i<5;i++){
      const y=1.234-i*.025;
      loft("muscles","Chest","serratus slip",[[side*.075,y,.000,.008,.006],[side*.087,y-.009,.008,.011,.008],
        [side*.081,y-.022,.026,.012,.007],[side*.062,y-.028,.037,.004,.004]],i%2?deep:muscle,true);
    }
    loft("muscles","Spine","rectus abdominis",[[side*.024,.951,.043,.012,.005],[side*.024,.978,.047,.022,.010],
      [side*.025,1.022,.048,.024,.011],[side*.025,1.073,.047,.025,.011],
      [side*.023,1.111,.044,.023,.012],[side*.017,1.145,.044,.012,.007]],muscle,true);
    for(let i=0;i<3;i++){
      const y=1.111-i*.044;
      arc("muscles","Spine","tendinous intersection",[[side*.007,y,.052],[side*.024,y-.004,.059],
        [side*.043,y-.006,.053]],.0021,fascia);
    }
    loft("muscles","Neck","sternocleidomastoid",[[side*.019,1.330,.043,.005,.004],[side*.024,1.367,.034,.009,.007],
      [side*.034,1.407,.012,.010,.006],[side*.043,1.448,-.012,.005,.003]],muscle,true);
    loft("muscles","Head","masseter",[[side*.047,1.452,.051,.009,.008],[side*.058,1.470,.040,.017,.012],
      [side*.069,1.494,.030,.019,.013],[side*.074,1.512,.013,.012,.006]],muscle,true);
    loft("muscles","Head","temporalis",[[side*.070,1.500,.020,.009,.006],[side*.077,1.526,.009,.016,.012],
      [side*.071,1.557,-.005,.023,.015],[side*.055,1.585,-.019,.018,.010],
      [side*.046,1.606,-.026,.009,.007]],deep,true);
    for(let i=0;i<3;i++){
      const x=(i-1)*.009;
      loft("muscles",hand,"finger flexor tendon",[[x,.003,-.002,.002,.002],[x,.028,-.007,.003,.003],
        [x,.052,-.003,.002,.002],[x,.078,-.001,.001,.001]],tendon,true,true);
      loft("muscles",foot,"toe extensor tendon",[[x,.017,0,.002,.002],[x,.050,.002,.003,.003],
        [x,.080,.002,.002,.001],[x,.102,.001,.001,.001]],tendon,true,true);
    }
  }
  arc("skeleton","Chest","sternum",[[0,1.31,.052],[0,1.22,.052],[0,1.15,.049]],.008,ivory);
  oval("skeleton","Head","cranium",[0,1.554,-.009],[.085,.088,.075],ivory);
  arc("skeleton","Head","jaw",[[-.060,1.516,.032],[-.043,1.451,.045],[0,1.432,.074],[.043,1.451,.045],[.060,1.516,.032]],.009,ivory);
  const cortex=makeMat(0xd198a4,.67),brainStem=makeMat(0xc99599,.58);
  for(const side of [-1,1]){
    loft("organs","Head","cerebral hemisphere",[[side*.025,1.529,-.013,.018,.032],[side*.031,1.547,-.010,.030,.048],
      [side*.031,1.571,-.009,.034,.054],[side*.027,1.595,-.007,.029,.047],
      [side*.023,1.611,-.010,.022,.034],[side*.011,1.625,-.014,.008,.013]],brain);
    for(let i=0;i<6;i++){
      const z=-.043+i*.014,shorten=Math.abs(i-2.5)*.003;
      arc("organs","Head","cortical fold",[[side*.018,1.616-shorten,z*.68],[side*.036,1.608-shorten,z*.84+.004],
        [side*.046,1.592-shorten,z-.003],[side*.055,1.575,z+.004],[side*.054,1.554,z]],.0025,cortex);
    }
    oval("organs","Head","cerebellar hemisphere",[side*.023,1.532,-.049],[.023,.018,.021],brainStem);
  }
  arc("organs","Head","brainstem",[[0,1.551,-.033],[0,1.528,-.026],[0,1.507,-.018],[0,1.469,-.019]],.009,brainStem);
  loft("organs","Chest","heart",[[.034,1.158,.036,.004,.005],[.029,1.171,.033,.015,.014],
    [.017,1.192,.025,.026,.022],[.013,1.213,.023,.027,.024],[.011,1.228,.014,.020,.017],
    [.011,1.233,.011,.009,.009]],heart);
  oval("organs","Chest","left atrium",[.024,1.225,-.001],[.015,.017,.017],heart);
  oval("organs","Chest","right atrium",[-.009,1.221,.011],[.017,.019,.017],vein);
  arc("organs","Chest","aortic arch",[[.012,1.221,.010],[.012,1.253,.018],
    [-.002,1.269,.011],[-.016,1.264,-.002],[-.012,1.235,-.020]],.007,artery);
  arc("organs","Chest","vena cava",[[-.015,1.301,-.007],[-.013,1.263,.001],[-.010,1.243,.005],[-.008,1.218,.015]],.006,vein);
  arc("organs","Chest","coronary artery",[[-.005,1.227,.034],[.010,1.209,.046],[.017,1.194,.049],[.030,1.174,.046]],.0019,artery);
  arc("organs","Chest","coronary branch",[[.009,1.209,.046],[.022,1.208,.045],[.030,1.200,.043]],.0015,artery);
  arc("organs","Chest","lower airway",[[0,1.298,.014],[0,1.318,.017],[0,1.346,.019]],.0067,tendon);
  arc("organs","Neck","upper airway",[[0,1.341,.018],[0,1.378,.023],[0,1.419,.025],[0,1.435,.024]],.0065,tendon);
  for(let i=0;i<12;i++){
    const y=1.302+i*.0103;
    oval("organs",y<1.343?"Chest":"Neck","tracheal ring",[0,y,.015+i*.00078],[.009,.0032,.008],cartilage);
  }
  loft("organs","Chest","diaphragm",[[0,1.119,-.017,.058,.020],[0,1.129,-.014,.088,.033],
    [0,1.139,-.010,.090,.035],[0,1.150,-.011,.065,.027],[0,1.159,-.018,.037,.020]],fascia);

  loft("organs","Spine","liver",[[.035,1.115,.006,.008,.006],[.011,1.120,.008,.020,.017],
    [-.016,1.123,.013,.028,.030],[-.046,1.128,.009,.029,.032],
    [-.071,1.136,.002,.015,.018],[-.084,1.145,-.002,.004,.005]],liver);
  arc("organs","Spine","liver lobe division",[[.013,1.147,.021],[.008,1.133,.039],[.001,1.113,.035]],.0017,vein);
  oval("organs","Spine","gallbladder",[-.035,1.109,.022],[.009,.017,.010],duct);
  loft("organs","Spine","stomach",[[.022,1.061,.010,.008,.009],[.037,1.071,.018,.017,.019],
    [.052,1.082,.021,.025,.023],[.056,1.098,.017,.028,.022],
    [.049,1.117,.010,.022,.020],[.033,1.131,.005,.013,.013],[.023,1.139,.001,.005,.006]],gut);
  arc("organs","Spine","esophagus",[[.022,1.142,-.005],[.010,1.162,-.015],[.006,1.177,-.019]],.005,colon);
  loft("organs","Spine","pancreas",[[.052,1.078,-.023,.005,.006],[.030,1.072,-.020,.013,.009],
    [.002,1.066,-.018,.013,.009],[-.026,1.067,-.015,.014,.008],[-.044,1.075,-.014,.008,.007]],duct);
  oval("organs","Spine","spleen",[.071,1.113,-.029],[.012,.035,.023],kidney);

  const colonPath=new T.CatmullRomCurve3([
    v(-.055,.929,.014),v(-.066,.967,.015),v(-.063,1.027,.017),
    v(-.021,1.041,.022),v(.039,1.034,.023),v(.064,1.015,.018),v(.063,.961,.016),
    v(.050,.938,.019),v(.018,.927,.011),v(.009,.906,-.004)
  ]);
  const colonRings=colonPath.getSpacedPoints(44).map((p,i)=>{
    const radius=(.010+.003*Math.pow(Math.sin(i*.63),2))*(1-.20*i/44);
    return [p.x,p.y,p.z,radius,radius*.92];
  });
  loft("organs","Spine","large intestine",colonRings,colon);
  arc("organs","Spine","small intestine",[[.024,1.066,.015],[-.035,1.054,.020],[-.045,1.026,.029],
    [.035,1.016,.036],[.043,.997,.036],[-.045,.990,.038],[-.047,.971,.028],[.037,.971,.039],
    [.041,.955,.026],[-.034,.948,.032],[-.040,.937,.020],[-.051,.934,.009]],.0085,gut);
  for(let i=0;i<3;i++){
    const y=1.016-i*.026;
    arc("organs","Spine","mesenteric vessel",[[0,1.054,-.020],[-.007,y+.014,.002],[(i%2?1:-1)*.030,y,.026]],.0015,artery);
  }
  loft("organs","Hips","bladder",[[0,.847,.023,.004,.006],[0,.862,.025,.020,.015],
    [0,.876,.030,.027,.021],[0,.892,.027,.022,.017],[0,.900,.024,.012,.009]],gut);
  loft("organs","Hips","uterus",[[0,.879,-.010,.005,.006],[0,.897,-.014,.010,.011],
    [0,.911,-.011,.017,.011],[0,.923,-.008,.020,.010],[0,.928,-.008,.013,.007]],brain);
  for(const side of [-1,1]){
    arc("organs","Hips","uterine tube",[[side*.010,.922,-.008],[side*.024,.932,-.009],
      [side*.037,.926,-.014],[side*.050,.919,-.014]],.0026,brain);
    oval("organs","Hips","ovary",[side*.050,.917,-.012],[.010,.007,.008],brainStem);
  }
  return groups;
}
