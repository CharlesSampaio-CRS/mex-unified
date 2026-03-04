/**
 * Context de Alertas de Preço Configuráveis
 * Gerencia alertas baseados em condições de preço definidas pelo usuário
 */

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TokenAlert, CreateAlertInput, UpdateAlertInput, AlertStatus } from '../types/alerts';
import { priceAlertService } from '../services/priceAlertService';
import { useAuth } from './AuthContext';

interface AlertsContextType {
  // Estado
  alerts: TokenAlert[];
  activeAlerts: TokenAlert[];
  loading: boolean;
  error: string | null;
  
  // Ações CRUD
  addAlert: (input: CreateAlertInput) => Promise<TokenAlert | null>;
  updateAlert: (id: string, updates: UpdateAlertInput) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  toggleAlert: (id: string, enabled?: boolean) => Promise<void>;
  
  // Consultas
  getAlertsForToken: (symbol: string, exchange?: string) => TokenAlert[];
  getAlertById: (id: string) => TokenAlert | undefined;
  refreshAlerts: () => Promise<void>;
  
  // Monitoramento
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  isMonitoring: boolean;
  
  // Legacy (manter compatibilidade)
  updateLastTriggered: (id: string) => Promise<void>;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

const STORAGE_KEY = '@cryptohub:price-alerts-v2';

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<TokenAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Carregar alertas do AsyncStorage ao iniciar
  useEffect(() => {
    if (user) {
      loadAlerts();
      initializeMonitoring();
    }
  }, [user]);

  // Salvar alertas no AsyncStorage sempre que mudar
  // Flag para evitar salvar o estado inicial vazio antes do loadAlerts
  const hasLoadedRef = React.useRef(false);
  
  useEffect(() => {
    if (!hasLoadedRef.current) return; // Ignora o primeiro render (antes do load)
    saveAlerts(alerts);
  }, [alerts]);

  /**
   * Inicializa serviço de monitoramento
   */
  const initializeMonitoring = async () => {
    try {
      await priceAlertService.initialize();
      await priceAlertService.startMonitoring();
      setIsMonitoring(true);
      console.log('[AlertsContext] ✅ Monitoramento iniciado');
    } catch (err) {
      console.error('[AlertsContext] ❌ Erro ao inicializar monitoramento:', err);
    }
  };

