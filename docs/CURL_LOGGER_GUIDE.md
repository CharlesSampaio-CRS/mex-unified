# 📋 cURL Logger - Guia Completo

## Visão Geral

O cURL Logger é um sistema automático de captura de requisições API que gera comandos `curl` prontos para testes no backend. Todas as chamadas feitas através do `apiService` são automaticamente capturadas e disponibilizadas para exportação.

## Características

✅ **Captura Automática**: Todas as requisições API são registradas automaticamente  
✅ **Deduplicação**: Evita registrar chamadas duplicadas (mesmo método + URL + body)  
✅ **Nomes Descritivos**: Cada requisição pode ter um nome amigável (ex: "Get Balances")  
✅ **Limite Inteligente**: Mantém apenas as últimas 50 requisições  
✅ **Formatação MD**: Exporta em formato markdown organizado  
✅ **Persistência**: Requisições são salvas localmente (AsyncStorage)  
✅ **Filtro de Headers**: Mantém apenas headers importantes (Authorization, Content-Type, etc.)

## Como Usar

### 1. Acessar o Logger

1. Abra o app
2. Vá para **Configurações** (última aba)
3. Procure por **"cURL Logger (Desenvolvimento)"**
4. Clique para abrir o modal

### 2. Interface do Modal

O modal mostra:
- **Estatísticas**: Total de requisições, métodos únicos, período
- **Lista de Requisições**: Cada item expandível mostrando:
  - Badge colorido com o método (GET/POST/PUT/DELETE)
  - Nome da requisição (se fornecido) ou endpoint
  - URL completa (quando há nome)
  - Timestamp
  - Comando curl completo

### 3. Ações Disponíveis

#### 📋 Copy MD
Copia todo o conteúdo formatado em markdown:
```markdown
# API cURL Commands
Gerado em: 01/01/2024 10:30

## 1. balances/exchanges - 01/01 10:30

```bash
curl -X GET 'https://api.example.com/balances/exchanges' \
  -H 'Authorization: Bearer xxx' \
  -H 'Content-Type: application/json'
```
...
```

#### 📄 Copy Raw
Copia apenas os comandos curl (sem formatação):
```bash
curl -X GET 'https://api.example.com/balances/exchanges' -H 'Authorization: Bearer xxx'

curl -X POST 'https://api.example.com/orders/create' -H 'Authorization: Bearer xxx' -d '{"symbol":"BTC","amount":0.01}'
```

#### 💾 Export
- **Web**: Baixa arquivo `api-curls.md`
- **Mobile**: Abre sheet de compartilhamento nativo

#### 🗑️ Clear
Remove todas as requisições registradas (pede confirmação)

### 4. Adicionar Nomes às Requisições

#### No código (serviço API):

```typescript
// services/api.ts

// Com nome descritivo
curlLogger.logRequest(
  'GET',
  url,
  headers,
  undefined,
  'Get User Balances'  // ← Nome da requisição
);

// Sem nome (usa URL como fallback)
curlLogger.logRequest(
  'POST',
  url,
  headers,
  body
);
```

#### Exemplos de nomes descritivos:

- ✅ "Get User Balances"
- ✅ "Create Buy Order"
- ✅ "List Exchanges"
- ✅ "Update Price Alert"
- ❌ "API Call" (muito genérico)
- ❌ "/api/v1/balances" (já temos a URL)

## Formato de Saída

### Markdown (para documentação)

```markdown
# API cURL Commands
Gerado em: 27/12/2024 14:30

---

## 1. Get User Balances - 27/12 14:30

```bash
curl -X GET 'https://api.cryptohub.com/v1/balances/exchanges' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

## 2. Create Buy Order - 27/12 14:32

```bash
curl -X POST 'https://api.cryptohub.com/v1/orders/create' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"exchange":"binance","symbol":"BTCUSDT","side":"buy","amount":"0.001","price":"45000"}'
```
```

### Raw (para scripts)

```bash
curl -X GET 'https://api.cryptohub.com/v1/balances/exchanges' -H 'Authorization: Bearer xxx' -H 'Content-Type: application/json'

