import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform } from 'react-native'
import { Camera, CameraView } from 'expo-camera'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import Svg, { Path, Rect } from 'react-native-svg'

interface QRScannerProps {
  visible: boolean
  onClose: () => void
  onScan: (data: string) => void
  title?: string
}

export function QRScanner({ visible, onClose, onScan, title }: QRScannerProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    if (visible) {
      requestPermission()
    }
  }, [visible])

  const requestPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
      
      if (status !== 'granted') {
        Alert.alert(
          t('common.attention'),
          'É necessário permitir o acesso à câmera para escanear QR codes.',
          [{ text: t('common.ok'), onPress: onClose }]
        )
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error)
      Alert.alert(t('common.error'), t('error.cameraAccess'))
      onClose()
    }
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true)
      
      // Tenta parsear se for JSON (algumas exchanges geram QR codes com JSON)
      try {
        const parsed = JSON.parse(data)
        onScan(JSON.stringify(parsed))
      } catch {
        // Se não for JSON, retorna o texto puro
        onScan(data)
      }
      
      // Fecha o scanner após 500ms
      setTimeout(() => {
        setScanned(false)
        onClose()
      }, 500)
    }
  }

  const handleClose = () => {
    setScanned(false)
    onClose()
  }

  if (!visible) {
    return null
  }

  if (hasPermission === null) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Solicitando permissão da câmera...
          </Text>
        </View>
      </Modal>
    )
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.loadingContainer}>
          <View style={[styles.errorContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              Sem acesso à câmera
            </Text>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
              Para escanear QR codes, você precisa permitir o acesso à câmera nas configurações do dispositivo.
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
              onPress={handleClose}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Overlay escuro */}
          <View style={styles.overlay}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <Text style={styles.headerTitle}>
                {title || 'Escaneie o QR Code'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {title?.includes('API') 
                  ? 'Aceita QR Codes da OKX e outras exchanges\ncom API Key, Secret e Passphrase'
                  : 'Posicione o QR code dentro da área marcada'
                }
              </Text>
            </View>

            {/* Área de scan com bordas */}
            <View style={styles.scanArea}>
              <View style={styles.scanFrame}>
                {/* Cantos do frame */}
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
              
              {/* Dica sobre formatos aceitos */}
              {title?.includes('API') && (
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>
                    💡 Aceita formatos JSON e texto
                  </Text>
                </View>
              )}
            </View>

            {/* Footer com botões */}
            <View style={[styles.footer, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.card }]}
                onPress={handleClose}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.footerHint}>
                {title?.includes('Escanear API') 
                  ? '🔐 Suporta QR Codes da OKX, Binance, etc'
                  : '💡 Também aceita códigos de barras'
                }
              </Text>
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  hintBox: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  hintText: {
    fontSize: 13,
    color: '#60a5fa',
    textAlign: 'center',
    fontWeight: '500',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3b82f6',
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  footer: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  cancelButton: {
    paddingVertical: 14,         // 16→14 (padrão primary button)
    paddingHorizontal: 24,       // 32→24 (padrão primary button)
    borderRadius: 12,
    minWidth: 200,
    minHeight: 48,               // Adiciona minHeight padrão
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    borderRadius: 16,
    padding: 24,
    maxWidth: 320,
    alignItems: 'center',
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
