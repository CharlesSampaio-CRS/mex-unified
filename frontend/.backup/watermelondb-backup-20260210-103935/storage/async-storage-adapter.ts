/**
 * AsyncStorage Adapter - Compatível com Expo Go
 * 
 * Implementa um adapter que funciona no Expo Go usando AsyncStorage
 * como alternativa ao WatermelonDB quando JSI não está disponível
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

export interface StorageItem {
  id: string
  [key: string]: any
}

class AsyncStorageAdapter {
  private prefix: string

  constructor(prefix: string = 'crypto_app') {
    this.prefix = prefix
  }

  private getKey(collection: string, id?: string): string {
    return id ? `${this.prefix}:${collection}:${id}` : `${this.prefix}:${collection}:index`
  }

  /**
   * Salva um item em uma collection
   */
  async save<T extends StorageItem>(collection: string, item: T): Promise<T> {
    try {
      // Salvar o item individual
      const itemKey = this.getKey(collection, item.id)
      await AsyncStorage.setItem(itemKey, JSON.stringify(item))

      // Atualizar índice da collection
      const indexKey = this.getKey(collection)
      const indexData = await AsyncStorage.getItem(indexKey)
      const index = indexData ? JSON.parse(indexData) : []
      
      if (!index.includes(item.id)) {
        index.push(item.id)
        await AsyncStorage.setItem(indexKey, JSON.stringify(index))
      }

      return item
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao salvar item em ${collection}:`, error)
      throw error
    }
  }

  /**
   * Busca um item por ID
   */
  async findById<T extends StorageItem>(collection: string, id: string): Promise<T | null> {
    try {
      const key = this.getKey(collection, id)
      const data = await AsyncStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao buscar item ${id} em ${collection}:`, error)
      return null
    }
  }

  /**
   * Busca todos os itens de uma collection
   */
  async findAll<T extends StorageItem>(collection: string): Promise<T[]> {
    try {
      const indexKey = this.getKey(collection)
      const indexData = await AsyncStorage.getItem(indexKey)
      const index = indexData ? JSON.parse(indexData) : []

      const items: T[] = []
      for (const id of index) {
        const item = await this.findById<T>(collection, id)
        if (item) items.push(item)
      }

      return items
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao buscar todos de ${collection}:`, error)
      return []
    }
  }

  /**
   * Atualiza um item
   */
  async update<T extends StorageItem>(collection: string, id: string, updates: Partial<T>): Promise<T | null> {
    try {
      const existing = await this.findById<T>(collection, id)
      if (!existing) return null

      const updated = { ...existing, ...updates }
      await this.save(collection, updated)
      return updated
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao atualizar item ${id} em ${collection}:`, error)
      return null
    }
  }

  /**
   * Deleta um item
   */
  async delete(collection: string, id: string): Promise<boolean> {
    try {
      // Remover item
      const itemKey = this.getKey(collection, id)
      await AsyncStorage.removeItem(itemKey)

      // Atualizar índice
      const indexKey = this.getKey(collection)
      const indexData = await AsyncStorage.getItem(indexKey)
      const index = indexData ? JSON.parse(indexData) : []
      const newIndex = index.filter((itemId: string) => itemId !== id)
      await AsyncStorage.setItem(indexKey, JSON.stringify(newIndex))

      return true
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao deletar item ${id} em ${collection}:`, error)
      return false
    }
  }

  /**
   * Busca com query simples (filtragem em memória)
   */
  async query<T extends StorageItem>(
    collection: string,
    predicate: (item: T) => boolean
  ): Promise<T[]> {
    try {
      const all = await this.findAll<T>(collection)
      return all.filter(predicate)
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao fazer query em ${collection}:`, error)
      return []
    }
  }

  /**
   * Limpa uma collection inteira
   */
  async clearCollection(collection: string): Promise<void> {
    try {
      const indexKey = this.getKey(collection)
      const indexData = await AsyncStorage.getItem(indexKey)
      const index = indexData ? JSON.parse(indexData) : []

      // Remover todos os itens
      for (const id of index) {
        const itemKey = this.getKey(collection, id)
        await AsyncStorage.removeItem(itemKey)
      }

      // Limpar índice
      await AsyncStorage.removeItem(indexKey)
    } catch (error) {
      console.error(`[AsyncStorageAdapter] Erro ao limpar collection ${collection}:`, error)
    }
  }

  /**
   * Limpa TUDO do storage (reset completo)
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      const appKeys = keys.filter(key => key.startsWith(this.prefix))
      await AsyncStorage.multiRemove(appKeys)
    } catch (error) {
      console.error('[AsyncStorageAdapter] Erro ao limpar tudo:', error)
    }
  }
}

// Singleton instance
export const asyncStorageAdapter = new AsyncStorageAdapter()
export default asyncStorageAdapter
