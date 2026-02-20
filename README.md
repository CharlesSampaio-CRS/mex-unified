# 📱 Multi-Exchange Unified (MEX-Unified)

App mobile para gerenciar criptomoedas em múltiplas exchanges de forma unificada.

![React Native](https://img.shields.io/badge/React%20Native-0.74-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)

---

## ⚡ Quick Start

```bash
npm install
npx expo start
```

Abra o **Expo Go** no celular e escaneie o QR code.

---

## � O que é?

Um aplicativo **mobile-only** (iOS/Android) que permite:

- 📊 Visualizar saldos de múltiplas exchanges em um único lugar
- 💰 Acompanhar evolução do portfolio com gráficos
- 📈 Gerenciar ordens abertas de todas as exchanges
- 🎯 Criar e monitorar estratégias de trading
- 🔔 Receber alertas de preço personalizados
- 🔐 Login seguro com Face ID / Touch ID

---

## 🚀 Instalação

### Pré-requisitos

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Expo Go** app no celular ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/CharlesSampaio-CRS/mex-unified.git
cd mex-unified

# 2. Instale as dependências
npm install

# 3. Inicie o servidor
npx expo start
```

**No celular:**
- Abra o app **Expo Go**
- Escaneie o QR code que apareceu no terminal
- Aguarde o app carregar

---

## 🎮 Comandos Úteis

```bash
# Iniciar servidor
npx expo start

# Limpar cache
npx expo start --clear

# Limpar cache completo
npx expo start -c

# Modo túnel (rede externa)
npx expo start --tunnel

# Abrir no Android
npx expo start --android

# Abrir no iOS (apenas macOS)
npx expo start --ios
```

---

## 📁 Estrutura Simplificada

```
mex-unified/
├── components/          # Componentes reutilizáveis
├── contexts/           # Estado global (Auth, Balance, Orders)
├── screens/            # Telas do app
├── services/           # Conexão com API Backend
├── lib/                # Utilitários (config, storage, crypto)
├── hooks/              # Custom hooks
├── types/              # TypeScript types
└── App.tsx             # Componente raiz
```

---

## 🔧 Tecnologias

- **React Native** - Framework mobile
- **Expo** - Toolchain para React Native
- **TypeScript** - Tipagem estática
- **React Navigation** - Navegação entre telas
- **Expo Secure Store** - Storage criptografado
- **Expo Local Authentication** - Face ID / Touch ID

---

## 🔌 Backend

O app consome dados do backend em **Rust** (trading-service):

```
Frontend (React Native/Expo)
    ↓
Backend (Rust/Actix-web) - AWS EC2
    ↓
MongoDB Atlas
    ↓
CCXT (Python) - Exchanges APIs
```

**Endpoint:** `http://54.94.231.254:3002/api/v1`

---

## ⚙️ Configuração

### API Backend

Edite `lib/config.ts`:

```typescript
export const config = {
  apiBaseUrl: 'http://54.94.231.254:3002/api/v1',
  apiTimeout: 25000,
}
```

### Variáveis de Ambiente (opcional)

Crie `.env`:

```env
EXPO_PUBLIC_API_URL=http://54.94.231.254:3002/api/v1
```

---

## 🎯 Funcionalidades

### ✅ Implementadas

- ✅ Login com email/senha
- ✅ Login com Google/Apple OAuth
- ✅ Face ID / Touch ID
- ✅ Portfolio unificado (múltiplas exchanges)
- ✅ Gráfico de evolução (7d, 15d, 30d, 90d, 1ano, máx)
- ✅ Lista de ordens abertas
- ✅ Gerenciamento de estratégias
- ✅ Alertas de preço
- ✅ Pull-to-refresh
- ✅ Modo escuro
- ✅ Sincronização automática

### 🚧 Em Desenvolvimento

- � Notificações push
- 🚧 Execução automática de estratégias
- � Relatórios avançados

---

## 🐛 Problemas Comuns

### "Unable to resolve module"
```bash
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

### Metro Bundler travado
```bash
npx kill-port 8081
npx expo start
```

### Timeout ao buscar dados
- Verifique se o backend está online: `http://54.94.231.254:3002/api/v1/health`
- Verifique sua conexão de internet
- Tente aumentar o timeout em `services/api.ts`

### Erro de autenticação
- No app: **Configurações → Sair → Limpar Cache**

---

## 📦 Principais Dependências

```json
{
  "expo": "~51.0.0",
  "react": "18.2.0",
  "react-native": "0.74.5",
  "@react-navigation/native": "^6.1.18",
  "@react-navigation/bottom-tabs": "^6.6.1",
  "expo-secure-store": "~13.0.2",
  "expo-local-authentication": "~14.0.1",
  "react-native-chart-kit": "^6.12.0",
  "react-native-paper": "^5.12.5"
}
```

---

## 📱 Build para Produção

### Instalar EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Android (APK)
```bash
eas build --platform android --profile preview
```

### iOS (Requer macOS + Xcode)
```bash
eas build --platform ios
```

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-feature`
3. Commit: `git commit -m 'Adiciona nova feature'`
4. Push: `git push origin feature/nova-feature`
5. Abra um Pull Request

---

## 📄 Licença

MIT License - veja [LICENSE](LICENSE)

---

## 👨‍💻 Autor

**Charles Roberto Sampaio**
- GitHub: [@CharlesSampaio-CRS](https://github.com/CharlesSampaio-CRS)

---

## 🔗 Links Úteis

- [Backend (Rust)](../trading-service)
- [Documentação da API](../trading-service/docs/SWAGGER_DOCUMENTATION.md)
- [Fluxos de Autenticação](../trading-service/docs/AUTH_FLOWS.md)

---

**Made with ❤️ by Charles Roberto Sampaio**
