# @t-mrtgu/react-native-vision-camera-barcode-scanner

This is VisionCamera Barcode Scanner. Install it through npm:

```sh
npm install @t-mrtgu/react-native-vision-camera-barcode-scanner react-native-nitro-image
```

VisionCamera Barcode Scanner depends on VisionCamera Core and Nitro Image.
Do not install it together with the unscoped
`react-native-vision-camera-barcode-scanner` package.

```sh
# Make sure VisionCamera Core is installed as well.
```

You can scan live camera frames, attach a Barcode Scanner output, or scan an existing Nitro Image with `BarcodeScanner.scanCodesInImageAsync(...)`.

## Barcode coordinates

Every `Barcode` keeps ML Kit's existing input-image coordinates and, when a
Camera context exists, also exposes coordinates in VisionCamera's Camera sensor
coordinate system:

| Property | Coordinate system | Availability |
| --- | --- | --- |
| `cornerPoints`, `boundingBox` | Input `Frame` or `Image` (existing behavior) | All scan APIs |
| `cameraCornerPoints`, `cameraBoundingBox` | Opaque Camera sensor coordinates accepted by VisionCamera | `CameraOutput`, `scanCodes(frame)`, and `scanCodesAsync(frame)` |

`cameraBoundingBox` is the axis-aligned box enclosing all transformed corner
points. If ML Kit does not return corner points, the scanner transforms all four
corners of `boundingBox` as a fallback.

The extra Camera coordinates are especially useful with
`useBarcodeScannerOutput(...)`: its callback receives barcodes but no `Frame`,
so application code cannot call `frame.convertFramePointToCameraPoint(...)`.
The scanner performs that native conversion while the camera buffer is valid
and stores only the resulting point values.

Treat Camera sensor coordinates as opaque. Do not normalize them or manually
apply screen dimensions, orientation, mirroring, safe-area insets, or
`resizeMode="cover"` cropping. VisionCamera's Preview View owns those transforms.

```tsx
import { useRef } from 'react'
import { View } from 'react-native'
import {
  Camera,
  type CameraRef,
  useCameraDevice,
} from 'react-native-vision-camera'
import { useBarcodeScannerOutput } from '@t-mrtgu/react-native-vision-camera-barcode-scanner'

function BarcodeCamera() {
  const cameraRef = useRef<CameraRef>(null)
  const device = useCameraDevice('back')

  const scannerOutput = useBarcodeScannerOutput({
    barcodeFormats: ['all-formats'],
    onBarcodeScanned(barcodes) {
      const camera = cameraRef.current
      if (camera == null) return

      for (const barcode of barcodes) {
        const viewCornerPoints = barcode.cameraCornerPoints?.map((point) =>
          camera.convertCameraPointToViewPoint(point),
        )

        // Draw an overlay using viewCornerPoints.
      }
    },
    onError(error) {
      console.error(error)
    },
  })

  if (device == null) return null

  return (
    <View style={{ flex: 1 }}>
      <Camera
        ref={cameraRef}
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        outputs={[scannerOutput]}
      />
      {/* Keep the overlay in this same local parent View coordinate system. */}
    </View>
  )
}
```

The Camera and overlay must share the same local parent View coordinate system;
the converted points are relative to the Camera Preview View, not the whole
screen. In particular, do not add safe-area or window offsets unless your own
layout places the overlay in a different coordinate system.

`scanCodesInImageAsync(image)` has no Camera context, so
`cameraCornerPoints` and `cameraBoundingBox` are `undefined` for static images.

## Minimum Requirements

The `GoogleMLKit/BarcodeScanning` dependency (version `9.0.0`) requires a minimum iOS target version of 15.5. Adjust it in your `Podfile` if needed.

Then, update your native project:

```sh
npx pod-install
```

And rebuild your app.
