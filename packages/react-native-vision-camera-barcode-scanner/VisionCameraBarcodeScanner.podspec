require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "VisionCameraBarcodeScanner"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = { :type => package["license"], :file => "LICENSE" }
  s.authors      = package["author"]

  s.platforms    = { :ios => 15.5, :visionos => 1.0 }
  # The scanner has its own release tags, independent of upstream core tags.
  # Publish this tag on the fork before distributing the corresponding release.
  s.source       = {
    :git => package["repository"]["url"].sub(/\Agit\+/, ""),
    :tag => "barcode-scanner-v#{s.version}"
  }

  # CocoaPods can run this for local :path Pods too. A complete npm package
  # must be validated without writes; only a monorepo needs source placement.
  s.prepare_command = <<-CMD
    set -eu
    ruby -rjson -rfileutils <<'RUBY'
begin
  expected_name = '@t-mrtgu/react-native-vision-camera-barcode-scanner'
  expected_version = '#{s.version}'
  root_package = JSON.parse(File.read('package.json'))
  if root_package['name'] == expected_name
    source = '.'
  elsif root_package['name'] == 'react-native-vision-camera-monorepo'
    source = 'packages/react-native-vision-camera-barcode-scanner'
  else
    raise 'unrecognized package layout'
  end

  manifest = JSON.parse(File.read(File.join(source, 'package.json')))
  unless manifest['name'] == expected_name && manifest['version'] == expected_version
    raise 'scanner name/version does not match this podspec'
  end
  required = %w[
    LICENSE ios/HybridBarcode.swift ios/BarcodeCoordinateSystemConverter.swift
    nitrogen/generated/ios/VisionCameraBarcodeScanner+autolinking.rb
    nitrogen/generated/shared/c++/HybridBarcodeSpec.cpp
  ]
  required.each do |entry|
    raise 'missing source file: ' + entry unless File.file?(File.join(source, entry))
  end

  unless source == '.'
    entries = %w[ios nitrogen LICENSE]
    entries << 'cpp' if File.directory?(File.join(source, 'cpp'))
    # Preflight all collisions before copying anything. A repeat invocation
    # accepts identical outputs but never overwrites unrelated existing files.
    entries.each do |entry|
      origin = File.join(source, entry)
      raise 'symlink source/output: ' + entry if File.symlink?(origin) || File.symlink?(entry)
      if File.exist?(entry) && !system('diff', '-qr', origin, entry, :out => File::NULL, :err => File::NULL)
        raise 'conflicting output: ' + entry
      end
    end
    entries.each do |entry|
      FileUtils.cp_r(File.join(source, entry), entry) unless File.exist?(entry)
    end
  end
rescue StandardError => error
  abort 'VisionCameraBarcodeScanner prepare: ' + error.message
end
RUBY
  CMD

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]
  s.frameworks = ["AVFoundation"]

  load 'nitrogen/generated/ios/VisionCameraBarcodeScanner+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'GoogleMLKit/BarcodeScanning', '9.0.0'
  s.dependency 'VisionCamera'
  s.dependency 'NitroImage'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
