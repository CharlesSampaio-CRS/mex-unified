/**
 * 🧪 Teste de Cálculo de PNL
 * 
 * Cole este código no console do navegador (F12) para testar o cálculo
 */

// Valores fornecidos
const currentValue = 330.95
const lastSnapshot = 320.96

// Cálculo
const change = currentValue - lastSnapshot
const changePercent = (change / lastSnapshot) * 100

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 TESTE DE CÁLCULO DE PNL')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
console.log('💰 Dados de Entrada:')
console.log(`   • Valor Atual (Live):  $${currentValue.toFixed(2)}`)
console.log(`   • Último Snapshot:     $${lastSnapshot.toFixed(2)}`)
console.log('')
console.log('📈 Cálculo do PNL:')
console.log(`   • Mudança Absoluta:    $${change.toFixed(2)}`)
console.log(`   • Mudança Percentual:  ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`)
console.log('')
console.log('✅ Resultado Esperado no PnLCard:')
console.log(`   • Balanço Atual:       $${currentValue.toFixed(2)}`)
console.log(`   • Hoje (24h):          ${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`)
console.log(`   • Status:              ${change >= 0 ? '🟢 LUCRO' : '🔴 PREJUÍZO'}`)
console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// Teste de formatação (como no componente)
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(value)
}

const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

console.log('🎨 Formatação Visual:')
console.log(`   • Valor Formatado:     ${formatCurrency(currentValue)}`)
console.log(`   • Mudança Formatada:   ${formatCurrency(change)}`)
console.log(`   • Percentual:          ${formatPercent(changePercent)}`)
console.log('')

// Verifica se o serviço está calculando corretamente
console.log('🔍 Para verificar se o PnLService está correto:')
console.log('   1. Abra o DevTools (F12)')
console.log('   2. Vá para a tab Console')
console.log('   3. Procure por logs do PnLCard:')
console.log('      "💰 [PnLCard] Valor atual (tempo real): 330.95"')
console.log('      "✅ [PnLCard] PNL carregado: {...}"')
console.log('')
console.log('   4. Verifique se os valores batem:')
console.log(`      - currentBalance: ${currentValue}`)
console.log(`      - today.change: ${change.toFixed(2)}`)
console.log(`      - today.changePercent: ${changePercent.toFixed(2)}`)
console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
