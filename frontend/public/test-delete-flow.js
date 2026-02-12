/**
 * Script de Teste: Fluxo de Delete
 * 
 * Este script testa se o delete está realmente removendo exchanges do WatermelonDB
 * 
 * Como usar:
 * 1. Abra o console do navegador (F12)
 * 2. Cole este script e execute
 * 3. Observe os logs detalhados
 */

async function testDeleteFlow() {
  console.log('🧪 ========== TESTE: FLUXO DE DELETE ==========')
  
  try {
    // 1. Verificar se o database está disponível
    if (!window.database) {
      console.error('❌ window.database não está disponível!')
      return
    }
    console.log('✅ Database disponível')
    
    // 2. Listar exchanges ANTES do delete
    const collection = window.database.get('user_exchanges')
    const beforeExchanges = await collection.query().fetch()
    
    console.log('\n📊 ANTES DO DELETE:')
    console.log(`Total de exchanges: ${beforeExchanges.length}`)
    console.table(beforeExchanges.map(ex => ({
      id: ex.id,
      name: ex.exchangeName,
      isActive: ex.isActive,
      createdAt: ex.createdAt?.toISOString()
    })))
    
    if (beforeExchanges.length === 0) {
      console.warn('⚠️ Não há exchanges para testar delete!')
      console.log('💡 Adicione uma exchange primeiro')
      return
    }
    
    // 3. Pegar a primeira exchange para deletar
    const exchangeToDelete = beforeExchanges[0]
    console.log('\n🎯 Exchange selecionada para DELETE:')
    console.log({
      id: exchangeToDelete.id,
      name: exchangeToDelete.exchangeName,
      isActive: exchangeToDelete.isActive
    })
    
    // 4. Executar o DELETE
    console.log('\n🗑️ Executando DELETE...')
    await window.database.write(async () => {
      await exchangeToDelete.destroyPermanently()
    })
    console.log('✅ DELETE executado com sucesso!')
    
    // 5. Aguardar um pouco para o WatermelonDB processar
    console.log('\n⏳ Aguardando 1 segundo...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 6. Listar exchanges DEPOIS do delete
    const afterExchanges = await collection.query().fetch()
    
    console.log('\n📊 DEPOIS DO DELETE:')
    console.log(`Total de exchanges: ${afterExchanges.length}`)
    console.table(afterExchanges.map(ex => ({
      id: ex.id,
      name: ex.exchangeName,
      isActive: ex.isActive,
      createdAt: ex.createdAt?.toISOString()
    })))
    
    // 7. Verificar se realmente deletou
    const wasDeleted = !afterExchanges.find(ex => ex.id === exchangeToDelete.id)
    
    console.log('\n📋 RESULTADO:')
    console.log(`Exchanges antes: ${beforeExchanges.length}`)
    console.log(`Exchanges depois: ${afterExchanges.length}`)
    console.log(`Diferença: ${beforeExchanges.length - afterExchanges.length}`)
    console.log(`Exchange foi deletada? ${wasDeleted ? '✅ SIM' : '❌ NÃO'}`)
    
    if (wasDeleted && afterExchanges.length === beforeExchanges.length - 1) {
      console.log('\n🎉 SUCESSO! Delete funcionou corretamente!')
    } else {
      console.error('\n❌ FALHA! Delete não funcionou como esperado!')
    }
    
    // 8. Testar persistência
    console.log('\n💾 Para testar persistência:')
    console.log('1. Recarregue a página (F5)')
    console.log('2. Execute este script novamente')
    console.log('3. Verifique se o total de exchanges continua igual')
    
  } catch (error) {
    console.error('❌ Erro no teste:', error)
  }
  
  console.log('\n🧪 ========== FIM DO TESTE ==========')
}

// Executar o teste
testDeleteFlow()
