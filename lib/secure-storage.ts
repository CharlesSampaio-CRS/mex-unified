import * as SecureStore from 'expo-secure-store'

/**
 * Wrapper para SecureStore - Mobile Only
 * Usa expo-secure-store (criptografado e seguro)
 */

export const secureStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key)
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value)
  },

  async deleteItemAsync(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key)
  },
}
