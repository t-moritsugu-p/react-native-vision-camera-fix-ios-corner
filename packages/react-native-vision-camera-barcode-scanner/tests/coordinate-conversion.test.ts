import { describe, expect, test } from 'bun:test'

// Arithmetic model tests only: these do not execute Swift/Kotlin, ML Kit,
// CameraX or Nitro. Run test:native:ios for the production Swift converters.
// Device tests are still required to validate detected points on the preview.

interface Point {
  x: number
  y: number
}

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

type Orientation = 'up' | 'right' | 'down' | 'left'

function frameToAndroidBarcodePoint(
  point: Point,
  frameWidth: number,
  frameHeight: number,
  rotationDegrees: number,
): Point {
  switch (rotationDegrees) {
    case 0:
      return point
    case 90:
      return { x: frameHeight - point.y, y: point.x }
    case 180:
      return { x: frameWidth - point.x, y: frameHeight - point.y }
    case 270:
      return { x: point.y, y: frameWidth - point.x }
    default:
      throw new Error(`Unsupported rotation: ${rotationDegrees}`)
  }
}

function androidBarcodeToFramePoint(
  point: Point,
  frameWidth: number,
  frameHeight: number,
  rotationDegrees: number,
): Point {
  switch (rotationDegrees) {
    case 0:
      return point
    case 90:
      return { x: point.y, y: frameHeight - point.x }
    case 180:
      return { x: frameWidth - point.x, y: frameHeight - point.y }
    case 270:
      return { x: frameWidth - point.y, y: point.x }
    default:
      throw new Error(`Unsupported rotation: ${rotationDegrees}`)
  }
}

function applyCameraTransform(point: Point): Point {
  // A non-normalizing affine buffer-to-sensor transform. Android Camera
  // coordinates are deliberately opaque and may be outside 0...1.
  return {
    x: 1.5 * point.x - 0.25 * point.y + 120,
    y: 0.5 * point.x + 2 * point.y - 80,
  }
}

function cameraToAndroidPreviewPoint(
  point: Point,
  previewWidth: number,
  isMirrored: boolean,
): Point {
  return isMirrored ? { x: previewWidth - point.x, y: point.y } : point
}

function modelIosFrameToCameraPoint(
  framePoint: Point,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
  isMirrored: boolean,
): Point {
  // CoreGraphics concatenates the mirror before the orientation transform.
  const normalizedX = framePoint.x / frameWidth
  const x = isMirrored ? 1 - normalizedX : normalizedX
  const y = framePoint.y / frameHeight

  let cameraPoint: Point
  switch (orientation) {
    case 'up':
      cameraPoint = { x, y }
      break
    case 'down':
      cameraPoint = { x: 1 - x, y: 1 - y }
      break
    case 'left':
      cameraPoint = { x: 1 - y, y: x }
      break
    case 'right':
      cameraPoint = { x: y, y: 1 - x }
      break
  }

  return cameraPoint
}

function iosBarcodeToCameraPoint(
  barcodePoint: Point,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
): Point {
  const swapsDimensions = orientation === 'left' || orientation === 'right'
  const barcodeWidth = swapsDimensions ? frameHeight : frameWidth
  const barcodeHeight = swapsDimensions ? frameWidth : frameHeight
  return {
    x: barcodePoint.x / barcodeWidth,
    y: barcodePoint.y / barcodeHeight,
  }
}

function transformGeometry(
  cornerPoints: Point[],
  boundingBox: Rect,
  transform: (point: Point) => Point,
): { cameraCornerPoints: Point[]; cameraBoundingBox: Rect } {
  const cameraCornerPoints = cornerPoints.map(transform)
  const sourcePoints =
    cornerPoints.length > 0
      ? cornerPoints
      : [
          { x: boundingBox.left, y: boundingBox.top },
          { x: boundingBox.right, y: boundingBox.top },
          { x: boundingBox.right, y: boundingBox.bottom },
          { x: boundingBox.left, y: boundingBox.bottom },
        ]
  const cameraBoxPoints = sourcePoints.map(transform)

  return {
    cameraCornerPoints,
    cameraBoundingBox: {
      left: Math.min(...cameraBoxPoints.map((point) => point.x)),
      right: Math.max(...cameraBoxPoints.map((point) => point.x)),
      top: Math.min(...cameraBoxPoints.map((point) => point.y)),
      bottom: Math.max(...cameraBoxPoints.map((point) => point.y)),
    },
  }
}

