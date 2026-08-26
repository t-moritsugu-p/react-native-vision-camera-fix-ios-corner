//
//  BarcodeCoordinateSystemConverter.swift
//  VisionCameraBarcodeScanner
//

import Foundation
import VisionCamera

/// Converts ML Kit barcode points into the normalized capture-device coordinate
/// space expected by VisionCamera on iOS.
///
/// ML Kit reports geometry in the detected image's view coordinate system, so
/// the orientation and mirroring supplied on MLImage are already reflected in
/// each point. The only remaining operation is scaling by the oriented image
/// dimensions. This is equivalent to VisionCamera's
/// FrameCoordinateSystemConverter for the same orientation and mirror state.
final class BarcodeCoordinateSystemConverter {
  private let barcodeWidth: Double
  private let barcodeHeight: Double

  init(
    width: Double,
    height: Double,
    orientation: CameraOrientation,
    isMirrored _: Bool
  ) {
    switch orientation {
    case .up, .down:
      self.barcodeWidth = width
      self.barcodeHeight = height
    case .left, .right:
      self.barcodeWidth = height
      self.barcodeHeight = width
    }
  }

  func convertBarcodePointToCameraPoint(_ barcodePoint: Point) -> Point {
    return Point(
      x: barcodePoint.x / barcodeWidth,
      y: barcodePoint.y / barcodeHeight)
  }
}
