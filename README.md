# 📱 Multi-Exchange Unified (MEX-Unified)

Sistema unificado de gerenciamento de criptomoedas em múltiplas exchanges com interface React Native/Expo.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.74-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)

---

## ⚡ Quick Start (3 passos)

```bash
# 1. Instalar dependências
npm install

# 2. Rodar no celular (Expo)
npx expo start

# 3. Rodar no navegador (Next.js)
npm run dev
```

📱 **Mobile**: Abra o **Expo Go** no celular e escaneie o QR code  
🌐 **Web**: Acesse **http://localhost:3000**

---

## 🚀 Início Rápido

### Pré-requisitos

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** ou **yarn**
- **Expo Go** app no celular (iOS/Android)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/CharlesSampaio-CRS/mex-unified.git
cd mex-unified

# Instale as dependências
npm install --legacy-peer-deps
# ou
yarn install
```

### Rodando o Projeto

#### 🌐 Web (Next.js)
```bash
npm run dev
# ou
yarn dev

# Acesse: http://localhost:3000
```

#### 📱 Mobile (Expo)
```bash
# Inicia o servidor Expo
npx expo start

# Depois:
# - Pressione 'w' para abrir no navegador (localhost:8081)
# - Pressione 'i' para iOS Simulator (somente macOS)
# - Pressione 'a' para Android Emulator
# - Escaneie o QR code com Expo Go app no celular
```

#### 🧪 Desenvolvimento
```bash
# Limpar cache e reiniciar
npx expo start --clear

# Limpar cache completo (node_modules + metro)
npx expo start -c

# Modo túnel (acessar de qualquer rede)
npx expo start --tunnel
```

---

## 📁 Estrutura do Projeto

```
mex-unified/
├── app/                    # Next.js app directory (web)
│   ├── auth/              # Páginas de autenticação
│   ├── import/            # Importação de snapshots
│   └── layout.tsx         # Layout raiz
├── assets/                # Imagens, ícones, logos
├── components/            # Componentes React reutilizáveis
│   ├── AnimatedLogoIcon.tsx
│   ├── PortfolioChart.tsx
│   ├── ExchangesList.tsx
│   └── ...
├── contexts/              # React Context (estado global)
│   ├── AuthContext.tsx           # Autenticação e usuário
│   ├── BalanceContext.tsx        # Saldos e balances
│   ├── OrdersContext.tsx         # Ordens abertas
│   └── ExchangesContext.tsx      # Exchanges linkadas
├── hooks/                 # Custom React Hooks
│   ├── useBackendStrategies.ts
│   ├── useBackendSnapshots.ts
│   └── ...
├── lib/                   # Utilitários e configurações
│   ├── config.ts                 # Configuração da API
│   ├── secure-storage.ts         # Storage seguro
│   └── encryption.ts             # Criptografia local
├── screens/               # Telas principais do app
│   ├── HomeScreen.tsx
│   ├── PortfolioScreen.tsx
│   ├── OrdersScreen.tsx
│   ├── StrategyScreen.tsx
│   └── ...
├── services/              # Serviços de API
│   ├── api.ts                    # Cliente HTTP principal
│   ├── backend-snapshot-service.ts
│   ├── backend-strategy-service.ts
│   └── ...
├── styles/                # Estilos globais
├── types/                 # TypeScript types/interfaces
├── App.tsx                # Componente raiz (mobile)
├── package.json           # Dependências
└── tsconfig.json          # Config TypeScript
```

---

## 🔧 Tecnologias Principais

### Frontend
- **React Native** - Framework mobile multiplataforma
- **Expo** - Toolchain e SDK para React Native
- **Next.js** - Framework React para web
- **TypeScript** - Tipagem estática
- **TailwindCSS** - Estilização (web)

### State Management
- **React Context API** - Gerenciamento de estado global
- **React Hooks** - Estado local e efeitos

### UI Components
- **React Native Paper** - Componentes Material Design
- **Expo Vector Icons** - Ícones
- **React Native Chart Kit** - Gráficos
- **React Native Reanimated** - Animações

### Autenticação & Segurança
- **Expo Local Authentication** - Biometria (Face ID/Touch ID)
- **Expo Secure Store** - Storage criptografado
- **JWT** - Autenticação via tokens

### Navegação
- **Expo Router** - Navegação file-based
- **React Navigation** - Navegação nativa

---

## 🏗️ Arquitetura

### Backend Integration
O app consome APIs do **Trading Service** (Rust/Actix-web) hospedado na AWS:

```
Frontend (React Native/Expo)
    ↓ HTTP/REST
Backend (Rust/Actix-web) → AWS EC2
    ↓
MongoDB Atlas (Dados criptografados)
    ↓
