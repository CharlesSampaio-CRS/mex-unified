/**
 * 🎮 GERENCIADOR DE BANCO DE DADOS - CONSOLE INTERATIVO
 * 
 * Como usar:
 * 1. Abra o DevTools (F12 ou Cmd+Option+I)
 * 2. Cole este código no Console
 * 3. Aperte Enter
 * 4. Use os comandos: dbManager.seed(), dbManager.clear(), dbManager.help()
 */

(function() {
  console.log('🎮 Carregando DB Manager...')
  
  // Busca o database do contexto global (já está carregado pelo app)
  const database = window.__db || 
                   window.database || 
                   (window.__WATERMELON_DATABASE__ && window.__WATERMELON_DATABASE__) ||
                   null
  
  if (!database) {
    console.error('❌ Database não encontrado!')
    console.log('💡 Certifique-se que:')
    console.log('   1. O app está rodando')
    console.log('   2. Você está na página do app (não em about:blank)')
    console.log('   3. A página foi completamente carregada')
    console.log('\n🔄 Tente recarregar a página e executar novamente')
    return
  }
  
  const SAMPLE_USER_ID = '697d8006d95d9fc65813eb74'
  
  const SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'ADA', 'XRP', 'MATIC']
  const EXCHANGES = ['Binance', 'Bybit', 'KuCoin', 'OKX', 'Gate.io']
  const NOTIFICATION_TYPES = [
    { title: 'Ordem Criada', icon: '🟢', type: 'success' },
    { title: 'Ordem Executada!', icon: '🎉', type: 'success' },
    { title: 'Ordem Cancelada', icon: '❌', type: 'info' },
    { title: 'Ordem Limite Criada', icon: '⏳', type: 'info' },
    { title: 'Ordem Parcialmente Executada', icon: '⚡', type: 'warning' },
  ]
  
  window.dbManager = {
    /**
     * 🌱 Popular banco com notificações
     * @param {number} count - Quantidade de notificações (padrão: 50)
     * @param {number} days - Dias no passado (padrão: 7)
     */
    async seedNotifications(count = 50, days = 7) {
      console.log(`🌱 Criando ${count} notificações dos últimos ${days} dias...`)
      
      const collection = database.get('notifications')
      const now = new Date()
      let created = 0
      
      for (let i = 0; i < count; i++) {
        const daysAgo = Math.floor(Math.random() * days)
        const date = new Date(now)
        date.setDate(date.getDate() - daysAgo)
        date.setHours(Math.floor(Math.random() * 24))
        date.setMinutes(Math.floor(Math.random() * 60))
        
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
        const exchange = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)]
        const notifType = NOTIFICATION_TYPES[Math.floor(Math.random() * NOTIFICATION_TYPES.length)]
        const side = Math.random() > 0.5 ? 'buy' : 'sell'
        const sidePT = side === 'buy' ? 'compra' : 'venda'
        const price = (Math.random() * 10000 + 100).toFixed(2)
        const amount = (Math.random() * 10).toFixed(4)
        
        await database.write(async () => {
          await collection.create(record => {
            record.userId = SAMPLE_USER_ID
            record.title = notifType.title
            record.message = `Ordem de ${sidePT} de ${symbol}/USDT no ${exchange}`
            record.type = notifType.type
            record.category = 'order'
            record.isRead = Math.random() > 0.7
            record.data = JSON.stringify({
              icon: notifType.icon,
              orderId: `order_${Date.now()}_${i}`,
              exchangeName: exchange,
              symbol: `${symbol}/USDT`,
              side,
              price,
              amount,
              type: Math.random() > 0.5 ? 'market' : 'limit'
            })
          })
        })
        
        created++
        if (created % 10 === 0) {
          console.log(`  ⏳ ${created}/${count}...`)
        }
      }
      
      console.log(`✅ ${created} notificações criadas!`)
      console.log('🔄 Recarregue: location.reload()')
    },
    
    /**
     * 📸 Popular banco com snapshots
     * @param {number} days - Dias no passado (padrão: 30)
     */
    async seedSnapshots(days = 30) {
      console.log(`📸 Criando snapshots dos últimos ${days} dias...`)
      
      const collection = database.get('balance_snapshots')
      const now = new Date()
      let created = 0
      
      // Lista de valores: começa com 100, varia aleatoriamente, últimos 4 fixos
      const values = []
      let currentValue = 100
      
      // Gera valores aleatórios até days-4
      for (let i = 0; i < days - 4; i++) {
        // Variação de -20 a +20
        const variation = Math.floor(Math.random() * 41) - 20
        currentValue = Math.max(50, currentValue + variation) // Não deixa ficar abaixo de 50
        values.push(currentValue)
      }
      
      // Últimos 4 valores FIXOS
      values.push(432, 330, 200, 280)
      
      for (let i = 0; i < days; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - (days - i))
        date.setHours(0, 0, 0, 0)
        
        await database.write(async () => {
          await collection.create(record => {
            record.userId = SAMPLE_USER_ID
            record.totalUsd = values[i]
            record.totalBrl = values[i] * 5.5 // Conversão fictícia
            record.timestamp = date.getTime()
          })
        })
        
        created++
        if (created % 5 === 0) {
          console.log(`  ⏳ ${created}/${days}...`)
        }
      }
      
    },
    
    /**
     * 🌱 Popular TUDO (notificações + snapshots)
     */
    async seedAll() {
      await this.seedNotifications(50, 7)
      console.log('')
      await this.seedSnapshots(30)
    },
    
    /**
     * 🗑️ Limpar notificações
     */
    async clearNotifications() {
      console.log('🗑️  Limpando notificações...')
      const collection = database.get('notifications')
      const all = await collection.query().fetch()
      
      await database.write(async () => {
        for (const item of all) {
          await item.markAsDeleted()
        }
      })
      
      console.log(`✅ ${all.length} notificações removidas!`)
      console.log('🔄 Recarregue: location.reload()')
    },
    
    /**
     * 🗑️ Limpar snapshots
     */
    async clearSnapshots() {
      console.log('🗑️  Limpando snapshots...')
      const collection = database.get('balance_snapshots')
      const all = await collection.query().fetch()
      
      await database.write(async () => {
        for (const item of all) {
          await item.markAsDeleted()
        }
      })
      
      console.log(`✅ ${all.length} snapshots removidos!`)
      console.log('🔄 Recarregue: location.reload()')
    },
    
    /**
     * 🗑️ Limpar TUDO
     */
    async clearAll() {
      console.log('🗑️  Limpando banco completo...\n')
      await this.clearNotifications()
      console.log('')
      await this.clearSnapshots()
      console.log('\n✅ Banco limpo completamente!')
      console.log('🔄 Recarregue: location.reload()')
    },
    
    /**
     * 📊 Ver status do banco
     */
    async status() {
      const notifications = await database.get('notifications').query().fetch()
      const snapshots = await database.get('balance_snapshots').query().fetch()
      const unread = notifications.filter(n => !n.isRead).length
      
      console.log('📊 Status do Banco de Dados')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`🔔 Notificações: ${notifications.length}`)
      console.log(`   └─ Não lidas: ${unread}`)
      console.log(`📸 Snapshots: ${snapshots.length}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
    },
    
    /**
     * ℹ️ Mostrar ajuda
     */
    help() {
      console.log(`
╔════════════════════════════════════════════════════════╗
║          🎮 DB MANAGER - COMANDOS DISPONÍVEIS          ║
╚════════════════════════════════════════════════════════╝

📊 CONSULTAR
  dbManager.status()              Ver status atual do banco

🌱 POPULAR
  dbManager.seedNotifications()   Criar 50 notificações (7 dias)
  dbManager.seedNotifications(100, 30)   Personalizar quantidade e período
  
  dbManager.seedSnapshots()       Criar 30 snapshots diários
  dbManager.seedSnapshots(60)     Criar 60 snapshots
  
  dbManager.seedAll()             Popular TUDO (notif + snap)

🗑️ LIMPAR
  dbManager.clearNotifications()  Remover todas notificações
  dbManager.clearSnapshots()      Remover todos snapshots
  dbManager.clearAll()            Limpar TUDO

ℹ️ AJUDA
  dbManager.help()                Mostrar esta ajuda

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Dica: Após executar qualquer comando, recarregue com:
   location.reload()  ou  Cmd+Shift+R
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `)
    }
  }
  
  console.log('✅ DB Manager carregado!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Digite: dbManager.help()')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})()