  /**
   * Carrega alertas do storage
   */
  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const loadedAlerts: TokenAlert[] = JSON.parse(stored);
        setAlerts(loadedAlerts);
        console.log(`[AlertsContext] ✅ ${loadedAlerts.length} alertas carregados`);
      }
      hasLoadedRef.current = true;
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar alertas');
      console.error('[AlertsContext] ❌ Erro ao carregar alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salva alertas no storage
   */
  const saveAlerts = async (alertsToSave: TokenAlert[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alertsToSave));
    } catch (err) {
      console.error('[AlertsContext] ❌ Erro ao salvar alertas:', err);
    }
  };

  /**
   * Cria novo alerta
   */
  const addAlert = useCallback(async (input: CreateAlertInput): Promise<TokenAlert | null> => {
    try {
      setError(null);
      
      const newAlert: TokenAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user?.id || '',
        symbol: input.symbol.toUpperCase(),
        exchangeId: input.exchangeId,
        exchangeName: input.exchangeName,
        alertType: input.alertType,
        condition: input.condition,
        value: input.value,
        basePrice: input.basePrice,        // ✅ Define basePrice se fornecido
        frequency: input.frequency || 'once',
        message: input.message,
        enabled: true,
        status: 'active' as AlertStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: input.expiresAt,
        triggerCount: 0,
        notificationSent: false,
      };

      // Adiciona ao serviço
      await priceAlertService.addAlert(newAlert);
      
      // Atualiza estado local
      setAlerts(prev => [...prev, newAlert]);
      
      console.log('[AlertsContext] ✅ Alerta criado:', newAlert.symbol);
      return newAlert;
    } catch (err: any) {
      setError(err.message || 'Erro ao criar alerta');
      console.error('[AlertsContext] ❌ Erro ao criar alerta:', err);
      return null;
    }
  }, [user]);

  /**
   * Atualiza alerta existente
   */
  const updateAlert = useCallback(async (id: string, updates: UpdateAlertInput) => {
    try {
      setError(null);
      
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      // Atualiza no serviço
      await priceAlertService.updateAlert(id, updatedData);
      
      // Atualiza estado local
      setAlerts(prev => prev.map(alert => 
        alert.id === id 
          ? { ...alert, ...updatedData }
          : alert
      ));
      
      console.log('[AlertsContext] ✅ Alerta atualizado:', id);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar alerta');
      console.error('[AlertsContext] ❌ Erro ao atualizar alerta:', err);
      throw err;
    }
  }, []);

  /**
   * Remove alerta
   */
  const deleteAlert = useCallback(async (id: string) => {
    console.log('[AlertsContext] 🗑️ Iniciando remoção do alerta:', id);
    
    try {
      setError(null);
      
      // Update otimista - remove da UI e salva no storage imediatamente
      setAlerts(prev => {
        const filtered = prev.filter(alert => alert.id !== id);
        console.log('[AlertsContext] 📊 Alertas antes:', prev.length, 'depois:', filtered.length);
        // Salva direto no storage para garantir persistência imediata
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)).catch(console.error);
        return filtered;
      });
      
      // Também remove no serviço (mantém sincronizado)
      await priceAlertService.deleteAlert(id);
      
      console.log('[AlertsContext] ✅ Alerta removido com sucesso:', id);
    } catch (err: any) {
      setError(err.message || 'Erro ao remover alerta');
      console.error('[AlertsContext] ❌ Erro ao remover alerta:', err);
      
      // Em caso de erro, recarrega os alertas para garantir consistência
      await loadAlerts();
      throw err;
    }
  }, [loadAlerts]);

  /**
   * Liga/Desliga alerta
   */
  const toggleAlert = useCallback(async (id: string, enabled?: boolean) => {
    try {
      setError(null);
      
      // Se enabled não for passado, inverte o valor atual
      const alert = alerts.find(a => a.id === id);
      if (!alert) return;
      
      const newEnabled = enabled !== undefined ? enabled : !alert.enabled;
      
      await updateAlert(id, { enabled: newEnabled });
      
      console.log(`[AlertsContext] ${newEnabled ? '✅' : '⏸️'} Alerta ${newEnabled ? 'ativado' : 'pausado'}:`, id);
    } catch (err: any) {
      setError(err.message || 'Erro ao alternar alerta');
      console.error('[AlertsContext] ❌ Erro ao alternar alerta:', err);
    }
  }, [alerts, updateAlert]);

  /**
   * Busca alertas de um token específico
   */
  const getAlertsForToken = useCallback((symbol: string, exchange?: string): TokenAlert[] => {
    return alerts.filter(alert => {
      if (!alert.enabled) return false;
      if (alert.symbol !== symbol.toUpperCase()) return false;
      if (exchange && alert.exchangeId && alert.exchangeId !== exchange) return false;
      return true;
    });
  }, [alerts]);

  /**
   * Busca alerta por ID
   */
  const getAlertById = useCallback((id: string): TokenAlert | undefined => {
    return alerts.find(alert => alert.id === id);
  }, [alerts]);

  /**
   * Recarrega alertas
   */
  const refreshAlerts = useCallback(async () => {
    await loadAlerts();
  }, []);

  /**
   * Atualiza timestamp de último disparo (legacy)
   */
  const updateLastTriggered = useCallback(async (id: string) => {
    await updateAlert(id, { 
      lastTriggeredAt: new Date().toISOString(),
      triggerCount: (alerts.find(a => a.id === id)?.triggerCount || 0) + 1
    });
  }, [alerts, updateAlert]);

  /**
   * Inicia monitoramento
   */
  const startMonitoring = useCallback(async () => {
    try {
      await priceAlertService.startMonitoring();
      setIsMonitoring(true);
      console.log('[AlertsContext] 🚀 Monitoramento iniciado');
    } catch (err) {
      console.error('[AlertsContext] ❌ Erro ao iniciar monitoramento:', err);
    }
  }, []);

  /**
   * Para monitoramento
   */
  const stopMonitoring = useCallback(() => {
    priceAlertService.stopMonitoring();
    setIsMonitoring(false);
    console.log('[AlertsContext] ⏸️ Monitoramento pausado');
  }, []);

  // Alertas ativos
  const activeAlerts = alerts.filter(a => a.enabled && a.status === 'active');

  const value: AlertsContextType = {
    // Estado
    alerts,
    activeAlerts,
    loading,
    error,
    
    // Ações
    addAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    
    // Consultas
    getAlertsForToken,
    getAlertById,
    refreshAlerts,
    
    // Monitoramento
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    
    // Legacy
    updateLastTriggered,
  };

  return (
    <AlertsContext.Provider value={value}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
