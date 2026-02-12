/**
 * WatermelonDB Database Configuration
 * 
 * Este arquivo detecta automaticamente a plataforma e importa o adapter correto:
 * - 🌐 Web: LokiJSAdapter (IndexedDB)
 * - 📱 Mobile: SQLiteAdapter
 * 
 * React Native/Metro automaticamente carrega o arquivo correto baseado na extensão:
 * - database.web.ts → Para web (Next.js, Expo Web)
 * - database.native.ts → Para mobile (iOS, Android)
 * - database.ts → Fallback
 */

// O Metro/Webpack automaticamente carrega database.web.ts ou database.native.ts
// baseado na plataforma alvo. Este arquivo é um fallback que nunca será usado
// em produção, mas é necessário para satisfazer imports em arquivos comuns.

import { database as db, ensureDatabaseInitialized } from './database.web'

export { ensureDatabaseInitialized }
export { db as database }
export default db


