/**
 * Script para resetar o banco SQLite
 * Use após mudanças de schema
 */

import { sqliteDatabase } from '../lib/sqlite/database'

async function resetDatabase() {
  console.log('🔄 Resetando banco de dados SQLite...')
  
  try {
    await sqliteDatabase.resetDatabase()
    console.log('✅ Banco resetado com sucesso!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erro ao resetar banco:', error)
    process.exit(1)
  }
}

resetDatabase()
