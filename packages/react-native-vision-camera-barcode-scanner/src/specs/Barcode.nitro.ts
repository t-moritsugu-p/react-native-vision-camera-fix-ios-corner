import type { Image } from 'react-native-nitro-image'
import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'
import type { createBarcodeScannerOutput } from '../factory'
import type { BarcodeFormat } from './BarcodeFormat'
import type { BarcodeScanner } from './BarcodeScanner.nitro'
import type { BarcodeValueType } from './BarcodeValueType'
import type { Point } from './Point'
import type { Rect } from './Rect'

/**
 * Represents a single detected Barcode.
 *
 * A {@linkcode Barcode} is produced via the
 * {@linkcode BarcodeScanner} or the Barcode Scanner
 * {@linkcode createBarcodeScannerOutput | CameraOutput}.
 *
 * See {@linkcode BarcodeScanner.scanCodes | BarcodeScanner.scanCodes(...)}
 * and {@linkcode BarcodeScanner.scanCodesInImageAsync | BarcodeScanner.scanCodesInImageAsync(...)}
 * for information about Barcode coordinate systems.
 *
 * @example
 * ```ts
 * const barcode = ...
 * console.log(`Barcode value: ${barcode.rawValue}`)
 * ```
 */
export interface Barcode
  extends HybridObject<{
    ios: 'swift'
    android: 'kotlin'
  }> {
  /**
   * Get the format of this {@linkcode Barcode}.
   * @see {@linkcode BarcodeFormat}
   */
  readonly format: BarcodeFormat

  /**
   * Get the {@linkcode Barcode}'s bounding box.
   *
   * The coordinates are relative to the input {@linkcode Frame}
   * or {@linkcode Image}.
   */
  readonly boundingBox: Rect
  /**
   * Get the {@linkcode Barcode}'s corner points.
   *
   * The coordinates are relative to the input {@linkcode Frame}
   * or {@linkcode Image}.
   */
  readonly cornerPoints: Point[]
  /**
   * Get the {@linkcode Barcode}'s corner points in Camera sensor coordinates.
   *
   * Pass these points to
   * `Camera.convertCameraPointToViewPoint(...)` to obtain coordinates relative
   * to the Preview View. This is `undefined` when scanning a static
   * {@linkcode Image}, because there is no Camera coordinate system.
   *
   * The Camera coordinate system is platform-defined and must be treated as
   * opaque. Do not assume these values are normalized.
   */
  readonly cameraCornerPoints: Point[] | undefined
  /**
   * Get the {@linkcode Barcode}'s axis-aligned bounding box in Camera sensor
   * coordinates.
   *
   * This box encloses all transformed corner points. If ML Kit does not return
   * corner points, the four corners of {@linkcode boundingBox} are transformed
   * instead. This is `undefined` when scanning a static {@linkcode Image}.
   */
  readonly cameraBoundingBox: Rect | undefined
  /**
   * Get the {@linkcode Barcode}'s value in a user-friendly format.
   */
  readonly displayValue: string | undefined
  /**
   * Get the {@linkcode Barcode}'s value in raw bytes.
   */
  readonly rawBytes: ArrayBuffer | undefined
  /**
   * Get the {@linkcode Barcode}'s raw value as a string.
   */
  readonly rawValue: string | undefined
  /**
   * Get the {@linkcode Barcode}'s value's type.
   * @see {@linkcode BarcodeValueType}
   */
  readonly valueType: BarcodeValueType
}
