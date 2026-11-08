import json, hashlib
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image
from trimesh.ray.ray_pyembree import RayMeshIntersector

root=Path(__file__).resolve().parents[1] / 'assets' / 'dataset'
mesh=trimesh.load(root/'skokloster-castle.glb').to_mesh()
image=np.asarray(mesh.visual.material.baseColorTexture.convert('RGB'))
uv=mesh.visual.uv
vertices=np.array(mesh.vertices)[:,[0,2,1]]*[1,1,-1]
mesh.vertices=vertices
triangles=mesh.triangles
def colors(points,faces):
    bary=trimesh.triangles.points_to_barycentric(triangles[faces],points)
    tex=(uv[mesh.faces[faces]]*bary[:,:,None]).sum(axis=1)
    xx=np.clip((tex[:,0]*image.shape[1]).astype(int),0,image.shape[1]-1)
    yy=np.clip(((1-tex[:,1])*image.shape[0]).astype(int),0,image.shape[0]-1)
    return image[yy,xx]
np.random.seed(10)
p,faces=trimesh.sample.sample_surface(mesh,45000)
mask=(p[:,1]<3)&(p[:,1]>-.25)
p=p[mask];faces=faces[mask]
c=colors(p,faces)
data=np.column_stack([np.round(p,3),c]).tolist()
(root/'scan-points.json').write_text(json.dumps(data,separators=(',',':')))
route=json.loads((root/'route.json').read_text())
poses=route['route'][::2]
if poses[-1]!=route['route'][-1]:poses.append(route['route'][-1])
route['captures']=poses
route['capture_spacing_m']=.4
route['source_sha256']=hashlib.sha256((root/'skokloster-castle.glb').read_bytes()).hexdigest()
(root/'route.json').write_text(json.dumps(route,separators=(',',':')))
W,H=768,384
az=((np.arange(W)+.5)/W-.5)*2*np.pi
el=(.5-(np.arange(H)+.5)/H)*np.pi
a,e=np.meshgrid(az,el)
directions=np.column_stack([(np.cos(e)*np.cos(a)).ravel(),np.sin(e).ravel(),(np.cos(e)*np.sin(a)).ravel()])
ray=RayMeshIntersector(mesh)
(root/'panorama').mkdir(exist_ok=True)
for i,pose in enumerate(poses):
    origin=np.array(pose)+[0,1.05,0]
    origins=np.broadcast_to(origin,directions.shape).copy()
    locations,index,face=ray.intersects_location(origins,directions,multiple_hits=False)
    pixels=np.full((W*H,3),22,dtype=np.uint8)
    pixels[index]=colors(locations,face)
    Image.fromarray(pixels.reshape(H,W,3)).save(root/'panorama'/f'{i:03d}.jpg',quality=80)
    print(f'Capture {i+1}/{len(poses)}',flush=True)
print('Scan points',len(p),'captures',len(poses))
