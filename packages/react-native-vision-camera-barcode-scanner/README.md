# @t-mrtgu/react-native-vision-camera-barcode-scanner

This is VisionCamera Barcode Scanner. Install it through npm:

```sh
npm install @t-mrtgu/react-native-vision-camera-barcode-scanner@camera-coords react-native-nitro-image
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

## Verification before release

Run these commands from this package directory after installing the monorepo
dependencies and building the core package:

```sh
bun test
bun run test:native:ios
bun run test:package
bun run typecheck
bun run build
npm pack --ignore-scripts --pack-destination /path/to/temporary-directory
```

- `bun test` checks TypeScript arithmetic models only. It does not run the
  Swift/Kotlin implementations, ML Kit, CameraX or Nitro.
- `test:native:ios` requires macOS and Xcode command-line tools. It compiles
  the actual core and scanner Swift coordinate converters, uses CoreGraphics
  and a real CVPixelBuffer, and checks fixed expectations for every orientation
  and mirror state. Only the Nitro-backed enum/point data types are replaced
  with host-test types. It does not exercise ML Kit or the Nitro bridge.
- `test:package` requires the CocoaPods Ruby gem. On temporary copies it runs
  the real local `PodSourceInstaller.install!` path twice and checks that the
  npm package remains unchanged. It also runs monorepo preparation twice,
  checks root metadata is preserved, and rejects invalid/conflicting layouts
  without writes. React Native's dependency helper is replaced in this test:
  this is not a full `pod install`, dependency resolution, React Native
  autolinking, remote fetch, spec discovery, cleanup or native build test.
- Install the resulting tarball in a separate validation app and verify
  autolinking and native builds. Check the actual resolved core/Nitro versions;
  the wildcard peer dependencies do not pin a validated combination. Scanner
  updates alone do not install the core 5.2.2 preview-detachment fix.
- On devices, compare detected coordinates with the actual preview for front
  and back cameras, all orientations, mirroring and preview/full resolutions.
  Also test camera teardown/re-entry, background/foreground and disposal during
  a scan. The host tests are not proof of ML Kit-to-preview correctness.

The podspec's Git source uses this fork and a package-specific release tag:
`barcode-scanner-v<package version>` (for example,
`barcode-scanner-v5.2.2-camera-coords.0`). Before publishing, create and push
that tag on the approved release commit and verify that it resolves remotely
and includes this package's sources and LICENSE. A version change in
package.json does not create the tag. The package-level release script does
not create Git tags either. Do not publish until these checks pass.

The supported installation route is the npm package (or a validation tarball)
with React Native local-path autolinking. CocoaPods can execute
`prepare_command` even for a local `:path` Pod. In that layout the command
checks the package identity/version and required files, then exits without
copying or modifying anything. This behavior is tested with the installed
CocoaPods local source installer, not inferred from the documentation.

For an already-downloaded monorepo and an already-evaluated spec, preparation
copies only `ios`, `nitrogen`, optional `cpp`, and a missing `LICENSE` from the
scanner package to the download root. It preserves the root `package.json`,
README, `.gitignore`, and any identical LICENSE. Conflicting outputs fail
before copying; repeated preparation accepts identical outputs.

This post-download layout check does **not** establish a supported Git-only
installation route. A plain Podfile `:git` reference cannot discover this
nested podspec at the repository root. A standalone Ruby podspec cannot be
evaluated without its adjacent `package.json` and generated Ruby helper.
Remote tags, download/spec resolution and cleanup have not been verified.
Do not distribute instructions for a Git-only installation until that entire
route has been implemented and tested; the source URL/tag alone is not proof
that it works.

Publish only the scoped scanner package after validation, using the intended
`camera-coords` npm dist-tag. Do not run the monorepo-wide release command to
publish this fork's scanner. Release tags, npm publication and native app
distribution are separate operations.
