// Script para testar persistência do WatermelonDB
// Cole este código no console do navegador (F12)

console.log('🧪 Testando persistência do WatermelonDB...')

// 1. Verificar se o database existe
if (!window.database) {
  console.error('❌ Database não encontrado em window.database')
  console.log('💡 Certifique-se de que o app está rodando')
} else {
  console.log('✅ Database encontrado:', window.database)
}

// 2. Função para contar registros
async function countRecords() {
  const collections = [
    'user_exchanges',
    'balance_snapshots',
    'balance_history',
    'orders',
    'positions',
    'strategies',
    'notifications'
  ]
  
  console.log('\n📊 Contando registros...')
  
  for (const collectionName of collections) {
    try {
      const collection = window.database.get(collectionName)
      const count = await collection.query().fetchCount()
      console.log(`  ${collectionName}: ${count} registros`)
    } catch (err) {
      console.error(`  ❌ Erro ao contar ${collectionName}:`, err)
    }
  }
}

// 3. Função para listar exchanges
async function listExchanges() {
  console.log('\n📋 Listando exchanges conectadas...')
  
  try {
    const collection = window.database.get('user_exchanges')
    const exchanges = await collection.query().fetch()
    
    if (exchanges.length === 0) {
      console.log('  ℹ️ Nenhuma exchange conectada')
    } else {
      console.log(`  ✅ ${exchanges.length} exchange(s) encontrada(s):`)
      exchanges.forEach((ex, index) => {
        console.log(`\n  [${index + 1}] ${ex.exchangeName}`)
        console.log(`      ID: ${ex.id}`)
        console.log(`      Ativo: ${ex.isActive ? '✅' : '❌'}`)
        console.log(`      Criado em: ${ex.createdAt}`)
      })
    }
  } catch (err) {
    console.error('  ❌ Erro ao listar exchanges:', err)
  }
}

// 4. Função para adicionar exchange de teste
async function addTestExchange() {
  console.log('\n🧪 Adicionando exchange de teste...')
  
  try {
    const collection = window.database.get('user_exchanges')
    
    const testExchange = await window.database.write(async () => {
      return await collection.create(exchange => {
        exchange.userId = 'test-user-id'
        exchange.exchangeName = 'TestExchange'
        exchange.apiKeyEncrypted = 'test-api-key-' + Date.now()
        exchange.apiSecretEncrypted = 'test-api-secret-' + Date.now()
        exchange.isActive = true
      })
    })
    
    console.log('  ✅ Exchange de teste adicionada:', testExchange.id)
    console.log('  📝 Nome:', testExchange.exchangeName)
    console.log('  💡 Agora recarregue a página (F5) e execute listExchanges() novamente')
    console.log('  💡 A exchange de teste ainda estará lá!')
  } catch (err) {
    console.error('  ❌ Erro ao adicionar exchange de teste:', err)
  }
}

// 5. Função para deletar exchange de teste
async function deleteTestExchange() {
  console.log('\n🗑️ Deletando exchange de teste...')
  
  try {
    const collection = window.database.get('user_exchanges')
    const exchanges = await collection.query().fetch()
    const testExchange = exchanges.find(ex => ex.exchangeName === 'TestExchange')
    
    if (testExchange) {
      await window.database.write(async () => {
        await testExchange.destroyPermanently()
      })
      console.log('  ✅ Exchange de teste deletada')
    } else {
      console.log('  ℹ️ Nenhuma exchange de teste encontrada')
    }
  } catch (err) {
    console.error('  ❌ Erro ao deletar exchange de teste:', err)
  }
}

// 6. Função para verificar IndexedDB
async function checkIndexedDB() {
  console.log('\n🔍 Verificando IndexedDB...')
  
  if (!window.indexedDB) {
    console.error('  ❌ IndexedDB não suportado neste navegador')
    return
  }
  
  const databases = await window.indexedDB.databases()
  console.log('  📊 Databases encontrados:', databases.length)
  
  databases.forEach(db => {
    console.log(`    - ${db.name} (versão ${db.version})`)
  })
  
  const cryptohub = databases.find(db => db.name === 'cryptohub')
  if (cryptohub) {
    console.log('\n  ✅ Database "cryptohub" encontrado!')
    console.log('  💾 Versão:', cryptohub.version)
  } else {
    console.log('\n  ⚠️ Database "cryptohub" não encontrado')
  }
}

// Executar testes
async function runAllTests() {
  console.log('🚀 Executando todos os testes...\n')
  
  await checkIndexedDB()
  await countRecords()
  await listExchanges()
  
  console.log('\n✅ Testes concluídos!')
  console.log('\n📚 Funções disponíveis:')
  console.log('  - countRecords() - Conta registros em todas as tabelas')
  console.log('  - listExchanges() - Lista exchanges conectadas')
  console.log('  - addTestExchange() - Adiciona exchange de teste')
  console.log('  - deleteTestExchange() - Deleta exchange de teste')
  console.log('  - checkIndexedDB() - Verifica IndexedDB')
  console.log('  - runAllTests() - Executa todos os testes')
}

// Expor funções globalmente
window.testDB = {
  countRecords,
  listExchanges,
  addTestExchange,
  deleteTestExchange,
  checkIndexedDB,
  runAllTests
}

console.log('\n📦 Funções de teste disponíveis em window.testDB')
console.log('💡 Execute: window.testDB.runAllTests()')

// Executar automaticamente
await runAllTests()
