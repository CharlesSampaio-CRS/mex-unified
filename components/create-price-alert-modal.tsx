/**
 * Modal de Criação de Alerta de Preço
 * Permite ao usuário configurar alertas baseados em condições de preço
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
      console.error('[CreateAlertModal] ❌ Erro:', err);
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
        { label: `+5%`, value: (currentPrice * 1.05).toFixed(2) },
        { label: `+10%`, value: (currentPrice * 1.1).toFixed(2) },
        { label: `-5%`, value: (currentPrice * 0.95).toFixed(2) },
        { label: `-10%`, value: (currentPrice * 0.9).toFixed(2) },
      ];
    } else {
      return [
        { label: `+5%`, value: '5' },
        { label: `+10%`, value: '10' },
        { label: `+20%`, value: '20' },
        { label: `-5%`, value: '-5' },
        { label: `-10%`, value: '-10' },
      ];
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Bottom Sheet */}
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>

          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Criar Alerta</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* Token Info Row */}
            {!isGenericMode ? (
              <View style={[styles.tokenRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.tokenIconWrap, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]}>
                  <Ionicons name="logo-bitcoin" size={22} color={colors.primary} />
                </View>
                <View style={styles.tokenInfoLeft}>
                  <Text style={[styles.tokenSymbol, { color: colors.text }]}>{symbol}/USDT</Text>
                  <Text style={[styles.tokenExchange, { color: colors.textSecondary }]}>
                    {exchangeName || ''}
                  </Text>
                </View>
                {currentPrice && (
                  <View style={styles.tokenPriceWrap}>
                    <Text style={[styles.tokenPrice, { color: colors.text }]}>${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Modo genérico: seletor de exchange + input de token */
              <View style={[styles.tokenRow, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
                {exchanges && exchanges.length > 0 && (
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Corretora</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      <View style={styles.exchangeChips}>
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
                              <Text style={[styles.exchangeChipText, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular }]}>
                                {ex.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Token</Text>
                  <TextInput
                    style={[styles.inputField, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}
                    placeholder="Ex: BTC, ETH, SOL..."
                    placeholderTextColor={colors.textTertiary}
                    value={localSymbol}
                    onChangeText={setLocalSymbol}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            {/* Tipo + Condição como segmentado */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de alerta</Text>
              <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {([['price', '$ Preço'], ['percentage', '% Variação']] as const).map(([type, label]) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.segmentItem, alertType === type && { backgroundColor: colors.primary }]}
                    onPress={() => setAlertType(type)}
                  >
                    <Text style={[styles.segmentText, { color: alertType === type ? '#fff' : colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Condição */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Condição</Text>
              <View style={styles.conditionGrid}>
                {([
                  ['above', '↑ Acima', colors.success],
                  ['below', '↓ Abaixo', colors.danger],
                  ['crosses_up', '⬆ Cruza cima', colors.success],
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
                    <Text style={[styles.conditionText, { color: condition === cond ? activeColor : colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Target Price Input */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {alertType === 'price' ? 'Preço alvo' : 'Variação (%)'}
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons
                  name={alertType === 'price' ? 'cash-outline' : 'trending-up-outline'}
                  size={20}
                  color={colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.priceInput, { color: colors.text }]}
                  placeholder={alertType === 'price' ? '0.00' : '0.00'}
                  placeholderTextColor={colors.textTertiary}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              {/* Hint */}
              <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                {condition === 'above' || condition === 'crosses_up'
                  ? 'Alerta disparado quando o preço subir acima do valor'
                  : 'Alerta disparado quando o preço cair abaixo do valor'}
              </Text>

              {/* Sugestões */}
              {currentPrice && getSuggestedValues().length > 0 && (
                <View style={styles.suggestions}>
                  {getSuggestedValues().map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.suggestionChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => setValue(s.value)}
                    >
                      <Text style={[styles.suggestionLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                      <Text style={[styles.suggestionValue, { color: colors.text }]}>
                        {alertType === 'price' ? `$${s.value}` : `${s.value}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Frequência — toggle row */}
            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: `${colors.surface}` }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Alerta persistente</Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  Notificar sempre que o preço cruzar
                </Text>
              </View>
              <Switch
                value={frequency === 'repeated'}
                onValueChange={(v) => setFrequency(v ? 'repeated' : 'once')}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Mensagem customizada */}
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
                <TextInput
                  style={[styles.inputField, styles.textArea, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Ex: 🎉 Bitcoin disparou!"
                  placeholderTextColor={colors.textTertiary}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            {/* Erros */}
            {errors.length > 0 && (
              <View style={[styles.errorBox, { backgroundColor: '#ef444415' }]}>
                {errors.map((error, idx) => (
                  <Text key={idx} style={styles.errorText}>⚠️ {error}</Text>
                ))}
              </View>
            )}

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>{t('alerts.previewAlert')}</Text>
              <Text style={[styles.previewText, { color: colors.text }]}>
                {getAlertIcon(condition)} {symbol || '???'} {formatAlertCondition({ condition, value: parseFloat(value) || 0, alertType } as any)}
              </Text>
              <Text style={[styles.previewFrequency, { color: colors.textTertiary }]}>
                {t('alerts.frequencyLabel')} {getAlertFrequencyLabel(frequency)}
              </Text>
            </View>

          </ScrollView>

          {/* CTA Button */}
          <View style={[styles.ctaWrap, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Criar Alerta</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cancelBtn: {
    padding: 4,
  },
  cancelText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  title: {
    fontSize: typography.h4,
    fontWeight: fontWeights.bold,
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Token row (info do token pré-selecionado)
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    minHeight: 80,
  },
  tokenIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  tokenInfoLeft: {
    flex: 1,
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
  tokenPriceWrap: {
    alignItems: 'flex-end',
  },
  tokenPrice: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  // Form sections
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  // Segmented control (Tipo de alerta)
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
  // Condition grid (2x2)
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
  // Price input com ícone
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 14,
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
  },
  inputHint: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  // Sugestões
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 70,
  },
  suggestionLabel: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
    marginBottom: 2,
  },
  suggestionValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
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
  // Text area (mensagem customizada)
  inputField: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: typography.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Erros
  errorBox: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: '#ef4444',
    marginBottom: 4,
  },
  // Preview
  preview: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: typography.caption,
    marginBottom: 6,
  },
  previewText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 4,
  },
  previewFrequency: {
    fontSize: typography.caption,
  },
  // CTA Button
  ctaWrap: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#19a1e6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
  },
  // Exchange chips (modo genérico)
  exchangeChips: {
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
});
