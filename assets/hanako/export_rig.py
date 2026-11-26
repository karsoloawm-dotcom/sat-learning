"""Rebuild the Afterlife rig from Hanako's original packed v3 export."""
import base64
import gzip
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[2]
raw = gzip.decompress(base64.b64decode((root / "reaper-girl.txt").read_bytes()))
offset = 4 + struct.unpack_from("<I", raw)[0]
header = json.loads(raw[4:offset])
data = bytearray(raw[offset:])
bones = header["bones"]
header["rigVersion"] = 2
header["clipBones"] = [b["n"] for b in bones]
names = header["clipBones"]
rest = []
for bone in bones:
    parent = rest[bone["p"]] if bone["p"] >= 0 else [0, 0, 0]
    rest.append([a+b for a,b in zip(parent, bone["t"])])

controls = {}
for side, sign in (("L",1), ("R",-1)):
    for name, parent, pivot, axis, start, width in (
        ("toe","foot",[0,-.038,.076],2,.057,.041),
        ("fingers","hand",[sign*.049,0,0],0,.032,.036),
        ("twist","forearm",[sign*.096,0,.01],0,.055,.12)):
        index = names.index(parent+"."+side)
        controls[index] = (len(bones),axis,sign if axis==0 else 1,start,width)
        bones.append(dict(n=name+"."+side,p=index,t=pivot))

for v in range(header["nv"]):
    p = struct.unpack_from("<3f", data, header["pos"]+12*v)
    slot = header["si"] + 4*v
    weight = header["sw"] + 16*v
    combined = {}
    for b,w in zip(data[slot:slot+4], struct.unpack_from("<4f",data,weight)):
        if w <= 0: continue
        # Several legacy shoe panels followed the opposite ankle. Mirror those
        # influences before deriving the toe weights, across all garment states.
        if abs(p[0]) > .027 and p[1] < .54 and names[b].split(".")[0] in ("thigh","shin","foot"):
            b = names.index(names[b].split(".")[0]+(".L" if p[0]>0 else ".R"))
        if b in controls:
            child,axis,sign,start,width = controls[b]
            t = min(1,max(0,((p[axis]-rest[b][axis])*sign-start)/width))
            t = t*t*(3-2*t)
            combined[child] = combined.get(child,0) + w*t
            w *= 1-t
        combined[b] = combined.get(b,0)+w
    pairs = sorted(combined.items(),key=lambda q:-q[1])[:4]
    total = sum(w for _,w in pairs)
    assert total > 0
    pairs += [(0,0)]*(4-len(pairs))
    data[slot:slot+4] = bytes(b for b,_ in pairs)
    struct.pack_into("<4f",data,weight,*(w/total for _,w in pairs))
# Turn open garment boundaries inward. Weld UV splits for boundary detection
# only, retaining each source UV and all four joint weights on the new lining.
from collections import Counter, defaultdict
formats = {"pos":"3f","nrm":"3f","uv":"2f","si":"4B","sw":"4f"}
streams = {k:list(struct.iter_unpack("<"+fmt, data[header[k]:header[k]+header["nv"]*struct.calcsize("<"+fmt)]))
           for k,fmt in formats.items()}
triangles = list(struct.unpack_from("<"+"H"*header["ni"],data,header["idx"]))
start,count,material = header["groups"][-1]
assert start+count == len(triangles) and material==2
header["hems"]={}
for garment in ("shirt","shorts","socks"):
    first,length=header["cloth"][garment]
    edge_count=Counter()
    oriented={}
    aliases=defaultdict(list)
    def point(v): return tuple(round(c,5) for c in streams["pos"][v])
    for v in range(first,first+length): aliases[point(v)].append(v)
    for i in range(start,start+count,3):
        a,b,c=triangles[i:i+3]
        if not all(first<=v<first+length for v in (a,b,c)): continue
        for u,v in ((a,b),(b,c),(c,a)):
            key=tuple(sorted((point(u),point(v))))
            edge_count[key]+=1
            oriented[key]=(u,v)
    begin=len(streams["pos"])
    inner={}
    for key,n in edge_count.items():
        if n!=1:continue
        a,b=oriented[key]
        for v in (a,b):
            if v in inner:continue
            normals=[streams["nrm"][k] for k in aliases[point(v)]]
            normal=[sum(t)/len(normals) for t in zip(*normals)]
            norm=max(.001,sum(c*c for c in normal)**.5)
            inner[v]=len(streams["pos"])
            for k in streams:
                value=streams[k][v]
                if k=="pos":value=tuple(c-.0028*d/norm for c,d in zip(value,normal))
                streams[k].append(value)
        triangles.extend((b,a,inner[a],b,inner[a],inner[b]))
    header["hems"][garment]=[begin,len(streams["pos"])-begin]
assert len(streams["pos"])<65536
header["nv"]=len(streams["pos"])
header["ni"]=len(triangles)
header["groups"][-1][1]=len(triangles)-start
# Repack referenced streams so the shipped download contains no stale arrays.
old=data
data=bytearray()
def store(block):
    data.extend(bytes(-len(data)%4))
    offset=len(data)
    data.extend(block)
    return offset
for key,fmt in formats.items():
    item=struct.Struct("<"+fmt)
    header[key]=store(b"".join(item.pack(*row) for row in streams[key]))
header["idx"]=store(struct.pack("<"+"H"*len(triangles),*triangles))
for clip in header["clips"].values():
    for key,width in (("q",len(names)*4),("h",3)):
        off=clip[key]
        clip[key]=store(old[off:off+4*clip["n"]*width])
for key in ("body","face","ctex"):
    off,size=header[key]
    header[key]=[store(old[off:off+size]),size]
encoded = json.dumps(header,separators=(",",":")).encode()
encoded += b" "*(-len(encoded)%4)
packed = struct.pack("<I",len(encoded))+encoded+data
Path(__file__).with_name("hanako-rig-2.txt").write_bytes(base64.b64encode(gzip.compress(packed,mtime=0)))
