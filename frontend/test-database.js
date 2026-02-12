/**
 * Script de teste para verificar se o database está funcionando
 * Cole no console do navegador (F12 → Console)
 */

(async function testDatabase() {
  console.log('🧪 Testando Database...')
  
  try {
    // 1. Verifica se database existe
    if (!window.database) {
      console.error('❌ window.database não existe!')
      return
    }
    console.log('✅ window.database existe')
    console.log('   Tipo:', typeof window.database)
    console.log('   Valor:', window.database)
    
    // 2. Verifica se é uma instância de Database
    if (!window.database.get) {
      console.error('❌ database.get não é uma função!')
      return
    }
    console.log('✅ database.get() existe')
    
    // 3. Testa acessar collection
    const collection = window.database.get('user_exchanges')
    console.log('✅ Collection obtida:', collection)
    
    // 4. Testa query
    const count = await collection.query().fetchCount()
    console.log('✅ Query executada com sucesso')
    console.log('   Total de exchanges:', count)
    
    // 5. Lista todas as exchanges
    const exchanges = await collection.query().fetch()
    console.log('✅ Exchanges encontradas:', exchanges.length)
    
    if (exchanges.length > 0) {
      console.table(exchanges.map(e => ({
        ID: e.id,
        Exchange: e.exchangeName,
        Ativo: e.isActive ? '✅' : '❌',
        'Criado em': new Date(e.createdAt).toLocaleString('pt-BR')
      })))
    }
    
    // 6. Verifica ensureDatabaseInitialized
    if (window.ensureDatabaseInitialized) {
      console.log('✅ window.ensureDatabaseInitialized() existe')
      await window.ensureDatabaseInitialized()
    }
    
    console.log('🎉 TODOS OS TESTES PASSARAM!')
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error)
    console.error('   Stack:', error.stack)
  }
})();
