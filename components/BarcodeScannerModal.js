import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

// A reusable full-screen scanner. Pass `visible`, `onClose`, and `onScanned(value)`.
export default function BarcodeScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorchOn(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(80); // short buzz confirms a successful read
    onScanned(data);
  };

  const rescan = () => setScanned(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            autofocus="on"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Camera permission is required to scan barcodes.</Text>
            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
              <Text style={styles.grantBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Corner-bracket scan frame reads more clearly than a plain box */}
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setTorchOn((t) => !t)}>
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.hintBox}>
          {scanned ? (
            <TouchableOpacity style={styles.rescanBtn} onPress={rescan}>
              <Ionicons name="refresh" size={16} color={COLORS.navy} />
              <Text style={styles.rescanText}>Scan again</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hintText}>Hold steady, fill the frame with the barcode</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CORNER_SIZE = 28;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  frameWrap: {
    width: 280,
    height: 180,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: COLORS.amber,
  },
  cornerTL: { top: 0, left: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: RADIUS.sm },
  cornerTR: { top: 0, right: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: RADIUS.sm },
  cornerBL: { bottom: 0, left: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: RADIUS.sm },
  cornerBR: { bottom: 0, right: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: RADIUS.sm },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  hintBox: { position: 'absolute', bottom: 70, alignItems: 'center' },
  hintText: { color: '#fff', fontSize: 13 },
  rescanBtn: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.amber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  rescanText: { color: COLORS.navy, fontWeight: '700', fontSize: 13 },
  permissionBox: { padding: SPACING.lg, alignItems: 'center' },
  permissionText: { color: '#fff', textAlign: 'center', marginBottom: SPACING.md },
  grantBtn: { backgroundColor: COLORS.amber, padding: SPACING.md, borderRadius: RADIUS.sm },
  grantBtnText: { color: COLORS.navy, fontWeight: '700' },
});
