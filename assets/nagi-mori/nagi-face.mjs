import * as T from "three";

export function createNagiFaces(){
  const entries=["Neutral","Blink","Smirk","Focused","Startled","Uneasy","Relieved","Wince","Soothe"];
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=1024;
  const c=canvas.getContext("2d");
  const oval=(x,y,w,h,color)=>{
    c.beginPath();c.ellipse(x,y,w,h,0,0,Math.PI*2);c.fillStyle=color;c.fill();
  };
  const stroke=(x1,y1,x2,y2,x3,y3,weight,color="#373044")=>{
    c.beginPath();c.moveTo(x1,y1);c.quadraticCurveTo(x2,y2,x3,y3);
    c.strokeStyle=color;c.lineWidth=weight;c.lineCap="round";c.stroke();
  };
  entries.forEach((name,i)=>{
    c.save();c.translate((i%3)*170,Math.floor(i/3)*320);
    for(const s of [-1,1]){
      const x=84+s*38,y=108;
      const closed=["Blink","Wince"].includes(name);
      const h=name==="Startled"?31:name==="Focused"||name==="Smirk"?13:name==="Soothe"?17:22;
      const brow=name==="Startled"?44:name==="Uneasy"||name==="Soothe"?59:68;
      stroke(x-27,brow+s*5,x,brow-9,x+26,brow-s*5,6);
      if(closed){stroke(x-28,y,x,y+16,x+28,y-2,6);continue}
      oval(x,y,29,h,"#fff4db");
      const look=name==="Smirk"?8:name==="Soothe"?-5:0;
      oval(x+look,y+2,13,Math.min(h-1,21),"#6a7841");
      oval(x+look,y+3,6,Math.min(h-2,15),"#25382d");
      oval(x+look-4,y-6,3,5,"#fff6e7");
      stroke(x-28,y-2,x,y-h*1.85,x+28,y-2,7);
    }
    if(name==="Startled"||name==="Uneasy"){
      oval(84,253,name==="Startled"?17:11,name==="Startled"?17:7,"#64343d");
    }else{
      const smile=["Smirk","Relieved","Soothe"].includes(name);
      stroke(67,254,85,smile?270:248,102,name==="Smirk"?245:254,5,"#77434a");
    }
    c.restore();
  });
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  return {texture,entries};
}

// Sample the actual porcelain face instead of floating flat artwork in front of
// the nose. The conformed patch is then parented to the animated head joint.
export function attachNagiFace(actor,source,atlas,ghost=false){
  const head=actor.bones.get("Head"),part=actor.parts.get("Head");
  const position=source.geometry.attributes.position;
  const count=source.geometry.index?.count??position.count;
  const read=i=>new T.Vector3().fromBufferAttribute(position,source.geometry.index?.getX(i)??i);
  const triangles=[];
  for(let i=0;i<count;i+=3){
    const a=read(i),b=read(i+1),c=read(i+2);
    const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.max(a.z,b.z,c.z)>0&&Math.abs(det)>1e-8)triangles.push([a,b,c,det]);
  }
  function depth(x,y){
    let z=0;
    for(const [a,b,c,d] of triangles){
      const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/d;
      const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/d;
      const w=1-u-v;
      if(Math.min(u,v,w)>=-.0001)z=Math.max(z,u*a.z+v*b.z+w*c.z);
    }
    return z;
  }
  actor.root.updateWorldMatrix(true,true);
  const points=[],uv=[],indices=[],columns=26,rows=19;
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
    const u=x/columns,w=y/rows,Y=1.433+.147*w;
    const half=.099*(.72+.28*Math.min(1,w*3));
    const X=(2*u-1)*half,Z=depth(X,Y);
    const p=head.worldToLocal(actor.root.localToWorld(new T.Vector3(X,Y,Z+.004)));
    points.push(...p.toArray());uv.push(u*170/512,w*320/1024);
    if(x<columns&&y<rows){
      const a=y*(columns+1)+x,b=a+columns+1;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(points,3));
  geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const map=atlas.texture.clone();
  const material=new T.MeshLambertMaterial({map,transparent:ghost,opacity:ghost?0:1,
    alphaTest:.26,depthWrite:!ghost,side:T.DoubleSide,emissive:ghost?0x283a56:0x09030a,
    polygonOffset:true,polygonOffsetFactor:-2});
  const patch=new T.Mesh(geo,material);patch.name="Nagi · rigged facial expression";head.add(patch);
  actor.faceLayer=patch;
  // Keep the real skin, piercings and hair. The new patch provides the eyes and mouth.
  const features=/^(Ivory sclera|Amber olive|Deep green|Espresso ink|Mouth interior|Rosewood lips|Black cherry|Rose clay)/;
  part.traverse(o=>{if(o.isMesh&&features.test(o.material?.name||o.userData.originalFaceMaterial||""))o.visible=false});
  actor.faceTexture=name=>{
    const i=Math.max(0,atlas.entries.indexOf(name));
    map.offset.set((i%3)*170/512,1-(Math.floor(i/3)+1)*320/1024);
  };
  actor.faceTexture("Neutral");
  return patch;
}
