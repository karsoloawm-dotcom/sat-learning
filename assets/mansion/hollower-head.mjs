const clamp = x => Math.max(0,Math.min(1,x));
const smooth = x => {const u=clamp(x);return u*u*(3-2*u)};
const seamX = y => .018+.038*smooth((y-.124)/.128);

export function makeHeadExtraction(T, body, stage, crown, addSkull) {
  const mesh=body.userData.mesh, bone=body.userData.bones.head, original=mesh.geometry;
  body.updateMatrixWorld(true);
  const rest=mesh.worldToLocal(bone.getWorldPosition(new T.Vector3()));
  const source=original.attributes.position;
  // Share all immutable rig data. The replay owns only the animated vertex array.
  const geometry=new T.BufferGeometry();
  for(const [key,value] of Object.entries(original.attributes))geometry.setAttribute(key,value);
  geometry.setIndex(original.index);
  for(const {start,count,materialIndex} of original.groups)geometry.addGroup(start,count,materialIndex);
  const animated=source.clone().setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',animated);
  geometry.setAttribute('hollowerBind',source);
  mesh.geometry=geometry;
  const headVertices=[];
  const faceVertices=new Set();
  for(const {start,count,materialIndex} of original.groups){
    if(materialIndex===1)for(let i=start;i<start+count;i++)faceVertices.add(original.index.getX(i));
  }
  const {skinIndex,skinWeight}=geometry.attributes;
  const headIndex=mesh.skeleton.bones.indexOf(bone);
  for(let i=0;i<source.count;i++){
    let weight=0;
    for(let j=0;j<4;j++)if(skinIndex.getComponent(i,j)===headIndex)weight+=skinWeight.getComponent(i,j);
    if(weight>.01||faceVertices.has(i))headVertices.push([i,weight,faceVertices.has(i)]);
  }

  const slit={value:0}, collapsed={value:0};
  function decorate(material, face=false) {
    const compile=material.onBeforeCompile, key=material.customProgramCacheKey();
    material.onBeforeCompile=shader=>{
      compile.call(material,shader);
      shader.uniforms.hollowerSeam=slit;
      shader.uniforms.hollowerCollapsed=collapsed;
      shader.vertexShader='attribute vec3 hollowerBind;\nvarying vec3 vHollowerHead;\n'+
        shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHollowerHead = hollowerBind;');
      shader.fragmentShader=`varying vec3 vHollowerHead;
        uniform float hollowerSeam;
        uniform float hollowerCollapsed;
      `+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec3 h = vHollowerHead - vec3(${rest.x.toFixed(6)},${rest.y.toFixed(6)},${rest.z.toFixed(6)});
        if(hollowerSeam > 0. && h.z > -.012 && h.y > .10) {
          float travel = ${crown.y.toFixed(6)} - h.y;
          float x = .018+.038*smoothstep(.124,.252,h.y);
          float width = mix(.0014,.010,hollowerSeam);
          float d = abs(h.x-x);
          if (travel >= -.031 && travel < .132*hollowerSeam) {
            if(d<width*.60 && hollowerCollapsed<.92) discard;
            diffuseColor.rgb *= mix(vec3(.54,.075,.072),vec3(1.),smoothstep(width,width+.006,d));
          }
        }
        ${face ? `
        if(hollowerCollapsed > 0.) {
          vec2 eye = vec2((abs(h.x)-.067)/.039,(h.y-.075+.09*(abs(h.x)-.067))/.026);
          float sockets = 1.-smoothstep(.20,1.,length(eye));
          float mouth = (1.-smoothstep(.001,.004,abs(h.y+.019-.07*h.x))) *
                        (1.-smoothstep(.022,.030,abs(h.x)));
          diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.92,.51,.325),hollowerCollapsed);
          diffuseColor.rgb *= mix(vec3(1.),vec3(.45,.23,.30),hollowerCollapsed*max(sockets*.68,mouth));
        }` : ''}
      `);
    };
    material.customProgramCacheKey=()=>key+'/hollower-head/'+face;
  }

  const skull=new T.Group();skull.name='Hollower extracted skull';stage.add(skull);
  skull.scale.copy(bone.scale).multiplyScalar(1.11);
  addSkull(body).out.forEach(part=>skull.add(part));
  const enamel=new T.MeshLambertMaterial({color:0xd8c6a5,emissive:0x21140f,flatShading:true});
  const tooth=new T.BoxGeometry(.008,.008,.006);
  for(let i=-4;i<=4;i++){
    const piece=new T.Mesh(tooth,enamel);
    piece.position.set(i*.008,.052-.006*Math.abs(i)/4,.096-i*i*.0006);
    piece.rotation.z=i*.028;skull.add(piece);
  }
  const heldRotation=new T.Quaternion(), baseRotation=new T.Quaternion();
  const floorRotation=new T.Quaternion().setFromEuler(new T.Euler(-.18,.45,-.54));
  const turn=new T.Quaternion().setFromEuler(new T.Euler(.81,-.24,.21));
  const floor=new T.Vector3(.67,.013,-.26), origin=new T.Vector3(), held=new T.Vector3();
  let lastFlatten=-1,lastZip=-1;
  return {
    decorate, skull,
    update(on,zip,pull,drop,hand){
      slit.value=on?zip:0;collapsed.value=on?pull:0;
      if(collapsed.value!==lastFlatten||slit.value!==lastZip){
        const flat=collapsed.value,tear=slit.value;
        for(const [i,influence,face] of headVertices){
          const x=source.getX(i),y=source.getY(i),z=source.getZ(i),localY=y-rest.y;
          const weight=(face?.84:smooth(influence)*smooth((localY+.045)/.090))*flat;
          const socket=Math.exp(-(((Math.abs(x)-.067)/.039)**2+((localY-.075)/.026)**2));
          const fold=.0035*Math.sin(y*126+x*62);
          const finishedZ=rest.z+.024+(z-rest.z)*.105+fold-.006*socket;
          const distance=x-seamX(localY);
          const edge=(distance<0?-1:1)*smooth((localY-.10)/.115);
          const split=edge*(.012*weight+.009*tear*(1-flat)*smooth(influence)*Math.exp(-((distance/.064)**2)));
          animated.setXYZ(i,x+split-x*.054*weight,y-.018*weight,z+(finishedZ-z)*weight);
        }
        animated.needsUpdate=true;
        lastFlatten=flat;lastZip=tear;
      }
      skull.visible=on&&pull>.018;
      if(!skull.visible)return;
      bone.getWorldPosition(origin).sub(stage.position);
      bone.getWorldQuaternion(baseRotation);
      heldRotation.copy(baseRotation).multiply(turn);
      skull.quaternion.copy(baseRotation).slerp(heldRotation,pull).slerp(floorRotation,drop);
      held.copy(crown).multiply(skull.scale).applyQuaternion(skull.quaternion);
      skull.position.copy(origin).lerp(hand.clone().sub(held),pull).lerp(floor,drop);
      skull.position.y+=.12*Math.sin(Math.PI*drop);
    },
    dispose(){
      mesh.geometry=original;
      geometry.dispose();tooth.dispose();enamel.dispose();
    }
  };
}
