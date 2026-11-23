import {makeTorso} from './hollower-torso.mjs';

const ease = (t,a,b) => {
  const u=Math.max(0,Math.min(1,(t-a)/(b-a)));
  return u*u*(3-2*u);
};
export const REBIRTH_DEATH = 6.7;
const AWAKEN = REBIRTH_DEATH+10;
const END=AWAKEN+1.65;

export function playHollowerRebirth(T,site,o){
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const stage=new T.Group();stage.name='Hollower rebirth';stage.position.set(site.x,site.y,site.z);o.scene.add(stage);
  const body=o.makeActor(false),head=o.makeActor(true);
  const tall=new T.Group(),form=new T.Group(),hanger=new T.Group(),payload=new T.Group(),trail=new T.Group();
  stage.add(body,tall,form);form.add(head,hanger);hanger.add(payload,trail);
  form.name='Hanako · floating form';
  hanger.name='Hanako · neck stump anchor';
  o.bind(body);o.bind(head);body.updateMatrixWorld(true);head.updateMatrixWorld(true);
  const bones=body.userData.bones, headBone=bones.head;
  const pivot=form.worldToLocal(head.userData.bones.head.getWorldPosition(V(0,0,0)));
  head.position.copy(pivot).negate();
  const stump=V(0,o.cutY,.039);
  hanger.position.copy(stump).sub(pivot);
  payload.position.copy(stump).negate();
  const torso=makeTorso(T,body);
  const materials=[],geometries=[];
  const material=(color,emissive=0)=>{
    const m=new T.MeshLambertMaterial({color,emissive,flatShading:true});materials.push(m);return m;
  };
  const shadow=material(0x2a2635,0x0e0815),mask=material(0xaf907b),eyes=material(0xe9b880,0x9b501e);
  const sinew=material(0x843344,0x240709),spirit=material(0x635591,0x262044);
  const blood=material(0x651723,0x160307);
  const facetGeo=new T.IcosahedronGeometry(1,0),shaftGeo=new T.CylinderGeometry(.72,1,1,6);
  geometries.push(facetGeo,shaftGeo);
  function facet(parent,m,p,s){
    const mesh=new T.Mesh(facetGeo,m);parent.add(mesh);mesh.position.fromArray(p);mesh.scale.fromArray(s);return mesh;
  }
  const up=V(0,1,0),delta=V(0,0,0);
  function limb(parent,m,radii){
    return radii.map(r=>{
      const mesh=new T.Mesh(shaftGeo,m);parent.add(mesh);mesh.scale.set(r,1,r);return mesh;
    });
  }
  function lay(parts,points){
    parts.forEach((part,i)=>{
      delta.subVectors(points[i+1],points[i]);
      part.position.copy(points[i]).addScaledVector(delta,.5);
      part.scale.y=delta.length();
      part.visible=part.scale.y>.001;
      if(part.visible)part.quaternion.setFromUnitVectors(up,delta.normalize());
    });
  }
  facet(tall,shadow,[0,1.53,0],[.32,.75,.23]);
  facet(tall,mask,[0,2.29,.12],[.22,.23,.18]);
  for(const s of [-1,1]){
    facet(tall,eyes,[s*.073,2.32,.258],[.032,.036,.025]);
    facet(tall,mask,[s*.169,2.47,.12],[.069,.29,.07]).rotation.z=-s*.32;
  }
  const arms=[limb(tall,shadow,[.077,.051,.026]),limb(tall,shadow,[.077,.051,.026])];
  const legs=[limb(tall,shadow,[.098,.056]),limb(tall,shadow,[.098,.056])];
  const curve=new T.CatmullRomCurve3([stump.clone().add(V(0,.012,0)),stump.clone(),
    V(.007,1.35,-.053),V(.012,1.25,-.061)]);
  const stem=new T.TubeGeometry(curve,14,.016,6,false);
  geometries.push(stem);payload.add(new T.Mesh(stem,sinew));
  for(let i=0;i<11;i++){
    const y=1.36-i*.036;
    facet(payload,mask,[.012*Math.sin(i*.44),y,-.060],[.025,.018,.025]);
    facet(payload,mask,[.007,y-.004,-.085],[.009,.010,.017]);
  }
  const tail=limb(trail,spirit,[.059,.043,.028,.016]);
  const tendril=limb(stage,sinew,Array(27).fill(.018));
  const stain=facet(stage,blood,[0,.012,.13],[.49,.009,.63]);
  const light=new T.PointLight(0xffbdab,5.8,5);light.position.set(.54,1.74,.90);stage.add(light);

  const release=o.headless,original=body.userData.mesh.geometry,look=V(0,0,0);
  const mark=V(0,0,0),seam=V(0,0,0),hold=V(0,0,0),direction=V(0,0,0);
  const flatRotation=new T.Quaternion();
  let time=0,dead=false,transferred=false,done=false,awake=false,lastGore;

  function pose(t){
    o.bind(body);
    const fall=ease(t,1.20,2.58),after=ease(t,REBIRTH_DEATH,7.31);
    const brace=ease(t,.57,1.22)*(1-fall),roll=ease(t,3.15,3.63)*(1-ease(t,3.74,4.12));
    const fight=ease(t,4.95,5.72)*(1-ease(t,6.33,6.76));
    body.position.set(.035*fall,.12*fall-.13*brace+.028*roll,.86*fall);
    body.rotation.set(-1.54*fall-.22*brace,.09+.12*roll,.075*fall-.11*brace);
    bones.head.rotation.set(.37*brace-.17*fight,-.34*brace+.39*fight,.10*roll);
    bones.chest.rotation.set(.18*brace+.10*roll,.18*roll-.11*fight,.10*roll);
    bones.upperarm_L.rotation.set(.39*roll,-.69*fight,-1.31+.63*brace+.53*fight);
    bones.upperarm_R.rotation.set(-.38*fight,.31*roll,1.38-.65*brace-.28*roll);
    bones.forearm_L.rotation.y=.32+.90*fight;bones.forearm_R.rotation.y=-.25-.48*roll;
    bones.thigh_L.rotation.set(-.40*brace-.37*roll-.14*(1-after)*fall,0,.075);
    bones.shin_L.rotation.x=.71*brace+.46*roll+.11*fall;
    bones.thigh_R.rotation.z=-.16*fall;bones.shin_R.rotation.x=.22*brace+.10*fall;
    body.userData.face(t<.68?0:t<1.24?"dread":dead?"deathRest":t<3.23?"panic":"bracing");
    body.updateMatrixWorld(true);
    headBone.getWorldPosition(mark).sub(stage.position);
    bones.chest.localToWorld(seam.set(.016,.011-.30*ease(t,3.10,5.34),.09)).sub(stage.position);
  }
  function creature(t){
    const step=ease(t,.10,1.31),reach=ease(t,2.73,3.28);
    const pull=ease(t,5.21,5.85)*(1-ease(t,7.40,8.53));
    const leaving=ease(t,8.13,10.10);
    tall.position.set(1.08-.09*step+.49*leaving,0,-1.34+.55*step-.42*leaving);
    tall.rotation.set(.10*reach,-.55-.92*leaving,.13*reach*(1-leaving));
    tall.visible=leaving<.999;tall.updateMatrixWorld(true);
    hold.copy(mark).add(V(.09,.10+.36*ease(t,5.79,6.72),-.09));
    for(let i=0;i<2;i++){
      const s=i*2-1,foot=step*Math.PI+i*Math.PI;
      lay(legs[i],[V(s*.15,.95,0),V(s*.23,.43,.12*Math.sin(foot)),V(s*.26,.022+.11*Math.max(0,Math.sin(foot)),.12+.18*Math.sin(foot))]);
      const tip=V(s*.40,.54,.23);
      const aim=i===0?hold:seam;
      const weight=i===0?pull:reach*(1-ease(t,5.24,5.80));
      tip.lerp(tall.worldToLocal(aim.clone().add(stage.position)),weight);
      lay(arms[i],[V(s*.25,1.87,.01),tip.clone().lerp(V(s*.28,1.53,.13),.44).add(V(s*.12,.05,0)),
        tip.clone().add(V(s*.044,.082,-.021)),tip]);
    }
  }
  function showGore(on){
    if(on===lastGore)return;
    lastGore=on;
    const cut=ease(time,3.18,5.31), width=ease(time,4.24,5.62);
    body.userData.mesh.geometry=transferred?release:original;
    torso.update([cut*.026+width*.080,cut*.207],[cut*.052+width*.083,cut*.218],on);
    stain.visible=on&&cut>0;
    payload.visible=on;
    trail.visible=!on;
    for(const part of tendril)part.material=on?sinew:spirit;
  }
  const down=V(0,-1,0),bob=V(0,0,0),previous=V(0,0,0),anchor=V(0,0,0);
  const oldAnchor=V(0,0,0),subAnchor=V(0,0,0),motion=V(0,0,0),axis=V(0,0,0);
  const rootWorld=new T.Quaternion();
  let lastClock=null;
  lay(tail,[V(0,0,0),V(0,-.13,-.025),V(.035,-.29,-.08),V(-.022,-.44,-.075),V(0,-.59,-.04)]);
  function swing(clock){
    if(o.reduced)return;
    form.localToWorld(anchor.copy(hanger.position));
    const dt=lastClock===null?0:Math.min(clock-lastClock,.05);
    lastClock=clock;
    const length=.36;
    if(dt<=0||anchor.distanceToSquared(oldAnchor)>1.3){
      bob.copy(anchor).addScaledVector(down,length);previous.copy(bob);oldAnchor.copy(anchor);
    }
    // Constrain a weighted point to a fixed distance from the moving stump.
    // Damping dissipates momentum without ever moving the attachment point.
    const sub=dt/3;
    for(let i=1;i<=3;i++){
      subAnchor.copy(oldAnchor).lerp(anchor,i/3);
      motion.subVectors(bob,previous).multiplyScalar(Math.exp(-3.1*sub));
      previous.copy(bob);
      bob.add(motion).addScaledVector(down,8.8*sub*sub);
      axis.subVectors(bob,subAnchor);
      axis.y=Math.min(axis.y,-.20);
      bob.copy(subAnchor).addScaledVector(axis.normalize(),length);
    }
    oldAnchor.copy(anchor);
    form.getWorldQuaternion(rootWorld).invert();
    axis.subVectors(bob,anchor).normalize().applyQuaternion(rootWorld);
    hanger.quaternion.setFromUnitVectors(down,axis);
  }
  function hideTendril(){for(const part of tendril)part.visible=false}
  function attackTube(point,age){
    const target=point.clone().sub(stage.position);
    const start=torso.bowels.getWorldPosition(V(0,0,0)).sub(stage.position);
    const reach=ease(age,0,.53),tight=ease(age,.72,1.65),release=ease(age,2.27,2.77);
    const path=[],radius=.12-.044*tight;
    for(let i=0;i<=tendril.length;i++){
      const u=i/tendril.length;
      let p;
      if(i<15){
        const travel=i/15;
        p=start.clone().lerp(target,travel).add(V(.038*Math.sin(travel*5),-.14*Math.sin(travel*Math.PI),0));
        p.z-=radius*travel;
      }else{
        const arc=(i-15)/(tendril.length-15)*Math.PI*2.2;
        p=target.clone().add(V(Math.sin(arc)*radius,.035-u*.056,-Math.cos(arc)*radius));
      }
      p.lerp(start,1-reach*(1-release));path.push(p);
    }
    lay(tendril,path);
  }
  hideTendril();
  return {
    frame(t){
      if(time<2.37&&t>=2.37)o.cue('land');
      if(time<3.23&&t>=3.23)o.cue('seam');
      if(time<4.57&&t>=4.57)o.cue('widen');
      if(time<8.55&&t>=8.55)o.cue('land');
      time=t;
      pose(t);creature(t);
      const drawing=ease(t,5.73,REBIRTH_DEATH);
      if(t>=5.77&&!transferred){
        transferred=true;
        for(const organ of torso.viscera)payload.add(organ);
      }
      form.visible=transferred;
      const drop=ease(t,7.22,8.66),rise=ease(t,AWAKEN,END-.25);
      form.position.copy(mark).lerp(hold,drawing).lerp(V(.48,.116,-.24),drop);
      form.position.lerp(V(.48,1.38,.27),rise);
      form.quaternion.copy(body.quaternion).slerp(flatRotation,drawing*(1-drop)+rise);
      form.rotateZ(.40*drop*(1-rise));
      if(t>=AWAKEN)swing(t);
      head.userData.face(t>=AWAKEN?"revenant":t<6.92?"rolledEyes":t<7.62?"vacant":"deathRest");
      lastGore=undefined;showGore(o.gore());
      if(!dead&&t>=REBIRTH_DEATH){dead=true;o.die()}
      if(!awake&&t>=AWAKEN){awake=true;o.rise()}
      look.copy(stage.position).add(V(.12,.42+.31*rise,.11));o.target.copy(look);
      if(!done&&t>=END){done=true;o.end(this)}
    },
    camera(t){
      const open=ease(t,2.2,3.14),upper=ease(t,5.68,6.59)*(1-ease(t,7.18,8.66));
      const wake=ease(t,AWAKEN,END);
      o.camera.position.copy(stage.position).add(V(1.01-.33*open,1.68-.10*open+.40*upper+.20*wake,2.85-.86*open+.42*upper+.21*wake));
      o.camera.lookAt(look.clone().add(V(.22*upper,.73*upper,-.16*upper)));
    },
    showGore,
    control(pos,yaw,mx,mz,clock,attack){
      const speed=Math.hypot(mx,mz);
      form.position.set(pos.x-stage.position.x,pos.y-stage.position.y-.08+(o.reduced?0:.066*Math.sin(clock*3.2)),pos.z-stage.position.z);
      direction.set(0,0,0);
      if(attack)direction.copy(attack.point).sub(pos);
      else if(speed>.04)direction.set(-Math.sin(yaw)*mz+Math.cos(yaw)*mx,0,-Math.cos(yaw)*mz-Math.sin(yaw)*mx);
      const facing=direction.lengthSq()>.002?Math.atan2(direction.x,direction.z):yaw+Math.PI;
      const turn=Math.atan2(Math.sin(facing-form.rotation.y),Math.cos(facing-form.rotation.y));
      form.rotation.set(.10*speed,form.rotation.y+turn*.22,0);
      swing(clock);
      if(attack)attackTube(attack.point,attack.age);else hideTendril();
    },
    cleanup(){
      stage.removeFromParent();torso.dispose();body.userData.mesh.geometry=original;
      materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());o.disposeActors();
    }
  };
}
