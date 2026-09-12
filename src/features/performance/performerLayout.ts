export const DEFAULT_PERFORMER_WIDTH_RATIO = 0.6156
export const MIN_PERFORMER_WIDTH = 616
export const MAX_PERFORMER_WIDTH = 1180
export const MAX_PERFORMER_HEIGHT_RATIO = 0.60705
export const PERFORMER_VERTICAL_ANCHOR = 0.445

export interface PerformerRenderRect { x: number; y: number; width: number; height: number }

const LEO_CAMERA_FOV = 50
const LEO_CAMERA_Z = 2.4
const LEO_ZOOM = 0.9
const LEO_Y_OFFSET = -0.12

export function getPerformerRenderRect(stageWidth: number, stageHeight: number, sourceAspect: number): PerformerRenderRect {
  let width = Math.min(MAX_PERFORMER_WIDTH, Math.max(MIN_PERFORMER_WIDTH, stageWidth * DEFAULT_PERFORMER_WIDTH_RATIO))
  let height = width / sourceAspect
  const maximumHeight = stageHeight * MAX_PERFORMER_HEIGHT_RATIO
  if (height > maximumHeight) {
    const fitScale = maximumHeight / height
    width *= fitScale
    height = maximumHeight
  }
  return { x: (stageWidth - width) / 2, y: stageHeight * PERFORMER_VERTICAL_ANCHOR - height / 2, width, height }
}

/** Screen-space bounds of Leo's Three.js source plane, including its projection and offset. */
export function getLeoPerformerRenderRect(stageWidth: number, stageHeight: number, sourceAspect: number): PerformerRenderRect {
  const visibleWorldHeight = 2 * LEO_CAMERA_Z * Math.tan(LEO_CAMERA_FOV * Math.PI / 360)
  const height = stageHeight * (2 * LEO_ZOOM / visibleWorldHeight)
  const width = height * sourceAspect
  const centerY = stageHeight * (0.5 - LEO_Y_OFFSET / visibleWorldHeight)
  return { x: (stageWidth - width) / 2, y: centerY - height / 2, width, height }
}
