import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native'
import { migrationService } from '../services/migration-service'

/**
 * ImportSnapshot Component
 * 
 * UI para importar snapshots do MongoDB para WatermelonDB
 * 
 * Uso:
 * 1. Cole o JSON do MongoDB no campo
 * 2. Clique em "Importar"
 * 3. Verifique no IndexedDB
 */

export default function ImportSnapshot() {
  const [jsonInput, setJsonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  // Dados de exemplo pré-carregados
  const exampleData = {
    _id: { $oid: '697c1ed702aa49660af34553' },
    date: '2026-01-30',
    user_id: '6950290f5d594da225720e58',
    exchanges: [
      {
        exchange_id: '693481148b0a41e8b6acb079',
        exchange_name: 'NovaDAX',
        balance_usd: 0.0006162698492431068,
        is_active: true,
        tokens_count: 43,
      },
      {
        exchange_id: '693481148b0a41e8b6acb07b',
        exchange_name: 'MEXC',
        balance_usd: 0,
        is_active: true,
        tokens_count: 0,
      },
      {
        exchange_id: '693481148b0a41e8b6acb078',
        exchange_name: 'Bybit',
        balance_usd: 0.000063097508,
        is_active: true,
        tokens_count: 2,
      },
    ],
    timestamp: { $numberLong: '1769742027' },
    total_usd: 0.0006793673572431068,
    updated_at: { $date: '2026-01-30T03:00:39.853Z' },
  }

  const handleLoadExample = () => {
    setJsonInput(JSON.stringify(exampleData, null, 2))
    setResult('')
  }

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      Alert.alert('Erro', 'Cole o JSON do snapshot primeiro')
      return
    }

    setLoading(true)
    setResult('')

    try {
      const data = JSON.parse(jsonInput)
      
      const success = await migrationService.importMongoSnapshot(data)

      if (success) {
        const timestamp = parseInt(data.timestamp.$numberLong) * 1000
        const resultText = `✅ Snapshot importado com sucesso!

📊 Detalhes:
  • User ID: ${data.user_id}
  • Total USD: $${data.total_usd.toFixed(6)}
  • Total BRL: R$${(data.total_usd * 5.0).toFixed(2)}
  • Data: ${new Date(timestamp).toLocaleString()}
  • Exchanges: ${data.exchanges.length}

📍 Verifique no IndexedDB:
  DevTools → Application → IndexedDB → balance_snapshots`

        setResult(resultText)
        Alert.alert('Sucesso!', 'Snapshot importado. Verifique o console para detalhes.')
      } else {
        setResult('❌ Falha ao importar snapshot. Verifique o console.')
        Alert.alert('Erro', 'Falha ao importar. Veja o console (F12)')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
      setResult(`❌ Erro ao importar: ${errorMsg}`)
      Alert.alert('Erro', `Erro ao importar: ${errorMsg}`)
      console.error('Erro ao importar:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportExample = async () => {
    setLoading(true)
    setResult('')

    try {
      await migrationService.importTestData()
      setResult(`✅ Dados de exemplo importados!

📊 Snapshot de teste criado:
  • User ID: 6950290f5d594da225720e58
  • Total USD: $0.000679
  • Exchanges: NovaDAX, MEXC, Bybit

📍 Verifique no IndexedDB`)
      
      Alert.alert('Sucesso!', 'Dados de exemplo importados')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
      setResult(`❌ Erro: ${errorMsg}`)
      Alert.alert('Erro', errorMsg)
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setJsonInput('')
    setResult('')
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📥 Importar Snapshot do MongoDB</Text>
        <Text style={styles.subtitle}>
          Cole o JSON do snapshot abaixo e clique em Importar
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={handleLoadExample}
        >
          <Text style={styles.buttonText}>📝 Carregar Exemplo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonSuccess, loading && styles.buttonDisabled]}
          onPress={handleImportExample}
          disabled={loading}
        >
          <Text style={styles.buttonText}>⚡ Importar Exemplo Rápido</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>JSON do MongoDB:</Text>
        <TextInput
          style={styles.input}
          value={jsonInput}
          onChangeText={setJsonInput}
          placeholder='{"_id": {"$oid": "..."}, ...}'
          multiline
          numberOfLines={15}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={loading || !jsonInput.trim()}
        >
          <Text style={styles.buttonText}>
            {loading ? '⏳ Importando...' : '📥 Importar Snapshot'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={handleClear}
        >
          <Text style={styles.buttonText}>🗑️ Limpar</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>ℹ️ Instruções:</Text>
        <Text style={styles.instructionsText}>
          1. <Text style={styles.bold}>Carregar Exemplo:</Text> Preenche com dados de teste{'\n'}
          2. <Text style={styles.bold}>Importar Exemplo Rápido:</Text> Importa diretamente{'\n'}
          3. <Text style={styles.bold}>Cole seu JSON:</Text> Do MongoDB ou API{'\n'}
          4. <Text style={styles.bold}>Importar:</Text> Salva no WatermelonDB local{'\n'}
          5. <Text style={styles.bold}>Verificar:</Text> DevTools → Application → IndexedDB
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  inputContainer: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 200,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  instructions: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#333',
  },
})
