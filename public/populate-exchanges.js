/**
 * Script para Popular Exchanges do MongoDB no WatermelonDB
 * 
 * COMO USAR:
 * 1. Abra o navegador (http://localhost:3000)
 * 2. Certifique-se de que o app está carregado (aguarde alguns segundos)
 * 3. Abra DevTools (F12) → Console
 * 4. Cole todo este código e aperte Enter
 * 5. Execute: popularExchanges()
 * 6. Verifique: verExchanges()
 */

// Mapeamento de exchange_id para nome
const EXCHANGE_NAMES = {
  '693481148b0a41e8b6acb079': 'NovaDAX',
  '693481148b0a41e8b6acb07b': 'MEXC',
  '693481148b0a41e8b6acb078': 'Bybit',
  '693481148b0a41e8b6acb073': 'Binance',
  '693481148b0a41e8b6acb075': 'Gate.io',
  '693481148b0a41e8b6acb07a': 'KuCoin',
  '6942d26ffa8ecd38fb975eff': 'OKX',
  '6942d27ffa8ecd38fb975f01': 'Coinbase',
}

// Dados do MongoDB
const MONGO_DATA = {
  user_id: '6950290f5d594da225720e58',
  exchanges: [
    {
      exchange_id: '693481148b0a41e8b6acb079',
      api_key_encrypted: 'gAAAAABpNJeS3m9vXXv9kOVGGpaVKw03ugUOmDHkCUzyySP0XhY2ynUfVHn1Cgup4NjJmAAueu8cPOIGJ_lPERFvlRsq6m4Pdp2DnFQicSkzMUuUMJ0j1WMoy2bwfq-RvxmUfnn1mhI0',
      api_secret_encrypted: 'gAAAAABpNJeTcXg61vdkNma23ZFjmoKQ7Mc8XrMoieQQTvabSo7OfnJJa63kZonDc-k4_pkqnPbfZd5wDM-tnY7XKPSbcFc7x8KzjMFRDnbahJVBkeU0wc3nD7y2j9tFBIscXQiHsn7V',
      passphrase_encrypted: null,
      is_active: true,
      created_at: '2025-12-06T20:52:35.043Z',
      updated_at: '2025-12-13T20:06:09.580Z'
    },
    {
      exchange_id: '693481148b0a41e8b6acb07b',
      api_key_encrypted: 'gAAAAABpP2bzUTzP_TqA9r7rEFmqrpc1IOTKJPJtLYIh_nPOsY4dG9Az6E7BryZ2PxkhB2cBGdOk0vxgruYXhQ5kj2LFzIjQnpCbyQf7W1BR80H3oyn9wwY=',
      api_secret_encrypted: 'gAAAAABpP2bzL7LnOWeeBaKsaj0E8KRSjevq96WZpPmQBlc9iSyx-bCjqn4FnxbbZJ0oEjRQg8_4PQ-WuIDdlnLUggHPnIWPZ9s4OzrpAIyXN8Er4eEiuARz4wUNuf0ImpKdzFLPMf6V',
      passphrase_encrypted: null,
      is_active: true,
      created_at: '2025-12-15T01:40:03.886Z',
      updated_at: '2025-12-15T01:40:03.886Z'
    },
    {
      exchange_id: '693481148b0a41e8b6acb078',
      api_key_encrypted: 'gAAAAABpQXDLF80vof2DHK58VxYs2SO1Q3y5jUOdLnIRCttm_eRwGmridTT6fS-hOpr6m2NiLpRd2gG-_-b7Wc9hQ1cf17kTxqL64Ij2X9mQ3hRKGZ3m7XI=',
      api_secret_encrypted: 'gAAAAABpQXDLpXut1_-y6bacOoiEDhDOj6n9Kq57sTewpTR6QvZ8qikWDTohtVvnFW7CwZkdU6160wdWzwzpqawmyCUeT1LHMvER_UkhPce8zjG6LVKO4v1wxQV9UOXvvRxLjEqrbGxf',
      passphrase_encrypted: null,
      is_active: true,
      created_at: '2025-12-16T14:45:54.317Z',
      updated_at: '2025-12-16T14:46:35.298Z'
    },
    {
      exchange_id: '693481148b0a41e8b6acb073',
      api_key_encrypted: 'gAAAAABpQjWDc2nsIudiuM_8qehnajxNL0ch0TouQLHH0rRa7jrAPt_R2xhLTXctCG2cQk3jHOCkxmrpL98OOcc81ReJtUL1P3cjoDd1gZnHGbU7pM_z3UgSe4pCt6QOrxPZA0eddVulGazbvXuDHqw2J9MqEEG3sGaU0mJ5GToSiLoUHBUAZuY=',
      api_secret_encrypted: 'gAAAAABpQjWD7dCy80AuJzg0WNBhZJWLUy0co6dToDVD9K3cxU1h3cHembjh6MCd8E1u691aGc0QRKX66DHCBbsvQ2kAMrQDiZzf7Z4UqZ8NzreOLM2aqOHKbj4cepmev4tW25DjdL0LeuNOrALTceN0YJ2V8BZxKMCkSZIr1acdvD8iwlWTkwI=',
      passphrase_encrypted: null,
      is_active: false,
      created_at: '2025-12-17T04:45:55.238Z',
      updated_at: '2025-12-17T04:45:55.238Z'
    },
    {
      exchange_id: '693481148b0a41e8b6acb075',
      api_key_encrypted: 'gAAAAABpQja3Cr7X_x1nztx0WhYsE0ZjFpbO54SLr4XxNLFduIpRLDwJbrP3RfeP1x1Wv5wrnFyhGv3YFi3FmRxdpGO8b37UZnitMayJSmzvX3dhuhBYPWJnhvKV_D7ctd0-JSwcf_EP1b8-ct0x80Z6fR-8q9DKTQ==',
      api_secret_encrypted: 'gAAAAABpQja3prAGzduvIUs3J8RRjC_3f_LfJVaRcmlilZhrqfBjotbaCWQ5TQVUGI-81fIDfTjAq9IMJSwIGZN0allupQDqmKtI5aZLKzG-5WU8rcZbNhqee0TW1Oamh2vFj1kyUqoBWnWq_cFUhEAZy-WKvOWpXkXr8BhFd5Vc9oGtzG46VW2k3t0dKXykujOoQjItnemS',
      passphrase_encrypted: null,
      is_active: false,
      created_at: '2025-12-17T04:51:03.745Z',
      updated_at: '2025-12-17T04:51:03.745Z'
    },
    {
      exchange_id: '693481148b0a41e8b6acb07a',
      api_key_encrypted: 'gAAAAABpQjmdbaQdMokOj7c0n9C0GWYk1WPJQhLp0CGNPSrEHHvNH9pRhqCtqLluOiS3GWDt92KWwi_47B04ZJkwGLbyXbhhYFiu3FDgLJhXnh_8U2yBcWwAep7LKfWi87Ecq1tAQovA',
      api_secret_encrypted: 'gAAAAABpQjmduknlvEqlEvIbvQ5wbYTqc_vch3MYsukNiA7nbOnO-0W8U43cpmQOSb9P0LI4OkCGZx9fChzSTpEHRQJUvTBn4HtXq5CcaS3UaPAEt1fir7hEmc-1PAH-StBmWiE_r0TsEieuAtFROF7RKYQuXW-xwPxaYZwXbCTMai9FcvNHwj0=',
      passphrase_encrypted: null,
      is_active: false,
      created_at: '2025-12-17T05:03:25.506Z',
      updated_at: '2025-12-17T05:03:25.506Z'
    },
    {
      exchange_id: '6942d26ffa8ecd38fb975eff',
      api_key_encrypted: 'gAAAAABpQtNGxMmv8SamcU8I7a6Lr3hfEAokFLW9CPOkoqSKQA-y7HowmgQEYNCrrCJoazVTR3_d95_-cixE-2Tjoy9AsDQBrKsnpBXLAqyDNGjSYsYHtwl6PqY_OIbkMJSX7Sjw4Ck7',
      api_secret_encrypted: 'gAAAAABpQtNGhV31PuHdp586t-lcjU_ngZ6z4GTPSPMrq05TFePiQounhDRbhAoKMxwoTR1VoVoW6eZFa8R0rO53IW8YkYlaE5pz-tIDiwyEEUpRNDNY26Q67Zbv4Cv0RlMX8prRQ5TLxmUQzkpjJuDmWRZojFMUV6-VHG4fYSBLoA90IVqFq8g=',
      passphrase_encrypted: 'gAAAAABpQtNG3IMqgYUr_VUkrSlEsFHGZiZ1yW2Oa8hOqHvxtVlRq3ptc7BFors_W4h5iGLYqj8waAu3qOMqZgQebMhG7cMjyDoZ8g7Lfbwp5pURUeMtIBg=',
      is_active: false,
      created_at: '2025-12-17T15:59:02.940Z',
      updated_at: '2025-12-17T15:59:02.940Z'
    },
    {
      exchange_id: '6942d27ffa8ecd38fb975f01',
      api_key_encrypted: 'gAAAAABpQtNauSY4bt942k4yb1q0albqd4q38AMUpcNHDY-B-X5ssTDcjbY7Eo1HotD4pKE7oBJfpFPdPhE96R6yXGpaJrSScTwUa_02naV1VB9LNOafGjVmacUXv4oze_V5rfQL3KBm',
      api_secret_encrypted: 'gAAAAABpQtNa5qAOnEFbVTDbSTfs12DS94tr73sMFQbolEW-tpD4FY7C0tmvhatXUVRW4ovFn3xNYNv3KjIrQMSQjeX3tbxFy6Hvdzpyphujx2HKlzCsOsSxbROUQzJUoYeptXPd-34MjD4u-RUj1CZX3Pu3WT1P6w==',
      passphrase_encrypted: null,
      is_active: false,
      created_at: '2025-12-17T15:59:22.296Z',
      updated_at: '2025-12-17T15:59:22.296Z'
    }
  ]
}

