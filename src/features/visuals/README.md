# Visuals
Future stage visual system boundary.

Leo's visual lives in `leoPerformer/`. It ports the complete composition from `pointcloud-demo/overlay.html`: the music-reactive mountain point cloud from `background-flat.html` and the microphone-reactive webcam point cloud from `index.html`. It samples the app's existing segmented performer and confidence-mask canvases and never owns a camera or segmentation model. In development, set `VITE_PERFORMER_VISUAL=segmented` to compare it with the photographic segmented performer; the default is `leo`.
