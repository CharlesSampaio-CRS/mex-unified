# 📋 cURL Logger - Documentação Simplificada

## O que é?

Sistema que captura automaticamente todas as requisições HTTP do app e gera comandos curl prontos para testes no backend.

## Características Principais

✅ **Sem Duplicatas**: Detecta e ignora requisições repetidas  
✅ **Formato Limpo**: Apenas curl, sem informações desnecessárias  
✅ **Headers Filtrados**: Mantém apenas headers importantes (Authorization, Content-Type, etc.)  
✅ **Limite Automático**: Mantém apenas as últimas 50 requisições  
✅ **Dados Reais**: Captura exatamente o que foi enviado ao backend  

## Como usar?

### 1. Captura Automática

Toda requisição feita pelo app é automaticamente capturada (sem duplicatas).

### 2. Acessar Logs

**Settings → cURL Logger**

Você verá:
- Total de requisições únicas
- Lista de todas as chamadas
- Comando curl de cada uma

### 3. Exportar

**Três formas:**

1. **Copiar MD**: Documento markdown formatado
2. **Copiar Raw**: Apenas os curls, sem formatação
3. **Exportar**: Baixa/compartilha arquivo .md

## Formato do Arquivo Gerado

```markdown
# API cURL Commands

Gerado em: 23/02/2026, 14:30:45
Total: 15 requisições únicas

---

## 1. GET - 23/02 14:30

```bash
curl -X GET 'https://api.crypto.com/balances' \
  -H 'Authorization: Bearer xxx'
```

## 2. POST - 23/02 14:31

```bash
curl -X POST 'https://api.crypto.com/orders' \
  -H 'Authorization: Bearer xxx' \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"BTC/USDT","side":"buy","amount":0.01}'
```

## 3. DELETE - 23/02 14:32

```bash
curl -X DELETE 'https://api.crypto.com/orders/abc123' \
  -H 'Authorization: Bearer xxx'
```
```

## Exemplo de Uso

### Para Testar no Backend

1. Faça ações no app (carregar saldos, criar ordem, etc.)
2. Abra **Settings → cURL Logger**
3. Copie o curl que quer testar
4. Cole no terminal e execute:

```bash
curl -X GET 'https://api.crypto.com/balances' \
  -H 'Authorization: Bearer seu_token_aqui'
```

### Para Documentação da API

1. Use todas as features do app
2. Exporte o log completo
3. Você tem todos os endpoints documentados!

## Deduplicação

O sistema detecta duplicatas usando:
- **Method** (GET, POST, etc.)
- **URL** completa
- **Body** da requisição

Se você fizer a mesma requisição várias vezes, só será salva uma vez.

## Limite de Logs

- **Máximo**: 50 requisições
- **Automático**: Remove os mais antigos quando atingir o limite
- **Manual**: Use "Limpar" para resetar

## Headers Filtrados

São salvos apenas headers importantes:
- `Authorization`
- `Content-Type`
- `Accept`
- `X-API-Key`

Headers automáticos do fetch (User-Agent, etc.) são ignorados.

## Tips para Testes

### 1. Teste Direto
```bash
# Copie o curl e execute
curl -X GET 'https://api.example.com/endpoint' ...
```

### 2. Modifique Parâmetros
```bash
# Mude valores para testar diferentes cenários
curl -X POST 'https://api.example.com/orders' \
  -H 'Authorization: Bearer token' \
  -H 'Content-Type: application/json' \
  -d '{"amount":999}' # <-- mudado
```

### 3. Teste Erros
```bash
# Remova o token para testar erro 401
curl -X GET 'https://api.example.com/orders'
```

### 4. Crie Coleções Postman
1. Copie o curl
2. Postman → Import → Raw Text
3. Cole o curl
4. Pronto!

## Estatísticas

O logger mantém estatísticas:
- Total de requisições únicas
- Contagem por método (GET, POST, etc.)
- Data da mais antiga e mais recente

## Segurança ⚠️

**IMPORTANTE:**
- Os curls contêm **tokens de autenticação**
- Os curls contêm **dados reais**
- **NÃO compartilhe** publicamente
- **LIMPE** após uso
- Use apenas para debug pessoal/testes

## Fluxo Típico

```
1. Usar o app normalmente
   ↓
2. Abrir cURL Logger
   ↓
3. Ver requisições capturadas
   ↓
4. Copiar curl específico
   ↓
5. Testar no terminal/Postman
   ↓
6. Ajustar e retest ar
   ↓
7. Limpar logs quando terminar
```

## Diferença da Versão Anterior

| Antes | Agora |
|-------|-------|
| Salvava duplicatas | ✅ Ignora duplicatas |
| Todos os headers | ✅ Apenas importantes |
| Sem limite | ✅ Limite de 50 |
| Documento complexo | ✅ Formato simples |
| Headers/Body separados | ✅ Apenas curl |

## FAQ

**P: Por que não vejo todas as minhas requisições?**  
R: Duplicatas são automaticamente ignoradas.

**P: Posso desativar o logger?**  
R: Sim, use `curlLogger.setEnabled(false)` programaticamente.

**P: O que acontece quando atinge 50 requisições?**  
R: A mais antiga é removida automaticamente.

**P: Posso filtrar por método (GET, POST)?**  
R: Não ainda, mas está no roadmap.

**P: Como uso no Postman?**  
R: Copie o curl → Postman Import → Raw Text → Cole.

---

**Foco: Simplicidade e utilidade para testes reais no backend!** 🚀