CCXT Python Service (Exchanges)
```

### Fluxo de Dados

```
1. Usuário autentica (JWT)
2. Frontend busca dados do MongoDB via API
3. Dados são descriptografados localmente
4. UI renderiza portfolio, ordens, estratégias
5. Pull-to-refresh atualiza dados do backend
```

---

## 🔑 Configuração

### Variáveis de Ambiente

Crie um arquivo `lib/config.ts` com suas configurações:

```typescript
export const config = {
  // API Backend (Rust)
  apiBaseUrl: 'http://54.94.231.254:3002/api/v1',
  kongBaseUrl: 'http://54.94.231.254:3002',
  
  // Timeouts
  apiTimeout: 30000,
  
  // Features
  enableBiometric: true,
  enableAutoRefresh: true,
}
```

---

## 📦 Principais Dependências

```json
{
  "expo": "~51.0.0",
  "react": "18.2.0",
  "react-native": "0.74.5",
  "next": "14.2.15",
  "@react-navigation/native": "^6.1.18",
  "expo-secure-store": "~13.0.2",
  "expo-local-authentication": "~14.0.1",
  "react-native-chart-kit": "^6.12.0"
}
```

### Comandos Úteis

```bash
# Instalar nova dependência
npm install <package>
# ou
npx expo install <package>  # Recomendado para pacotes Expo

# Atualizar Expo SDK
npx expo upgrade

# Verificar dependências desatualizadas
npm outdated

# Build para produção (web)
npm run build

# Servir build de produção (web)
npm run start

# Limpar cache do Expo
npx expo start --clear

# Resetar completamente o projeto
rm -rf node_modules package-lock.json
npm install
npx expo start -c
```

---

## 🎯 Funcionalidades Principais

### ✅ Implementadas

- 🔐 **Autenticação**
  - Login com email/senha
  - Login com Google/Apple (OAuth)
  - Face ID / Touch ID
  - Auto-login com biometria

- 💰 **Portfolio**
  - Visualização de saldos em múltiplas exchanges
  - Gráfico de evolução (7d, 15d, 30d)
  - Cálculo de PNL (Profit & Loss)
  - Conversão USD/BRL em tempo real

- 📊 **Snapshots**
  - Histórico de saldos diários
  - Importação de snapshots via JSON
  - Gráficos de evolução patrimonial

- 🎯 **Estratégias**
  - Criação de estratégias de trading
  - Filtros por exchange/símbolo/tipo
  - Ativação/desativação
  - Persistência no MongoDB

- 📈 **Ordens**
  - Visualização de ordens abertas
  - Filtros por exchange/mercado/tipo
  - Sincronização automática

- 🔄 **Pull-to-Refresh**
  - Atualização manual de dados
  - Sincronização com backend
  - Indicadores de loading

### 🚧 Em Desenvolvimento

- 📱 Notificações push
- 🤖 Execução automática de estratégias
- 📊 Relatórios avançados
- 🔔 Alertas de preço

---

## 🐛 Debug & Troubleshooting

### Problemas Comuns

#### 1. **Erro: "Unable to resolve module"**
```bash
# Limpe o cache e reinstale
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

#### 2. **Timeout ao buscar dados**
- Verifique se o backend está rodando: `http://54.94.231.254:3002/api/v1/health`
- Verifique sua conexão de rede
- Aumente os timeouts em `services/api.ts`

#### 3. **Erro de autenticação**
```bash
# Limpe o storage local
# No app: Settings → Logout → Clear Cache
```

#### 4. **Metro Bundler não inicia**
```bash
# Mate processos na porta 8081
npx kill-port 8081
npm start
```

### Logs & Console

```typescript
// Habilitar logs detalhados
console.log('🔍 Debug:', data)
console.error('❌ Erro:', error)
console.warn('⚠️ Aviso:', warning)
```

---

## 🧪 Testes

```bash
# Rodar testes (quando implementados)
npm test

# Testes com coverage
npm run test:coverage
```

---

## 📱 Build para Produção

### iOS
```bash
# Requer macOS e Xcode
eas build --platform ios
```

### Android
```bash
# Gera APK
eas build --platform android --profile preview

# Gera AAB para Google Play
eas build --platform android --profile production
```

### Web
```bash
# Build estático Next.js
npm run build
npm run start # Serve produção
```

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👨‍💻 Autor

**Charles Roberto Sampaio**

- GitHub: [@CharlesSampaio-CRS](https://github.com/CharlesSampaio-CRS)

---

## 🔗 Links Relacionados

- **Backend (Rust)**: [trading-service](../trading-service)
- **Documentação da API**: [SWAGGER_DOCUMENTATION.md](../trading-service/docs/SWAGGER_DOCUMENTATION.md)
- **Fluxos de Auth**: [AUTH_FLOWS.md](../trading-service/docs/AUTH_FLOWS.md)

---

## 📞 Suporte

Para bugs e sugestões, abra uma [issue](https://github.com/CharlesSampaio-CRS/mex-unified/issues) no GitHub.

---

**Made with ❤️ by Charles Roberto Sampaio**
