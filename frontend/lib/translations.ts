/**
 * Sistema de Traduções
 * Centraliza todas as traduções da aplicação
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

export type Language = 'pt-BR' | 'en-US'

const LANGUAGE_STORAGE_KEY = '@cryptohub:language'

// Todas as traduções organizadas por idioma
export const translations = {
  'pt-BR': {
    // Navigation
    'nav.home': 'Início',
    'nav.exchanges': 'Corretoras',
    'nav.strategies': 'Estratégias',
    'nav.profile': 'Perfil',
    
    // Home Screen
    'home.title': 'CryptoHub',
    'home.subtitle': 'Tokens unificadas',
    'home.portfolio': 'Total',
    'home.last24h': 'últimas 24h',
    'home.performance': 'Desempenho',
    'home.exchanges': 'Minhas Corretoras',
    'home.noData': 'Sem dados disponíveis',
    'home.loading': 'Carregando dados...',
    'home.distribution': 'Por Exchange',
    'home.noExchangesConnected': 'Nenhuma exchange conectada',
    'home.tabSummary': 'Resumo',
    'home.tabAssets': 'Ativos',
    'home.tabOrders': 'Ordens',
    'home.updating': 'Atualizando...',
    
    // Common
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.save': 'Salvar',
    'common.loading': 'Carregando...',
    'common.retry': 'Tentar novamente',
    'common.close': 'Fechar',
    
    // Auth
    'login.title': 'Bem-vindo',
    'login.subtitle': 'Entre na sua conta',
    'login.email': 'Email',
    'login.password': 'Senha',
    'login.loginButton': 'Entrar',
    'login.noAccount': 'Não tem uma conta?',
    'login.signUp': 'Cadastre-se',
    
    'signup.title': 'Criar Conta',
    'signup.subtitle': 'Comece sua jornada',
    'signup.nameLabel': 'Nome',
    'signup.namePlaceholder': 'Seu nome completo',
    'signup.emailLabel': 'Email',
    'signup.emailPlaceholder': 'seu@email.com',
    'signup.passwordLabel': 'Senha',
    'signup.passwordPlaceholder': 'Mínimo 8 caracteres',
    'signup.confirmPasswordLabel': 'Confirmar Senha',
    'signup.confirmPasswordPlaceholder': 'Digite a senha novamente',
    'signup.showPassword': 'Mostrar',
    'signup.hidePassword': 'Ocultar',
    'signup.createButton': 'Criar Conta',
    'signup.orSignUpWith': 'ou cadastre-se com',
    'signup.google': 'Continuar com Google',
    'signup.apple': 'Continuar com Apple',
    'signup.alreadyHaveAccount': 'Já tem uma conta?',
    'signup.signIn': 'Entrar',
    'signup.termsText': 'Ao criar uma conta, você concorda com nossos',
    'signup.termsOfService': 'Termos de Serviço',
    'signup.and': 'e',
    'signup.privacyPolicy': 'Política de Privacidade',
    'signup.accountCreated': 'Conta criada com sucesso!',
    'signup.createAccountFailed': 'Falha ao criar conta',
    'signup.passwordMismatch': 'As senhas não coincidem',
    'signup.passwordTooShort': 'A senha deve ter pelo menos 8 caracteres',
    'signup.passwordWeak': 'Fraca',
    'signup.passwordMedium': 'Média',
    'signup.passwordGood': 'Boa',
    'signup.passwordStrong': 'Forte',
    'signup.passwordStrength': 'Força',
    'signup.nameRequired': 'Nome é obrigatório',
    'signup.emailRequired': 'Email é obrigatório',
    'signup.invalidEmail': 'Email inválido',
    'signup.passwordRequired': 'Senha é obrigatória',
    'signup.confirmPasswordRequired': 'Confirmação de senha é obrigatória',
    'signup.passwordNeedsUppercase': 'A senha deve conter pelo menos uma letra maiúscula',
    'signup.passwordNeedsLowercase': 'A senha deve conter pelo menos uma letra minúscula',
    'signup.passwordNeedsNumber': 'A senha deve conter pelo menos um número',
    'signup.userAlreadyExists': 'Este email já está cadastrado',
    'signup.passwordError': 'Erro na senha fornecida',
    'signup.googleSignupFailed': 'Falha ao cadastrar com Google',
    'signup.appleSignupFailed': 'Falha ao cadastrar com Apple',
    'signup.fillAllFields': 'Preencha todos os campos',
    
    // Profile
    'profile.title': 'Perfil',
    'profile.subtitle': 'Suas informações pessoais',
    'profile.logout': 'Sair',
    'profile.logoutConfirm': 'Tem certeza que deseja sair?',
    'profile.logoutError': 'Erro ao sair',
    'profile.settings': 'Configurações',
    'profile.edit': 'Editar',
    'profile.email': 'Email',
    'profile.memberSince': 'Membro desde',
    'profile.changePassword': 'Alterar Senha',
    'profile.exportData': 'Exportar Dados',
    'profile.darkMode': 'Modo Escuro',
    'profile.security': 'Segurança',
    'profile.aboutApp': 'Sobre o App',
    'profile.language': 'Idioma',
    
    // Settings
    'settings.title': 'Configurações',
    'settings.subtitle': 'Personalize seu app',
    'settings.systemTitle': 'Sistema',
    'settings.activated': 'Ativado',
    'settings.deactivated': 'Desativado',
    'settings.biometricEnabled': 'habilitado com sucesso',
    'settings.biometricDisabled': 'desabilitado',
    'settings.biometricError': 'Erro ao configurar biometria',
    'settings.deleteAccount': 'Excluir Conta',
  },
  'en-US': {
    // Navigation
    'nav.home': 'Home',
    'nav.exchanges': 'Exchanges',
    'nav.strategies': 'Strategies',
    'nav.profile': 'Profile',
    
    // Home Screen
    'home.title': 'CryptoHub',
    'home.subtitle': 'Unified Tokens',
    'home.portfolio': 'Total',
    'home.last24h': 'last 24h',
    'home.performance': 'Performance',
    'home.exchanges': 'My Exchanges',
    'home.noData': 'No data available',
    'home.loading': 'Loading data...',
    'home.distribution': 'By Exchange',
    'home.noExchangesConnected': 'No exchanges connected',
    'home.tabSummary': 'Summary',
    'home.tabAssets': 'Assets',
    'home.tabOrders': 'Orders',
    'home.updating': 'Updating...',
    
    // Common
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.loading': 'Loading...',
    'common.retry': 'Retry',
    'common.close': 'Close',
    
    // Auth
    'login.title': 'Welcome',
    'login.subtitle': 'Sign in to your account',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.loginButton': 'Sign In',
    'login.noAccount': "Don't have an account?",
    'login.signUp': 'Sign Up',
    
    'signup.title': 'Create Account',
    'signup.subtitle': 'Start your journey',
    'signup.nameLabel': 'Name',
    'signup.namePlaceholder': 'Your full name',
    'signup.emailLabel': 'Email',
    'signup.emailPlaceholder': 'your@email.com',
    'signup.passwordLabel': 'Password',
    'signup.passwordPlaceholder': 'Minimum 8 characters',
    'signup.confirmPasswordLabel': 'Confirm Password',
    'signup.confirmPasswordPlaceholder': 'Type password again',
    'signup.showPassword': 'Show',
    'signup.hidePassword': 'Hide',
    'signup.createButton': 'Create Account',
    'signup.orSignUpWith': 'or sign up with',
    'signup.google': 'Continue with Google',
    'signup.apple': 'Continue with Apple',
    'signup.alreadyHaveAccount': 'Already have an account?',
    'signup.signIn': 'Sign In',
    'signup.termsText': 'By creating an account, you agree to our',
    'signup.termsOfService': 'Terms of Service',
    'signup.and': 'and',
    'signup.privacyPolicy': 'Privacy Policy',
    'signup.accountCreated': 'Account created successfully!',
    'signup.createAccountFailed': 'Failed to create account',
    'signup.passwordMismatch': 'Passwords do not match',
    'signup.passwordTooShort': 'Password must be at least 8 characters',
    'signup.passwordWeak': 'Weak',
    'signup.passwordMedium': 'Medium',
    'signup.passwordGood': 'Good',
    'signup.passwordStrong': 'Strong',
    'signup.passwordStrength': 'Strength',
    'signup.nameRequired': 'Name is required',
    'signup.emailRequired': 'Email is required',
    'signup.invalidEmail': 'Invalid email',
    'signup.passwordRequired': 'Password is required',
    'signup.confirmPasswordRequired': 'Password confirmation is required',
    'signup.passwordNeedsUppercase': 'Password must contain at least one uppercase letter',
    'signup.passwordNeedsLowercase': 'Password must contain at least one lowercase letter',
    'signup.passwordNeedsNumber': 'Password must contain at least one number',
    'signup.userAlreadyExists': 'This email is already registered',
    'signup.passwordError': 'Error with provided password',
    'signup.googleSignupFailed': 'Failed to sign up with Google',
    'signup.appleSignupFailed': 'Failed to sign up with Apple',
    'signup.fillAllFields': 'Please fill all fields',
    
    // Profile
    'profile.title': 'Profile',
    'profile.subtitle': 'Your personal information',
    'profile.logout': 'Logout',
    'profile.logoutConfirm': 'Are you sure you want to logout?',
    'profile.logoutError': 'Error logging out',
    'profile.settings': 'Settings',
    'profile.edit': 'Edit',
    'profile.email': 'Email',
    'profile.memberSince': 'Member since',
    'profile.changePassword': 'Change Password',
    'profile.exportData': 'Export Data',
    'profile.darkMode': 'Dark Mode',
    'profile.security': 'Security',
    'profile.aboutApp': 'About App',
    'profile.language': 'Language',
    
    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Customize your app',
    'settings.systemTitle': 'System',
    'settings.activated': 'Activated',
    'settings.deactivated': 'Deactivated',
    'settings.biometricEnabled': 'enabled successfully',
    'settings.biometricDisabled': 'disabled',
    'settings.biometricError': 'Error configuring biometric',
    'settings.deleteAccount': 'Delete Account',
  }
} as const

type TranslationKeys = keyof typeof translations['pt-BR']

/**
 * Função de tradução
 */
export function translate(key: string, language: Language): string {
  return translations[language][key as TranslationKeys] || key
}

/**
 * Carrega o idioma salvo do AsyncStorage
 */
export async function loadLanguage(): Promise<Language> {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (savedLanguage === 'pt-BR' || savedLanguage === 'en-US') {
      return savedLanguage
    }
  } catch (error) {
    console.error('Error loading language:', error)
  }
  return 'en-US' // default
}

/**
 * Salva o idioma no AsyncStorage
 */
export async function saveLanguage(language: Language): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch (error) {
    console.error('Error saving language:', error)
    throw error
  }
}
