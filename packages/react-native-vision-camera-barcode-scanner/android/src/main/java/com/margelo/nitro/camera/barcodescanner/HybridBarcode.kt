package com.margelo.nitro.camera.barcodescanner

import com.google.mlkit.vision.barcode.common.Barcode
import com.margelo.nitro.camera.barcodescanner.extensions.fromMLBarcodeFormat
import com.margelo.nitro.camera.barcodescanner.extensions.fromMLBarcodeValueType
import com.margelo.nitro.core.ArrayBuffer

class HybridBarcode(
  private val barcode: Barcode,
  coordinateConverter: BarcodeCoordinateSystemConverter? = null,
) : HybridBarcodeSpec() {
  private val originalCornerPoints: Array<Point> =
    barcode.cornerPoints
      ?.map { point -> Point(point.x.toDouble(), point.y.toDouble()) }
      ?.toTypedArray()
      ?: emptyArray()

  override val cameraCornerPoints: Array<Point>? =
    coordinateConverter?.let { converter ->
      originalCornerPoints
        .map(converter::convertBarcodePointToCameraPoint)
        .toTypedArray()
    }

  override val cameraBoundingBox: Rect? =
    coordinateConverter?.let { converter ->
      val sourcePoints =
        if (originalCornerPoints.isNotEmpty()) {
          originalCornerPoints
        } else {
          boundingBoxCorners
        }
      val cameraPoints = sourcePoints.map(converter::convertBarcodePointToCameraPoint)
      cameraPoints.toBoundingBox()
    }

  override val format: BarcodeFormat
    get() = BarcodeFormat.fromMLBarcodeFormat(barcode.format)
  override val boundingBox: Rect
    get() {
      val box = barcode.boundingBox ?: return Rect(0.0, 0.0, 0.0, 0.0)
      return Rect(box.left.toDouble(), box.right.toDouble(), box.top.toDouble(), box.bottom.toDouble())
    }
  override val cornerPoints: Array<Point>
    get() = originalCornerPoints
  override val displayValue: String?
    get() = barcode.displayValue
  override val rawBytes: ArrayBuffer? by lazy {
    val bytes = barcode.rawBytes ?: return@lazy null
    return@lazy ArrayBuffer.copy(bytes)
  }
  override val rawValue: String?
    get() = barcode.rawValue
  override val valueType: BarcodeValueType
    get() = BarcodeValueType.fromMLBarcodeValueType(barcode.valueType)

  private val boundingBoxCorners: Array<Point>
    get() {
      val box = boundingBox
      return arrayOf(
        Point(box.left, box.top),
        Point(box.right, box.top),
        Point(box.right, box.bottom),
        Point(box.left, box.bottom),
      )
    }

  private fun List<Point>.toBoundingBox(): Rect {
    if (isEmpty()) return Rect(0.0, 0.0, 0.0, 0.0)

    var minX = Double.POSITIVE_INFINITY
    var maxX = Double.NEGATIVE_INFINITY
    var minY = Double.POSITIVE_INFINITY
    var maxY = Double.NEGATIVE_INFINITY
    for (point in this) {
      minX = minOf(minX, point.x)
      maxX = maxOf(maxX, point.x)
      minY = minOf(minY, point.y)
      maxY = maxOf(maxY, point.y)
    }
    return Rect(minX, maxX, minY, maxY)
  }
}
