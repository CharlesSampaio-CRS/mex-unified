# 🐛 Debug: Botão "Criar Conta" Não Responde

## 🎯 Problema

Ao clicar no botão "Criar Conta" na tela de registro, nada acontece.

## 🔍 Logs Adicionados

### 1. SignUpScreen.tsx

**Botão:**
```typescript
onPress={() => {
  console.log('🔵 [SignUpScreen] Botão "Criar Conta" pressionado')
  handleRegister()
}}
```

**Função handleRegister():**
```typescript
console.log('🔵 [SignUpScreen] handleRegister() chamado')
console.log('📥 [SignUpScreen] Dados:', { name, email, passwordLength })
```

**Validações:**
- ❌ Nome vazio
- ❌ Email vazio
- ❌ Email inválido
- ❌ Senha vazia
- ❌ Confirmação vazia
- ❌ Senhas não conferem
- ❌ Senha muito curta
- ❌ Senha sem letra maiúscula
- ❌ Senha sem letra minúscula
- ❌ Senha sem número
- ✅ Todas validações passaram

### 2. AuthContext.tsx

**Função register():**
```typescript
console.log('🔵 [AuthContext] register() chamado')
console.log('📥 [AuthContext] Parâmetros:', { email, name, passwordLength })
console.log('🔄 [AuthContext] setIsLoading(true)')
console.log('📝 [REGISTER] URL:', registerUrl)
console.log('🌐 [REGISTER] Enviando request...')
console.log('📊 [REGISTER] Status:', response.status)
console.log('📊 [REGISTER] Response:', responseText)
```

## 🧪 Fluxo de Logs Esperado

Quando clicar em "Criar Conta":

```javascript
// 1. Botão pressionado
🔵 [SignUpScreen] Botão "Criar Conta" pressionado

// 2. handleRegister chamado
🔵 [SignUpScreen] handleRegister() chamado
📥 [SignUpScreen] Dados: { name: 'João', email: 'joao@test.com', passwordLength: 10 }

// 3. Validações
// Se falhar alguma validação, verá:
❌ [SignUpScreen] Nome vazio
// ou
❌ [SignUpScreen] Email inválido: xxx
// ou
❌ [SignUpScreen] Senha muito curta: 5
// etc.

// 4. Se passar todas validações:
✅ [SignUpScreen] Todas validações passaram, chamando register()

// 5. AuthContext register
🔵 [AuthContext] register() chamado
📥 [AuthContext] Parâmetros: { email, name, passwordLength }
🔄 [AuthContext] setIsLoading(true)
📝 [REGISTER] URL: http://18.228.235.167:3002/api/v1/auth/register
📝 [REGISTER] Payload: { email, name, password: '***' }
🌐 [REGISTER] Enviando request...

// 6. Resposta da API
📊 [REGISTER] Status: 201
📊 [REGISTER] Response: {"success":true,"token":"..."}
✅ [REGISTER] Response JSON parsed
```

## 📋 Cenários Possíveis

### Cenário 1: Botão não está sendo clicado
**Log esperado:** Nenhum  
**Causa:** Problema de UI, botão disabled ou overlay bloqueando

### Cenário 2: Validação falhando
**Log esperado:**
```
🔵 [SignUpScreen] Botão "Criar Conta" pressionado
🔵 [SignUpScreen] handleRegister() chamado
❌ [SignUpScreen] <validação específica>
```
**Causa:** Alguma validação não passou

### Cenário 3: register() não sendo chamado
**Log esperado:**
```
🔵 [SignUpScreen] Botão "Criar Conta" pressionado
🔵 [SignUpScreen] handleRegister() chamado
✅ [SignUpScreen] Todas validações passaram, chamando register()
// Para aqui
```
**Causa:** Erro ao chamar register()

### Cenário 4: Fetch falhando
**Log esperado:**
```
...
🔵 [AuthContext] register() chamado
🌐 [REGISTER] Enviando request...
❌ Register error: [TypeError: Network request failed]
```
**Causa:** Problema de rede ou API

### Cenário 5: API retornando erro
**Log esperado:**
```
...
📊 [REGISTER] Status: 400
📊 [REGISTER] Response: {"error":"Email already exists"}
❌ Register error: Email already exists
```
**Causa:** Erro na API (email duplicado, etc.)

## 🧪 Como Testar

1. **Abra o console** (Expo Go → Shake → Debug JS Remotely)
2. **Preencha o formulário:**
   - Nome: João Silva
   - Email: joao@test.com
   - Senha: Test@1234
   - Confirmar: Test@1234
3. **Clique "Criar Conta"**
4. **Observe os logs**

## 🔧 Possíveis Correções

### Se botão não responde:
- Verificar se `isLoading` está travado em `true`
- Verificar se há overlay bloqueando
- Verificar se botão está `disabled`

### Se validação falha:
- Ajustar campos do formulário
- Verificar requisitos de senha

### Se fetch falha:
- Verificar conectividade com EC2
- Testar URL manualmente: `http://18.228.235.167:3002/api/v1/auth/register`

---

**🎯 Próxima ação: Testar cadastro e copiar TODOS os logs do console!**
