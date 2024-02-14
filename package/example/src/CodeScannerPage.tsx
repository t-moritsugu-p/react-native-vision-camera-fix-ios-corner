import * as React from 'react'
import { useCallback, useRef, useState } from 'react'
import {Alert, AlertButton, Dimensions, Linking, Platform, StyleSheet, TouchableOpacity, View} from 'react-native'
import {
  Code,
  CodeScannerFrame,
  useCameraDevice, useCameraFormat,
  useCodeScanner
} from '@t-mrtgu/react-native-vision-camera-fix-ios-codescan-corner'
import { Camera } from '@t-mrtgu/react-native-vision-camera-fix-ios-codescan-corner'
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, SAFE_AREA_PADDING } from './Constants'
import { useIsForeground } from './hooks/useIsForeground'
import { StatusBarBlurBackground } from './views/StatusBarBlurBackground'
import { PressableOpacity } from 'react-native-pressable-opacity'
import IonIcon from 'react-native-vector-icons/Ionicons'
import type { Routes } from './Routes'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/core'

const showCodeAlert = (value: string, onDismissed: () => void): void => {
  const buttons: AlertButton[] = [
    {
      text: 'Close',
      style: 'cancel',
      onPress: onDismissed,
    },
  ]
  if (value.startsWith('http')) {
    buttons.push({
      text: 'Open URL',
      onPress: () => {
        Linking.openURL(value)
        onDismissed()
      },
    })
  }
  Alert.alert('Scanned Code', value, buttons)
}

interface BarcodeEx {
  rawBarCode: string;
  resultPoints: {left: number, top: number, right: number, bottom: number}
  viewWidth: number;
  viewHeight: number;
  viewTop: number;
  viewLeft: number;
};