curl -X POST 'https://api.cryptohub.com/v1/orders/create' -H 'Authorization: Bearer xxx' -H 'Content-Type: application/json' -d '{"exchange":"binance","symbol":"BTCUSDT","side":"buy","amount":"0.001","price":"45000"}'
```

## Deduplicação

O sistema usa um hash baseado em:
- Método HTTP (GET, POST, etc.)
- URL completa
- Body da requisição (se houver)

Requisições idênticas **não são duplicadas**, mesmo que tenham nomes diferentes.

## Limite de Requisições

- **Máximo**: 50 requisições
- **Comportamento**: Quando atingir 50, a requisição mais antiga é removida
- **FIFO**: First In, First Out (primeira a entrar, primeira a sair)

## Filtro de Headers

Por questões de segurança e simplicidade, apenas estes headers são incluídos:

- `Authorization`
- `Content-Type`
- `Accept`
- `X-API-Key`
- `X-Request-ID`

Outros headers são omitidos para evitar poluição e proteger informações sensíveis.

## Persistência

- **Storage**: AsyncStorage (`@cryptohub:curl_logs`)
- **Quando salva**: Automaticamente após cada requisição
- **Quando carrega**: Ao iniciar o app
- **Limite de armazenamento**: ~2MB (AsyncStorage limit)

## Dicas de Uso

### Para Testes no Backend

1. Use a app normalmente para gerar requisições reais
2. Abra o cURL Logger
3. Copie o curl da requisição que deseja testar
4. Cole no terminal ou Postman
5. Modifique parâmetros conforme necessário

### Para Documentação

1. Faça um fluxo completo (login → listagem → criação)
2. Exporte o markdown
3. Use como base para documentação da API

### Para Debug

1. Identifique uma requisição problemática
2. Copie o curl exato
3. Teste direto no terminal
4. Compare resposta com o esperado

## Limitações

❌ **Não salva respostas**: Apenas requisições (não captura responses)  
❌ **Não funciona offline**: AsyncStorage pode falhar sem conexão  
❌ **Mobile: Share nativo**: No mobile, usa sheet de compartilhamento do sistema  
❌ **Sem edição**: Não é possível editar curls registrados (apenas copiar/exportar/limpar)

## Troubleshooting

### Requisições não aparecem

1. Verifique se o logger está habilitado (`isEnabled = true`)
2. Confirme que a chamada passa pelo `apiService.fetchWithTimeout`
3. Verifique se atingiu o limite de 50 requisições (limpe o log)

### Duplicatas aparecem

1. Verifique se o body/URL é exatamente igual
2. Parâmetros de query diferentes geram hashes diferentes
3. Headers NÃO afetam a deduplicação

### AsyncStorage cheio

1. Limpe o log manualmente (botão Clear)
2. O limite é ajustado automaticamente para 50 requisições
3. Se persistir, limpe o AsyncStorage do app

## Exemplos de Uso

### Testar Autenticação

```bash
# Copie o curl de login e teste com credenciais diferentes
curl -X POST 'https://api.cryptohub.com/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"wrong_password"}'
```

### Testar Criação de Ordem

```bash
# Copie o curl e modifique valores
curl -X POST 'https://api.cryptohub.com/v1/orders/create' \
  -H 'Authorization: Bearer xxx' \
  -H 'Content-Type: application/json' \
  -d '{"exchange":"binance","symbol":"ETHUSDT","side":"sell","amount":"0.5"}'
```

### Testar Paginação

```bash
# Teste diferentes páginas
curl -X GET 'https://api.cryptohub.com/v1/orders/history?page=1&limit=20' \
  -H 'Authorization: Bearer xxx'
  
curl -X GET 'https://api.cryptohub.com/v1/orders/history?page=2&limit=20' \
  -H 'Authorization: Bearer xxx'
```

## Recursos Futuros (Possíveis)

- [ ] Salvar respostas junto com requisições
- [ ] Exportar para Postman Collection
- [ ] Filtros por método/URL
- [ ] Busca por texto
- [ ] Favoritar requisições importantes
- [ ] Replay de requisições direto do app
- [ ] Copiar como código (Python, JavaScript, etc.)

---

**Desenvolvido para facilitar o teste e debugging de APIs** 🚀
