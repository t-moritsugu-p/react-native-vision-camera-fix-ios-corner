//
//  BarcodeCoordinateSystemConverter.swift
//  VisionCameraBarcodeScanner
//

import Foundation
import VisionCamera

/// Converts ML Kit barcode points into the normalized capture-device coordinate
/// space expected by VisionCamera on iOS.
///
/// Assumes ML Kit points already reflect the orientation and mirroring supplied
/// on MLImage, so only scaling by the oriented image dimensions remains.
/// Host tests verify this normalization, not the ML Kit assumption. Confirm
/// detected points against the actual preview on devices for each orientation
/// and mirror state before claiming equivalence with the core Frame converter.
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
