/**
 * Sistema de Alertas de Preço - Configurável pelo Usuário
 * Notifica quando preço atinge condições específicas
 */

export type AlertType = 'percentage' | 'price';
export type AlertCondition = 
  | 'above'           // Preço acima de X
  | 'below'           // Preço abaixo de X
  | 'crosses_up'      // Cruza para cima (estava abaixo, agora acima)
  | 'crosses_down';   // Cruza para baixo (estava acima, agora abaixo)

export type AlertFrequency = 
  | 'once'       // Notifica apenas uma vez
  | 'repeated'   // Notifica sempre que a condição for verdadeira
  | 'daily';     // Notifica uma vez por dia quando condição for verdadeira

export type AlertStatus = 
  | 'active'     // Ativo, monitorando
  | 'triggered'  // Foi disparado (apenas para 'once')
  | 'paused'     // Pausado pelo usuário
  | 'expired';   // Expirado (se tiver data de expiração)

export interface TokenAlert {
  id: string;
  userId: string;
  symbol: string;
  
  // Exchange (opcional - se vazio, monitora média de todas)
  exchangeId?: string;
  exchangeName?: string;
  
  // Tipo e Condição
  alertType: AlertType;              // 'percentage' ou 'price'
  condition: AlertCondition;         // 'above', 'below', 'crosses_up', 'crosses_down'
  value: number;                     // Porcentagem (5 = 5%) ou preço absoluto ($142.50)
  
  // Configurações
  frequency: AlertFrequency;         // 'once', 'repeated', 'daily'
  message?: string;                  // Mensagem customizada (opcional)
  
  // Estado
  enabled: boolean;
  status: AlertStatus;
  lastTriggeredAt?: string;          // ISO timestamp da última notificação
  lastCheckedPrice?: number;         // Último preço verificado
  basePrice?: number;                // Preço base para alertas de porcentagem
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;                // Data de expiração (opcional)
  
  // Metadados
  triggerCount: number;              // Quantas vezes foi disparado
  notificationSent: boolean;         // Se notificação foi enviada
}

export interface CreateAlertInput {
  symbol: string;
  exchangeId?: string;
  exchangeName?: string;
  alertType: AlertType;
  condition: AlertCondition;
  value: number;
  basePrice?: number;               // Preço base para alertas de porcentagem
  frequency?: AlertFrequency;
  message?: string;
  expiresAt?: string;
}

export interface UpdateAlertInput {
  enabled?: boolean;
  value?: number;
  frequency?: AlertFrequency;
  message?: string;
  status?: AlertStatus;
  lastTriggeredAt?: string;
  lastCheckedPrice?: number;
  triggerCount?: number;
  notificationSent?: boolean;
}

// Templates de mensagens
export const ALERT_TEMPLATES = {
  price_above: (symbol: string, price: number) => 
    `🚀 ${symbol} subiu acima de $${price.toFixed(2)}!`,
  
  price_below: (symbol: string, price: number) => 
    `📉 ${symbol} caiu abaixo de $${price.toFixed(2)}!`,
  
  price_crosses_up: (symbol: string, price: number) => 
    `⬆️ ${symbol} cruzou para cima de $${price.toFixed(2)}!`,
  
  price_crosses_down: (symbol: string, price: number) => 
    `⬇️ ${symbol} cruzou para baixo de $${price.toFixed(2)}!`,
  
  percentage_above: (symbol: string, percent: number, currentPrice: number) => 
    `📈 ${symbol} subiu ${percent.toFixed(2)}%! Preço atual: $${currentPrice.toFixed(2)}`,
  
  percentage_below: (symbol: string, percent: number, currentPrice: number) => 
    `📉 ${symbol} caiu ${Math.abs(percent).toFixed(2)}%! Preço atual: $${currentPrice.toFixed(2)}`,
};

// Validação de alertas
export function validateAlert(alert: Partial<CreateAlertInput>): string[] {
  const errors: string[] = [];
  
  if (!alert.symbol) {
    errors.push('Símbolo do token é obrigatório');
  }
  
  if (!alert.condition) {
    errors.push('Condição do alerta é obrigatória');
  }
  
  if (!alert.value || alert.value <= 0) {
    errors.push('Valor deve ser maior que zero');
  }
  
  if (alert.alertType === 'percentage' && (alert.value < -100 || alert.value > 1000)) {
    errors.push('Percentual deve estar entre -100% e +1000%');
  }
  
  return errors;
}

// Helpers
export function formatAlertCondition(alert: TokenAlert): string {
  const valueStr = alert.alertType === 'percentage' 
    ? `${alert.value > 0 ? '+' : ''}${alert.value}%`
    : `$${alert.value.toFixed(2)}`;
  
  const conditionStr = {
    above: 'acima de',
    below: 'abaixo de',
    crosses_up: 'cruza acima de',
    crosses_down: 'cruza abaixo de',
  }[alert.condition];
  
  return `${conditionStr} ${valueStr}`;
}

export function getAlertIcon(condition: AlertCondition): string {
  return {
    above: '🚀',
    below: '📉',
    crosses_up: '⬆️',
    crosses_down: '⬇️',
  }[condition];
}

export function getAlertFrequencyLabel(frequency: AlertFrequency): string {
  return {
    once: 'Uma vez',
    repeated: 'Sempre',
    daily: 'Uma vez por dia',
  }[frequency];
}
