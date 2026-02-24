# 📊 Monitoramento de Fluxo de Ordens - Guia de Logs

## Objetivo

Sistema de logs detalhados para monitorar o ciclo completo de **criação** e **cancelamento** de ordens, incluindo atualização de saldos e listagem de ordens.

## Identificadores por Componente

Cada componente tem um emoji e cor únicos para facilitar identificação nos logs:

| Emoji | Cor | Componente | Arquivo |
|-------|-----|------------|---------|
| 🔵 | Azul | TRADE-MODAL | `components/trade-modal.tsx` |
| 🟢 | Verde | ASSETS-LIST | `components/AssetsList.tsx` |
| 🟠 | Laranja | BALANCE-CONTEXT | `contexts/BalanceContext.tsx` |
| 🟣 | Roxo | ORDERS-CONTEXT | `contexts/OrdersContext.tsx` |
| 🔴 | Vermelho | ORDERS-SCREEN | `screens/OrdersScreen.tsx` |

## Fluxo de Criação de Ordem

### 1️⃣ Usuário Clica em "Comprar" ou "Vender" (AssetsList)

```
🟢 [ASSETS-LIST] ========================================
🟢 [ASSETS-LIST] Abrindo modal de trade
🟢 [ASSETS-LIST] Exchange: Binance
🟢 [ASSETS-LIST] Symbol: BTC
```

### 2️⃣ Modal TradeModal Abre e Usuário Confirma

```
🔵 [TRADE-MODAL] ========================================
🔵 [TRADE-MODAL] Iniciando criação de ordem
🔵 [TRADE-MODAL] Tipo: COMPRA
🔵 [TRADE-MODAL] Exchange: Binance (binance_123)
🔵 [TRADE-MODAL] Par: BTC
🔵 [TRADE-MODAL] Quantidade: 0.001
🔵 [TRADE-MODAL] Tipo ordem: limit
🔵 [TRADE-MODAL] Preço: 50000
🔵 [TRADE-MODAL] Total: 50
```

### 3️⃣ Chamada à API

```
🔵 [TRADE-MODAL] Enviando requisição para API...
🔵 [TRADE-MODAL] Resposta da API recebida em 1234ms
🔵 [TRADE-MODAL] Sucesso: true
```

### 4️⃣ Modal Fecha e Dispara Callbacks

```
✅ [TRADE-MODAL] Ordem criada com sucesso!
✅ [TRADE-MODAL] Fechando modal...
✅ [TRADE-MODAL] Modal fechado
✅ [TRADE-MODAL] Disparando callbacks em background...
```

### 5️⃣ Callback onOrderCreated Executado

```
🔄 [TRADE-MODAL] Executando callback onOrderCreated...
🟢 [ASSETS-LIST] ========================================
🟢 [ASSETS-LIST] Callback onOrderCreated recebido
🟢 [ASSETS-LIST] Exchange: Binance
🟢 [ASSETS-LIST] Symbol: BTC
🟢 [ASSETS-LIST] Chamando refreshBalance...
```

### 6️⃣ BalanceContext Atualiza Saldos

```
🟠 [BALANCE-CONTEXT] ========================================
🟠 [BALANCE-CONTEXT] refresh() chamado
🟠 [BALANCE-CONTEXT] Chamando fetchBalances(forceRefresh=true)...
🔐 [BalanceContext] Lock adquirido, iniciando fetch...
📡 [BalanceContext] Chamando apiService.getBalances()...
✅ [BalanceContext] Resposta recebida: COM DADOS
🟠 [BALANCE-CONTEXT] refresh() concluído em 2345ms
🟠 [BALANCE-CONTEXT] ========================================
```

### 7️⃣ OrdersContext Detecta Mudança (opcional/automático)

```
🟣 [ORDERS-CONTEXT] ========================================
🟣 [ORDERS-CONTEXT] Iniciando busca de ordens
🟣 [ORDERS-CONTEXT] ForceRefresh: false
🟣 [ORDERS-CONTEXT] User ID: user_123
🟣 [ORDERS-CONTEXT] Chamando getOrdersSecure...
🟣 [ORDERS-CONTEXT] Resposta recebida em 890ms
🟣 [ORDERS-CONTEXT] Sucesso: true
🟣 [ORDERS-CONTEXT] Total de ordens: 5
🟣 [ORDERS-CONTEXT] Ordens agrupadas por exchange:
  - Binance: 3 ordens
  - Bybit: 2 ordens
✅ [ORDERS-CONTEXT] Ordens atualizadas com sucesso
🟣 [ORDERS-CONTEXT] ========================================
```

### 8️⃣ Finalização

```
🟢 [ASSETS-LIST] refreshBalance chamado (2345ms)
🟢 [ASSETS-LIST] ========================================
✅ [TRADE-MODAL] Callbacks executados
🔵 [TRADE-MODAL] ========================================
```

---

## Fluxo de Cancelamento de Ordem

### 1️⃣ Usuário Clica em Cancelar na OrdersScreen

```
🔴 [ORDERS-SCREEN] ========================================
🔴 [ORDERS-SCREEN] Iniciando cancelamento de ordem
🔴 [ORDERS-SCREEN] Order ID: order_123
🔴 [ORDERS-SCREEN] Exchange ID: binance_123
🔴 [ORDERS-SCREEN] Symbol: BTC/USDT
🔴 [ORDERS-SCREEN] Side: buy
```

