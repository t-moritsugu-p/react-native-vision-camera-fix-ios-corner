//
//  HybridBarcodeScanner.swift
//  VisionCameraBarcodeScanner
//
//  Created by Marc Rousavy on 08.02.26.
//

import MLKitBarcodeScanning
import MLKitVision
import NitroImage
import NitroModules
import VisionCamera

class HybridBarcodeScanner: HybridBarcodeScannerSpec {
  private let scanner: BarcodeScanner

  init(options: BarcodeScannerOptions) {
    self.scanner = BarcodeScanner.barcodeScanner(options: options.toMLKitOptions())
    super.init()
  }

  func scanCodes(frame: any HybridFrameSpec) throws -> [any HybridBarcodeSpec] {
    let mlImage = try frame.toMLImage()
    let coordinateConverter = frame.getBarcodeCoordinateSystemConverter()
    let barcodes = try scanner.results(in: mlImage)
    return barcodes.map {
      HybridBarcode(barcode: $0, coordinateConverter: coordinateConverter)
    }
  }

  func scanCodesAsync(frame: any HybridFrameSpec) throws -> Promise<[any HybridBarcodeSpec]> {
    let mlImage = try frame.toMLImage()
    let coordinateConverter = frame.getBarcodeCoordinateSystemConverter()
    return process(mlImage, coordinateConverter: coordinateConverter)
  }

  func scanCodesInImageAsync(image: any HybridImageSpec) throws -> Promise<[any HybridBarcodeSpec]> {
    let mlImage = try image.toMLImage()
    return process(mlImage, coordinateConverter: nil)
  }

  private func process(
    _ image: MLImage,
    coordinateConverter: BarcodeCoordinateSystemConverter?
  ) -> Promise<[any HybridBarcodeSpec]> {
    let promise = Promise<[any HybridBarcodeSpec]>()

    scanner.process(image) { barcodes, error in
      if let error {
        promise.reject(withError: error)
        return
      }
      if let barcodes {
        promise.resolve(
          withResult: barcodes.map {
            HybridBarcode(barcode: $0, coordinateConverter: coordinateConverter)
          })
      } else {
        promise.resolve(withResult: [])
      }
    }

    return promise
  }
}
