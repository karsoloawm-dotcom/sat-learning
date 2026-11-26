// The Hollower itself: a low crawler (hunter) and the tall shade that does the fine work.
export function buildHollowerRig(T, stage){
  const materials=[], geometries=[];
  const mat=(color,emissive=0)=>{const m=new T.MeshLambertMaterial({color,emissive,flatShading:true});materials.push(m);return m};
  const chitin=mat(0x292833,0x080811),joint=mat(0x51414e),mask=mat(0xbca486),eye=mat(0xe9c288,0xb46229);
  function mesh(g,m,parent,x=0,y=0,z=0){
    const a=new T.Mesh(g,m);geometries.push(g);a.position.set(x,y,z);parent.add(a);return a;
  }
  function facet(parent,m,xyz,size){
    const a=mesh(new T.IcosahedronGeometry(1,0),m,parent,...xyz);a.scale.set(...size);return a;
  }
  const up=new T.Vector3(0,1,0),direction=new T.Vector3();
  function segments(parent,radii) {
    return radii.map(r=>mesh(new T.CylinderGeometry(r*.63,r,1,5),chitin,parent));
  }
  function lay(parts,points){
    parts.forEach((m,i)=>{
      const a=points[i],b=points[i+1];
      direction.subVectors(b,a);m.scale.y=direction.length();m.position.copy(a).lerp(b,.5);
      m.quaternion.setFromUnitVectors(up,direction.normalize());
    });
  }
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const hunter=new T.Group(), shade=new T.Group();stage.add(hunter,shade);
  facet(hunter,chitin,[0,.20,-.28],[.4,.27,.54]);
  facet(hunter,joint,[0,.23,-.55],[.28,.19,.35]);
  const head=new T.Group();hunter.add(head);head.position.set(0,.16,.16);
  facet(head,mask,[0,0,0],[.20,.22,.18]);
  for(const s of [-1,1]){
    facet(head,eye,[s*.084,.045,.155],[.045,.022,.025]);
    facet(head,chitin,[s*.099,-.09,.17],[.035,.115,.06]).rotation.z=s*.48;
  }
  const legs=Array.from({length:6},(_,i)=>segments(hunter,[.072,.049,.025]));
  const fore=Array.from({length:2},()=>segments(hunter,[.08,.054,.028]));
  facet(shade,chitin,[0,1.53,0],[.31,.76,.22]);
  facet(shade,mask,[0,2.31,.12],[.23,.24,.18]);
  for(const s of [-1,1]){
    facet(shade,eye,[.071*s,2.34,.26],[.03,.034,.027]);
    facet(shade,mask,[.17*s,2.49,.11],[.066,.30,.07]).rotation.z=-s*.32;
  }
  const shadowLegs=[segments(shade,[.093,.056]),segments(shade,[.093,.056])];
  const shadowArms=[segments(shade,[.075,.045]),segments(shade,[.075,.045])];
  return {materials,geometries,mat,mesh,facet,segments,lay,V,chitin,joint,mask,eye,hunter,head,shade,legs,fore,shadowLegs,shadowArms};
}
