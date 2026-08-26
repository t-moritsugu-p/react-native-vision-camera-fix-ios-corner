//
//  HybridBarcode.swift
//  VisionCameraBarcodeScanner
//
//  Created by Marc Rousavy on 08.02.26.
//

import MLKitBarcodeScanning
import NitroModules

final class HybridBarcode: HybridBarcodeSpec {
  private let barcode: Barcode
  private let originalCornerPoints: [Point]
  let cameraCornerPoints: [Point]?
  let cameraBoundingBox: Rect?

  init(
    barcode: Barcode,
    coordinateConverter: BarcodeCoordinateSystemConverter? = nil
  ) {
    self.barcode = barcode

    let originalCornerPoints: [Point] =
      barcode.cornerPoints?.map { value in
        guard let point = value as? CGPoint else {
          return Point(x: 0.0, y: 0.0)
        }
        return Point(x: point.x, y: point.y)
      } ?? []
    self.originalCornerPoints = originalCornerPoints

    if let coordinateConverter {
      let cameraCornerPoints = originalCornerPoints.map {
        coordinateConverter.convertBarcodePointToCameraPoint($0)
      }
      self.cameraCornerPoints = cameraCornerPoints

      let sourcePoints: [Point]
      if originalCornerPoints.isEmpty {
        let frame = barcode.frame
        let left = frame.origin.x
        let right = frame.origin.x + frame.size.width
        let top = frame.origin.y
        let bottom = frame.origin.y + frame.size.height
        sourcePoints = [
          Point(x: left, y: top),
          Point(x: right, y: top),
          Point(x: right, y: bottom),
          Point(x: left, y: bottom),
        ]
      } else {
        sourcePoints = originalCornerPoints
      }

      let cameraBoxPoints = sourcePoints.map {
        coordinateConverter.convertBarcodePointToCameraPoint($0)
      }
      self.cameraBoundingBox = Rect(
        left: cameraBoxPoints.map(\.x).min() ?? 0.0,
        right: cameraBoxPoints.map(\.x).max() ?? 0.0,
        top: cameraBoxPoints.map(\.y).min() ?? 0.0,
        bottom: cameraBoxPoints.map(\.y).max() ?? 0.0)
    } else {
      self.cameraCornerPoints = nil
      self.cameraBoundingBox = nil
    }

    super.init()
  }

  var format: BarcodeFormat {
    return BarcodeFormat(fromMLKitFormat: barcode.format)
  }

  var boundingBox: Rect {
    let frame = barcode.frame
    return Rect(
      left: frame.origin.x,
      right: frame.origin.x + frame.size.width,
      top: frame.origin.y,
      bottom: frame.origin.y + frame.size.height)
  }

  var cornerPoints: [Point] {
    return originalCornerPoints
  }

  var displayValue: String? {
    return barcode.displayValue
  }

  lazy var rawBytes: ArrayBuffer? = {
    guard let data = barcode.rawData else {
      return nil
    }
    return try? ArrayBuffer.copy(data: data)
  }()

  var rawValue: String? {
    return barcode.rawValue
  }

  var valueType: BarcodeValueType {
    return BarcodeValueType(fromMLKitValueType: barcode.valueType)
  }
}
