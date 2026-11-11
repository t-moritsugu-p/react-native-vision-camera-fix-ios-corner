#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Native iOS coordinate host tests require macOS and the Xcode command-line tools.' >&2
  exit 1
fi

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_dir="$(cd "$test_dir/../../.." && pwd)"
core_dir="$package_dir/../react-native-vision-camera"
test_build_dir="$(mktemp -d "${TMPDIR:-/tmp}/barcode-coordinate-tests.XXXXXX")"
trap 'rm -rf -- "$test_build_dir"' EXIT

# Compile a boundary module for the enum only; converter source is not copied,
# rewritten or reimplemented. The cache and binary stay in a temporary folder.
xcrun swiftc -parse-as-library -emit-object -emit-module -module-name VisionCamera \
  -module-cache-path "$test_build_dir/cache" \
  -emit-module-path "$test_build_dir/VisionCamera.swiftmodule" \
  "$test_dir/VisionCameraTypes.swift" -o "$test_build_dir/VisionCamera.o"
xcrun swiftc -module-cache-path "$test_build_dir/cache" -I "$test_build_dir" \
  "$test_build_dir/VisionCamera.o" \
  "$core_dir/ios/Utils/FrameCoordinateSystemConverter.swift" \
  "$package_dir/ios/BarcodeCoordinateSystemConverter.swift" \
  "$test_dir/CoordinateTests.swift" -o "$test_build_dir/coordinate-tests"
"$test_build_dir/coordinate-tests"
