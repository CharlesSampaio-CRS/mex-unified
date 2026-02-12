# 🌐 Configuração Real - Login com EC2

## ⚠️ Mock Removido

O sistema de mock login foi **removido** porque agora estamos usando a **API real da EC2**.

## ✅ Configuração Atual

### Endereço EC2
```
http://18.228.235.167:3002
```

### Login Real

1. **Cadastro de Novo Usuário:**
   ```bash
   POST http://18.228.235.167:3002/api/v1/auth/register
   ```

2. **Login com Email/Senha:**
   ```bash
   POST http://18.228.235.167:3002/api/v1/auth/login
   ```

3. **Login com Google OAuth:**
   ```bash
   GET http://18.228.235.167:3002/api/v1/auth/google
   ```

## 🔧 Arquivos Configurados

### Frontend
- `lib/config.ts`: API URLs apontando para EC2
- `services/migration-service.ts`: Endpoints de migração com EC2
- `.env`: Variáveis de ambiente com IP da EC2

### Backend
- `trading-service/.env`: Configurações da EC2

## 🧪 Testando

### 1. Cadastro
```typescript
// Endpoint
POST /api/v1/auth/register

// Body
{
  "email": "user@example.com",
  "name": "Test User",
  "password": "YourPassword123!"
}

// Response
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1Q...",
  "user": {
    "id": "698dd5ad08b21a144c4fc7f7",
    "email": "user@example.com",
    "name": "Test User"
  }
}
```

### 2. Login
```typescript
// Endpoint
POST /api/v1/auth/login

// Body
{
  "email": "user@example.com",
  "password": "YourPassword123!"
}
```

### 3. Balances
```typescript
// Endpoint
GET /api/v1/balances?user_id=YOUR_USER_ID

// Headers
Authorization: Bearer YOUR_TOKEN

// Response
{
  "success": true,
  "exchanges": [],
  "total_usd": 0.0,
  "timestamp": 1770903300
}
```

## 📊 Status de Conectividade

```bash
✅ EC2 está acessível: http://18.228.235.167:3002
✅ Endpoint de registro: 201 Created
✅ Endpoint de balances: 200 OK
✅ Token JWT funcionando
```

## � Google OAuth

Para OAuth funcionar corretamente, é necessário:

1. **Adicionar redirect URI no Google Console:**
   ```
   http://18.228.235.167:3002/api/v1/auth/callback
   ```

2. **Configurar no trading-service/.env:**
   ```bash
   GOOGLE_REDIRECT_URI=http://18.228.235.167:3002/api/v1/auth/callback
   ```

---

**🌐 Sistema usando API real da EC2!**