### 2️⃣ Chamada à API de Cancelamento

```
🔴 [ORDERS-SCREEN] Chamando cancelOrderByExchangeId...
✅ [ORDERS-SCREEN] Ordem cancelada com sucesso em 567ms
```

### 3️⃣ Atualização da Lista de Ordens

```
🔴 [ORDERS-SCREEN] Chamando refresh() para atualizar lista...
🟣 [ORDERS-CONTEXT] ========================================
🟣 [ORDERS-CONTEXT] Iniciando busca de ordens
🟣 [ORDERS-CONTEXT] ForceRefresh: true
...
✅ [ORDERS-SCREEN] Lista atualizada em 890ms
🔴 [ORDERS-SCREEN] ========================================
```

---

## Tempos Esperados (Benchmarks)

### Criação de Ordem
- **API Call**: 500-2000ms (depende da exchange)
- **Fechamento do Modal**: instantâneo (< 50ms)
- **refreshBalance**: 1000-3000ms
- **Atualização de Ordens**: 500-1500ms
- **Total (percebido pelo usuário)**: Modal fecha instantaneamente, atualização em background

### Cancelamento de Ordem
- **API Call**: 300-1000ms
- **Atualização da Lista**: 500-1500ms
- **Total**: 800-2500ms

---

## Como Usar os Logs

### 1. Monitorar Criação de Ordem
Filtre por `TRADE-MODAL` e `ASSETS-LIST`:
```bash
# React Native Debugger Console
Filter: TRADE-MODAL|ASSETS-LIST
```

### 2. Monitorar Cancelamento de Ordem
Filtre por `ORDERS-SCREEN`:
```bash
Filter: ORDERS-SCREEN
```

### 3. Monitorar Atualização de Saldos
Filtre por `BALANCE-CONTEXT`:
```bash
Filter: BALANCE-CONTEXT
```

### 4. Monitorar Sincronização de Ordens
Filtre por `ORDERS-CONTEXT`:
```bash
Filter: ORDERS-CONTEXT
```

### 5. Ver Fluxo Completo
Sem filtro ou com todos os identificadores:
```bash
Filter: TRADE-MODAL|ASSETS-LIST|BALANCE-CONTEXT|ORDERS-CONTEXT|ORDERS-SCREEN
```

---

## Troubleshooting

### ❌ Modal Não Fecha Após Criar Ordem
Procure por:
```
❌ [TRADE-MODAL] Erro ao criar ordem:
```
Verifique se há erro na API ou exceção.

### ❌ Saldos Não Atualizam
Procure por:
```
❌ [BalanceContext.fetchBalances] Error fetching balances:
```
Ou:
```
⏰ [BalanceContext] TIMEOUT DE SEGURANÇA (60s)
```

### ❌ Ordens Não Aparecem na Lista
Procure por:
```
❌ [ORDERS-CONTEXT] Erro ao buscar ordens:
⚠️ [ORDERS-CONTEXT] Nenhuma ordem retornada
```

### ⏱️ Processo Muito Lento
Compare os tempos logados com os benchmarks acima. Se muito acima:
- API lenta: `Resposta recebida em XXXXms` > 3000ms
- Lock travado: `⏭️ [BalanceContext] Fetch já em andamento`
- Múltiplas chamadas: Contagem excessiva de `Iniciando busca`

---

## Métricas Importantes

Ao analisar os logs, foque em:

1. **Tempo de Resposta da API** (`em XXXms`)
2. **Ordem dos Eventos** (sequência correta?)
3. **Callbacks Executados** (todos disparados?)
4. **Erros** (❌ indica falha)
5. **Sucessos** (✅ indica conclusão)

---

## Exemplo Completo (Sucesso)

```
🔵 [TRADE-MODAL] ======================================== 
🔵 [TRADE-MODAL] Iniciando criação de ordem
🔵 [TRADE-MODAL] Tipo: COMPRA | Par: BTC | Qtd: 0.001
🔵 [TRADE-MODAL] Enviando requisição para API...
🔵 [TRADE-MODAL] Resposta da API recebida em 1245ms
✅ [TRADE-MODAL] Ordem criada com sucesso!
✅ [TRADE-MODAL] Fechando modal...
✅ [TRADE-MODAL] Disparando callbacks em background...
🟢 [ASSETS-LIST] ========================================
🟢 [ASSETS-LIST] Callback onOrderCreated recebido
🟢 [ASSETS-LIST] Chamando refreshBalance...
🟠 [BALANCE-CONTEXT] ========================================
🟠 [BALANCE-CONTEXT] refresh() chamado
🔐 [BalanceContext] Lock adquirido, iniciando fetch...
📡 [BalanceContext] Chamando apiService.getBalances()...
✅ [BalanceContext] Resposta recebida: COM DADOS
🟠 [BALANCE-CONTEXT] refresh() concluído em 2134ms
🟢 [ASSETS-LIST] refreshBalance chamado (2134ms)
✅ [TRADE-MODAL] Callbacks executados
🔵 [TRADE-MODAL] ========================================
```

**Resultado**: Ordem criada em ~1.2s, modal fechou instantaneamente, saldos atualizados em ~2.1s em background.

