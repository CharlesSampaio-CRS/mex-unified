/**
 * Modal de Criação de Alerta de Preço
 * Padrão visual idêntico ao trade-modal (overlay centralizado, container flutuante)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { typography, fontWeights } from '../lib/typography';
import { useAlerts } from '../contexts/AlertsContext';
import { getExchangeLogo } from '../lib/exchange-logos';
import {
  AlertType,
  AlertCondition,
  AlertFrequency,
  validateAlert,
  formatAlertCondition,
  getAlertIcon,
  getAlertFrequencyLabel,
} from '../types/alerts';
import { TokenIcon } from './TokenIcon';

interface ExchangeOption {
  id: string;
  name: string;
}

interface CreateAlertModalProps {
  visible: boolean;
  onClose: () => void;
  symbol?: string;
  currentPrice?: number;
  exchangeId?: string;
  exchangeName?: string;
  /** Lista de exchanges disponíveis (para modo criação sem token pré-selecionado) */
  exchanges?: ExchangeOption[];
}

export function CreateAlertModal({
  visible,
  onClose,
  symbol: symbolProp,
  currentPrice,
  exchangeId: exchangeIdProp,
  exchangeName: exchangeNameProp,
  exchanges,
}: CreateAlertModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { addAlert } = useAlerts();

  // Modo: se symbol foi passado, mostra info do token; se não, mostra seletor de exchange + input de token
  const isGenericMode = !symbolProp;

  // Estados locais para exchange/token (modo genérico)
  const [localSymbol, setLocalSymbol] = useState('');
  const [localExchangeId, setLocalExchangeId] = useState(exchangeIdProp || '');
  const [localExchangeName, setLocalExchangeName] = useState(exchangeNameProp || '');

  // Valores derivados
  const symbol = symbolProp || localSymbol.trim().toUpperCase();
  const exchangeId = isGenericMode ? localExchangeId : exchangeIdProp;
  const exchangeName = isGenericMode ? localExchangeName : exchangeNameProp;

  // Sincroniza props quando modal abre
  useEffect(() => {
    if (visible) {
      if (exchangeIdProp) setLocalExchangeId(exchangeIdProp);
      if (exchangeNameProp) setLocalExchangeName(exchangeNameProp);
      if (!symbolProp) setLocalSymbol('');
    }
  }, [visible, exchangeIdProp, exchangeNameProp, symbolProp]);

  // Estados do formulário
  const [alertType, setAlertType] = useState<AlertType>('price');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [value, setValue] = useState('');
  const [frequency, setFrequency] = useState<AlertFrequency>('once');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reseta formulário ao fechar
  const handleClose = useCallback(() => {
    setAlertType('price');
    setCondition('above');
    setValue('');
    setFrequency('once');
    setCustomMessage('');
    setUseCustomMessage(false);
    setErrors([]);
    setLocalSymbol('');
    setLocalExchangeId(exchangeIdProp || '');
    setLocalExchangeName(exchangeNameProp || '');
    onClose();
  }, [onClose, exchangeIdProp, exchangeNameProp]);

  // Seleciona exchange (modo genérico)
  const handleSelectExchange = useCallback((ex: ExchangeOption) => {
    setLocalExchangeId(ex.id);
    setLocalExchangeName(ex.name);
  }, []);

  // Cria o alerta
  const handleCreate = useCallback(async () => {
    try {
      setLoading(true);
      setErrors([]);

      // Validação do modo genérico
      if (isGenericMode) {
        const genErrors: string[] = [];
        if (!localExchangeId) genErrors.push('Selecione uma corretora');
        if (!localSymbol.trim()) genErrors.push('Digite o símbolo do token');
        if (genErrors.length > 0) {
          setErrors(genErrors);
          return;
        }
      }

      const numericValue = parseFloat(value);

      // Validação
      const input = {
        symbol: symbol.toUpperCase(),
        exchangeId,
        exchangeName,
        alertType,
        condition,
        value: numericValue,
        basePrice: alertType === 'percentage' ? currentPrice : undefined,
        frequency,
        message: useCustomMessage ? customMessage : undefined,
      };

      const validationErrors = validateAlert(input);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Cria alerta
      const alert = await addAlert(input);

      if (alert) {
        console.log('[CreateAlertModal] ✅ Alerta criado:', alert);
        handleClose();
      } else {
        setErrors(['Erro ao criar alerta. Tente novamente.']);
      }
    } catch (err: any) {
      console.warn('[CreateAlertModal] ❌ Erro:', err);
      setErrors([err.message || 'Erro ao criar alerta']);
    } finally {
      setLoading(false);
    }
  }, [
    isGenericMode,
    localExchangeId,
    localSymbol,
    symbol,
    exchangeId,
    exchangeName,
    alertType,
    condition,
    value,
    currentPrice,
    frequency,
    customMessage,
    useCustomMessage,
    addAlert,
    handleClose,
  ]);

  // Sugestões de valor baseadas no preço atual
  const getSuggestedValues = () => {
    if (!currentPrice) return [];
    if (alertType === 'price') {
      return [
        { label: '+5%',  value: (currentPrice * 1.05).toFixed(2) },
        { label: '+10%', value: (currentPrice * 1.10).toFixed(2) },
        { label: '-5%',  value: (currentPrice * 0.95).toFixed(2) },
        { label: '-10%', value: (currentPrice * 0.90).toFixed(2) },
      ];
    } else {
      return [
        { label: '+5%',  value: '5'   },
        { label: '+10%', value: '10'  },
        { label: '+20%', value: '20'  },
        { label: '-5%',  value: '-5'  },
        { label: '-10%', value: '-10' },
      ];
    }
  };

  const isFormReady =
    !loading &&
    (isGenericMode ? (!!localExchangeId && !!localSymbol.trim()) : true) &&
    !!value;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>

          {/* ── Header ─────────────────────────────────────── */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Criar Alerta</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {symbol ? `${symbol}/USDT · ${exchangeName || ''}` : 'Configure um alerta de preço'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Conteúdo rolável ───────────────────────────── */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          >

            {/* ── Token / Exchange info ─────────────────────── */}
            {!isGenericMode ? (
              <View style={[styles.tokenCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
                <TokenIcon symbol={symbol || ''} size={36} style={styles.tokenIconWrap} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tokenSymbol, { color: colors.text }]}>{symbol}/USDT</Text>
                  <Text style={[styles.tokenExchange, { color: colors.textSecondary }]}>{exchangeName || ''}</Text>
                </View>
                {currentPrice != null && (
                  <Text style={[styles.tokenPrice, { color: colors.text }]}>
                    ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </Text>
                )}
              </View>
            ) : (
              <>
                {exchanges && exchanges.length > 0 && (
                  <View style={styles.formSection}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Corretora</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {exchanges.map((ex) => {
                          const isSelected = localExchangeId === ex.id;
                          const logo = getExchangeLogo(ex.id);
                          return (
                            <TouchableOpacity
                              key={ex.id}
                              style={[
                                styles.exchangeChip,
                                {
                                  borderColor: isSelected ? colors.primary : colors.border,
                                  backgroundColor: isSelected ? `${colors.primary}15` : colors.surface,
                                  borderWidth: isSelected ? 2 : 1,
                                },
                              ]}
                              onPress={() => handleSelectExchange(ex)}
                            >
                              {logo && <Image source={logo} style={styles.exchangeChipLogo} />}
                              <Text style={[
                                styles.exchangeChipText,
                                {
                                  color: isSelected ? colors.primary : colors.textSecondary,
                                  fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular,
                                },
                              ]}>
                                {ex.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}
                <View style={styles.formSection}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Token</Text>
                  <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.valueInput, { color: colors.text }]}
                      placeholder="Ex: BTC, ETH, SOL..."
                      placeholderTextColor={colors.textTertiary}
                      value={localSymbol}
                      onChangeText={setLocalSymbol}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </>
            )}

            {/* ── Tipo de alerta ────────────────────────────── */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de alerta</Text>
              <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {([['price', '$ Preço'], ['percentage', '% Variação']] as const).map(([type, label]) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.segmentItem, alertType === type && { backgroundColor: colors.primary }]}
                    onPress={() => setAlertType(type)}
                  >
                    <Text style={[styles.segmentText, { color: alertType === type ? '#fff' : colors.textSecondary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Condição ──────────────────────────────────── */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Condição</Text>
              <View style={styles.conditionGrid}>
                {([
                  ['above',        '↑ Acima',       colors.success],
                  ['below',        '↓ Abaixo',      colors.danger],
                  ['crosses_up',   '⬆ Cruza cima',  colors.success],
                  ['crosses_down', '⬇ Cruza baixo', colors.danger],
                ] as const).map(([cond, label, activeColor]) => (
                  <TouchableOpacity
                    key={cond}
                    style={[
                      styles.conditionBtn,
                      {
                        borderColor: condition === cond ? activeColor : colors.border,
                        backgroundColor: condition === cond ? `${activeColor}15` : colors.surface,
                      },
                    ]}
                    onPress={() => setCondition(cond)}
                  >
                    <Text style={[styles.conditionText, { color: condition === cond ? activeColor : colors.textSecondary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Preço / Variação alvo ─────────────────────── */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {alertType === 'price' ? 'Preço alvo (USD)' : 'Variação (%)'}
              </Text>
              <View style={[styles.stepperWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const v = parseFloat(value || '0');
                    const step = alertType === 'percentage' ? 1 : (v >= 100 ? 1 : v >= 1 ? 0.01 : 0.0001);
                    setValue(Math.max(alertType === 'percentage' ? -100 : 0, v - step).toFixed(
                      alertType === 'percentage' ? 2 : (v < 1 ? 4 : 2)
                    ));
                  }}
                >
                  <Text style={[styles.stepperIcon, { color: colors.textSecondary }]}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.stepperInput, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="numbers-and-punctuation"
                />
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const v = parseFloat(value || '0');
                    const step = alertType === 'percentage' ? 1 : (v >= 100 ? 1 : v >= 1 ? 0.01 : 0.0001);
                    setValue((v + step).toFixed(alertType === 'percentage' ? 2 : (v < 1 ? 4 : 2)));
                  }}
                >
                  <Text style={[styles.stepperIcon, { color: colors.textSecondary }]}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                {condition === 'above' || condition === 'crosses_up'
                  ? 'Alerta disparado quando o preço subir acima do valor'
                  : 'Alerta disparado quando o preço cair abaixo do valor'}
              </Text>

              {currentPrice && getSuggestedValues().length > 0 && (
                <View style={styles.percentGrid}>
                  {getSuggestedValues().map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.percentBtn, {
                        backgroundColor: value === s.value ? `${colors.primary}20` : colors.surface,
                        borderColor: value === s.value ? colors.primary : colors.border,
                      }]}
                      onPress={() => setValue(s.value)}
                    >
                      <Text style={[styles.percentBtnText, {
                        color: value === s.value ? colors.primary : colors.textSecondary,
                        fontWeight: value === s.value ? fontWeights.bold : fontWeights.medium,
                      }]}>
                        {s.label}
                      </Text>
                      <Text style={[styles.percentBtnSub, { color: value === s.value ? colors.primary : colors.textTertiary }]}>
                        {alertType === 'price' ? `$${s.value}` : `${s.value}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* ── Frequência de notificação ─────────────────── */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Frequência</Text>
              <View style={styles.freqGrid}>
                {([
                  ['once',     '1×',         'Uma vez'],
                  ['hourly',   '⏱',          'Por hora'],
                  ['daily',    '📅',          'Diário'],
                  ['weekly',   '📆',          'Semanal'],
                  ['repeated', '🔁',          'Sempre'],
                ] as const).map(([freq, icon, label]) => {
                  const isActive = frequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.freqBtn,
                        {
                          borderColor: isActive ? colors.primary : colors.border,
                          backgroundColor: isActive ? `${colors.primary}18` : colors.surface,
                        },
                      ]}
                      onPress={() => setFrequency(freq)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.freqIcon, { color: isActive ? colors.primary : colors.textSecondary }]}>
                        {icon}
                      </Text>
                      <Text style={[styles.freqLabel, { color: isActive ? colors.primary : colors.textSecondary, fontWeight: isActive ? fontWeights.bold : fontWeights.medium }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Mensagem personalizada</Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>Adicionar nota ao alerta</Text>
              </View>
              <Switch
                value={useCustomMessage}
                onValueChange={setUseCustomMessage}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {useCustomMessage && (
              <View style={styles.formSection}>
                <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.valueInput, styles.textArea, { color: colors.text }]}
                    placeholder="Ex: 🎉 Bitcoin disparou!"
                    placeholderTextColor={colors.textTertiary}
                    value={customMessage}
                    onChangeText={setCustomMessage}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            )}

            {/* ── Erros ─────────────────────────────────────── */}
            {errors.length > 0 && (
              <View style={[styles.errorBox, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
                {errors.map((error, idx) => (
                  <Text key={idx} style={[styles.errorText, { color: '#ef4444' }]}>⚠️ {error}</Text>
                ))}
              </View>
            )}

            {/* ── Preview ───────────────────────────────────── */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Prévia do alerta</Text>
                <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>
                  {getAlertFrequencyLabel(frequency)}
                </Text>
              </View>
              <Text style={[styles.previewText, { color: colors.text }]}>
                {getAlertIcon(condition)} {symbol || '???'}{' '}
                {formatAlertCondition({ condition, value: parseFloat(value) || 0, alertType } as any)}
              </Text>
            </View>

            {/* ── CTA ───────────────────────────────────────── */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: isFormReady ? colors.primary : colors.border },
              ]}
              onPress={handleCreate}
              disabled={!isFormReady}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.submitButtonText}>Criar Alerta</Text>
              }
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ─── Overlay / Container ───────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },

  // ─── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.bold,
  },
  headerSubtitle: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },

  // ─── Content ───────────────────────────────────────────────
  content: {
    flex: 1,
    padding: 16,
  },

  // ─── Token card ────────────────────────────────────────────
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  tokenIconWrap: {
    flexShrink: 0,
  },
  tokenSymbol: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  tokenExchange: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  tokenPrice: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },

  // ─── Form sections ─────────────────────────────────────────
  formSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // ─── Segmented control ─────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },

  // ─── Condition grid (2×2) ──────────────────────────────────
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionBtn: {
    width: '47%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  conditionText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },

  // ─── Stepper input ─────────────────────────────────────────
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperIcon: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    lineHeight: typography.h3 + 2,
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    paddingVertical: 0,
  },

  // ─── Sugestões rápidas ─────────────────────────────────────
  percentGrid: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  percentBtn: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  percentBtnText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  percentBtnSub: {
    fontSize: 9,
    marginTop: 1,
  },

  // ─── Input genérico ────────────────────────────────────────
  inputWrap: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  valueInput: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: typography.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },

  // ─── Frequência grid ───────────────────────────────────────
  freqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqBtn: {
    flex: 1,
    minWidth: '28%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  freqIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  freqLabel: {
    fontSize: typography.micro,
    textAlign: 'center',
  },

  // ─── Toggle rows ───────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },

  // ─── Exchange chips (modo genérico) ───────────────────────
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exchangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  exchangeChipLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  exchangeChipText: {
    fontSize: typography.bodySmall,
  },

  // ─── Erro ──────────────────────────────────────────────────
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  errorText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },

  // ─── Preview card ──────────────────────────────────────────
  previewCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  previewText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },

  // ─── Submit button ─────────────────────────────────────────
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: typography.button,
    fontWeight: fontWeights.bold,
  },
});