// Função principal
async function popularExchanges() {
  try {
    console.log('🚀 Iniciando população de exchanges...')
    console.log(`📊 Total de exchanges: ${MONGO_DATA.exchanges.length}`)
    console.log(`👤 User ID: ${MONGO_DATA.user_id}`)
    
    // Importar database - usar window para acessar o contexto do app
    if (!window.database) {
      throw new Error('Database não encontrado. Certifique-se de que o app está carregado.')
    }
    const database = window.database
    const collection = database.get('user_exchanges')
    
    // 1. Limpar exchanges existentes
    console.log('\n🗑️  Limpando exchanges existentes...')
    const existing = await collection.query().fetch()
    
    if (existing.length > 0) {
      await database.write(async () => {
        for (const exchange of existing) {
          await exchange.destroyPermanently()
        }
      })
      console.log(`✅ Removidos ${existing.length} registros antigos`)
    } else {
      console.log('ℹ️  Nenhum registro existente')
    }
    
    // 2. Adicionar novas exchanges
    console.log('\n➕ Adicionando exchanges...')
    let added = 0
    let skipped = 0
    
    for (const mongoExchange of MONGO_DATA.exchanges) {
      const exchangeName = EXCHANGE_NAMES[mongoExchange.exchange_id]
      
      if (!exchangeName) {
        console.warn(`⚠️  Exchange ID desconhecido: ${mongoExchange.exchange_id}`)
        skipped++
        continue
      }
      
      try {
        await database.write(async () => {
          await collection.create((exchange) => {
            exchange.userId = MONGO_DATA.user_id
            exchange.exchangeName = exchangeName
            exchange.apiKeyEncrypted = mongoExchange.api_key_encrypted
            exchange.apiSecretEncrypted = mongoExchange.api_secret_encrypted
            exchange.apiPassphraseEncrypted = mongoExchange.passphrase_encrypted || undefined
            exchange.isActive = mongoExchange.is_active
            exchange.createdAt = new Date(mongoExchange.created_at)
            exchange.updatedAt = new Date(mongoExchange.updated_at)
          })
        })
        
        const status = mongoExchange.is_active ? '✅ Ativa' : '❌ Inativa'
        console.log(`  ${status} ${exchangeName}`)
        added++
      } catch (error) {
        console.error(`❌ Erro ao adicionar ${exchangeName}:`, error)
        skipped++
      }
    }
    
    // 3. Resultado final
    console.log('\n' + '='.repeat(50))
    console.log('✅ CONCLUÍDO!')
    console.log('='.repeat(50))
    console.log(`📊 Adicionadas: ${added}`)
    console.log(`⚠️  Ignoradas: ${skipped}`)
    
    // 4. Verificar
    const finalCount = await collection.query().fetchCount()
    console.log(`💾 Total no banco: ${finalCount}`)
    
    console.log('\n💡 Dica: Execute verExchanges() para ver as exchanges')
    
  } catch (error) {
    console.error('❌ ERRO:', error)
    console.log('\n🔧 Troubleshooting:')
    console.log('  1. Certifique-se de estar na página http://localhost:3000')
    console.log('  2. O app deve estar carregado completamente')
    console.log('  3. Tente recarregar a página e executar novamente')
  }
}

// Função para verificar exchanges
async function verExchanges() {
  try {
    if (!window.database) {
      throw new Error('Database não encontrado. Certifique-se de que o app está carregado.')
    }
    const database = window.database
    const collection = database.get('user_exchanges')
    const exchanges = await collection.query().fetch()
    
    console.log(`\n🔗 Total de exchanges: ${exchanges.length}`)
    console.table(exchanges.map(e => ({
      ID: e.id.substring(0, 8) + '...',
      Nome: e.exchangeName,
      Ativa: e.isActive ? '✅' : '❌',
      'Created At': new Date(e.createdAt).toLocaleString('pt-BR'),
      'Updated At': new Date(e.updatedAt).toLocaleString('pt-BR')
    })))
    
    return exchanges
  } catch (error) {
    console.error('❌ Erro ao verificar exchanges:', error)
  }
}

// Expor funções globalmente
window.popularExchanges = popularExchanges
window.verExchanges = verExchanges

console.log('✅ Script carregado!')
console.log('📌 Execute: popularExchanges()')
console.log('📌 Depois: verExchanges()')
