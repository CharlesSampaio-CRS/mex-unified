/**
 * Serviço de Monitoramento de Alertas de Preço - Mobile Only
 * Verifica periodicamente os preços e dispara notificações quando condições são atingidas
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  TokenAlert, 
  AlertCondition, 
  ALERT_TEMPLATES,
  AlertFrequency,
  AlertStatus
} from '../types/alerts';
import { apiService } from './api';

const ALERTS_STORAGE_KEY = '@cryptohub:price-alerts-v2';
const PRICE_CACHE_KEY = '@cryptohub:price_cache';
const CHECK_INTERVAL_MS = 60000; // 1 minuto

interface PriceCache {
  [symbol: string]: {
    price: number;
    timestamp: number;
  };
}

class PriceAlertService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private priceCache: PriceCache = {};

  /**
   * Inicializa o serviço de alertas - Mobile only
   */
  async initialize() {
    try {
      // Solicita permissão de notificações
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('[PriceAlerts] ⚠️ Permissão de notificações NÃO concedida — alertas não enviarão push');
      } else {
        console.log('[PriceAlerts] ✅ Permissão de notificações concedida');
      }

      // Configura handler de notificações (foreground)
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Carrega cache de preços
      await this.loadPriceCache();
      
      console.log('[PriceAlerts] ✅ Serviço mobile inicializado');
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao inicializar:', error);
    }
  }

  /**
   * Inicia o monitoramento de alertas
   */
  async startMonitoring() {
    if (this.isRunning) {
      console.log('[PriceAlerts] ⚠️ Monitoramento já está rodando');
      return;
    }

    this.isRunning = true;
    console.log('[PriceAlerts] 🚀 Iniciando monitoramento mobile de alertas...');

    // Verifica imediatamente
    await this.checkAlerts();

    // Configura intervalo de verificação
    this.checkInterval = setInterval(async () => {
      await this.checkAlerts();
    }, CHECK_INTERVAL_MS);

    console.log(`[PriceAlerts] ✅ Monitoramento ativo (intervalo: ${CHECK_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Para o monitoramento
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[PriceAlerts] 🛑 Monitoramento pausado');
  }

  /**
   * Verifica todos os alertas ativos
   */
  private async checkAlerts() {
    try {
      const alerts = await this.getActiveAlerts();
      
      if (alerts.length === 0) {
        console.log('[PriceAlerts] ℹ️ Nenhum alerta ativo');
        return;
      }

      console.log(`[PriceAlerts] 🔍 Verificando ${alerts.length} alertas...`);

      // Agrupa alertas por exchangeId+symbol para otimizar chamadas à API
      const alertsByKey = new Map<string, TokenAlert[]>();
      for (const alert of alerts) {
        const key = `${alert.exchangeId || 'global'}:${alert.symbol}`;
        const group = alertsByKey.get(key) || [];
        group.push(alert);
        alertsByKey.set(key, group);
      }

      // Busca preço real de cada exchange+symbol via API (usa credenciais do usuário)
      const currentPrices = await this.fetchCurrentPricesFromExchanges(alertsByKey);

      // Verifica cada alerta
      for (const alert of alerts) {
        await this.checkAlert(alert, currentPrices);
      }

      // Salva cache de preços
      await this.savePriceCache();

    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao verificar alertas:', error);
    }
  }

  /**
   * Verifica um alerta específico
   */
  private async checkAlert(alert: TokenAlert, currentPrices: Map<string, number>) {
    // Key combina exchangeId + symbol para buscar o preço correto da corretora
    const priceKey = `${alert.exchangeId || 'global'}:${alert.symbol}`;
    const currentPrice = currentPrices.get(priceKey);
    
    if (!currentPrice) {
      console.warn(`[PriceAlerts] ⚠️ Preço de ${alert.symbol} (${alert.exchangeId || 'global'}) não disponível`);
      return;
    }

    const cacheKey = `${alert.exchangeId || ''}:${alert.symbol}`;
    const previousPrice = this.priceCache[cacheKey]?.price;
    
    // Atualiza cache
    this.priceCache[cacheKey] = {
      price: currentPrice,
      timestamp: Date.now(),
    };

    // Verifica se alerta foi disparado
    const triggered = this.isAlertTriggered(alert, currentPrice, previousPrice);

    if (triggered) {
      console.log(`[PriceAlerts] 🔔 Alerta disparado: ${alert.symbol} ${alert.condition} ${alert.value}`);
      await this.triggerAlert(alert, currentPrice);
    } else {
      // ✅ SEMPRE atualiza lastCheckedPrice para rastrear mudanças de preço
      // Isso é essencial para condições crosses_up/crosses_down funcionarem
      await this.updateLastCheckedPrice(alert, currentPrice);
    }
  }

  /**
   * Verifica se um alerta deve ser disparado
   */
  private isAlertTriggered(
    alert: TokenAlert,
    currentPrice: number,
    previousPrice?: number
  ): boolean {
    if (!alert.enabled || alert.status !== 'active') {
      return false;
    }

    // ✅ Verifica frequência ANTES de verificar condição
    if (alert.frequency === 'once' && alert.triggerCount > 0) {
      console.log(`[PriceAlerts] ⏭️ Alerta ${alert.symbol} já disparou (frequência: once)`);
      return false;
    }

    if (alert.frequency === 'daily' && alert.lastTriggeredAt) {
      const lastTriggered = new Date(alert.lastTriggeredAt);
      const now = new Date();
      const hoursSinceLastTrigger = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastTrigger < 24) {
        console.log(`[PriceAlerts] ⏳ Alerta ${alert.symbol} em cooldown (${hoursSinceLastTrigger.toFixed(1)}h desde último disparo)`);
        return false;
      }
    }

    // ✅ IMPORTANTE: Evita disparar múltiplas vezes se o preço não mudou significativamente
    // Para alertas de porcentagem, usa threshold relativo (0.01% do preço)
    // Para alertas de preço absoluto, usa threshold fixo ($0.01)
    if (alert.lastCheckedPrice) {
      const priceDiff = Math.abs(currentPrice - alert.lastCheckedPrice);
      const threshold = alert.alertType === 'percentage' 
        ? currentPrice * 0.0001  // 0.01% do preço atual
        : 0.01;                   // $0.01 fixo
      
      if (priceDiff < threshold) {
        return false;
      }
    }

    // Verifica condição baseada no tipo
    if (alert.alertType === 'price') {
      return this.checkPriceCondition(alert, currentPrice, previousPrice);
    } else {
      return this.checkPercentageCondition(alert, currentPrice);
    }
  }

  /**
   * Verifica condição de preço absoluto
   */
  private checkPriceCondition(
    alert: TokenAlert,
    currentPrice: number,
    previousPrice?: number
  ): boolean {
    switch (alert.condition) {
      case 'above':
        return currentPrice > alert.value;
      
      case 'below':
        return currentPrice < alert.value;
      
      case 'crosses_up':
        return previousPrice !== undefined && 
               previousPrice <= alert.value && 
               currentPrice > alert.value;
      
      case 'crosses_down':
        return previousPrice !== undefined && 
               previousPrice >= alert.value && 
               currentPrice < alert.value;
      
      default:
        return false;
    }
  }

  /**
   * Verifica condição de porcentagem
   * O valor do alerta é exatamente o que o usuário digitou:
   *   - condition='above', value=10 → dispara quando subiu >= +10%
   *   - condition='below', value=-5 → dispara quando caiu <= -5%
   *   - condition='above', value=-3 → dispara quando variação >= -3% (caiu menos que 3%)
   *   - condition='below', value=5 → dispara quando variação <= 5% (compatibilidade)
   */
  private checkPercentageCondition(
    alert: TokenAlert,
    currentPrice: number
  ): boolean {
    if (!alert.basePrice || alert.basePrice <= 0) {
      console.error(`[PriceAlerts] ❌ Alerta ${alert.id} de porcentagem sem basePrice válido!`);
      alert.basePrice = currentPrice;
      return false;
    }

    const percentChange = ((currentPrice - alert.basePrice) / alert.basePrice) * 100;
    const targetValue = alert.value; // Valor exato do usuário (pode ser negativo)
    
    console.log(`[PriceAlerts] 📊 ${alert.symbol}: base=$${alert.basePrice.toFixed(2)}, current=$${currentPrice.toFixed(2)}, change=${percentChange.toFixed(2)}%, target=${targetValue}%, condition=${alert.condition}`);

    switch (alert.condition) {
      case 'above':
        // Dispara quando percentChange >= targetValue
        // Ex: target=10 → subiu 10%+  |  target=-5 → caiu menos de 5%
        const isAbove = percentChange >= targetValue;
        console.log(`[PriceAlerts] 🔍 ABOVE: ${percentChange.toFixed(2)}% >= ${targetValue}% ? ${isAbove}`);
        return isAbove;
      
      case 'below':
        // Dispara quando percentChange <= targetValue
        // Ex: target=-5 → caiu 5%+  |  target=-10 → caiu 10%+
        // Compatibilidade: se user digitar 5 com below, interpreta como -5
        const effectiveTarget = targetValue > 0 ? -targetValue : targetValue;
        const isBelow = percentChange <= effectiveTarget;
        console.log(`[PriceAlerts] 🔍 BELOW: ${percentChange.toFixed(2)}% <= ${effectiveTarget}% ? ${isBelow}`);
        return isBelow;
      
      case 'crosses_up': {
        const lastPercent = alert.lastCheckedPrice && alert.basePrice
          ? ((alert.lastCheckedPrice - alert.basePrice) / alert.basePrice) * 100
          : percentChange - 1;
        
        const wasBelow = lastPercent < targetValue;
        const isNowAbove = percentChange >= targetValue;
        const crossed = wasBelow && isNowAbove;
        
        console.log(`[PriceAlerts] 🔍 CROSSES_UP: was ${lastPercent.toFixed(2)}%, now ${percentChange.toFixed(2)}%, target ${targetValue}% → ${crossed}`);
        return crossed;
      }
      
      case 'crosses_down': {
        const lastPercentD = alert.lastCheckedPrice && alert.basePrice
          ? ((alert.lastCheckedPrice - alert.basePrice) / alert.basePrice) * 100
          : percentChange + 1;
        
        const effectiveTargetD = targetValue > 0 ? -targetValue : targetValue;
        const wasAbove = lastPercentD > effectiveTargetD;
        const isNowBelow = percentChange <= effectiveTargetD;
        const crossed = wasAbove && isNowBelow;
        
        console.log(`[PriceAlerts] 🔍 CROSSES_DOWN: was ${lastPercentD.toFixed(2)}%, now ${percentChange.toFixed(2)}%, target ${effectiveTargetD}% → ${crossed}`);
        return crossed;
      }
      
      default:
        return false;
    }
  }

  /**
   * Dispara um alerta (envia notificação)
   */
  private async triggerAlert(alert: TokenAlert, currentPrice: number) {
    try {
      // Gera mensagem
      const message = this.generateAlertMessage(alert, currentPrice);

      // Envia notificação push
      await this.sendNotification(alert, message, currentPrice);

      // Atualiza alerta
      await this.updateAlertAfterTrigger(alert, currentPrice);

      console.log(`[PriceAlerts] ✅ Notificação enviada: ${message}`);
    } catch (error) {
      console.error(`[PriceAlerts] ❌ Erro ao disparar alerta:`, error);
    }
  }

  /**
   * Gera mensagem do alerta
   */
  private generateAlertMessage(alert: TokenAlert, currentPrice: number): string {
    if (alert.message) {
      return alert.message;
    }

    if (alert.alertType === 'price') {
      const templateKey = `price_${alert.condition}` as keyof typeof ALERT_TEMPLATES;
      const template = ALERT_TEMPLATES[templateKey];
      return template ? (template as any)(alert.symbol, alert.value, currentPrice) : 
        `${alert.symbol}: $${currentPrice.toFixed(2)}`;
    } else {
      const percentChange = alert.basePrice 
        ? ((currentPrice - alert.basePrice) / alert.basePrice) * 100
        : 0;
      
      const templateKey = percentChange > 0 ? 'percentage_above' : 'percentage_below';
      const template = ALERT_TEMPLATES[templateKey];
      return template ? template(alert.symbol, percentChange, currentPrice) :
        `${alert.symbol}: ${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%`;
    }
  }

  /**
   * Envia notificação push - Mobile only
   */
  private async sendNotification(alert: TokenAlert, message: string, currentPrice: number) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 Alerta de Preço: ${alert.symbol}`,
          body: message,
          data: {
            alertId: alert.id,
            symbol: alert.symbol,
            price: currentPrice,
            type: 'price-alert',
          },
          sound: 'default',
          badge: 1,
        },
        trigger: null, // Imediato
      });
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao enviar notificação:', error);
    }
  }

  /**
   * Atualiza alerta após disparo
   */
  private async updateAlertAfterTrigger(alert: TokenAlert, currentPrice: number) {
    const alerts = await this.getAllAlerts();
    const index = alerts.findIndex(a => a.id === alert.id);
    
    if (index === -1) return;

    alerts[index] = {
      ...alerts[index],
      lastTriggeredAt: new Date().toISOString(),
      lastCheckedPrice: currentPrice,
      triggerCount: (alerts[index].triggerCount || 0) + 1,
      notificationSent: true,
      status: alert.frequency === 'once' ? 'triggered' : 'active',
    };

    await this.saveAlerts(alerts);
  }

  /**
   * Atualiza lastCheckedPrice do alerta (mesmo quando não disparar)
   */
  private async updateLastCheckedPrice(alert: TokenAlert, currentPrice: number) {
    const alerts = await this.getAllAlerts();
    const index = alerts.findIndex(a => a.id === alert.id);
    
    if (index === -1) return;

    alerts[index] = {
      ...alerts[index],
      lastCheckedPrice: currentPrice,
      updatedAt: new Date().toISOString(),
    };

    await this.saveAlerts(alerts);
  }

  /**
   * Busca preços reais das corretoras via API (usa credenciais/secret do usuário)
   * Agrupa por exchangeId+symbol para otimizar chamadas
   * Chama POST /token-pairs/ticker que busca via CCXT com api_key/secret decriptados
   */
  private async fetchCurrentPricesFromExchanges(
    alertsByKey: Map<string, TokenAlert[]>
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    const fetchPromises: Promise<void>[] = [];
    
    for (const [key, alerts] of alertsByKey) {
      const [exchangeId, symbol] = key.split(':');
      const alert = alerts[0]; // Pega dados do primeiro alerta do grupo
      
      if (!exchangeId || exchangeId === 'global') {
        console.warn(`[PriceAlerts] ⚠️ Alerta ${symbol} sem exchangeId, ignorando`);
        continue;
      }

      // Par de trading padrão: SYMBOL/USDT
      const tradingPair = symbol.includes('/') ? symbol : `${symbol}/USDT`;

      const promise = (async () => {
        try {
          const result = await apiService.getPairTicker(exchangeId, tradingPair);
          
          if (result.success && result.ticker.last > 0) {
            prices.set(key, result.ticker.last);
            console.log(`[PriceAlerts] ✅ ${symbol} @ ${result.exchange}: $${result.ticker.last}`);
          } else {
            console.warn(`[PriceAlerts] ⚠️ Ticker inválido para ${symbol} na exchange ${exchangeId}`);
          }
        } catch (error: any) {
          console.error(`[PriceAlerts] ❌ Erro ao buscar preço de ${symbol} (${exchangeId}):`, error.message);
        }
      })();

      fetchPromises.push(promise);
    }

    // Busca todos os preços em paralelo
    await Promise.allSettled(fetchPromises);

    console.log(`[PriceAlerts] 📊 ${prices.size}/${alertsByKey.size} preços obtidos das corretoras`);
    return prices;
  }

  /**
   * CRUD de Alertas
   */

  async getAllAlerts(): Promise<TokenAlert[]> {
    try {
      const stored = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao carregar alertas:', error);
      return [];
    }
  }

  async getActiveAlerts(): Promise<TokenAlert[]> {
    const alerts = await this.getAllAlerts();
    return alerts.filter(a => a.enabled && a.status === 'active');
  }

  async saveAlerts(alerts: TokenAlert[]) {
    try {
      await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao salvar alertas:', error);
    }
  }

  async addAlert(alert: TokenAlert) {
    const alerts = await this.getAllAlerts();
    alerts.push(alert);
    await this.saveAlerts(alerts);
    console.log(`[PriceAlerts] ✅ Alerta adicionado: ${alert.symbol}`);
  }

  async updateAlert(id: string, updates: Partial<TokenAlert>) {
    const alerts = await this.getAllAlerts();
    const index = alerts.findIndex(a => a.id === id);
    
    if (index !== -1) {
      alerts[index] = { ...alerts[index], ...updates, updatedAt: new Date().toISOString() };
      await this.saveAlerts(alerts);
      console.log(`[PriceAlerts] ✅ Alerta atualizado: ${id}`);
    }
  }

  async deleteAlert(id: string) {
    console.log(`[PriceAlerts] 🗑️ Tentando remover alerta: ${id}`);
    const alerts = await this.getAllAlerts();
    console.log(`[PriceAlerts] 📊 Total de alertas antes da remoção: ${alerts.length}`);
    
    const filtered = alerts.filter(a => a.id !== id);
    console.log(`[PriceAlerts] 📊 Total de alertas após filtro: ${filtered.length}`);
    
    if (alerts.length === filtered.length) {
      console.warn(`[PriceAlerts] ⚠️ Alerta ${id} não encontrado na lista`);
    }
    
    await this.saveAlerts(filtered);
    console.log(`[PriceAlerts] ✅ Alerta removido com sucesso: ${id}`);
  }

  /**
   * Cache de Preços
   */

  private async loadPriceCache() {
    try {
      const stored = await AsyncStorage.getItem(PRICE_CACHE_KEY);
      this.priceCache = stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao carregar cache:', error);
      this.priceCache = {};
    }
  }

  private async savePriceCache() {
    try {
      await AsyncStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(this.priceCache));
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao salvar cache:', error);
    }
  }

  /**
   * Limpa cache e alertas antigos
   */
  async cleanup() {
    try {
      // Remove alertas expirados
      const alerts = await this.getAllAlerts();
      const now = Date.now();
      
      const validAlerts = alerts.filter(alert => {
        if (!alert.expiresAt) return true;
        return new Date(alert.expiresAt).getTime() > now;
      });

      if (validAlerts.length !== alerts.length) {
        await this.saveAlerts(validAlerts);
        console.log(`[PriceAlerts] 🗑️ ${alerts.length - validAlerts.length} alertas expirados removidos`);
      }

      // Limpa cache de preços antigos (> 1 hora)
      const oneHourAgo = now - (60 * 60 * 1000);
      Object.keys(this.priceCache).forEach(symbol => {
        if (this.priceCache[symbol].timestamp < oneHourAgo) {
          delete this.priceCache[symbol];
        }
      });

      await this.savePriceCache();
    } catch (error) {
      console.error('[PriceAlerts] ❌ Erro ao limpar:', error);
    }
  }
}

export const priceAlertService = new PriceAlertService();
