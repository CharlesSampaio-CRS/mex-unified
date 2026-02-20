import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

/**
 * ⚠️ COMPONENTE DESABILITADO
 * 
 * ImportSnapshot Component
 * 
 * Este componente foi desabilitado porque o sistema agora usa MongoDB diretamente.
 * Snapshots são gerenciados automaticamente pelo backend (Rust scheduler).
 * 
 * Motivo: Migração de SQLite → MongoDB completa
 */

export default function ImportSnapshot() {
  return (
    <View style={styles.container}>
      <View style={styles.disabledOverlay}>
        <Text style={styles.disabledTitle}>⚠️ Funcionalidade Desabilitada</Text>
        <Text style={styles.disabledText}>
          Este recurso de importação foi removido.{'\n\n'}
          Os snapshots agora são gerenciados automaticamente pelo backend MongoDB.
          {'\n\n'}
          Os dados são salvos diariamente às 00:00 UTC.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  disabledOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#ff6b6b',
    textAlign: 'center',
  },
  disabledText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
})
