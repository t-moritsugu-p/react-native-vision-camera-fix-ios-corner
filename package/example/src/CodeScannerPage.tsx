import * as React from 'react'
import { useCallback, useRef, useState } from 'react'
import {Alert, AlertButton, Dimensions, Linking, StyleSheet, View} from 'react-native'
import {
  Code,
  CodeScannerFrame,
  useCameraDevice,
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

  // 2. Only activate Camera when the app is focused and this screen is currently opened
  const isFocused = useIsFocused()
  const isForeground = useIsForeground()
  const isActive = isFocused && isForeground

  // 3. (Optional) enable a torch setting
  const [torch, setTorch] = useState(false)

  const [targetBarcodes, setTargetBarcodes] = useState<BarcodeEx[]>([]);

  // const [xRatio, setXRatio] = useState<Number>(0);
  // const [yRatio, setYRatio] = useState<Number>(0);

  const WINDOW_HEIGHT = Dimensions.get('window').height;
  const WINDOW_WIDTH = Dimensions.get('window').width;
  const [cameraHeight, setCameraHeight] = useState<Number>(0);

  const onCameraInit = () => {

  }


  // 4. On code scanned, we show an aler to the user
  const isShowingAlert = useRef(false)
  const onCodeScanned = useCallback((codes: Code[], frame: CodeScannerFrame) => {
    // console.log(`Scanned ${codes.length} codes:`, codes)
    // console.log(`codeScanFrame:`, frame)

    const value = codes[0]?.value
    if (value == null) return
    // console.log(codes[0]!.corners)
    // if (isShowingAlert.current) return
    // showCodeAlert(value, () => {
    //   isShowingAlert.current = false
    // })
    // isShowingAlert.current = true
    let xRatio;
    let yRatio;
    let logicalHeightDiff;
    if (frame.width > frame.height) {
      xRatio = frame.height / WINDOW_WIDTH;

      const logicalHeight = frame.width / frame.height * WINDOW_WIDTH;
      logicalHeightDiff = logicalHeight - WINDOW_HEIGHT;
      // setCameraHeight(logicalHeight);
      // console.log('logicalHeight: ' + logicalHeight + ' ' + cameraHeight + 'w: ' + WINDOW_WIDTH + ' h:' + WINDOW_HEIGHT)
      yRatio = frame.width / logicalHeight;
    } else {
      xRatio = frame.width / WINDOW_WIDTH;

      const logicalHeight = frame.height / frame.width * WINDOW_WIDTH;
      logicalHeightDiff = logicalHeight - WINDOW_HEIGHT;
      // setCameraHeight(logicalHeight)
      // console.log('logicalHeight: ' + logicalHeight + ' ' + cameraHeight + 'w: ' + WINDOW_WIDTH + ' h:' + WINDOW_HEIGHT)
      yRatio = frame.height / logicalHeight;
    }
    // console.log(logicalHeightDiff)

    const lists: BarcodeEx[] = [];
    for (const bc of codes) {
      // cornerPointsは左上スタート、右上スタートとかパターンがいくつかある boundingBoxはiOSには存在しない
      if (!bc.value || !bc.corners || !bc.frame) {
        continue;
      }
      const xArray = bc.corners.map(corner => corner.x);
      const yArray = bc.corners.map(corner => corner.y);
      const resultPoints = {
        left: Math.min(...xArray) / xRatio,
        right: Math.max(...xArray) / xRatio,
        bottom: Math.max(...yArray) / yRatio - ((logicalHeightDiff > 0)?  logicalHeightDiff / 2 : 0),
        top: Math.min(...yArray) / yRatio - ((logicalHeightDiff > 0)?  logicalHeightDiff / 2 : 0),
        // left: Math.min(...xArray) ,
        // right: Math.max(...xArray) ,
        // bottom: Math.max(...yArray) ,
        // top: Math.min(...yArray) ,
        // left: bc.frame.x,
        // right: bc.frame.x + bc.frame.width,
        // bottom: bc.frame.y + bc.frame.height,
        // top: bc.frame?.y
      };
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
      {device != null && (
        <Camera
          // style={StyleSheet.absoluteFill}
          style={[styles.barcodeArea, {height: WINDOW_HEIGHT}]}
          device={device}
          isActive={isActive}
          codeScanner={codeScanner}
          torch={torch ? 'on' : 'off'}
          enableZoomGesture={true}
          onInitialized={onCameraInit}
          ref={refCamera}
        />
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
