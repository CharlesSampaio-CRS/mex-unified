import React, { useState, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useOrders } from '../contexts/OrdersContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { useBalance } from '../contexts/BalanceContext';
import { apiService } from '../services/api';
import { orderOperationsService } from '../services/order-operations';
import { OpenOrder, getOrderId } from '../types/orders';
import { OrderDetailsModal } from './order-details-modal';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';
import { GradientCard } from './GradientCard';
import { typography, fontWeights } from '../lib/typography';

export interface AllOpenOrdersListRef {
  refresh: () => Promise<void>;
}

export const AllOpenOrdersList = forwardRef((props: {}, ref: React.Ref<AllOpenOrdersListRef>) => {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { ordersByExchange, loading, refreshing: contextRefreshing, timestamp, refresh } = useOrders();
  const { hideValue } = usePrivacy();
  const { refresh: refreshBalance, data: balanceData } = useBalance();
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // 🆕 Estado local para ordens (permite remoção otimista)
  const [localOrdersByExchange, setLocalOrdersByExchange] = useState(ordersByExchange);
  
  // Sincroniza estado local quando ordersByExchange atualiza
  useEffect(() => {
    setLocalOrdersByExchange(ordersByExchange);
  }, [ordersByExchange]);
  
  // Filtrar ordens por busca (nome da exchange ou símbolo do token)
  const filteredOrdersByExchange = useMemo(() => {
    if (!searchQuery.trim()) {
      return localOrdersByExchange;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return localOrdersByExchange
      .map(exchange => {
        const exchangeName = exchange.exchangeName.toLowerCase();
        
        // Se o nome da exchange corresponde, retorna todas as ordens
        if (exchangeName.includes(query)) {
          return exchange;
        }
        
        // Caso contrário, filtra apenas ordens com símbolos correspondentes
        return {
          ...exchange,
          orders: exchange.orders.filter(order => 
            order.symbol.toLowerCase().includes(query)
          )
        };
      })
      .filter(exchange => exchange.orders.length > 0);
  }, [localOrdersByExchange, searchQuery]);
  
  const totalOrders = filteredOrdersByExchange.reduce((sum, ex) => sum + ex.orders.length, 0);
  
  const gradientColors: readonly [string, string, ...string[]] = isDark 
    ? ['rgba(26, 26, 26, 0.95)', 'rgba(38, 38, 38, 0.95)', 'rgba(26, 26, 26, 0.95)']
    : ['rgba(250, 250, 249, 1)', 'rgba(247, 246, 244, 1)', 'rgba(250, 250, 249, 1)']
  
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null);
  const [orderDetailsVisible, setOrderDetailsVisible] = useState(false);
  
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<{ order: OpenOrder; exchangeId: string; exchangeName: string } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingOrderIds, setCancellingOrderIds] = useState<Set<string>>(new Set()); // IDs das ordens sendo canceladas

  // Estado para confirmar clonagem de ordem
  const [confirmCloneVisible, setConfirmCloneVisible] = useState(false);
  const [orderToClone, setOrderToClone] = useState<{ order: OpenOrder; exchangeId: string; exchangeName: string } | null>(null);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  
  // Estado para tooltip
  const [tooltipVisible, setTooltipVisible] = useState<{ [key: string]: boolean }>({});

  // Estado para modal de trade (não usado mais para clone direto)
  const [tradeModalVisible, setTradeModalVisible] = useState(false);

  // Expõe método refresh via ref
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      setIsUpdating(true);
      try {
        await refresh();
      } finally {
        setTimeout(() => setIsUpdating(false), 300);
      }
    },
  }), [refresh]);

  // Handler para pull-to-refresh
  const handleRefresh = async () => {
    setIsUpdating(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setIsUpdating(false), 300);
    }
  };

  // Limpa ordens "cancelando" quando a lista atualiza (elas já foram removidas)
  useEffect(() => {
    if (ordersByExchange.length > 0 && cancellingOrderIds.size > 0) {
      const currentOrderIds = new Set(
        ordersByExchange.flatMap(ex => ex.orders.map(order => getOrderId(order)))
      );
      
      // Remove IDs que não existem mais na lista
      setCancellingOrderIds(prev => {
        const newSet = new Set<string>();
        prev.forEach(id => {
          if (currentOrderIds.has(id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
    }
  }, [ordersByExchange]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return t('orders.timeAgo.minutes').replace('{minutes}', String(minutes));
    } else if (hours < 24) {
      return t('orders.timeAgo.hours').replace('{hours}', String(hours));
    } else {
      const days = Math.floor(hours / 24);
      return t('orders.timeAgo.days').replace('{days}', String(days));
    }
  };

  const handleOpenDetails = (order: OpenOrder) => {
    setSelectedOrder(order);
    setOrderDetailsVisible(true);
  };

  // 🆕 Remove ordem localmente (otimista)
  const removeOrderLocally = (orderId: string, exchangeId: string) => {
    setLocalOrdersByExchange(prev => 
      prev.map(exchange => {
        if (exchange.exchangeId === exchangeId) {
          return {
            ...exchange,
            orders: exchange.orders.filter(order => getOrderId(order) !== orderId)
          };
        }
        return exchange;
      }).filter(exchange => exchange.orders.length > 0) // Remove exchanges sem ordens
    );
  };

  const handleCancelOrder = (order: OpenOrder, exchangeId: string, exchangeName: string) => {
    setOrderToCancel({ order, exchangeId, exchangeName });
    setConfirmCancelVisible(true);
    setCancelError(null);
  };

  const confirmCancelOrder = async (order: OpenOrder, exchangeId: string, exchangeName: string) => {
    if (!user?.id) {
      setCancelError('Usuário não autenticado');
      return;
    }

    const orderId = getOrderId(order);
    
    setCancelLoading(true);
    setCancelError(null);
    // Fecha modal imediatamente para evitar overlay na tela inteira
    setConfirmCancelVisible(false);
    setOrderToCancel(null);
    
    // ✅ Marca a ordem como "cancelando" IMEDIATAMENTE
    setCancellingOrderIds(prev => new Set(prev).add(orderId));

    try {
      const result = await apiService.cancelOrder(user.id, orderId, exchangeId, order.symbol);
      
      if (result.success) {
        // ✅ REMOÇÃO OTIMISTA: Remove da lista IMEDIATAMENTE
        removeOrderLocally(orderId, exchangeId);
        setCancelLoading(false);
        
        // Remove do Set de "cancelando"
        setCancellingOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
        
        // Recarrega em background (silencioso - sem loading)
        refresh().catch(console.error);
        refreshBalance().catch(console.error);
      } else {
        const errorMsg = result.error || result.message || 'Erro ao cancelar ordem';
        setCancelError(errorMsg);
        setCancelLoading(false);
        // Remove do Set se deu erro
        setCancellingOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido ao cancelar ordem';
      setCancelError(errorMessage);
      setCancelLoading(false);
      // Remove do Set se deu erro
      setCancellingOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleCloneOrder = (order: OpenOrder, exchangeId: string, exchangeName: string) => {
    setOrderToClone({ order, exchangeId, exchangeName });
    setCloneError(null);
    setInsufficientBalance(false);

    // Validar saldo disponível
    if (balanceData) {
      const exchange = balanceData.exchanges.find(ex => 
        (ex.exchange_id === exchangeId) || (ex.exchange === exchangeName)
      );
      
      if (exchange && exchange.balances) {
        if (order.side === 'buy') {
          // Para ordem de compra, verificar USDT/USD/USDC
          const usdtBalance = exchange.balances['USDT'] || exchange.balances['USD'] || exchange.balances['USDC'];
          const totalNeeded = order.price * order.amount;
          if (usdtBalance && usdtBalance.free < totalNeeded) {
            setInsufficientBalance(true);
          }
        } else {
          // Para ordem de venda, verificar saldo do token base
          const [baseAsset] = order.symbol.split('/');
          const tokenBalance = exchange.balances[baseAsset];
          if (tokenBalance && tokenBalance.free < order.amount) {
            setInsufficientBalance(true);
          }
        }
      }
    }

    setConfirmCloneVisible(true);
  };

  const confirmCloneOrder = async () => {
    if (!orderToClone || !user) return;

    const { order, exchangeId, exchangeName } = orderToClone;
    
    setCloneLoading(true);
    setCloneError(null);

    try {
      let result;
      if (order.side === 'buy') {
        result = await orderOperationsService.createBuyOrder(
          user.id,
          exchangeId,
          order.symbol,
          order.amount,
          'limit',
          order.price
        );
      } else {
        result = await orderOperationsService.createSellOrder(
          user.id,
          exchangeId,
          order.symbol,
          order.amount,
          'limit',
          order.price
        );
      }

      if (result.success) {
        // Fecha o modal imediatamente
        setConfirmCloneVisible(false);
        setOrderToClone(null);
        setCloneLoading(false);

        // Atualiza em background
        refresh().catch(console.error);
        refreshBalance().catch(console.error);
      } else {
        const errorMsg = result.error || result.message || 'Erro ao clonar ordem';
        setCloneError(errorMsg);
        setCloneLoading(false);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido ao clonar ordem';
      setCloneError(errorMessage);
      setCloneLoading(false);
    }
  };

  // Removido loading customizado - usa apenas o RefreshControl do ScrollView

  return (
    <ScrollView
      style={[styles.scrollContainer, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={contextRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Indicador de atualização */}
      {isUpdating && totalOrders > 0 && (
        <View style={[styles.updatingBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.updatingText, { color: colors.primary }]}>
            Atualizando ordens...
          </Text>
        </View>
      )}
      
      {/* Card Principal com LinearGradient - SEMPRE VISÍVEL */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { borderColor: colors.border }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.valueContainer}>
            <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
              {timestamp 
                ? `Updated ${new Date(timestamp).toLocaleTimeString(language, { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo'
                  })}` 
                : 'Updated recently'}
            </Text>
          </View>
        </View>

        {/* Campo de Busca */}
        <View style={styles.searchContainer}>
          <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="BTC, ETH, SOL..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Mensagem quando não há orders */}
      {totalOrders === 0 ? (
        <View style={styles.emptyContentContainer}>
          <Text style={[styles.emptyIcon, { color: colors.textTertiary }]}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('orders.empty')}</Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            {t('orders.emptyDescription')}
          </Text>
        </View>
      ) : (
        // Lista de orders por exchange
        <>
      {filteredOrdersByExchange.map((exchangeData) => {
        if (exchangeData.orders.length === 0) return null;

        return (
          <View key={exchangeData.exchangeId} style={styles.exchangeSection}>
            <View style={[styles.exchangeHeader, { backgroundColor: colors.surface }]}>
              <Text style={[styles.exchangeName, { color: colors.text }]}>
                {exchangeData.exchangeName}
              </Text>
              <Text style={[styles.orderCount, { color: colors.textSecondary }]}>
                {exchangeData.orders.length} {exchangeData.orders.length === 1 ? t('orders.order') : t('orders.ordersPlural')}
              </Text>
            </View>

            {exchangeData.orders.map((order, index) => {
              const orderId = getOrderId(order);
              const isCancelling = cancellingOrderIds.has(orderId);
              
              return (
              <GradientCard
                key={orderId || index}
                style={[
                  styles.orderCard,
                  isCancelling && { opacity: 0.5 }
                ]}
              >
                {isCancelling && (
                  <View style={styles.cancellingOverlay}>
                    <AnimatedLogoIcon size={24} />
                    <Text style={[styles.cancellingText, { color: colors.textSecondary }]}>
                      {t('orders.cancelingOrder')}
                    </Text>
                  </View>
                )}
                <View style={styles.orderHeader}>
                  <View style={styles.orderTitleRow}>
                    <View style={styles.symbolWithClone}>
                      <Text style={[styles.orderSymbol, { color: colors.text }]}>{order.symbol}</Text>
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity
                          style={[styles.cloneIconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          onPress={() => handleCloneOrder(order, exchangeData.exchangeId, exchangeData.exchangeName)}
                          onLongPress={() => {
                            const key = `${order.id}-clone`;
                            setTooltipVisible({ ...tooltipVisible, [key]: true });
                            setTimeout(() => {
                              setTooltipVisible({ ...tooltipVisible, [key]: false });
                            }, 2000);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="copy-outline" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        {tooltipVisible[`${order.id}-clone`] && (
                          <View style={[styles.tooltip, { backgroundColor: colors.text }]}>
                            <Text style={[styles.tooltipText, { color: colors.background }]}>
                              {t('orders.cloneTooltip')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.orderTime, { color: colors.textTertiary }]}>
                      {formatDate(order.timestamp)}
                    </Text>
                  </View>
                  <View style={[
                    styles.sideBadge,
                    { backgroundColor: order.side === 'buy' ? colors.successLight : colors.dangerLight }
                  ]}>
                    <Text style={[
                      styles.sideText,
                      { color: order.side === 'buy' ? colors.success : colors.danger }
                    ]}>
                      {order.side === 'buy' ? t('orders.side.buy') : t('orders.side.sell')}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orders.amount')}:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {hideValue(formatAmount(order.amount))}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orders.price')}:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {hideValue(`$${formatPrice(order.price)}`)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('orders.total')}:</Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontWeight: '600' }]}>
                      {hideValue(`$${formatPrice(order.price * order.amount)}`)}
                    </Text>
                  </View>
                </View>

                {/* Botões de ação */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.detailsButton,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]}
                    onPress={() => handleOpenDetails(order)}
                  >
                    <Text style={[styles.detailsButtonText, { color: colors.primary }]}>
                      {t('orders.viewDetails')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      { backgroundColor: 'transparent', borderColor: colors.danger },
                      isCancelling && { opacity: 0.5 }
                    ]}
                    onPress={() => handleCancelOrder(order, exchangeData.exchangeId, exchangeData.exchangeName)}
                    disabled={isCancelling}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.danger }]}>
                      {t('orders.cancel')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </GradientCard>
            )})}
          </View>
        );
      })}
        </>
      )}

      {/* Modal de detalhes da ordem */}
      <OrderDetailsModal
        visible={orderDetailsVisible}
        onClose={() => setOrderDetailsVisible(false)}
        order={selectedOrder}
      />

      {/* Modal de confirmação de cancelamento */}
      <Modal
        visible={confirmCancelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancelLoading) {
            setConfirmCancelVisible(false);
            setOrderToCancel(null);
            setCancelError(null);
          }
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!cancelLoading) {
              setConfirmCancelVisible(false);
              setOrderToCancel(null);
              setCancelError(null);
            }
          }}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('orders.cancelOrder')}
            </Text>

            {orderToCancel && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  {t('orders.confirmCancelMessage')}
                </Text>

                <View style={[styles.orderInfoBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={styles.orderInfoRow}>
                    <Text style={[styles.orderInfoLabel, { color: colors.textSecondary }]}>{t('orders.pair')}:</Text>
                    <Text style={[styles.orderInfoValue, { color: colors.text }]}>
                      {orderToCancel.order.symbol}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={[styles.orderInfoLabel, { color: colors.textSecondary }]}>{t('orders.type')}:</Text>
                    <Text style={[
                      styles.orderInfoValue,
                      { color: orderToCancel.order.side === 'buy' ? colors.success : colors.danger }
                    ]}>
                      {orderToCancel.order.side === 'buy' ? t('orders.side.buy') : t('orders.side.sell')}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={[styles.orderInfoLabel, { color: colors.textSecondary }]}>{t('orders.price')}:</Text>
                    <Text style={[styles.orderInfoValue, { color: colors.text }]}>
                      {hideValue(`$${formatPrice(orderToCancel.order.price)}`)}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={[styles.orderInfoLabel, { color: colors.textSecondary }]}>{t('orders.quantity')}:</Text>
                    <Text style={[styles.orderInfoValue, { color: colors.text }]}>
                      {hideValue(formatAmount(orderToCancel.order.amount))}
                    </Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={[styles.orderInfoLabel, { color: colors.textSecondary }]}>{t('orders.exchange')}:</Text>
                    <Text style={[styles.orderInfoValue, { color: colors.text }]}>
                      {orderToCancel.exchangeName}
                    </Text>
                  </View>
                </View>

                {cancelError && (
                  <View style={[styles.errorBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      ❌ {cancelError}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: colors.border }]}
                onPress={() => {
                  setConfirmCancelVisible(false);
                  setOrderToCancel(null);
                  setCancelError(null);
                }}
                disabled={cancelLoading}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                  {t('common.back')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonDanger,
                  { backgroundColor: colors.danger, borderColor: colors.danger },
                  cancelLoading && styles.modalButtonDisabled
                ]}
                onPress={() => {
                  if (orderToCancel && !cancelLoading) {
                    confirmCancelOrder(orderToCancel.order, orderToCancel.exchangeId, orderToCancel.exchangeName);
                  }
                }}
                disabled={cancelLoading}
              >
                {cancelLoading ? (
                  <AnimatedLogoIcon size={20} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    {cancelError ? 'Tentar Novamente' : 'Sim, Cancelar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmação para clonar ordem */}
      <Modal
        visible={confirmCloneVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cloneLoading) {
            setConfirmCloneVisible(false);
            setOrderToClone(null);
            setCloneError(null);
          }
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!cloneLoading) {
              setConfirmCloneVisible(false);
              setOrderToClone(null);
              setCloneError(null);
            }
          }}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              📋 {t('orders.cloneTitle')}
            </Text>
            
            {orderToClone && (
              <View>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                  {t('orders.cloneMessage')}
                </Text>

                <View style={[styles.orderSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('orders.symbol')}:</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {orderToClone.order.symbol}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('orders.side.title')}:</Text>
                    <Text style={[
                      styles.summaryValue,
                      { color: orderToClone.order.side === 'buy' ? colors.success : colors.danger }
                    ]}>
                      {orderToClone.order.side === 'buy' ? t('orders.side.buy') : t('orders.side.sell')}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('orders.amount')}:</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatAmount(orderToClone.order.amount)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('orders.price')}:</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      ${formatPrice(orderToClone.order.price)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('orders.total')}:</Text>
                    <Text style={[styles.summaryValue, { color: colors.text, fontWeight: '600' }]}>
                      ${formatPrice(orderToClone.order.price * orderToClone.order.amount)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('orders.exchange')}:</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {orderToClone.exchangeName}
                    </Text>
                  </View>
                </View>

                {insufficientBalance && (
                  <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                    <Text style={[styles.warningText, { color: colors.warning }]}>
                      ⚠️ {t('orders.insufficientBalance')}
                    </Text>
                  </View>
                )}

                {cloneError && (
                  <View style={[styles.errorBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                    <Text style={[styles.errorText, { color: colors.danger }]}>
                      ❌ {cloneError}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: colors.border }]}
                onPress={() => {
                  setConfirmCloneVisible(false);
                  setOrderToClone(null);
                  setCloneError(null);
                }}
                disabled={cloneLoading}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                  {t('common.back')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                  cloneLoading && styles.modalButtonDisabled
                ]}
                onPress={() => {
                  if (!cloneLoading) {
                    confirmCloneOrder();
                  }
                }}
                disabled={cloneLoading}
              >
                {cloneLoading ? (
                  <AnimatedLogoIcon size={20} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    {cloneError ? t('orders.retry') : t('orders.confirmClone')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  // Card Principal - DUPLICADO do Summary
  container: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 12,
  },
  // Campo de Busca
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    fontSize: 16,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingLeft: 36,
    paddingRight: 36,
    fontSize: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    borderWidth: 1,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 0,
  },
  valueContainer: {
    flexDirection: "column",
    gap: 4,
  },
  value: {
    fontSize: typography.displaySmall,  // 28px - mesmo do Summary
    fontWeight: fontWeights.light,
    letterSpacing: -1.2,
  },
  lastUpdated: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    opacity: 0.4,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshIcon: {
    fontSize: typography.h4,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  exchangeSection: {
    marginBottom: 24,
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  exchangeName: {
    fontSize: 15,
    fontWeight: '600',
  },
  orderCount: {
    fontSize: typography.caption,
    opacity: 0.5,
  },
  orderCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  symbolWithClone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderTitleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cloneIconButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  orderSymbol: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sideText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  orderTime: {
    fontSize: 12,
  },
  loadingExchangeContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 8,
  },
  loadingExchangeText: {
    marginTop: 8,
    fontSize: 13,
  },
  orderDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal de confirmação
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalBody: {
    marginBottom: 24,
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  orderInfoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  orderInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,      // 20→24 (padrão primary button)
    borderRadius: 12,            // 10→12 (padrão primary button)
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  modalButtonDanger: {
    borderWidth: 0,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Overlay de cancelamento
  cancellingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancellingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal de clone
  modalMessage: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  orderSummary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tooltip: {
    position: 'absolute',
    top: -35,
    left: -10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonPrimary: {
    // Usa o backgroundColor e borderColor dinâmico no componente
  },
  // Banner de atualização
  updatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  updatingText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