type Props = NativeStackScreenProps<Routes, 'CodeScannerPage'>
export function CodeScannerPage({ navigation }: Props): React.ReactElement {
  // 1. Use a simple default back camera
  const device = useCameraDevice('back')
  // 3.7.0からfps指定の場合formatが必須になったので取得して割り当てる必要がある
  const format = useCameraFormat(device, [])

  // 2. Only activate Camera when the app is focused and this screen is currently opened
  const isFocused = useIsFocused()
  const isForeground = useIsForeground()
  const isActive = isFocused && isForeground

  // 3. (Optional) enable a torch setting
  const [torch, setTorch] = useState(false)

  const [targetBarcodes, setTargetBarcodes] = useState<BarcodeEx[]>([]);

  const WINDOW_HEIGHT = Dimensions.get('window').height;
  const WINDOW_WIDTH = Dimensions.get('window').width;
  const [cameraHeight, setCameraHeight] = useState<number>(0);

  const onCameraInit = (config: { codeScannerFrame: CodeScannerFrame }) => {
    console.log('*********init*********');
    console.log(config);
    console.log('*********init end*********');
    const frame = config.codeScannerFrame;
    if (frame.width === 0 || frame.height === 0) {
      return;
    }

    if (frame.width > frame.height) {
      const logicalHeight = frame.width / frame.height * WINDOW_WIDTH;
      setCameraHeight(logicalHeight);
    } else {
      const logicalHeight = frame.height / frame.width * WINDOW_WIDTH;
    }

  }


  // 4. On code scanned, we show an aler to the user
  const isShowingAlert = useRef(false)
  const onCodeScanned = useCallback((srcCodes: Code[], srcFrame: CodeScannerFrame) => {
    // console.log(`Scanned ${codes.length} codes:`, codes)
    // console.log(`codeScanFrame:`, frame)

    const value = srcCodes[0]?.value
    if (value == null) return

    // if (isShowingAlert.current) return
    // showCodeAlert(value, () => {
    //   isShowingAlert.current = false
    // })
    // isShowingAlert.current = true


    // console.log(logicalHeightDiff)

    //const detectedBarcodes: Code[] = invertCodeIfOriented(_.cloneDeep(srcCodes));
    //const frame: CodeScannerFrame = invertFrameIfOriented(_.cloneDeep(srcFrame));


    const codes: Code[] = invertCodeIfOriented(srcCodes);
    const frame: CodeScannerFrame = invertFrameIfOriented(srcFrame);

    // const codes: Code[] = srcCodes;
    // const frame: CodeScannerFrame = srcFrame;

    console.log(codes[0]!.corners)
    console.log(codes[0]!.value)
    console.log(WINDOW_WIDTH + ' ' + WINDOW_HEIGHT)

    // 入力画像のサイズはonInitializedと変わらないが、useStateでxRatioを利用する形にすると何故か常に初期値が利用されてしまう
    // そのため、毎回計算する。
    let xRatio = 1;
    let yRatio: number = 1;
    if (frame.width > frame.height) {
      xRatio = frame.height / WINDOW_WIDTH;
      // yRatio.value = frame.width / WINDOW_HEIGHT;
      const logicalHeight = frame.width / frame.height * WINDOW_WIDTH;
      yRatio = frame.width / logicalHeight;
      // console.log(logicalHeight + ' xr:' + xRatio + ' yr:' + yRatio)
    } else {
      xRatio = frame.width / WINDOW_WIDTH;
      // yRatio.value = frame.height / WINDOW_HEIGHT;
      const logicalHeight = frame.height / frame.width * WINDOW_WIDTH;
      yRatio = frame.height / logicalHeight;
      // console.log(logicalHeight + ' xr:' + xRatio + ' yr:' + yRatio)
    }

    const lists: BarcodeEx[] = [];
    for (const bc of codes) {
      // cornerPointsは左上スタート、右上スタートとかパターンがいくつかある boundingBoxはiOSには存在しない
      if (!bc.value || !bc.corners || !bc.frame) {
        continue;
      }
      const xArray = bc.corners.map(corner => corner.x);
      const yArray = bc.corners.map(corner => corner.y);

      // androidの場合、X座標の軸方向が反転している
      const resultPoints = (Platform.OS === "ios")? {
        left: Math.min(...xArray) / xRatio,
        right: Math.max(...xArray) / xRatio,
        bottom: Math.max(...yArray) / yRatio,
        top: Math.min(...yArray) / yRatio,
      } : {
        left:  (frame.width - Math.max(...xArray)) / xRatio,
        right: (frame.width - Math.min(...xArray)) / xRatio,
        bottom: Math.max(...yArray) / yRatio,
        top: Math.min(...yArray) / yRatio,
      }

      lists.push({
        rawBarCode: bc.value,
        resultPoints: resultPoints,
        viewWidth: resultPoints.right - resultPoints.left,
        viewHeight: resultPoints.bottom - resultPoints.top,
        viewTop: resultPoints.top,
        viewLeft: resultPoints.left
      });

    }
    setTargetBarcodes(lists);
  }, [])

  // 5. Initialize the Code Scanner to scan QR codes and Barcodes
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'codabar'],
    onCodeScanned: onCodeScanned,
  })

  const refCamera = useRef<Camera>(null);

  return (
    <View style={styles.container}>
      {device != null && isFocused && (

        <TouchableOpacity
          // style={[styles.barcodeAreaWrapper, {height: cameraHeight.value}]}
          style={[styles.barcodeArea, {height: cameraHeight}]}
          onPressOut={async (e) => {
            if (refCamera) {
              try {
                console.log('focust st')
                console.log(e.nativeEvent.locationX + ' '  + e.nativeEvent.locationY)
                await refCamera.current?.focus({x: e.nativeEvent.locationX, y: e.nativeEvent.locationY});
                console.log('focust end')
              } catch (e) {
                console.log(e)
                console.log('focust error')
              }

            }
          }}
        >

          <Camera
            // style={StyleSheet.absoluteFill}
            style={[styles.barcodeArea, {height: cameraHeight}]}
            device={device}
            isActive={isActive}
            codeScanner={codeScanner}
            torch={torch ? 'on' : 'off'}
            // enableZoomGesture={true}
            onInitialized={onCameraInit}
            ref={refCamera}
            //fps={6}
            //format={format}
          />

        </TouchableOpacity>
      )}

      <StatusBarBlurBackground />

      <View style={styles.rightButtonRow}>
        <PressableOpacity style={styles.button} onPress={() => setTorch(!torch)} disabledOpacity={0.4}>
          <IonIcon name={torch ? 'flash' : 'flash-off'} color="white" size={24} />
        </PressableOpacity>
      </View>

      {/* Back Button */}
      <PressableOpacity style={styles.backButton} onPress={navigation.goBack}>
        <IonIcon name="chevron-back" color="white" size={35} />
      </PressableOpacity>

      {device != null && (
        targetBarcodes && targetBarcodes.slice().map((ex, index) => {
          return (
              <View key={index} style={[
                styles.targetBarcodeArea,
                {
                  borderColor: 'red',
                  width: ex.viewWidth, height: ex.viewHeight,
                  top: ex.viewTop, left: ex.viewLeft
                }
              ]}>
              </View>
          )
        })
      )}

    </View>
  )
}

const invertCodeIfOriented = (codes: Code[]) => {
  for (const bc of codes) {
    if (!bc.frame || bc.frame.width > bc.frame.height) {
      continue;
    }
    const x = bc.frame.y;
    const y = bc.frame.x;
    const width = bc.frame.height;
    const height = bc.frame.width;
    bc.frame.x = x;
    bc.frame.y = y;
    bc.frame.width = width;
    bc.frame.height = height;

    if (bc.corners) {
      for (const corner of bc.corners) {
        const cx = corner.y;
        const cy = corner.x;
        corner.x = cx;
        corner.y = cy;
      }
    }
  }
  return codes;
}

const invertFrameIfOriented = (frame: CodeScannerFrame) => {
  if (frame.width > frame.height) {
    const width = frame.height;
    const height = frame.width;
    frame.width = width;
    frame.height = height;
  }
  return frame;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    width: '100%',
    height: '100%'
  },
  button: {
    marginBottom: CONTENT_SPACING,
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: CONTROL_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(140, 140, 140, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  backButton: {
    position: 'absolute',
    left: SAFE_AREA_PADDING.paddingLeft,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  targetBarcodeArea: { // barcodeAreaに被せる前提のためabsolute
    position:'absolute',
    borderStyle: 'solid',
    borderWidth: 2,
    backgroundColor:'transparent',
    top: 0,
    left: 0,
    zIndex: 40,
  },
  barcodeArea: { // frameをcropするために原点を計算するためabsoolute
    position:'absolute',
    width: '100%',
    height: 200,
    overflow: 'hidden',
    top: 0,
    left: 0,
    Index: 30,
  },
})
