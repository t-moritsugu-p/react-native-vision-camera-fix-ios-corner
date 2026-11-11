import AVFoundation
import CoreGraphics
import VisionCamera

// Replace only Nitro-backed data types, not the production converter code.
typealias CameraOrientation = VisionCamera.CameraOrientation
struct Point {
  let x: Double
  let y: Double
}

@main
enum CoordinateTests {
  static func check(_ actual: CGPoint, _ expected: CGPoint, _ label: String) {
    precondition(abs(actual.x - expected.x) < 1e-10, "\(label): x=\(actual.x), expected \(expected.x)")
    precondition(abs(actual.y - expected.y) < 1e-10, "\(label): y=\(actual.y), expected \(expected.y)")
  }

  static func main() {
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault, 640, 480, kCVPixelFormatType_32BGRA, nil, &buffer)
    precondition(status == kCVReturnSuccess)
    let pixelBuffer = buffer!
    let input = CGPoint(x: 123, y: 234)
    let cases: [(CameraOrientation, Bool, CGPoint)] = [
      (.up, false, CGPoint(x: 0.1921875, y: 0.4875)),
      (.up, true, CGPoint(x: 0.8078125, y: 0.4875)),
      (.down, false, CGPoint(x: 0.8078125, y: 0.5125)),
      (.down, true, CGPoint(x: 0.1921875, y: 0.5125)),
      (.left, false, CGPoint(x: 0.5125, y: 0.1921875)),
      (.left, true, CGPoint(x: 0.5125, y: 0.8078125)),
      (.right, false, CGPoint(x: 0.4875, y: 0.8078125)),
      (.right, true, CGPoint(x: 0.4875, y: 0.1921875)),
    ]
    var checks = 0
    for (orientation, mirrored, expected) in cases {
      let label = "\(orientation), mirror=\(mirrored)"
      let transform = FrameCoordinateSystemConverter.getFrameToCameraMatrix(
        pixelBuffer: pixelBuffer, orientation: orientation, isMirrored: mirrored)
      check(input.applying(transform), expected, "core \(label)")
      let inverse = FrameCoordinateSystemConverter.getCameraToFrameMatrix(
        pixelBuffer: pixelBuffer, orientation: orientation, isMirrored: mirrored)
      check(expected.applying(inverse), input, "core inverse \(label)")
      checks += 2

      // Synthetic oriented-image points, not captured ML Kit observations.
      // Test the actual scanner's normalization independently of the core's
      // transform: feeding output-derived inputs would hide orientation bugs.
      let converter = BarcodeCoordinateSystemConverter(
        width: 640, height: 480, orientation: orientation, isMirrored: mirrored)
      let normalized = converter.convertBarcodePointToCameraPoint(Point(x: 123, y: 234))
      let expectedNormalized: CGPoint
      switch orientation {
      case .up, .down: expectedNormalized = CGPoint(x: 0.1921875, y: 0.4875)
      case .left, .right: expectedNormalized = CGPoint(x: 0.25625, y: 0.365625)
      }
      check(CGPoint(x: normalized.x, y: normalized.y), expectedNormalized, "scanner \(label)")
      let origin = converter.convertBarcodePointToCameraPoint(Point(x: 0, y: 0))
      check(CGPoint(x: origin.x, y: origin.y), .zero, "scanner origin \(label)")
      checks += 2
    }
    // Independent fixed inputs at two resolutions, no inverse helper.
    for (width, height, x, y) in [(640.0, 480.0, 120.0, 480.0), (4032.0, 3024.0, 756.0, 3024.0)] {
      let converter = BarcodeCoordinateSystemConverter(
        width: width, height: height, orientation: .right, isMirrored: false)
      let result = converter.convertBarcodePointToCameraPoint(Point(x: x, y: y))
      check(CGPoint(x: result.x, y: result.y), CGPoint(x: 0.25, y: 0.75), "resolution \(width)")
      checks += 1
    }
    print("PASS: \(checks) checks against production Swift converters (host types; no ML Kit/Nitro/device coverage)")
  }
}
