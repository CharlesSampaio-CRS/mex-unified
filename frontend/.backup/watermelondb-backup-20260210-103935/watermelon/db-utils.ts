/**
 * Utilitários para verificar disponibilidade do WatermelonDB
 * e lidar com execução no Expo Go
 */

import Constants from 'expo-constants'

/**
 * Verifica se está rodando no Expo Go
 * Expo Go não suporta JSI/WatermelonDB
 */
export const isExpoGo = (): boolean => {
  return Constants.appOwnership === 'expo'
}

/**
 * Verifica se WatermelonDB está disponível
 * @returns true se database está disponível para uso
 */
export const isDatabaseAvailable = (): boolean => {
  return !isExpoGo()
}

/**
 * Executa uma operação de banco de dados apenas se disponível
 * Se não disponível (Expo Go), retorna o valor padrão
 * 
 * @example
 * const data = await safeDbOperation(
 *   async () => {
 *     const snapshots = await database.collections.get('balance_snapshots').query().fetch()
 *     return snapshots
 *   },
 *   [] // valor padrão se DB não disponível
 * )
 */
export const safeDbOperation = async <T>(
  operation: () => Promise<T>,
  defaultValue: T,
  operationName?: string
): Promise<T> => {
  if (!isDatabaseAvailable()) {
    if (operationName) {
      console.warn(`⚠️  [DB] Operação "${operationName}" ignorada - WatermelonDB não disponível no Expo Go`)
    }
    return defaultValue
  }

  try {
    return await operation()
  } catch (error) {
    console.error(`❌ [DB] Erro na operação${operationName ? ` "${operationName}"` : ''}:`, error)
    return defaultValue
  }
}

/**
 * Executa uma operação de banco de dados síncrona apenas se disponível
 */
export const safeDbOperationSync = <T>(
  operation: () => T,
  defaultValue: T,
  operationName?: string
): T => {
  if (!isDatabaseAvailable()) {
    if (operationName) {
      console.warn(`⚠️  [DB] Operação "${operationName}" ignorada - WatermelonDB não disponível no Expo Go`)
    }
    return defaultValue
  }

  try {
    return operation()
  } catch (error) {
    console.error(`❌ [DB] Erro na operação${operationName ? ` "${operationName}"` : ''}:`, error)
    return defaultValue
  }
}
