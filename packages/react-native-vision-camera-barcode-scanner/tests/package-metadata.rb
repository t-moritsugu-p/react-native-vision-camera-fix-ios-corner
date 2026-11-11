# Metadata/layout and real CocoaPods local source-install regression checks.
# This is not a full pod install, dependency resolution or native build.
require 'cocoapods'
require 'digest'
require 'fileutils'
require 'json'
require 'open3'
require 'tmpdir'

# React Native injects this helper during an app's pod install. Its dependency
# wiring is outside this metadata test; the generated Nitro helper is real.
def install_modules_dependencies(_spec); end

package_dir = File.expand_path('..', __dir__)
package = JSON.parse(File.read(File.join(package_dir, 'package.json')))
spec = Dir.chdir(package_dir) do
  Pod::Specification.from_file('VisionCameraBarcodeScanner.podspec')
end

def check(condition, message)
  raise message unless condition
end

check(spec.source[:git] == package.fetch('repository').fetch('url').sub(/\Agit\+/, ''), 'Wrong Git source')
check(spec.source[:tag] == "barcode-scanner-v#{package.fetch('version')}", 'Wrong scanner release tag')
check(spec.license[:file] == 'LICENSE', 'Missing pod license file')
check(package.fetch('files').include?('LICENSE'), 'Missing npm license allowlist entry')
check(
  File.binread(File.join(package_dir, 'LICENSE')) == File.binread(File.join(package_dir, '../../LICENSE')),
  'Package license differs from repository license'
)

def copy_package(package_dir, destination)
  FileUtils.mkdir_p(destination)
  %w[package.json VisionCameraBarcodeScanner.podspec LICENSE ios nitrogen].each do |entry|
    FileUtils.cp_r(File.join(package_dir, entry), destination)
  end
end

def snapshot(directory)
  Dir.chdir(directory) do
    Dir.glob('**/*', File::FNM_DOTMATCH).sort.to_h do |path|
      value = if File.symlink?(path)
                [:symlink, File.readlink(path)]
              elsif File.directory?(path)
                [:directory]
              else
                [:file, Digest::SHA256.file(path).hexdigest]
              end
      [path, value]
    end
  end
end

def check_sources(spec, directory)
  Dir.chdir(directory) do
    check(File.file?('LICENSE'), 'Prepared source is missing LICENSE')
    check(File.file?('ios/BarcodeCoordinateSystemConverter.swift'), 'Prepared source is missing converter')
    check(File.file?('nitrogen/generated/ios/VisionCameraBarcodeScanner+autolinking.rb'), 'Missing Nitro helper')
    patterns = spec.attributes_hash.fetch('source_files')
    files = patterns.flat_map { |pattern| Dir.glob(pattern) }
    check(files.include?('ios/HybridBarcode.swift'), 'Pod source patterns exclude the scanner implementation')
    check(files.any? { |path| path.start_with?('nitrogen/generated/shared/') }, 'Pod source patterns exclude generated C++')
    check(files.any? { |path| path.start_with?('nitrogen/generated/ios/') }, 'Pod source patterns exclude generated iOS files')
  end
end

# Reproduce npm/autolinking's :path install using the real Sandbox,
# PodSourceInstaller.install! and PodSourcePreparer (not a mocked prepare call).
Dir.mktmpdir('scanner-local-pod-') do |temp_dir|
  local_dir = File.join(temp_dir, 'package')
  copy_package(package_dir, local_dir)
  local_spec = Dir.chdir(local_dir) do
    Pod::Specification.from_file('VisionCameraBarcodeScanner.podspec')
  end
  sandbox = Pod::Sandbox.new(File.join(temp_dir, 'Pods'))
  sandbox.store_local_path(local_spec.name, File.join(local_dir, 'VisionCameraBarcodeScanner.podspec'), true)
  installer = Pod::Installer::PodSourceInstaller.new(
    sandbox, Pod::Podfile.new, { :ios => [local_spec] }, :can_cache => false
  )
  before = snapshot(local_dir)
  2.times { installer.install! }
  check(snapshot(local_dir) == before, 'Local installation changed package files')
  check_sources(local_spec, local_dir)
  puts "PASS: CocoaPods #{Pod::VERSION} local PodSourceInstaller.install! twice; package unchanged"
end

# The post-download monorepo case uses actual source copies. Root metadata
# deliberately collides with the package's metadata and must not be replaced.
Dir.mktmpdir('scanner-pod-layout-') do |download_dir|
  nested_dir = File.join(download_dir, 'packages/react-native-vision-camera-barcode-scanner')
  copy_package(package_dir, nested_dir)
  %w[package.json README.md LICENSE .gitignore].each do |entry|
    FileUtils.cp(File.join(package_dir, '../..', entry), File.join(download_dir, entry))
  end
  root_metadata = %w[package.json README.md LICENSE .gitignore].to_h do |entry|
    [entry, File.binread(File.join(download_dir, entry))]
  end
  nested_before = snapshot(nested_dir)
  preparer = Pod::Installer::PodSourcePreparer.new(spec, Pathname.new(download_dir))
  preparer.prepare!
  first = snapshot(download_dir)
  preparer.prepare!
  check(snapshot(download_dir) == first, 'Monorepo preparation is not idempotent')
  root_metadata.each do |entry, content|
    check(File.binread(File.join(download_dir, entry)) == content, "Root #{entry} was overwritten")
  end
  check(snapshot(nested_dir) == nested_before, 'Monorepo package sources were changed')
  check_sources(spec, download_dir)
  puts 'PASS: monorepo preparation twice; root metadata and nested sources preserved'
end

# Fail closed before copying anything on unknown/incomplete layouts or a
# conflicting existing output. Capture expected errors to keep logs readable.
[:unknown, :incomplete_local, :wrong_version, :conflicting_output, :conflicting_license, :missing_nested_source].each do |scenario|
  Dir.mktmpdir('scanner-invalid-layout-') do |directory|
    if [:incomplete_local, :wrong_version].include?(scenario)
      copy_package(package_dir, directory)
      if scenario == :incomplete_local
        FileUtils.rm(File.join(directory, 'ios/HybridBarcode.swift'))
      else
        manifest = JSON.parse(File.read(File.join(directory, 'package.json')))
        manifest['version'] = '0.0.0-invalid'
        File.write(File.join(directory, 'package.json'), JSON.generate(manifest))
      end
    elsif scenario != :unknown
      nested_dir = File.join(directory, 'packages/react-native-vision-camera-barcode-scanner')
      copy_package(package_dir, nested_dir)
      FileUtils.cp(File.join(package_dir, '../../package.json'), directory)
      case scenario
      when :conflicting_output
        FileUtils.mkdir_p(File.join(directory, 'ios'))
        File.write(File.join(directory, 'ios/unrelated.swift'), '// do not overwrite')
      when :conflicting_license
        File.write(File.join(directory, 'LICENSE'), 'unrelated license')
      when :missing_nested_source
        FileUtils.rm(File.join(nested_dir, 'ios/HybridBarcode.swift'))
      end
    end
    before = snapshot(directory)
    output, status = Open3.capture2e('/bin/bash', '-c', spec.prepare_command, :chdir => directory)
    check(!status.success?, "#{scenario}: invalid preparation succeeded")
    check(output.include?('VisionCameraBarcodeScanner prepare:'), "#{scenario}: missing diagnostic")
    check(snapshot(directory) == before, "#{scenario}: failure changed files")
  end
end
puts 'PASS: 6 invalid/conflicting layouts rejected without writes'
puts 'Not tested: remote download, spec discovery, cleanup, full pod install, React Native autolinking or native build.'
