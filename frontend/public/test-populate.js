/**
 * Script de Teste para Debug da População de Exchanges
 * 
 * Cole este código no console do navegador para testar manualmente
 */

async function testPopulate() {
  console.log('🧪 [TEST] Iniciando teste de população...')
  
  // 1. Verificar se database está disponível
  if (!window.database) {
    console.error('❌ [TEST] window.database não encontrado!')
    console.log('💡 [TEST] Aguarde o app carregar completamente')
    return
  }
  console.log('✅ [TEST] Database encontrado:', window.database)
  
  // 2. Verificar collection
  try {
    const collection = window.database.get('user_exchanges')
    console.log('✅ [TEST] Collection user_exchanges acessível:', collection)
  } catch (error) {
    console.error('❌ [TEST] Erro ao acessar collection:', error)
    return
  }
  
  // 3. Verificar exchanges existentes
  try {
    const collection = window.database.get('user_exchanges')
    const existing = await collection.query().fetch()
    console.log('📊 [TEST] Exchanges existentes:', existing.length)
    
    if (existing.length > 0) {
      console.table(existing.map(e => ({
        ID: e.id.substring(0, 8),
        Nome: e.exchangeName,
        Ativa: e.isActive,
        UserId: e.userId.substring(0, 8)
      })))
    }
  } catch (error) {
    console.error('❌ [TEST] Erro ao buscar exchanges:', error)
  }
  
  // 4. Testar criação manual
  try {
    console.log('🧪 [TEST] Testando criação de exchange...')
    const collection = window.database.get('user_exchanges')
    
    await window.database.write(async () => {
      await collection.create((exchange) => {
        exchange.userId = '6950290f5d594da225720e58'
        exchange.exchangeName = 'TEST_EXCHANGE'
        exchange.apiKeyEncrypted = 'test_key'
        exchange.apiSecretEncrypted = 'test_secret'
        exchange.isActive = true
        exchange.createdAt = new Date()
        exchange.updatedAt = new Date()
      })
    })
    
    console.log('✅ [TEST] Exchange de teste criada com sucesso!')
    
    // Verificar
    const count = await collection.query().fetchCount()
    console.log('📊 [TEST] Total após criação:', count)
    
  } catch (error) {
    console.error('❌ [TEST] Erro ao criar exchange de teste:', error)
    console.error('Stack:', error.stack)
  }
  
  console.log('🏁 [TEST] Teste concluído!')
}

// Função para limpar todas as exchanges
async function clearExchanges() {
  try {
    const collection = window.database.get('user_exchanges')
    const existing = await collection.query().fetch()
    
    console.log(`🗑️ Limpando ${existing.length} exchanges...`)
    
    await window.database.write(async () => {
      for (const exchange of existing) {
        await exchange.destroyPermanently()
      }
    })
    
    console.log('✅ Exchanges limpas!')
  } catch (error) {
    console.error('❌ Erro ao limpar:', error)
  }
}

// Expor funções globalmente
window.testPopulate = testPopulate
window.clearExchanges = clearExchanges

console.log('✅ Funções de teste carregadas!')
console.log('📌 Execute: testPopulate()')
console.log('📌 Para limpar: clearExchanges()')
