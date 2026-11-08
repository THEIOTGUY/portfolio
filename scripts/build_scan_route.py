import json
from collections import deque
from pathlib import Path
import numpy as np
import trimesh
from scipy.ndimage import binary_dilation, binary_closing, label

root = Path(__file__).resolve().parents[1] / 'assets' / 'dataset'
m = trimesh.load(root / 'skokloster-castle.glb').to_mesh()
v = np.array(m.vertices)
# Source is Z-up; browser coordinates are X, Z, -Y.
v = v[:, [0, 2, 1]] * [1, 1, -1]
origin = v[:, [0, 2]].min(axis=0) - .5
step = .2
shape = tuple((np.ceil((v[:, [0, 2]].max(axis=0)-origin)/step).astype(int)+3).tolist())
floor = np.zeros(shape, bool)
blocked = np.zeros(shape, bool)
for mask, output in [(abs(v[:,1]) < .13, floor), ((v[:,1] > .18) & (v[:,1] < 1.35), blocked)]:
    cells = np.floor((v[mask][:, [0,2]]-origin)/step).astype(int)
    output[cells[:,0],cells[:,1]] = True
floor = binary_closing(floor, iterations=2)
blocked = binary_dilation(blocked, iterations=2)
free = floor & ~blocked
labs, n = label(free)
sizes = np.bincount(labs.ravel()); sizes[0] = 0
free = labs == sizes.argmax()
start = tuple(np.argwhere(free)[0])
def bfs(start):
    q=deque([start]); parents={start:None}; end=start
    while q:
        end=q.popleft()
        for dx,dz in [(1,0),(-1,0),(0,1),(0,-1)]:
            nxt=(end[0]+dx,end[1]+dz)
            if 0<=nxt[0]<shape[0] and 0<=nxt[1]<shape[1] and free[nxt] and nxt not in parents:
                parents[nxt]=end; q.append(nxt)
    return end, parents
a,_=bfs(start);b,parents=bfs(a)
route=[];p=b
while p is not None:
    route.append([round(float(origin[0]+(p[0]+.5)*step),3),.02,round(float(origin[1]+(p[1]+.5)*step),3)])
    p=parents[p]
route.reverse()
result={'source':'Habitat Test Scenes / Skokloster Castle','route_method':'Four-connected breadth-first path on scan-derived 0.2 m occupancy grid; 0.4 m obstacle dilation. Illustrative robot route, not a recorded experiment or Habitat navmesh.', 'spacing':step,'clearance':.4,'route':route,'navigable_cells':int(free.sum())}
(root/'route.json').write_text(json.dumps(result,separators=(',',':')))
print('Navigable cells',free.sum(),'Route points',len(route),'Length m',(len(route)-1)*step)
