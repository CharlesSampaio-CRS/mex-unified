/**
 * Script de Importação Inline
 * Cole este código no Console do Chrome (F12)
 */

console.log('🚀 Iniciando importação inline...')

// Seus dados do MongoDB
const mongoSnapshot = {
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

async function importarSnapshot() {
  try {
    // Importar database diretamente
    const { database } = await import('@nozbe/watermelondb')
    
    console.log('📦 Database:', database)
    
    // Converter timestamp
    const timestamp = parseInt(mongoSnapshot.timestamp.$numberLong) * 1000
    const totalBrl = mongoSnapshot.total_usd * 5.0
    
    console.log('📊 Criando snapshot...')
    console.log('  User ID:', mongoSnapshot.user_id)
    console.log('  Total USD: $' + mongoSnapshot.total_usd)
    console.log('  Total BRL: R$' + totalBrl.toFixed(2))
    console.log('  Timestamp:', new Date(timestamp).toLocaleString())
    
    // Pegar o database do app
    const db = window.__DATABASE__ || database
    
    if (!db) {
      console.error('❌ Database não encontrado')
      console.log('ℹ️  Tente adicionar em algum componente React:')
      console.log('     import { database } from "@/lib/watermelon/database"')
      console.log('     window.__DATABASE__ = database')
      return false
    }
    
    // Criar snapshot
    const collection = db.get('balance_snapshots')
    
    await db.write(async () => {
      const snapshot = await collection.create(s => {
        s.userId = mongoSnapshot.user_id
        s.totalUsd = mongoSnapshot.total_usd
        s.totalBrl = totalBrl
        s.timestamp = timestamp
      })
      
      console.log('✅ Snapshot criado:', snapshot)
    })
    
    console.log('\n✅ SUCESSO! Snapshot importado!')
    console.log('\n📍 Verifique em:')
    console.log('   DevTools → Application → IndexedDB → balance_snapshots')
    
    return true
  } catch (error) {
    console.error('❌ Erro:', error)
    console.log('\nℹ️  Solução alternativa:')
    console.log('1. Adicione o componente <ImportSnapshot /> em alguma tela')
    console.log('2. Use o botão "Importar Exemplo Rápido"')
    return false
  }
}

// Executar
importarSnapshot()
