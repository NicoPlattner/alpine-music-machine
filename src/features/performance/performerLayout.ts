export const DEFAULT_PERFORMER_WIDTH_RATIO = 0.6156
export const MIN_PERFORMER_WIDTH = 616
export const MAX_PERFORMER_WIDTH = 1180
export const MAX_PERFORMER_HEIGHT_RATIO = 0.60705
export const PERFORMER_VERTICAL_ANCHOR = 0.445

export interface PerformerRenderRect { x: number; y: number; width: number; height: number }

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
