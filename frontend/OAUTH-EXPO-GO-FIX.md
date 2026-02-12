# 🔐 Solução: Login Google via EC2

## 🔴 Problema Original

Ao tentar fazer login com Google no **Expo Go**, havia erro de `Network request failed` porque:

1. **localhost não é acessível** do dispositivo móvel
2. **RedirectUri hardcoded** com IP fixo
3. **Scheme padrão `exp`** não funciona bem com OAuth

## ✅ Solução Implementada

### 1️⃣ Backend na EC2

**Endereço:**
```
http://18.228.235.167:3002
```

**Configuração (trading-service/.env):**
```bash
PUBLIC_URL=http://18.228.235.167:3002
GOOGLE_REDIRECT_URI=http://18.228.235.167:3002/api/v1/auth/callback
FRONTEND_URL=http://18.228.235.167:3000
```

### 2️⃣ Frontend Apontando para EC2

**Configuração (frontend/lib/config.ts):**
```typescript
export const config = {
  apiBaseUrl: 'http://18.228.235.167:3002/api/v1',
  kongBaseUrl: 'http://18.228.235.167:3002/api/v1',
}
```

**Variáveis de Ambiente (frontend/.env):**
```bash
NEXT_PUBLIC_API_URL=http://18.228.235.167:3002
NEXT_PUBLIC_AUTH_URL=http://18.228.235.167:3002
```

### 3️⃣ OAuth com AuthSession

**Import:**
```typescript
import * as AuthSession from 'expo-auth-session'
```

**RedirectUri Dinâmico:**
```typescript
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'cryptohub',
  path: 'auth/callback',
})
```

**O que `makeRedirectUri()` gera:**
- **Expo Go**: `exp://exp.host/@username/cryptohub-mobile/--/auth/callback`
- **Dev Client**: `cryptohub://auth/callback`
- **Standalone**: `cryptohub://auth/callback`

### 4️⃣ Scheme Personalizado

**app.json:**
```json
{
  "expo": {
    "scheme": "cryptohub"  // Mudado de "exp" para "cryptohub"
  }
}
```

## 📱 Como Funciona Agora

### Fluxo de Login:

1. Usuário clica em "Login com Google"
2. App chama backend `/auth/google/mobile`
3. Backend retorna `auth_url` (URL do Google)
4. App abre navegador com `WebBrowser.openAuthSessionAsync()`
5. Usuário faz login no Google
6. Google redireciona para o `redirectUri` gerado dinamicamente
7. App captura o callback e extrai tokens
8. Login completo! ✅

### Logs de Debug:

```javascript
console.log('[Google OAuth] redirectUri gerado:', redirectUri)
// Expo Go: exp://exp.host/@username/cryptohub-mobile/--/auth/callback
// Dev Client: cryptohub://auth/callback
```

## ⚙️ Configuração do Backend

O backend (Kong/Trading Service) precisa aceitar os seguintes redirect URIs:

### Para Desenvolvimento:
```
exp://exp.host/@username/cryptohub-mobile/--/auth/callback
cryptohub://auth/callback
http://localhost:8081/auth/callback (web)
```

### Para Produção:
```
cryptohub://auth/callback (iOS/Android)
https://cryptohub.com/auth/callback (web)
```

## 🧪 Como Testar

### 1. Recarregar Expo Go

```bash
# Parar servidor
./dev.sh stop

# Iniciar novamente
./dev.sh all
```

### 2. No Expo Go:

1. Abra o app no Expo Go
2. Clique em "Login com Google"
3. Verifique os logs:
   ```
   [Google OAuth] redirectUri gerado: exp://exp.host/@...
   [Google OAuth] Platform: ios
   ```
4. Página do Google deve abrir ✅
5. Após login, app deve receber callback ✅

### 3. Verificar Callback:

Se o callback não funcionar, verifique:

```typescript
// No AuthContext.tsx
const result = await WebBrowser.openAuthSessionAsync(...)

if (result.type === 'success' && 'url' in result) {
  console.log('✅ Callback recebido:', result.url)
  // Deve conter: ?access_token=...&user_id=...
}
```

## 🐛 Troubleshooting

### Problema: "Could not open URL"

**Solução:** Verifique se o backend está retornando `auth_url` corretamente:

```bash
curl http://localhost:3002/api/v1/auth/google/mobile
# Deve retornar: { "auth_url": "https://accounts.google.com/..." }
```

### Problema: "Redirect mismatch"

**Solução:** O redirect URI do Google Console deve incluir:
```
exp://exp.host/@username/cryptohub-mobile/--/auth/callback
```

Ou usar um wildcard:
```
exp://exp.host/@username/*
```

### Problema: Callback não chega

**Solução:** Verifique se o backend está redirecionando para o URI correto após login:

```typescript
// Backend deve redirecionar para:
const redirectUri = req.query.redirect_uri || 'exp://...'
res.redirect(`${redirectUri}?access_token=${token}&user_id=${userId}`)
```

## 📚 Referências

- [Expo AuthSession Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Expo WebBrowser Docs](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Deep Linking Guide](https://docs.expo.dev/guides/linking/)

## ✅ Checklist de Configuração

- [x] Import `expo-auth-session`
- [x] Usar `makeRedirectUri()`
- [x] Atualizar `app.json` com scheme `cryptohub`
- [x] Adicionar logs de debug
- [ ] Configurar redirect URIs no Google Console
- [ ] Configurar backend para aceitar URIs dinâmicos
- [ ] Testar no Expo Go
- [ ] Testar no Dev Client
- [ ] Testar build standalone

---

**✨ Com essas mudanças, o login com Google deve funcionar perfeitamente no Expo Go!**