function expectPoint(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 10)
  expect(actual.y).toBeCloseTo(expected.y, 10)
}

describe('Android coordinate arithmetic model (not native integration)', () => {
  const frameWidth = 640
  const frameHeight = 480
  const framePoint = { x: 123, y: 234 }

  for (const rotationDegrees of [0, 90, 180, 270]) {
    test(`undoes ML Kit's ${rotationDegrees}-degree rotation before the CameraX matrix`, () => {
      const barcodePoint = frameToAndroidBarcodePoint(
        framePoint,
        frameWidth,
        frameHeight,
        rotationDegrees,
      )
      const convertedFramePoint = androidBarcodeToFramePoint(
        barcodePoint,
        frameWidth,
        frameHeight,
        rotationDegrees,
      )

      expectPoint(convertedFramePoint, framePoint)
      expectPoint(
        applyCameraTransform(convertedFramePoint),
        applyCameraTransform(framePoint),
      )
    })
  }

  test('keeps sensor coordinates independent of front-preview mirroring', () => {
    const cameraPoint = applyCameraTransform(framePoint)
    const previewWidth = 1000
    const backViewPoint = cameraToAndroidPreviewPoint(
      cameraPoint,
      previewWidth,
      false,
    )
    const frontViewPoint = cameraToAndroidPreviewPoint(
      cameraPoint,
      previewWidth,
      true,
    )

    expectPoint(backViewPoint, cameraPoint)
    expectPoint(frontViewPoint, {
      x: previewWidth - cameraPoint.x,
      y: cameraPoint.y,
    })
  })
})

describe('iOS coordinate arithmetic model (not ML Kit observations)', () => {
  const frameWidth = 640
  const frameHeight = 480
  const framePoint = { x: 123, y: 234 }

  // Fixed expected values, independently checked by the native CoreGraphics
  // harness. Do not derive test inputs by reversing the function under test.
  const cases: [Orientation, boolean, Point][] = [
    ['up', false, { x: 0.1921875, y: 0.4875 }],
    ['up', true, { x: 0.8078125, y: 0.4875 }],
    ['down', false, { x: 0.8078125, y: 0.5125 }],
    ['down', true, { x: 0.1921875, y: 0.5125 }],
    ['left', false, { x: 0.5125, y: 0.1921875 }],
    ['left', true, { x: 0.5125, y: 0.8078125 }],
    ['right', false, { x: 0.4875, y: 0.8078125 }],
    ['right', true, { x: 0.4875, y: 0.1921875 }],
  ]
  for (const [orientation, isMirrored, expected] of cases) {
    test(`frame model: ${orientation}, mirror=${isMirrored}`, () => {
      expectPoint(
        modelIosFrameToCameraPoint(
          framePoint,
          frameWidth,
          frameHeight,
          orientation,
          isMirrored,
        ),
        expected,
      )
    })
  }

  for (const orientation of ['up', 'right', 'down', 'left'] as const) {
    test(`normalizes synthetic image coordinates: ${orientation}`, () => {
      const expected =
        orientation === 'up' || orientation === 'down'
          ? { x: 0.1921875, y: 0.4875 }
          : { x: 0.25625, y: 0.365625 }
      expectPoint(
        iosBarcodeToCameraPoint({ x: 123, y: 234 }, 640, 480, orientation),
        expected,
      )
    })
  }
})

describe('camera bounding boxes', () => {
  const boundingBox = { left: 0, right: 20, top: 0, bottom: 20 }
  const rotateAndShear = ({ x, y }: Point): Point => ({
    x: x - y,
    y: x + y,
  })

  test('uses every transformed corner point', () => {
    const result = transformGeometry(
      [
        { x: 10, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 20 },
        { x: 0, y: 10 },
      ],
      boundingBox,
      rotateAndShear,
    )

    expect(result.cameraBoundingBox).toEqual({
      left: -10,
      right: 10,
      top: 10,
      bottom: 30,
    })
  })

  test('falls back to all four original bounding-box corners', () => {
    const result = transformGeometry([], boundingBox, rotateAndShear)

    expect(result.cameraCornerPoints).toEqual([])
    expect(result.cameraBoundingBox).toEqual({
      left: -20,
      right: 20,
      top: 0,
      bottom: 40,
    })
  })
})
