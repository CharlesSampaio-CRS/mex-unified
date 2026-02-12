/**
 * Hybrid Database Manager
 * 
 * Detecta automaticamente se está no Expo Go e usa o adapter apropriado:
 * - Expo Go: AsyncStorage (funciona, mas mais lento)
 * - Dev Client/Web: WatermelonDB (mais rápido, com JSI)
 */

import Constants from 'expo-constants'
import { Platform } from 'react-native'
import asyncStorageAdapter, { StorageItem } from './async-storage-adapter'

// Detectar Expo Go
const isExpoGo = Constants.appOwnership === 'expo' || 
                 (__DEV__ && typeof (global as any).nativeFabricUIManager === 'undefined')

// Collections disponíveis
export type CollectionName = 
  | 'user_exchanges'
  | 'balance_snapshots'
  | 'balance_history'
  | 'orders'
  | 'positions'
  | 'strategies'
  | 'notifications'
  | 'watchlist'
  | 'price_alerts'

interface DatabaseAdapter {
  save<T extends StorageItem>(collection: CollectionName, item: T): Promise<T>
  findById<T extends StorageItem>(collection: CollectionName, id: string): Promise<T | null>
  findAll<T extends StorageItem>(collection: CollectionName): Promise<T[]>
  update<T extends StorageItem>(collection: CollectionName, id: string, updates: Partial<T>): Promise<T | null>
  delete(collection: CollectionName, id: string): Promise<boolean>
  query<T extends StorageItem>(collection: CollectionName, predicate: (item: T) => boolean): Promise<T[]>
  clearCollection(collection: CollectionName): Promise<void>
}

class HybridDatabaseManager implements DatabaseAdapter {
  private adapter: DatabaseAdapter
  private usingExpoGoMode: boolean

  constructor() {
    this.usingExpoGoMode = isExpoGo

    if (this.usingExpoGoMode) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔄 [HybridDB] Modo EXPO GO detectado')
      console.log('   Usando AsyncStorage (funciona, mas mais lento)')
      console.log('')
      console.log('💡 Para melhor performance:')
      console.log('   npx expo start --web')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      // Usar AsyncStorage no Expo Go
      this.adapter = asyncStorageAdapter as any
    } else {
      console.log('✅ [HybridDB] Dev Client/Web detectado')
      console.log('   Usando WatermelonDB (com JSI)')
      
      // Usar WatermelonDB em Dev Client/Web
      try {
        // Lazy import para evitar erro no Expo Go
        const { database } = require('../watermelon/database')
        this.adapter = this.createWatermelonAdapter(database)
      } catch (error) {
        console.warn('⚠️  [HybridDB] Erro ao carregar WatermelonDB, usando AsyncStorage:', error)
        this.adapter = asyncStorageAdapter as any
        this.usingExpoGoMode = true
      }
    }
  }

  /**
   * Cria adapter para WatermelonDB
   */
  private createWatermelonAdapter(database: any): DatabaseAdapter {
    return {
      async save<T extends StorageItem>(collection: CollectionName, item: T): Promise<T> {
        const col = database.get(collection)
        const created = await database.write(async () => {
          return await col.create((record: any) => {
            Object.keys(item).forEach(key => {
              if (key !== 'id') {
                record[key] = (item as any)[key]
              }
            })
          })
        })
        return { ...item, id: created.id }
      },

      async findById<T extends StorageItem>(collection: CollectionName, id: string): Promise<T | null> {
        try {
          const col = database.get(collection)
          const record = await col.find(id)
          return record ? this.recordToObject(record) : null
        } catch {
          return null
        }
      },

      async findAll<T extends StorageItem>(collection: CollectionName): Promise<T[]> {
        const col = database.get(collection)
        const records = await col.query().fetch()
        return records.map(this.recordToObject)
      },

      async update<T extends StorageItem>(collection: CollectionName, id: string, updates: Partial<T>): Promise<T | null> {
        try {
          const col = database.get(collection)
          const record = await col.find(id)
          const updated = await database.write(async () => {
            return await record.update((rec: any) => {
              Object.keys(updates).forEach(key => {
                if (key !== 'id') {
                  rec[key] = (updates as any)[key]
                }
              })
            })
          })
          return this.recordToObject(updated)
        } catch {
          return null
        }
      },

      async delete(collection: CollectionName, id: string): Promise<boolean> {
        try {
          const col = database.get(collection)
          const record = await col.find(id)
          await database.write(async () => {
            await record.destroyPermanently()
          })
          return true
        } catch {
          return false
        }
      },

      async query<T extends StorageItem>(collection: CollectionName, predicate: (item: T) => boolean): Promise<T[]> {
        const all = await this.findAll(collection) as T[]
        return all.filter(predicate)
      },

      async clearCollection(collection: CollectionName): Promise<void> {
        const col = database.get(collection)
        const records = await col.query().fetch()
        await database.write(async () => {
          await Promise.all(records.map((r: any) => r.destroyPermanently()))
        })
      },
    }
  }

  private recordToObject(record: any): any {
    const obj: any = { id: record.id }
    Object.keys(record._raw).forEach(key => {
      if (key !== 'id') {
        obj[key] = record[key]
      }
    })
    return obj
  }

  // Proxy methods
  async save<T extends StorageItem>(collection: CollectionName, item: T): Promise<T> {
    return this.adapter.save(collection, item)
  }

  async findById<T extends StorageItem>(collection: CollectionName, id: string): Promise<T | null> {
    return this.adapter.findById(collection, id)
  }

  async findAll<T extends StorageItem>(collection: CollectionName): Promise<T[]> {
    return this.adapter.findAll(collection)
  }

  async update<T extends StorageItem>(collection: CollectionName, id: string, updates: Partial<T>): Promise<T | null> {
    return this.adapter.update(collection, id, updates)
  }

  async delete(collection: CollectionName, id: string): Promise<boolean> {
    return this.adapter.delete(collection, id)
  }

  async query<T extends StorageItem>(collection: CollectionName, predicate: (item: T) => boolean): Promise<T[]> {
    return this.adapter.query(collection, predicate)
  }

  async clearCollection(collection: CollectionName): Promise<void> {
    return this.adapter.clearCollection(collection)
  }

  isUsingExpoGoMode(): boolean {
    return this.usingExpoGoMode
  }

  getAdapterType(): 'AsyncStorage' | 'WatermelonDB' {
    return this.usingExpoGoMode ? 'AsyncStorage' : 'WatermelonDB'
  }
}

// Singleton instance
export const hybridDatabase = new HybridDatabaseManager()
export default hybridDatabase
