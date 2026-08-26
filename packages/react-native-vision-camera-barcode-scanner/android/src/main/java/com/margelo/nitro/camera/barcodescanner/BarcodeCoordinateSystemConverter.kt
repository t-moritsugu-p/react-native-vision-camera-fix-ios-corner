package com.margelo.nitro.camera.barcodescanner

import android.graphics.Matrix
import androidx.camera.core.ImageProxy

/**
 * Converts ML Kit's rotation-adjusted barcode coordinates to CameraX sensor
 * coordinates, which is the coordinate space expected by VisionCamera's
 * Preview View conversion APIs.
 *
 * All ImageProxy-derived values are copied in the constructor so this object
 * remains safe to use after the ImageProxy has been closed.
 */
class BarcodeCoordinateSystemConverter(
  frameWidth: Double,
  frameHeight: Double,
  rotationDegrees: Int,
  sensorToBufferTransformMatrix: Matrix,
) {
  constructor(image: ImageProxy) : this(
    image.width.toDouble(),
    image.height.toDouble(),
    image.imageInfo.rotationDegrees,
    image.imageInfo.sensorToBufferTransformMatrix,
  )

  private val barcodeToFrame =
    BarcodeImageCoordinateConverter(frameWidth, frameHeight, rotationDegrees)
  private val bufferToSensorTransformMatrix =
    Matrix().also { matrix ->
      require(sensorToBufferTransformMatrix.invert(matrix)) {
        "Cannot invert the CameraX sensor-to-buffer transform matrix!"
      }
    }

  fun convertBarcodePointToCameraPoint(barcodePoint: Point): Point {
    val framePoint = barcodeToFrame.convertBarcodePointToFramePoint(barcodePoint)
    val coordinates = floatArrayOf(framePoint.x.toFloat(), framePoint.y.toFloat())
    bufferToSensorTransformMatrix.mapPoints(coordinates)
    return Point(coordinates[0].toDouble(), coordinates[1].toDouble())
  }
}

/**
 * ML Kit reports points after applying InputImage.rotationDegrees, while
 * CameraX's sensorToBufferTransformMatrix targets the unrotated ImageProxy
 * buffer. This converter maps the points back into that raw buffer.
 */
internal class BarcodeImageCoordinateConverter(
  private val frameWidth: Double,
  private val frameHeight: Double,
  rotationDegrees: Int,
) {
  private val rotationDegrees = ((rotationDegrees % 360) + 360) % 360

  init {
    require(
      this.rotationDegrees == 0 ||
        this.rotationDegrees == 90 ||
        this.rotationDegrees == 180 ||
        this.rotationDegrees == 270,
    ) {
      "rotationDegrees must be one of 0, 90, 180 or 270, but was $rotationDegrees!"
    }
  }

  fun convertBarcodePointToFramePoint(barcodePoint: Point): Point {
    val x = barcodePoint.x
    val y = barcodePoint.y

    return when (rotationDegrees) {
      0 -> Point(x, y)
      90 -> Point(y, frameHeight - x)
      180 -> Point(frameWidth - x, frameHeight - y)
      270 -> Point(frameWidth - y, x)
      else -> error("unreachable")
    }
  }
}
