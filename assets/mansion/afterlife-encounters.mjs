// Each landmark owns a windup, an escape condition, and one existing finale.
export function buildEncounters(T, scene, mansion) {
  const stone=new T.MeshLambertMaterial({color:0x656976,flatShading:true});
  const timber=new T.MeshLambertMaterial({color:0x483b40,flatShading:true});
  const linen=new T.MeshLambertMaterial({color:0xadb0a7,side:T.DoubleSide,flatShading:true});
  const sites=[], screens=[];
  function site(id,x,z,radius,seconds,prompt,warn,escape,color) {
    const root=new T.Group();root.position.set(x,0,z);root.name=id+' landmark';scene.add(root);
    const glow=new T.MeshBasicMaterial({color});
    const ring=new T.Mesh(new T.RingGeometry(.88,1,36),glow);
    ring.rotation.x=-Math.PI/2;ring.position.y=.065;root.add(ring);ring.visible=false;
    const s={id,x,z,root,ring,glow,radius,seconds,prompt,warn,escape,actors:[]};sites.push(s);return s;
  }
  function shape(s,geo,mat,x,y,z){
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);s.root.add(m);return m;
  }
  function box(s,x,y,z,w,h,d,mat){return shape(s,new T.BoxGeometry(w,h,d),mat,x,y,z)}
  function screen(s,x,z,w,h,d) {
    box(s,x,h/2,z,w,h,d,stone);
    screens.push(new T.Box3(new T.Vector3(s.x+x-w/2,0,s.z+z-d/2),new T.Vector3(s.x+x+w/2,h,s.z+z+d/2)));
  }
  const twins=site('half',-10,17,1.55,2.6,null,'Two lanterns answered. Back out before the shadows meet.','One lantern goes dark.',0x8fd4c9);
  for(const side of [-1,1]){
    box(twins,side*1.9,.68,0,.45,1.35,.45,stone);
    box(twins,side*1.9,1.52,0,.3,.31,.3,twins.glow);
    shape(twins,new T.ConeGeometry(.48,.31,4),timber,side*1.9,1.82,0);
    twins.actors.push(shape(twins,new T.ConeGeometry(.29,1.57,7),timber,side*1.85,.79,.2));
  }
  screen(twins,-1.15,1.35,1.3,1.9,.25);
  const sheets=site('skin',-19,-9,2.8,3.2,'Lift the laundry sheet','A second figure moves beneath the linen. Take the side opening.','Only empty linen moves.',0xccd2ba);
  for(const z of [-1.4,.8]){
    for(const x of [-2.1,2.1])box(sheets,x,1.17,z,.11,2.34,.11,timber);
    box(sheets,0,2.27,z,4.3,.055,.055,timber);
    for(const x of [-1.44,0,1.44])sheets.actors.push(box(sheets,x,1.68,z,1.15,1.13,.034,linen));
  }
  screen(sheets,2.15,-.5,.22,1.94,1.64);
  const heart=site('heart',11,17,2.55,3.4,'Lift the red votive','Your pulse answers the arch. Put the light down or step behind the stone.','The answering heartbeat fades.',0xff655f);
  box(heart,0,.44,-.42,1.04,.88,.78,stone);
  shape(heart,new T.OctahedronGeometry(.17),heart.glow,0,1.06,-.42);
  for(const x of [-1.45,1.45])box(heart,x,1.32,-1.38,.34,2.64,.37,stone);
  box(heart,0,2.58,-1.38,3.35,.3,.46,stone);screen(heart,1.15,.23,.27,2,1.3);
  const yew=site('hang',19,-10,1.85,2.5,null,'The leaves fall silent. Step sideways out of the branch shadow.','The branch swings past.',0xb9a4d3);
  shape(yew,new T.CylinderGeometry(.22,.46,3.7,7),timber,2,1.85,-.5);
  const limb=box(yew,.9,3.45,-.5,2.86,.22,.23,timber);limb.rotation.z=.13;
  for(const x of [-.2,1.6,2.7])shape(yew,new T.IcosahedronGeometry(1.25,0),stone,x,4.08,-.55).scale.set(1.18,.67,.88);
  const shadow=box(yew,0,.065,0,.68,.018,3.2,timber);yew.actors.push(shadow);
  const study=site('parts',-7,-53,3.4,4,'Uncover the specimen','A white reflection is crossing the room. Slip around a corner.','The reflection passes the doorway.',0xdadfd8);
  box(study,0,.7,-.68,1.7,.12,.83,timber);
  for(const x of [-.68,.68])box(study,x,.32,-.68,.13,.64,.57,timber);
  shape(study,new T.IcosahedronGeometry(.48,1),linen,0,.84,-.68).scale.set(1.45,.53,.71);
  const mirror=box(study,0,1.46,-1.22,1.26,1.15,.08,stone);
  study.actors.push(box(study,0,1.43,mirror.position.z+.06,.09,.75,.04,study.glow));
  const ray=new T.Ray(), end=new T.Vector3(), hit=new T.Vector3();
  function sight(a,b){
    ray.origin.set(a.x,1.38,a.z);end.set(b.x,1.38,b.z);
    const distance=end.distanceTo(ray.origin);
    ray.direction.copy(end).sub(ray.origin).normalize();
    return !screens.some(bounds=>ray.intersectBox(bounds,hit)&&hit.distanceTo(ray.origin)<distance);
  }
  let active=null, time=0, locked=null;
  const distance=(s,p)=>Math.hypot(p.x-s.x,p.z-s.z);
  function reset(){
    if(active)active.ring.visible=false;
    if(active===twins)twins.actors.forEach((m,i)=>m.position.x=i?1.85:-1.85);
    if(active===sheets)sheets.actors.forEach(m=>m.rotation.x=0);
    if(active===yew)shadow.position.x=0;
    if(active===study)study.actors[0].position.x=0;
    active=null;time=0;
  }
  function start(s,notify){active=s;locked=s;time=0;s.ring.visible=true;notify(s.warn)}
  function resolvePlayer(p,oldX,oldZ,r){
    for(const b of screens){
      const inside=(x,z)=>x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r;
      if(!inside(p.x,p.z))continue;
      if(!inside(oldX,p.z))p.x=oldX;
      else if(!inside(p.x,oldZ))p.z=oldZ;
      else {p.x=oldX;p.z=oldZ}
    }
  }
  return {sight,resolvePlayer,get active(){return active},reset,
    action(p){if(active)return active===heart?'Lower the votive':null;
      return sites.find(s=>s.prompt&&s!==locked&&distance(s,p)<1.55)?.prompt||null},
    use(label,notify){if(active===heart&&label==='Lower the votive'){reset();notify(heart.escape);return true}
      const s=sites.find(s=>s.prompt===label);if(!s)return false;start(s,notify);return true},
    step(dt,p,enabled,notify,capture){
      if(!enabled){reset();return}
      if(locked&&distance(locked,p)>locked.radius+.5)locked=null;
      if(!active){const s=sites.find(s=>!s.prompt&&s!==locked&&distance(s,p)<s.radius);if(!s)return;start(s,notify)}
      const s=active;time+=dt;const t=Math.min(1,time/s.seconds);
      s.ring.scale.setScalar(s.radius*(1-.78*t));s.ring.visible=true;
      let clear=distance(s,p)>s.radius;
      if(s===twins){
        twins.actors.forEach((actor,i)=>actor.position.x=(i?1:-1)*(1.85-1.51*t));
        clear ||= [-1,1].some(i=>!sight({x:s.x+1.9*i,z:s.z},p));
      }else if(s===sheets){
        sheets.actors.forEach((m,i)=>m.rotation.x=.05+.24*Math.max(0,Math.cos(time*4-i*.8)));
        clear ||= !sight({x:s.x,z:s.z-1.8},p);
      }else if(s===heart){s.ring.scale.multiplyScalar(1+.13*Math.sin(time*9));clear ||= !sight({x:s.x,z:s.z-1.38},p)}
      else if(s===yew){shadow.position.x=.57*Math.sin(time*1.9);clear ||= Math.abs(p.x-s.x-shadow.position.x)>1.18}
      else {study.actors[0].position.x=.47*Math.sin(time*1.9);clear ||= !mansion.huntLayout.vision({x:s.x,z:s.z-1.3},p)}
      if(clear){reset();notify(s.escape)}else if(t===1){reset();capture(s.id)}
    }
  };
}
