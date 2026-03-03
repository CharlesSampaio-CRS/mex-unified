/**
 * Modal de Criação de Alerta de Preço
 * Permite ao usuário configurar alertas baseados em condições de preço
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { typography, fontWeights } from '../lib/typography';
import { useAlerts } from '../contexts/AlertsContext';
import {
  AlertType,
  AlertCondition,
  AlertFrequency,
  validateAlert,
  formatAlertCondition,
  getAlertIcon,
  getAlertFrequencyLabel,
} from '../types/alerts';

interface CreateAlertModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
  exchangeId?: string;
  exchangeName?: string;
}

export function CreateAlertModal({
  visible,
  onClose,
  symbol,
  currentPrice,
  exchangeId,
  exchangeName,
}: CreateAlertModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { addAlert } = useAlerts();

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
    onClose();
  }, [onClose]);

  // Cria o alerta
  const handleCreate = useCallback(async () => {
    try {
      setLoading(true);
      setErrors([]);

      const numericValue = parseFloat(value);

      // Validação
      const input = {
        symbol: symbol.toUpperCase(),
        exchangeId,
        exchangeName,
        alertType,
        condition,
        value: numericValue,
        basePrice: alertType === 'percentage' ? currentPrice : undefined,  // ✅ Define basePrice para alertas de porcentagem
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
    symbol,
    exchangeId,
    exchangeName,
    alertType,
    condition,
    value,
    currentPrice,           // ✅ Adiciona currentPrice nas dependências
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
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              🔔 {t('alerts.createAlert')}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Token Info */}
            <View style={[styles.tokenInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.tokenSymbol, { color: colors.text }]}>
                {symbol}
              </Text>
              {currentPrice && (
                <Text style={[styles.tokenPrice, { color: colors.textSecondary }]}>
                  {t('alerts.currentPrice')} ${currentPrice.toFixed(2)}
                </Text>
              )}
              {exchangeName && (
                <Text style={[styles.tokenExchange, { color: colors.textTertiary }]}>
                  {exchangeName}
                </Text>
              )}
            </View>

            {/* Tipo de Alerta */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('alerts.alertType')}
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    alertType === 'price' && styles.optionButtonActive,
                    { 
                      borderColor: alertType === 'price' ? colors.primary : colors.border,
                      backgroundColor: alertType === 'price' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setAlertType('price')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: alertType === 'price' ? colors.primary : colors.text },
                    ]}
                  >
                    💰 {t('alerts.absolutePrice')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    alertType === 'percentage' && styles.optionButtonActive,
                    { 
                      borderColor: alertType === 'percentage' ? colors.primary : colors.border,
                      backgroundColor: alertType === 'percentage' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setAlertType('percentage')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: alertType === 'percentage' ? colors.primary : colors.text },
                    ]}
                  >
                    📊 {t('alerts.percentage')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Condição */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('alerts.condition')}
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    condition === 'above' && styles.optionButtonActive,
                    { 
                      borderColor: condition === 'above' ? colors.primary : colors.border,
                      backgroundColor: condition === 'above' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setCondition('above')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: condition === 'above' ? colors.primary : colors.text },
                    ]}
                  >
                    🚀 {t('alerts.above')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    condition === 'below' && styles.optionButtonActive,
                    { 
                      borderColor: condition === 'below' ? colors.primary : colors.border,
                      backgroundColor: condition === 'below' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setCondition('below')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: condition === 'below' ? colors.primary : colors.text },
                    ]}
                  >
                    📉 {t('alerts.below')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    condition === 'crosses_up' && styles.optionButtonActive,
                    { 
                      borderColor: condition === 'crosses_up' ? colors.primary : colors.border,
                      backgroundColor: condition === 'crosses_up' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setCondition('crosses_up')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: condition === 'crosses_up' ? colors.primary : colors.text },
                    ]}
                  >
                    ⬆️ {t('alerts.crossesUp')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    condition === 'crosses_down' && styles.optionButtonActive,
                    { 
                      borderColor: condition === 'crosses_down' ? colors.primary : colors.border,
                      backgroundColor: condition === 'crosses_down' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setCondition('crosses_down')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: condition === 'crosses_down' ? colors.primary : colors.text },
                    ]}
                  >
                    ⬇️ {t('alerts.crossesDown')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Valor */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {alertType === 'price' ? t('alerts.targetPrice') : t('alerts.percentageLabel')}
              </Text>
              
              <TextInput
                style={[
                  styles.input,
                  { 
                    color: colors.text, 
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={alertType === 'price' ? 'Ex: 50000' : 'Ex: 5 (para 5%)'}
                placeholderTextColor={colors.textTertiary}
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
              />

              {/* Sugestões */}
              {currentPrice && (
                <View style={styles.suggestions}>
                  {getSuggestedValues().map((suggestion, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.suggestionButton,
                        { 
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => setValue(suggestion.value)}
                    >
                      <Text style={[styles.suggestionLabel, { color: colors.textSecondary }]}>
                        {suggestion.label}
                      </Text>
                      <Text style={[styles.suggestionValue, { color: colors.text }]}>
                        {alertType === 'price' ? `$${suggestion.value}` : `${suggestion.value}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Frequência */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('alerts.frequency')}
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    frequency === 'once' && styles.optionButtonActive,
                    { 
                      borderColor: frequency === 'once' ? colors.primary : colors.border,
                      backgroundColor: frequency === 'once' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setFrequency('once')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: frequency === 'once' ? colors.primary : colors.text },
                    ]}
                  >
                    1️⃣ {t('alerts.once')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    frequency === 'repeated' && styles.optionButtonActive,
                    { 
                      borderColor: frequency === 'repeated' ? colors.primary : colors.border,
                      backgroundColor: frequency === 'repeated' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setFrequency('repeated')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: frequency === 'repeated' ? colors.primary : colors.text },
                    ]}
                  >
                    🔁 {t('alerts.always')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    frequency === 'daily' && styles.optionButtonActive,
                    { 
                      borderColor: frequency === 'daily' ? colors.primary : colors.border,
                      backgroundColor: frequency === 'daily' ? `${colors.primary}15` : colors.surface,
                    },
                  ]}
                  onPress={() => setFrequency('daily')}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      { color: frequency === 'daily' ? colors.primary : colors.text },
                    ]}
                  >
                    📅 {t('alerts.daily')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mensagem Customizada */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('alerts.customMessage')}
                </Text>
                <Switch
                  value={useCustomMessage}
                  onValueChange={setUseCustomMessage}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>

              {useCustomMessage && (
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    { 
                      color: colors.text, 
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Ex: 🎉 Bitcoin disparou!"
                  placeholderTextColor={colors.textTertiary}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={3}
                />
              )}
            </View>

            {/* Erros */}
            {errors.length > 0 && (
              <View style={[styles.errorContainer, { backgroundColor: '#ef444415' }]}>
                {errors.map((error, idx) => (
                  <Text key={idx} style={[styles.errorText, { color: '#ef4444' }]}>
                    ⚠️ {error}
                  </Text>
                ))}
              </View>
            )}

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                {t('alerts.previewAlert')}
              </Text>
              <Text style={[styles.previewText, { color: colors.text }]}>
                {getAlertIcon(condition)} {symbol} {formatAlertCondition({
                  condition,
                  value: parseFloat(value) || 0,
                  alertType,
                } as any)}
              </Text>
              <Text style={[styles.previewFrequency, { color: colors.textTertiary }]}>
                {t('alerts.frequencyLabel')} {getAlertFrequencyLabel(frequency)}
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                { backgroundColor: colors.primary },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {t('alerts.createButton')}
                </Text>
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
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.icon,
    fontWeight: fontWeights.semibold,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  tokenInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  tokenSymbol: {
    fontSize: typography.display,
    fontWeight: fontWeights.bold,
    marginBottom: 4,
  },
  tokenPrice: {
    fontSize: typography.h4,
    marginBottom: 2,
  },
  tokenExchange: {
    fontSize: typography.caption,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionButtonActive: {
    borderWidth: 2,
  },
  optionButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: typography.h4,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestionButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  suggestionLabel: {
    fontSize: typography.tiny,
    marginBottom: 2,
  },
  suggestionValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: typography.bodySmall,
    marginBottom: 4,
  },
  preview: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: typography.caption,
    marginBottom: 8,
  },
  previewText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
    marginBottom: 4,
  },
  previewFrequency: {
    fontSize: typography.caption,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  createButton: {},
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.semibold,
  },
});
