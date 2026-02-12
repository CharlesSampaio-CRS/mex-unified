# 🔧 Debug: Exchange Não Salva

## 🐛 Problema Reportado

Ao cadastrar uma exchange, ela não está sendo salva no banco SQLite.

## 🔍 Investigação

### Arquivos com Logs Adicionados

1. **services/exchange-service.ts**
   - ✅ Logs detalhados em `addExchange()`
   - ✅ Logs dos dados recebidos
   - ✅ Verificação se foi inserido no banco

2. **lib/sqlite/query-builder.ts**
   - ✅ Logs no método `insert()`
   - ✅ SQL gerado
   - ✅ Valores passados

3. **lib/sqlite/database.ts**
   - ✅ Logs no método `query()`
   - ✅ Resultado do `runAsync()`

## 📊 Fluxo de Logs Esperado

Quando cadastrar uma exchange, você verá:

```javascript
// 1. ExchangeService
🔵 [ExchangeService] addExchange() iniciado
📥 [ExchangeService] Dados recebidos: { userId, exchangeType, ... }
💾 [ExchangeService] Exchange objeto criado: { id, user_id, ... }
🔄 [ExchangeService] Executando INSERT no SQLite...

// 2. QueryBuilder
🔵 [QueryBuilder] insert() iniciado
📋 [QueryBuilder] Tabela: user_exchanges
📥 [QueryBuilder] Dados: {...}
📝 [QueryBuilder] SQL: INSERT INTO user_exchanges (...)
📝 [QueryBuilder] Values: [...]

// 3. SQLite Database
🔵 [SQLite] query() chamado
📝 [SQLite] SQL: INSERT INTO...
📝 [SQLite] Params: [...]
🔄 [SQLite] Executando runAsync...
✅ [SQLite] runAsync result: { changes: 1, lastInsertRowId: X }

// 4. Volta ao ExchangeService
✅ [QueryBuilder] INSERT result: { insertId: X, rowsAffected: 1 }
✅ [ExchangeService] INSERT concluído com sucesso!
✅ [ExchangeService] Exchange confirmada no banco: exchange_123...
```

## 🧪 Como Testar

1. **Abra o Console:**
   - Expo Go: Shake device → "Debug JS Remotely"
   - Web: F12 → Console

2. **Tente Cadastrar Exchange:**
   - Abra "Exchanges Manager"
   - Clique em "Add Exchange"
   - Preencha os dados
   - Clique em "Connect"

3. **Analise os Logs:**
   - ✅ Se aparecer todos os logs acima = Funcionando
   - ❌ Se parar em algum ponto = Erro identificado

## 🔄 Possíveis Causas

### Causa 1: Banco Não Inicializado
```
❌ Database não inicializado
```
**Solução:** Aguardar `initialize()` no `BalanceContext`

### Causa 2: Tabela Não Existe
```
❌ no such table: user_exchanges
```
**Solução:** Verificar se `createTables()` foi executado

### Causa 3: Erro de Constraint
```
❌ FOREIGN KEY constraint failed
```
**Solução:** Verificar se `user_id` é válido

### Causa 4: Campos NULL
```
❌ NOT NULL constraint failed
```
**Solução:** Verificar se todos os campos obrigatórios estão preenchidos

## 📝 Próximos Passos

1. ✅ **Logs Adicionados** - Aguardar teste
2. ⏳ **Teste no App** - Cadastrar exchange e verificar logs
3. ⏳ **Identificar Erro** - Analisar onde para o fluxo
4. ⏳ **Fix** - Aplicar correção baseada nos logs

---

**🔍 Aguardando logs do teste!**
