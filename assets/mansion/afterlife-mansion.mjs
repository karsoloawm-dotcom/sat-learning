import {createStairPerformance,stairFootWeights,STAIR_IMPACT,STAIR_TWITCH_END,STAIR_END} from "./stair-performance.mjs";
import {playStairCue} from "./stair-sound.mjs";
import {createKeeperHunt} from "./keeper-hunt.mjs";
import {furnishInterior} from "./mansion-interior.mjs?v=blade";

export function buildMansion(THREE, scene, northLimit) {
  const group = new THREE.Group();
  const centerZ = -40;
  group.name = "Groundskeeper’s mansion";
  group.position.z = centerZ;
  scene.add(group);

  // Room anchors are shared by the permanent furniture and the cinematics.
  const fixtures = {
    keeper:  {x:-1.6,z:-4.74,distance:3.15,offset:.60},
    leatherBench:{x:2.25,z:-4.78,distance:3.08,offset:-1.25},
    keeper2: {x:8.3,z:.2,distance:3.05},
    keeper3: {x:-8.9,z:.15,distance:3.12},
    keeper4: {x:-7.25,z:-18.9,distance:7.4},
    keeper5: {x:7.2,z:-18.9,distance:5.2}
  };
  const rooms=Object.fromEntries(Object.entries(fixtures).map(([k,r])=>[k,{...r,z:r.z+centerZ}]));
  const maps = [];
  function grain(base, vertical, shingle = false) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      ctx.fillStyle = row % 3 ? "#130d0b37" : "#eedfc82c";
      if (vertical) ctx.fillRect(row * 16, 0, 3, 128);
      else ctx.fillRect(0, row * 16, 128, 2);
      if (shingle) {
        ctx.fillStyle = "#0c0c123f";
        for (let col = -1; col < 5; col++) ctx.fillRect(col * 32 + (row % 2) * 16, row * 16, 2, 16);
      }
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = i % 3 ? "#180d1044" : "#e1cec832";
      ctx.fillRect((i * 73) % 128, (i * i * 31) % 128, vertical ? 1 : 5 + i % 17, vertical ? 8 + i % 16 : 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    maps.push(texture);
    return texture;
  }
  const mat = (color, map = null, emissive = 0) => new THREE.MeshLambertMaterial({color, map, emissive, side: THREE.DoubleSide});
  const siding = mat(0xffffff, grain("#716352", false)), slate = mat(0xffffff, grain("#4c4652", false, true));
  const oak = mat(0x524137), trim = mat(0x9c8a73), iron = mat(0x292630), brick = mat(0xffffff, grain("#61433f", false, true));
  const plaster = mat(0x625f50), floor = mat(0xffffff, grain("#594439", true));
  const stone = mat(0x696271), path = mat(0x99877b), glass = mat(0x222a3a, null, 0x101420);
  const litGlass = mat(0x89572e, null, 0x362114), lantern = mat(0xffc680, null, 0xb45421);
  const red = mat(0x60343c), brass = mat(0xab8356), paper = mat(0xb3a388);

  const solids = [], boundaries = [];
  function mesh(geometry, material, x,y,z, sx=1,sy=1, horizontal=false) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)*sx, uv.getY(i)*sy);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x,y,z);
    object.castShadow = !horizontal;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function box(w,h,d,material,x,y,z,solid=false,horizontal=false) {
    if (solid) {
      solids.push(new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z+centerZ-d/2),
        new THREE.Vector3(x+w/2,y+h/2,z+centerZ+d/2)));
    }
    return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,w/2,(horizontal?d:h)/2,horizontal);
  }
  function wall(w,h,d,x,y,z,material=siding) {
    box(w,h,d,material,x,y,z,true);
    const base = y-h/2+.12;
    box(w+.035,.22,d+.035,oak,x,base,z);
  }
  function beam(x,y,z,ex,ey,ez,size,material=trim) {
    const direction = new THREE.Vector3(ex-x,ey-y,ez-z), length = direction.length();
    const object = box(size,length,size,material,(x+ex)/2,(y+ey)/2,(z+ez)/2);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize());
  }
  function light(x,y,z,power,range,fixture=true) {
    if(fixture){
      box(.30,.38,.30,lantern,x,y,z);
      for(const h of [-.23,.23])box(.38,.075,.38,iron,x,y+h,z);
      // Indoor lanterns hang from the ceiling instead of floating.
      const top=Math.abs(x)<12&&z<6.5&&z>-26.4?(z>-6.5?3.39:6.75):0;
      if(top>y+.27)box(.03,top-y-.27,.03,iron,x,(top+y+.27)/2,z);
    }
    const source = new THREE.PointLight(0xffab63,power,range,1.65);
    source.position.set(x,y,z);
    group.add(source);
  }
  function sign(text,x,y,z,w) {
    const canvas = document.createElement("canvas");
    canvas.width=512; canvas.height=88;
    const c=canvas.getContext("2d");
    c.fillStyle="#302427";c.fillRect(0,0,512,88);
    c.strokeStyle="#927657";c.lineWidth=3;c.strokeRect(7,7,498,74);
    c.fillStyle="#ead1a7";c.textAlign="center";c.textBaseline="middle";
    c.font="bold 31px Georgia";c.fillText(text,256,46,472);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;maps.push(texture);
    return mesh(new THREE.PlaneGeometry(w,w*88/512),mat(0xffffff,texture,0x16100c),x,y,z);
  }
  function window(x,y,z,w,h,angle=0,warm=false,boarded=false) {
    const pane = new THREE.Group();
    pane.position.set(x,y,z);pane.rotation.y=angle;group.add(pane);
    function piece(w,h,d,x,y,z,m) {
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);pane.add(o);return o;
    }
    piece(w+.18,h+.18,.08,0,0,0,oak);
    piece(w,h,.065,0,0,.05,warm?litGlass:glass);
    for(const s of [-1,1]) {
      piece(.075,h+.10,.085,s*w/2,0,.10,trim);
      piece(w+.10,.075,.085,0,s*h/2,.10,trim);
    }
    piece(.055,h,.06,0,0,.11,trim);
    piece(w,.055,.06,0,.10,.11,trim);
    piece(w+.27,.11,.24,0,-h/2-.11,.05,trim);
    if(boarded) for(const [offset,tilt] of [[-.22,.21],[.13,-.15]])
      piece(w+.22,.15,.072,0,offset,.16,oak).rotation.z=tilt;
  }
  function gable(x,z,w,d,eaves,peak) {
    const run=w/2, angle=Math.atan2(peak,run);
    for(const side of [-1,1]) {
      const roof=box(Math.hypot(run,peak)+.38,.14,d+.43,slate,x+side*run/2,eaves+peak/2,z);
      roof.rotation.z=-side*angle;
      for(const face of [-1,1])beam(x,eaves+peak,z+face*d/2,x+side*run,eaves,z+face*d/2,.12,trim);
    }
    const triangle=new THREE.Shape();
    triangle.moveTo(-run,0);triangle.lineTo(run,0);triangle.lineTo(0,peak);triangle.closePath();
    for(const s of [-1,1])mesh(new THREE.ShapeGeometry(triangle),siding,x,eaves,z+s*d/2,w/2,peak/2);
    box(.19,.14,d+.5,iron,x,eaves+peak,z);
  }

  // The exterior upper storey and roof sit above a fully partitioned ground floor.
  box(24,.23,13,stone,0,-.06,0,false,true);
  box(23.6,.08,12.7,floor,0,.09,0,false,true);
  box(24,.17,13,oak,0,3.48,0,false,true);
  for(const x of [-7,7])wall(10,3.39,.25,x,1.72,6.5);
  box(4,1.15,.25,siding,0,2.94,6.5);
  for(const x of [-7,7])wall(10,3.45,.26,x,1.73,-6.5);
  box(4,1.05,.26,siding,0,2.93,-6.5);
  wall(.26,3.45,13,-12,1.73,0);
  wall(.26,3.45,9.05,12,1.73,-1.975);
  wall(.26,3.45,2.06,12,1.73,5.47);
  box(.26,1.08,1.89,siding,12,2.91,3.495);
  box(.39,2.4,.13,trim,12,1.27,2.51);
  box(.39,2.4,.13,trim,12,1.27,4.47);
  const serviceDoor = new THREE.Group();
  serviceDoor.position.set(12,.13,2.55);
  group.add(serviceDoor);
  const doorPanel = new THREE.Box3(new THREE.Vector3(-.065,0,0), new THREE.Vector3(.065,2.2,1.88));
  function doorPiece(w,h,d,material,x,y,z) {
    const piece = box(w,h,d,material,x,y,z);
    serviceDoor.add(piece);
  }
  doorPiece(.13,2.2,1.88,oak,0,1.1,.94);
  for(const y of [.34,1.89])doorPiece(.18,.12,1.77,trim,0,y,.94);
  doorPiece(.25,.072,.18,brass,0,1.03,1.61);
  const door = {x:12,z:centerZ+3.49, open:true};
  function setServiceDoor(open) {
    door.open = open;
    serviceDoor.rotation.y = open ? Math.PI/2 : 0;
  }
  setServiceDoor(true);
  box(24,2.8,13,siding,0,4.99,0);
  box(24.43,.17,13.37,trim,0,3.61,0);
  box(24.48,.21,13.42,oak,0,6.40,0);
  gable(-7.55,0,9.35,13,6.47,2.9);
  gable(7.55,-.45,9.35,13.9,6.47,3.45);
  box(5.8,3.9,6.1,siding,0,7.1,3.6);
  for(const y of [5.35,7.03,9.02])box(6.04,.18,6.37,trim,0,y,3.6);
  const spire=new THREE.CylinderGeometry(.33,4.37,4.6,4);
  mesh(spire,slate,0,11.39,3.6,2,3).rotation.y=Math.PI/4;
  box(.66,.27,.66,trim,0,13.72,3.6);
  for(const x of [-9,8.5]) {
    box(.9,2.2,.83,brick,x,9.02,-2.6);
    box(1.08,.14,1.01,stone,x,10.18,-2.6);
    box(.61,.045,.53,iron,x,10.26,-2.6);
  }
  for(const x of [-9.9,-6.7,-3.65,3.65,6.7,9.9]) {
    window(x,2.0,6.65,1,1.63,0,Math.abs(x)===6.7,Math.abs(x)===9.9);
    window(x,4.93,6.66,1.05,1.7,0,false,Math.abs(x)===3.65);
    window(x,1.97,6.34,1.03,1.6,Math.PI,Math.abs(x)===6.7);
  }
  for(const s of [-1,1]) {
    window(s*7.55,7.4,6.56,1.0,1.25);
    for(const z of [-4.4,.1,4.4]) for(const y of [1.98,4.93])
      if(s<0||z!==4.4||y>3)window(s*12.15,y,z,1.0,1.6,s*Math.PI/2,y<3&&z===.1);
    for(const z of [2.95,4.62])window(s*2.93,8.08,z,1,1.43,s*Math.PI/2);
  }
  for(const x of [-1.6,0,1.6])window(x,8.08,6.67,.94,1.43);
  // Porch, worn runner and a clearly lit, physically open entrance.
  box(7.25,.18,2.8,stone,0,.02,7.83,false,true);
  box(7.5,.14,3.05,slate,0,3.01,7.9).rotation.x=.12;
  for(const x of [-3.41,3.41]) {
    box(.19,2.9,.19,trim,x,1.51,9.11,true);
    box(.39,.21,.39,stone,x,.18,9.11);
    beam(x,2.35,9.1,x*.79,2.89,9.1,.10,oak);
  }
  for(const x of [-2.02,2.02])box(.13,2.52,.25,trim,x,1.32,6.64);
  box(4.24,.17,.32,trim,0,2.46,6.64);
  for(const s of [-1,1]) {
    box(.11,2.38,.84,oak,s*1.86,1.29,6.04);
    box(.045,.12,.09,brass,s*1.78,1.25,5.73);
  }
  sign("THE GROUNDSKEEPER’S MANSION",0,2.42,9.34,4.3);
  light(-2.71,2.19,6.87,9,9);
  light(2.71,2.19,6.87,9,9);
  const moonBounce=new THREE.PointLight(0xaebce7,38,27,1.55);
  moonBounce.position.set(5,11,13);
  group.add(moonBounce);
  box(2.78,.055,15.45,path,0,.065,17.3,false,true);
  sign("MANSION  ↑",2.3,1.43,15.3,2.05);
  box(.13,1.4,.13,oak,2.3,.70,15.22);
  light(-2.2,1.03,14.7,5.5,6);

  // Ground-floor plan: entrance hall, parlor, dining room, rear workshop.
  for(const x of [-4.8,4.8]) {
    wall(.18,3.4,4.2,x,1.73,4.33,plaster);
    wall(.18,3.4,1.83,x,1.73,-1.68,plaster);
    box(.18,.95,3.0,oak,x,2.98,.73);
    for(const z of [-.81,2.24])box(.27,2.54,.14,trim,x,1.33,z);
  }
  for(const x of [-7.02,7.02])wall(9.96,3.42,.20,x,1.72,-2.65,plaster);
  box(4.09,.93,.22,oak,0,2.99,-2.65);
  for(const x of [-2.04,2.04])box(.14,2.54,.33,trim,x,1.36,-2.65);
  sign("LEATHER WORKSHOP",0,2.75,-2.51,2.38);
  sign("BROOM WORKSHOP",-8.45,2.7,-2.52,2.15);
  sign("KITCHEN",8.2,2.7,-2.52,1.65);
  sign("REAR HALLS",0,2.72,-6.32,2.14);
  box(2.4,.025,7.4,red,0,.145,2.28,false,true);
  for(const x of [-1.11,1.11])box(.055,.026,7.28,brass,x,.148,2.28,false,true);
  light(0,2.97,2.7,15,10,false); // the hall chandelier is part of the interior
  light(-9.7,2.65,.12,12,9);
  light(9.0,2.75,.18,12,10);
  light(0,2.52,-5.62,17,11);
  const serviceSign = sign("SERVICE YARD",11.79,2.62,3.49,1.72);
  serviceSign.rotation.y=-Math.PI/2;
  light(12.55,2.22,4.95,8,8);
  box(2.3,.055,5.5,path,13.2,.06,6.05,false,true);

  function table(x,z,w,d,top=.86) {
    box(w,.08,d,oak,x,top-.04,z,true);
    for(const i of [-1,1])for(const j of [-1,1])box(.10,top-.08,.10,oak,x+i*(w/2-.07),(top-.08)/2,z+j*(d/2-.08));
  }
  const kitchen=fixtures.keeper2, leather=fixtures.keeper, bench=fixtures.leatherBench;
  box(2.4,.84,.66,oak,kitchen.x-.15,.42,kitchen.z,true);
  box(2.48,.05,.74,trim,kitchen.x-.15,.865,kitchen.z);
  box(1.25,.90,.50,oak,kitchen.x+.8,.45,kitchen.z-1.1,true);
  box(1.30,.04,.54,trim,kitchen.x+.8,.92,kitchen.z-1.1);
  box(.62,.07,.36,iron,kitchen.x+.78,.975,kitchen.z-1.1);
  box(2.4,.85,.55,oak,8.8,.55,5.65,true);
  box(2.46,.08,.62,trim,8.8,1.02,5.65);
  box(.56,.045,.33,iron,8.88,1.063,5.65);
  box(.07,.28,.07,brass,8.88,1.21,5.84);
  box(.27,.07,.07,brass,8.78,1.34,5.84);
  for(let i=0;i<4;i++)box(.26,.30,.23,i%2?iron:paper,8.15+i*.41,1.52,5.79);
  box(2.0,.07,.38,oak,8.75,1.32,5.79);
  const register = {x:7.22,z:centerZ+.18};
  box(.38,.07,.25,red,register.x,.925,.18).rotation.y=-.17;
  box(.31,.026,.20,paper,7.225,.966,.18).rotation.y=-.17;
  box(.018,.012,.20,brass,7.069,.967,.18).rotation.y=-.17;

  const broom=fixtures.keeper3;
  table(broom.x,broom.z,1.5,.62,.835);
  for(let i=0;i<4;i++){
    beam(-11.48+i*.42,.19,-2.12,-11.57+i*.42,1.87,-2.35,.049,brass);
    box(.24,.25,.12,paper,-11.48+i*.42,.31,-2.14).rotation.z=.05*(i-1);
  }
  table(-9.8,4.6,2.5,.54);
  for(let i=0;i<3;i++)box(.34,.33,.38,trim,-10.5+i*.62,1.03,4.63);
  box(.88,1.59,1.7,brick,-11.43,.84,2.5,true);
  box(.048,.76,.97,iron,-10.98,.58,2.5);

  table(leather.x,leather.z,2.10,.8,.86);
  table(bench.x,bench.z,1.30,.6,.855);
  for(const x of [-7.3,7.3]){
    table(x,-5.58,4.0,.88);
    box(4.2,.13,.49,oak,x,1.56,-6.15);
    for(let i=0;i<5;i++)box(.24,.35+(i%3)*.11,.28,i%2?glass:brass,x-1.2+i*.60,1.85,-6.14);
    for(let i=0;i<3;i++)box(.54,.44,.50,oak,x-1+i*.66,.33,-4.82,true);
  }

  // The rear annex has a high ceiling and a central passage between the halls.
  box(24,.23,20,stone,0,-.06,-16.45,false,true);
  box(23.7,.08,19.95,floor,0,.09,-16.45,false,true);
  wall(24,6.8,.28,0,3.42,-26.45);
  for(const x of [-12,12])wall(.28,6.8,20,x,3.42,-16.45);
  box(24,3.37,.25,siding,0,5.23,-6.48);
  box(24,.16,20,oak,0,6.83,-16.46);
  gable(0,-16.46,24,20,6.9,3.2);
  for(const x of [-2.12,2.12]){
    wall(.20,6.75,2.9,x,3.41,-7.94,plaster);
    if(x<0)wall(.20,6.75,13.65,x,3.41,-19.54,plaster);
    else{
      wall(.20,6.75,2.62,x,3.41,-14.02,plaster);
      wall(.20,6.75,9.77,x,3.41,-21.48,plaster);
      box(.22,5.99,1.27,plaster,x,3.80,-15.965);
      for(const z of [-16.64,-15.28])box(.32,.79,.13,trim,x,.525,z);
      box(.34,.12,1.51,trim,x,.86,-15.96);
    }
    box(.24,3.96,3.36,oak,x,4.83,-11.08);
    for(const z of [-9.4,-12.76])box(.34,2.87,.15,trim,x,1.46,z);
  }
  sign("←   GALLOWS HALL",0,2.95,-12.4,2.75);
  sign("TROPHY WORKSHOP   →",0,2.33,-12.37,2.75);
  light(0,2.65,-8.1,12,8);
  light(0,2.6,-15.65,10,8);
  light(-8.5,4.7,-16.6,24,13);
  light(6.4,2.9,-16.6,18,12);
  const frame=fixtures.keeper4,x0=frame.x-1.3,z0=frame.z;
  // Fixed platform and stair. Only the moving leaves and scene props are live.
  for(const z of [-.625,.625])box(2.6,.12,.25,oak,x0,2.34,z0+z,true);
  for(const x of [-.9,.9])box(.8,.12,1,oak,x0+x,2.34,z0,true);
  const closed=new THREE.Mesh(new THREE.BoxGeometry(1,.08,1),oak);
  closed.position.set(x0,2.36,z0);group.add(closed);
  for(const x of [-1.2,1.2]){
    for(const z of [-.65,.65])box(.14,2.28,.14,oak,x0+x,1.14,z0+z,true);
    box(.16,2.6,.16,oak,x0+x,3.7,z0);
    box(.08,.85,.08,trim,x0+x*.75,4.55,z0).rotation.z=Math.sign(x)*.78;
  }
  box(2.9,.16,.16,oak,x0,4.92,z0);
  for(let i=0;i<7;i++) {
    const h=(i+1)*.343,x=3.25-i*.3;
    box(.30,.05,.9,oak,x0+x,h-.025,z0+.1,true);
    box(.03,.343,.9,oak,x0+x-.135,h-.19,z0+.1);
  }
  const trophy=fixtures.keeper5;
  table(trophy.x-.4,trophy.z,1.9,.8,.89);
  for(const x of [5.3,7.2,9.1]){
    box(1.2,.51,.53,oak,x,.26,-22.7,true);
    box(1.22,.055,.58,trim,x,.54,-22.7);
    box(.45,.62,.36,glass,x,.87,-22.7);
    box(.42,.27,.045,brass,x,.75,-22.51);
  }
  box(3.2,.05,.3,oak,trophy.x-.4,1.35,trophy.z-1.25);
  box(.55,.35,.55,oak,trophy.x+1.15,.175,trophy.z+.3,true);
  sign("No. 27",2.19,1.16,-5.16,.74);
  const cabinetSign=sign("THE DOLLS",8.85,2.15,-14.3,1.65);
  cabinetSign.rotation.y=Math.PI;
  solids.push(new THREE.Box3(new THREE.Vector3(7.67,.1,centerZ-15.29),
    new THREE.Vector3(10.03,2.27,centerZ-14.61)));

  const stairs={start:centerZ-21.15,impact:centerZ-23.18,wall:centerZ-26.28,width:3.66};
  const tread=new THREE.Group();
  tread.name="Loose stair tread";group.add(tread);
  for(let i=0;i<8;i++){
    const top=.27*(i+1),z=-21.15-.51*(i+.5);
    box(stairs.width,top,.515,oak,0,top/2+.115,z,false,true);
    box(.44,.018,.38,trim,1.42,top+.132,z); // Polished edge used by the keeper.
    if(i===3){
      tread.position.set(0,top+.114,z);
      tread.add(box(2.05,.09,.467,trim,0,.04,0));
      for(const x of [-.85,.85])tread.add(box(.21,.021,.30,iron,x,.095,-.01));
    }else box(stairs.width,.037,.09,trim,0,top+.123,z+.23);
  }
  box(stairs.width,2.16,1.23,oak,0,1.195,-25.84,false,true);
  light(-1.64,3.45,-22.0,11,8);
  light(1.61,4.8,-25.85,9,7);
  const spike=new THREE.Group();
  spike.name="Staircase spike";
  spike.position.set(0,7.85,stairs.impact-centerZ);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.21,.035,1.18,6),iron);
  pin.position.y=-.48;
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.10,.43,6),trim);
  tip.rotation.x=Math.PI;tip.position.y=-1.22;
  spike.add(pin,tip);group.add(spike);
  const collar=box(.92,.1,.92,oak,0,6.73,stairs.impact-centerZ);
  collar.rotation.y=Math.PI/4;
  const latch=new THREE.Group();latch.name="Stair trap release";
  latch.position.set(-1.63,3.36,stairs.impact-centerZ);group.add(latch);
  box(.36,.44,.13,iron,-1.63,3.36,stairs.impact-centerZ);
  latch.add(box(.095,.48,.08,brass,0,-.13,.11));
  latch.add(box(.16,.13,.10,trim,0,-.30,.12));
  stairs.spike=spike;
  stairs.impactTime=STAIR_IMPACT;
  stairs.twitchEnd=STAIR_TWITCH_END;
  stairs.endTime=STAIR_END;
  stairs.footWeights=stairFootWeights;
  stairs.playCue=playStairCue;
  stairs.performance=(actor,reduced)=>createStairPerformance(THREE,actor,stairs,reduced);
  stairs.setMechanism=(press,release)=>{
    tread.rotation.x=-.105*press;
    tread.position.y=1.194-.055*press;
    latch.rotation.z=.96*release;
  };
  stairs.surface=(x,z)=>{
    if(Math.abs(x)>stairs.width/2||z>=stairs.start||z<stairs.wall-.04)return .115;
    const index=Math.min(7,Math.floor((stairs.start-z)/.51));
    return .115+.27*(index+1)+(index===3&&Math.abs(x)<1.025?.078+tread.position.y-1.194-(z-(stairs.start-1.785))*Math.sin(tread.rotation.x):0);
  };
  stairs.floor=(x,z)=>Math.abs(x)<stairs.width/2&&z<stairs.start&&z>stairs.wall-.04
    ? .115+Math.min(2.16,Math.max(0,(stairs.start-z)/.51*.27)):0;
  stairs.triggers=(x,z)=>Math.abs(x)<1.055&&z<=stairs.impact+.61&&z>stairs.impact-.22;

  function solid(w,h,d,x,y,z){
    solids.push(new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z+centerZ-d/2),new THREE.Vector3(x+w/2,y+h/2,z+centerZ+d/2)));
  }
  const interior=furnishInterior(THREE,{group,box,mesh,mat,maps,window,wall,sign,beam,solid,centerZ,brick,plasterWall:plaster});

  // Combine the static trim, furniture and cladding by material. Collision
  // keeps its own box data, so grouped meshes never need per-frame raycasts.
  group.updateMatrixWorld(true);
  const local = group.matrixWorld.clone().invert(), batches = new Map();
  group.traverse(object => {
    if(!object.isMesh||object===closed||interior.live.has(object)||[spike,tread,latch,serviceDoor].includes(object.parent))return;
    const key=object.material.id+"/"+object.castShadow;
    if(!batches.has(key))batches.set(key,[]);
    batches.get(key).push(object);
  });
  for(const objects of batches.values()){
    if(objects.length<2)continue;
    const data={position:[],normal:[],uv:[]};
    for(const object of objects){
      const baked=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      baked.applyMatrix4(local.clone().multiply(object.matrixWorld));
      for(const key of Object.keys(data))for(const v of baked.attributes[key].array)data[key].push(v);
      baked.dispose();object.geometry.dispose();object.removeFromParent();
    }
    const geometry=new THREE.BufferGeometry();
    for(const key of Object.keys(data))geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],key==="uv"?2:3));
    const object=new THREE.Mesh(geometry,objects[0].material);
    object.castShadow=objects[0].castShadow;object.receiveShadow=true;
    group.add(object);
  }

  boundaries.push([-24,-2.75,-25.1,-24.9],[2.75,24,-25.1,-24.9]);
  const hatch = new THREE.Box3(new THREE.Vector3(2.00,.805,centerZ-16.60),new THREE.Vector3(2.24,6.8,centerZ-15.33));
  const sightSolids=[...solids,hatch];
  function blocked(x,z,radius,small=false) {
    return boundaries.some(([a,b,c,d])=>x+radius>a&&x-radius<b&&z+radius>c&&z-radius<d)
      ||(!small&&x+radius>hatch.min.x&&x-radius<hatch.max.x&&z+radius>hatch.min.z&&z-radius<hatch.max.z)
      ||solids.some(b=>x+radius>b.min.x&&x-radius<b.max.x&&z+radius>b.min.z&&z-radius<b.max.z)
      ||overlapsDoor(x,z,radius,door.open);
  }
  function overlapsDoor(x,z,radius,open) {
    const dx=x-door.x, dz=z-centerZ-2.55;
    const u=open?-dz:dx, v=open?dx:dz;
    return u+radius>doorPanel.min.x&&u-radius<doorPanel.max.x&&v+radius>0&&v-radius<doorPanel.max.z;
  }
  function toggleServiceDoor(player, hunter) {
    const next = !door.open;
    if(overlapsDoor(player.x,player.z,.27,next)||overlapsDoor(hunter.x,hunter.z,.34,next))return false;
    setServiceDoor(next);
    return true;
  }
  function move(p,dx,dz,radius=.24,small=false) {
    if(!blocked(p.x+dx,p.z,radius,small))p.x+=dx;
    if(!blocked(p.x,p.z+dz,radius,small))p.z+=dz;
  }
  const ray=new THREE.Ray(), point=new THREE.Vector3();
  const origin=new THREE.Vector3(), endpoint=new THREE.Vector3(), expanded=new THREE.Box3();
  const doorStart=new THREE.Vector3(),doorEnd=new THREE.Vector3(),doorRay=new THREE.Ray();
  const ceiling=new THREE.Box3(new THREE.Vector3(-12,3.395,centerZ-6.5),new THREE.Vector3(12,3.565,centerZ+6.5));
  function doorLocal(source,target) {
    const x=source.x-door.x,z=source.z-centerZ-2.55;
    target.set(door.open?-z:x,source.y-.13,door.open?x:z);
  }
  function doorHit(start,end,radius=0) {
    doorLocal(start,doorStart);doorLocal(end,doorEnd);
    doorRay.origin.copy(doorStart);
    doorRay.direction.subVectors(doorEnd,doorStart).normalize();
    expanded.copy(doorPanel);
    expanded.min.x-=radius;expanded.min.z-=radius;
    expanded.max.x+=radius;expanded.max.z+=radius;
    if(expanded.containsPoint(doorStart))return 0;
    return doorRay.intersectBox(expanded,point)?point.distanceTo(doorStart):Infinity;
  }
  function clearCamera(target,camera) {
    const distance=camera.distanceTo(target);
    if(!distance)return true;
    ray.origin.copy(target);
    ray.direction.subVectors(camera,target).divideScalar(distance);
    let allowed=distance;
    for(const box of sightSolids) {
      // Furniture only clips the camera if the sight line actually crosses it.
      if(box.containsPoint(target))continue;
      if(ray.intersectBox(box,point))allowed=Math.min(allowed,Math.max(.20,point.distanceTo(target)-.12));
    }
    const hit=doorHit(target,camera);
    if(hit<allowed)allowed=Math.max(.20,hit-.12);
    if(allowed<distance)ray.at(allowed,camera);
    return allowed===distance;
  }
  function clearSegment(from,y1,to,y2,radius) {
    origin.set(from.x,y1,from.z);
    endpoint.set(to.x,y2,to.z);
    const distance=origin.distanceTo(endpoint);
    if(!distance)return true;
    ray.origin.copy(origin);
    ray.direction.subVectors(endpoint,origin).divideScalar(distance);
    if(doorHit(origin,endpoint,radius)<distance)return false;
    for(const solid of sightSolids) {
      expanded.copy(solid);
      if(radius){
        expanded.min.set(solid.min.x-radius,-1,solid.min.z-radius);
        expanded.max.set(solid.max.x+radius,2,solid.max.z+radius);
      }
      if(ray.intersectBox(expanded,point)&&point.distanceTo(origin)<distance-.001)return false;
    }
    return radius||!ray.intersectBox(ceiling,point)||point.distanceTo(origin)>=distance;
  }
  function vision(hunter,player) {
    const y=1.64+floorAt(hunter);
    const targetY=floorAt(player);
    return Math.abs(targetY-floorAt(hunter))<1.05&&(
      clearSegment(hunter,y,player,1.54+targetY,0)||clearSegment(hunter,y,player,1.14+targetY,0));
  }
  function floorAt(p){return stairs.floor(p.x,p.z);}
  function audible(hunter,player) {
    return clearSegment(hunter,1.06+floorAt(hunter),player,1.06+floorAt(player),0);
  }
  const reachable=(from,to)=>clearSegment(from,1.1,to,1.1,.32);
  const huntPoint=(x,z)=>({x,z:z+centerZ});
  const patrol=[huntPoint(10.45,-1.87),huntPoint(10.45,-.1)];
  const corners=[
    [10.14,.94],[6.55,.94],[5.45,.8],[4.12,.8],[2.9,2.96],[2.9,5.88],
    [1.1,6.02],[1.05,7.35],[1.15,-1.96],[1.15,-3.15],
    [7.4,3.53],[10.76,3.53],[11.35,3.53],[12.55,3.53],[14.28,3.62],
    [14.25,4.91],[12.62,4.94],[12.60,7.12],[10.95,7.18],[-.75,.7],[-4.1,.7],[-5.45,.7],
    [.9,-5.8],[.9,-7.2],[.9,-10.98],[-.95,-10.98],[-3.2,-10.98],[3.2,-10.98],
    [-4.3,-15],[4.3,-15],[4.7,-8.15],[6.25,-8.15],[8.9,-9.3]
  ].map(([x,z])=>huntPoint(x,z));
  // A small visibility graph lets the Keeper go around furniture and use the
  // currently open exits without receiving the player's position from navigation.
  function huntRoute(from,goal) {
    if(reachable(from,goal))return goal;
    const nodes=[from,...corners,goal], end=nodes.length-1;
    const costs=nodes.map(()=>Infinity), first=[], visited=new Set();
    costs[0]=0;
    while(!visited.has(end)){
      let next=-1;
      for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&costs[i]<(costs[next]??Infinity))next=i;
      if(next<0)return null;
      visited.add(next);
      for(let i=1;i<nodes.length;i++){
        if(visited.has(i))continue;
        const a=nodes[next],b=nodes[i],cost=costs[next]+Math.hypot(a.x-b.x,a.z-b.z);
        if(cost>=costs[i]||!reachable(a,b))continue;
        costs[i]=cost;first[i]=next===0?b:first[next];
      }
    }
    return first[end];
  }
  const huntLayout={patrol,register,registerApproach:huntPoint(register.x,.94),vision,audible,reachable,route:huntRoute};
  const inside=(x,z)=>Math.abs(x)<11.88&&z>centerZ-26.32&&z<centerZ+6.4;
  function roomAt(x,z){
    if(!inside(x,z))return null;
    const local=z-centerZ;
    if(local<-6.5)return x<-2.3?"keeper4":x>2.3?"keeper5":null;
    if(local<-2.74)return "keeper";
    return x<-4.9?"keeper3":x>4.9?"keeper2":null;
  }
  const grounds=(_x,z)=>z<-31;
  return {group,centerZ,northLimit,inside,grounds,rooms,stairs,roomAt,huntLayout,door,toggleServiceDoor,setServiceDoor,bath:interior.bath,blade:interior.blade,
    createHunt:(actor,cue,capture)=>createKeeperHunt(huntLayout,actor,cue,capture),
    gallowsOpen(on){closed.visible=!on},blocked,move,clearCamera,dispose(){maps.forEach(t=>t.dispose());interior.bath.dispose()}};
}
