export const faceVersions = [
  ['softSmile','Soft smile'], ['skeptical','Skeptical'], ['exhausted','Exhausted'],
  ['heartEyes','Pink heart pupils'], ['revenant','Flying entity'],
  ['lostEye','Missing one eye',true], ['eyeless','Empty eye sockets',true],
  ['emptyMouth','Empty sockets and mouth',true],
  ['dread','Quiet fear'], ['panic','Wide-eyed panic'], ['bracing','Bracing for impact'],
  ['rolledEyes','Eyes rolled back'], ['vacant','Vacant stare'], ['deathRest','Limp, half-lidded'],
  ['heartBashful','Heart pupils · bashful'], ['heartJoy','Heart pupils · delighted'],
  ['heartPanic','Heart pupils · frightened'], ['heartSorrow','Heart pupils · tearful'],
  ['heartDazed','Heart pupils · dazed']
];

export function buildFaceAtlas(original, page=0) {
  const atlas=document.createElement('canvas');
  atlas.width=1024;atlas.height=1024;
  const ctx=atlas.getContext('2d'),tile=512;
  const sample=document.createElement('canvas');
  sample.width=sample.height=1;
  const pixel=sample.getContext('2d');
  pixel.drawImage(original,12,12,1,1,0,0,1,1);
  const [r,g,b]=pixel.getImageData(0,0,1,1).data;
  const skin=`rgb(${r},${g},${b})`,line='#4f394f';
  function oval(x,y,w,h,color,angle=0){
    ctx.beginPath();ctx.ellipse(x,y,w,h,angle,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  function curve(color,width,points){
    ctx.beginPath();ctx.moveTo(points[0],points[1]);ctx.quadraticCurveTo(...points.slice(2));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();
  }
  function heart(x,y,size,pale){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    ctx.beginPath();ctx.moveTo(0,24);
    ctx.bezierCurveTo(-56,-14,-27,-40,0,-21);
    ctx.bezierCurveTo(27,-40,56,-14,0,24);
    ctx.fillStyle=pale?'#ad6583':'#df427d';ctx.fill();oval(-13,-14,6,5,'#ffdae8');ctx.restore();
  }
  faceVersions.slice(page*8,page*8+8).forEach(([id,,gore],i)=>{
    ctx.save();ctx.translate(i>=4?tile:0,(i%4)*256);
    ctx.fillStyle=skin;ctx.fillRect(0,0,tile,256);
    const entity=id==='revenant';
    for(const side of [-1,1]){
      const x=256+side*82;
      const socket=gore&&(id!=='lostEye'||side===-1);
      const lovestruck=id.startsWith('heart');
      const fear=id==='panic'||id==='dread'||id==='heartPanic';
      const dead=id==='rolledEyes'||id==='vacant'||id==='deathRest';
      if(socket){
        oval(x,120,61,39,'#925663',side*.09);
        oval(x,120,48,31,'#4d273a',side*.09);
        oval(x+side*4,117,39,25,'#281724');
        if(id==='lostEye')curve('#9e4654',7,[x-30,139,x-20,157,x-19,174]);
      }else if(id==='bracing'){
        curve(line,13,[x-56,116,x,149-side*7,x+53,111]);
        curve('#9f626b',4,[x-37,145,x+1,156,x+27,145]);
      }else if(dead){
        const rolled=id==='rolledEyes',limp=id==='deathRest';
        const h=rolled?36:limp?15:31;
        oval(x,120,55,h,'#e9e2d9',side*.055);
        if(!rolled||side<0)oval(x+side*3,rolled?90:limp?117:124,rolled?12:limp?12:15,
          rolled?6:limp?12:19,'#8b7c87');
        if(!rolled)oval(x+side*3,limp?117:124,limp?6:8,limp?9:12,'#645765');
        curve('#60485a',limp?12:9,[x-55,118,x,limp?88:120-h*1.9,x+53,119]);
        if(limp)curve('#bc8785',5,[x-39,143,x,152,x+40,145]);
      }else{
        const h=id==='exhausted'||id==='heartDazed'?18:id==='heartBashful'?29:id==='skeptical'&&side===1?24:
          id==='panic'||id==='heartPanic'?47:id==='dread'||id==='heartSorrow'?34:39;
        if(id==='exhausted')oval(x,149,41,8,'#b87579',side*.07);
        oval(x,121,57,h,entity?'#2c213e':'#fffbea',side*.07);
        curve(line,10,[x-59,118,x,121-2*h,x+56,119]);
        if(lovestruck){
          const glance=id==='heartBashful'?14:0;
          heart(x+glance,id==='heartBashful'?126:119,id==='heartPanic'||id==='heartDazed'?.62:.93,id==='heartDazed');
          if(id==='heartBashful'||id==='heartJoy')oval(x,174,30,9,'#d78c87',side*.12);
          if(id==='heartSorrow'){
            curve('#82a8bc',7,[x+side*31,144,x+side*33,162,x+side*28,178]);
            oval(x+side*28,179,5,8,'#99bdd0');
          }
        }
        else{
          oval(x+(id==='skeptical'?15:side*4),120,entity?23:fear?13:17,Math.min(h-2,fear?21:29),entity?'#eca5df':'#715869');
          oval(x+(id==='skeptical'?15:side*4),121,entity?4:fear?6:10,Math.min(h-3,fear?11:21),entity?'#3a1b42':'#3e2842');
          oval(x-5,112,entity?4:6,8,entity?'#fff0fb':'#fffdf3');
        }
      }
      const brow=id==='panic'||id==='heartPanic'?40:id==='dread'||id==='heartSorrow'?49:id==='skeptical'&&side===-1?45:61;
      if(id!=='emptyMouth')curve(dead?'#8e6468':line,dead?6:9,
        [x-45,brow+side*(fear?20:9),x,brow-10,x+40,brow-side*(fear?20:9)]);
      if(entity){
        curve('#aa668f',6,[x+side*49,143,x+side*41,161,x+side*33,171]);
        curve('#694565',4,[x+side*57,138,x+side*55,150,x+side*42,161]);
      }
    }
    if(id==='emptyMouth'){
      oval(255,222,37,12,'#9d5b62',-.06);oval(255,222,30,7,'#321b2a',-.06);
    }else if(id==='panic'||id==='heartPanic'){
      oval(255,215,28,26,'#78414f');oval(255,225,20,15,'#542a3d');
    }else if(id==='dread'||id==='vacant'||id==='rolledEyes'||id==='deathRest'){
      const w=id==='deathRest'?18:25,h=id==='rolledEyes'?14:id==='vacant'?8:5;
      oval(255,222,w+3,h+3,'#ac7774');oval(255,222,w,h,'#724852',-.035);
    }else if(id==='bracing'){
      oval(255,218,28,11,'#904f58');oval(255,216,23,6,'#f2ded0');
    }else if(id==='heartSorrow'||id==='heartDazed'){
      curve('#a56a77',7,[228,226,257,210,284,223]);
    }else if(id==='heartJoy'){
      oval(255,215,33,17,'#7f4057');oval(255,209,25,6,'#fff1e7');
    }else if(id==='softSmile'||id==='heartEyes'||id==='heartBashful'){
      curve('#a36162',7,[222,216,258,240,291,212]);
    }else if(entity){
      curve('#62344f',7,[223,225,255,214,290,219]);
      oval(254,48,9,16,'#a55f89');
    }else{
      curve('#a86a69',7,id==='exhausted'?[231,228,254,215,279,224]:[227,224,257,230,287,217]);
    }
    ctx.restore();
  });
  return atlas;
}
