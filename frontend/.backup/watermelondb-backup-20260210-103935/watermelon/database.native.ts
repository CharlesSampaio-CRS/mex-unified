import { Database, Q } from '@nozbe/watermelondb'
import { Platform } from 'react-native'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import Constants from 'expo-constants'
import { schema } from './schema'
import { 
  UserExchange,
  BalanceSnapshot,
  BalanceHistory,
  Order,
  Position,
  Strategy,
  Notification
} from './models'

// 📱 MOBILE: Usa SQLiteAdapter
// Detectar se está rodando no Expo Go
// Expo Go não suporta JSI, então precisamos desabilitar
const isExpoGo = Constants.appOwnership === 'expo' || __DEV__ && typeof (global as any).nativeFabricUIManager === 'undefined'

// ⚠️ IMPORTANTE: No Expo Go, WatermelonDB não funcionará completamente
// JSI é necessário para performance, mas não está disponível no Expo Go
// Apenas em builds standalone (EAS Build) ou desenvolvimento local com expo-dev-client

if (isExpoGo) {
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.warn('⚠️  [WatermelonDB] EXPO GO DETECTADO')
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.warn('')
  console.warn('❌ Banco de dados local NÃO FUNCIONARÁ no Expo Go')
  console.warn('   (JSI não está disponível)')
  console.warn('')
  console.warn('✅ SOLUÇÕES:')
  console.warn('')
  console.warn('   1️⃣  Expo Web (RECOMENDADO para dev):')
  console.warn('       npx expo start --web')
  console.warn('')
  console.warn('   2️⃣  Expo Dev Client (para celular):')
  console.warn('       npx expo install expo-dev-client')
  console.warn('       npx eas build --profile development --platform android')
  console.warn('       npx expo start --dev-client')
  console.warn('')
  console.warn('   📖 Leia: WATERMELONDB-EXPO-GUIDE.md')
  console.warn('')
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

let adapter: SQLiteAdapter
let database: Database

try {
  adapter = new SQLiteAdapter({
    schema,
    // JSI só funciona em builds standalone (EAS Build) ou expo-dev-client
    // No Expo Go, WatermelonDB não funcionará corretamente
    jsi: !isExpoGo, // Desabilita JSI no Expo Go
    onSetUpError: (error: Error) => {
      console.error('❌ [WatermelonDB Mobile] Setup error:', error)
      if (isExpoGo) {
        console.error('')
        console.error('💡 Este erro é ESPERADO no Expo Go')
        console.error('   Use Expo Web ou Dev Client para banco local')
        console.error('   Veja: WATERMELONDB-EXPO-GUIDE.md')
      }
    }
  })

  // Database instance
  database = new Database({
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

  console.log('✅ [WatermelonDB Mobile] Database inicializado', {
    platform: Platform.OS,
    isExpoGo,
    jsiEnabled: !isExpoGo
  })

} catch (error) {
  console.error('❌ [WatermelonDB Mobile] ERRO CRÍTICO ao inicializar database:', error)
  
  if (isExpoGo) {
    console.error('')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('🚨 ERRO ESPERADO: Você está usando Expo Go!')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('')
    console.error('Para usar o banco de dados local:')
    console.error('1. npx expo start --web (mais fácil)')
    console.error('2. Ou instale expo-dev-client')
    console.error('')
    console.error('Leia: WATERMELONDB-EXPO-GUIDE.md para detalhes')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
  
  throw error
}

export { database }
export default database

// Helper para verificar se database está disponível
export const isDatabaseAvailable = () => {
  return !isExpoGo && database !== null
}

// Helper para garantir que database está inicializado
export const ensureDatabaseInitialized = async () => {
  if (!isDatabaseAvailable()) {
    throw new Error('Database não disponível no Expo Go. Use Expo Web ou Dev Client.')
  }
  return database
}
