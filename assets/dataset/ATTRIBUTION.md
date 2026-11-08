# Real scan and derived playback assets

**The King's Hall**, Skokloster Castle (Skoklosters slott).
Scan by **Erik Lernestål**. Description by Sara Dixon.

Original model: https://sketchfab.com/3d-models/the-king-s-hall-d18155613363445b9b68c0c67196d98d
Original model license: Creative Commons Attribution 4.0 (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/
Distributed as `skokloster-castle.glb` by Habitat Test Scenes:
https://huggingface.co/datasets/ai-habitat/habitat_test_scenes
The distribution's dataset card carries CC BY-NC 4.0. This noncommercial research portfolio retains that restriction for its distributed derived assets.

Changes: transformed Z-up source coordinates to Y-up; sampled 16,162 textured surface points below 3 m; derived a four-connected route from a 0.2 m occupancy grid with two-cell obstacle dilation; ray-traced 69 768×384 equirectangular camera captures at approximately 0.4 m intervals, camera height 1.05 m. Source SHA-256 is recorded in route.json. Images are virtual captures rendered from scanned geometry and texture, not a recording of a physical robot.

The robot, path timing and map reveal are simulated. The route is a conservative raster approximation, not a Habitat navmesh or benchmark trajectory. The map reveal counts scan points within 4 m of the route without occlusion testing; it is not a reconstruction quality metric. No semantic object detections or model inference are claimed. This is not an R2R/RxR evaluation run.

To regenerate: download the source GLB into this directory, install numpy, scipy, trimesh, Pillow and embreex, then run scripts/build_scan_route.py and scripts/render_scan.py from the repository. The source model is not needed at runtime. Keep upstream attribution and license notices when reusing derived assets.
