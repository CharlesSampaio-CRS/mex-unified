import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations'

/**
 * 🔄 Database Migrations
 * 
 * IMPORTANTE: Sempre que alterar o schema, incremente a versão e adicione uma migração
 */
export const migrations = schemaMigrations({
  migrations: [
    // ✅ v1 → v2: Adiciona exchange_type para identificar o tipo CCXT da exchange
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'user_exchanges',
          columns: [
            { name: 'exchange_type', type: 'string', isIndexed: true },
          ]
        }),
      ]
    },
  ]
})
