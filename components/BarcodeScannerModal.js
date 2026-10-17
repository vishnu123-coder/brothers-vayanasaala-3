import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Vibration, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPE } from '../utils/theme';

// Reusable full-screen scanner. Pass `visible`, `onClose`, and `onScanned(value)`.
export default function BarcodeScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const frameW = Math.min(width - 56, 340);
  const frameH = Math.round(frameW * 0.62);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorchOn(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission]);

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(80);
    onScanned(String(data).trim());
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            autofocus="on"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'code93', 'codabar', 'upc_a', 'upc_e', 'itf14', 'qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={44} color="#fff" />
            <Text style={styles.permissionText}>Camera permission is required to scan barcodes.</Text>
            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
              <Text style={styles.grantBtnText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.frame, { width: frameW, height: frameH }]} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} accessibilityLabel="Close scanner">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setTorchOn((t) => !t)} accessibilityLabel="Toggle flashlight">
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.hintBox, { bottom: insets.bottom + 56 }]}>
          {scanned ? (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
              <Ionicons name="refresh" size={18} color={COLORS.navy} />
              <Text style={styles.rescanText}>Scan again</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hintText}>Hold steady and fill the frame with the barcode</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CORNER = 30;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  frame: {},
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: COLORS.amber },
  cornerTL: { top: 0, left: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: RADIUS.sm },
  cornerTR: { top: 0, right: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: RADIUS.sm },
  cornerBL: { bottom: 0, left: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: RADIUS.sm },
  cornerBR: { bottom: 0, right: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: RADIUS.sm },
  topBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 24, padding: 10 },
  hintBox: { position: 'absolute', alignItems: 'center', paddingHorizontal: 24 },
  hintText: {
    ...TYPE.body,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rescanBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.amber,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  rescanText: { ...TYPE.bodyStrong, color: COLORS.navy },
  permissionBox: { padding: SPACING.lg, alignItems: 'center', gap: 14 },
  permissionText: { ...TYPE.body, color: '#fff', textAlign: 'center' },
  grantBtn: { backgroundColor: COLORS.amber, paddingHorizontal: 22, paddingVertical: 14, borderRadius: RADIUS.md },
  grantBtnText: { ...TYPE.bodyStrong, color: COLORS.navy },
});
