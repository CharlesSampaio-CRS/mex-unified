import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'
import { schema } from './schema'
import { migrations } from './migrations'
import { 
  UserExchange,
  BalanceSnapshot,
  BalanceHistory,
  Order,
  Position,
  Strategy,
  Notification
} from './models'

// 🌐 WEB: Usa LokiJSAdapter com IndexedDB
const adapter = new LokiJSAdapter({
  schema,
  migrations, // ✅ Migrações ativadas
  useWebWorker: false, // true = melhor performance, mas precisa configurar worker
  useIncrementalIndexedDB: true, // ✅ PERSISTÊNCIA ATIVADA - Dados salvos no IndexedDB
  dbName: 'cryptohub', // Nome do database no IndexedDB
  onSetUpError: (error: Error) => {
    console.error('❌ [WatermelonDB Web] Setup error:', error)
    
    // Se o banco está corrompido, limpa e recarrega
    if (error.message.includes('Corrupted database') || error.message.includes('missing metadata')) {
      
      // Limpar IndexedDB
      if (typeof window !== 'undefined' && window.indexedDB) {
        try {
          window.indexedDB.deleteDatabase('cryptohub')
          
          // Aguardar um pouco e recarregar
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } catch (deleteError) {
          alert('⚠️ Banco de dados corrompido!\n\nAbra o console (F12) e execute o script fix-corrupted-db.js')
        }
      }
    }
  }
})

// Database instance
const database = new Database({
  adapter,
  modelClasses: [
    UserExchange,
    BalanceSnapshot,
    BalanceHistory,
    Order,
    Position,
    Strategy,
    Notification,
  ],
})

// 🔧 Função para verificar e criar collections se necessário
export async function ensureDatabaseInitialized() {
  try {
    
    // Tenta acessar cada collection para garantir que existe
    const collections = [
      'user_exchanges',
      'balance_snapshots',
      'balance_history',
      'orders',
      'positions',
      'strategies',
      'notifications'
    ]
    
    for (const collectionName of collections) {
      const collection = database.get(collectionName)
      const count = await collection.query().fetchCount()
      
    }
  
    
    return true
  } catch (error) {
    
    // Se falhar, força reload completo
    if (__DEV__) {
      
      // Limpa tudo antes de recarregar
      if (typeof window !== 'undefined') {
        if (window.indexedDB) {
          window.indexedDB.deleteDatabase('cryptohub')
        }
        if (window.localStorage) {
          localStorage.clear()
        }
        if (window.sessionStorage) {
          sessionStorage.clear()
        }
        
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    }
    
    return false
  }
}

// Expor database no window para debug/scripts
if (typeof window !== 'undefined') {
  // Proteger contra chamadas acidentais como database()
  Object.defineProperty(window, 'database', {
    value: database,
    writable: false,
    configurable: true,
    enumerable: true
  });
  
  (window as any).ensureDatabaseInitialized = ensureDatabaseInitialized
  
}

// Inicializa automaticamente ao carregar
if (typeof window !== 'undefined') {
  ensureDatabaseInitialized().catch(error => {
    console.error('❌ [WatermelonDB] Failed to initialize:', error)
  })
}

// Export named para compatibilidade
export { database }

// Export default
export default database
