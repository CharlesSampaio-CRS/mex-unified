import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { curlLogger } from '@/services/curl-logger';
import { typography, fontWeights } from '@/lib/typography';
import * as Clipboard from 'expo-clipboard';

interface CurlLoggerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CurlLoggerModal({ visible, onClose }: CurlLoggerModalProps) {
  const { colors } = useTheme();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadRequests();
    }
  }, [visible]);

  const loadRequests = () => {
    const reqs = curlLogger.getRequests();
    setRequests(reqs.reverse()); // Mais recentes primeiro
  };

  const handleCopyAll = async () => {
    try {
      const curls = curlLogger.generateSimpleCurls();
      await Clipboard.setStringAsync(curls);
      Alert.alert('✅ Copiado', 'Todos os cURLs copiados para área de transferência!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao copiar cURLs');
    }
  };

  const handleCopyRaw = async () => {
    try {
      const raw = curlLogger.generateRawCurls();
      await Clipboard.setStringAsync(raw);
      Alert.alert('✅ Copiado', 'cURLs brutos copiados (sem formatação)!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao copiar cURLs');
    }
  };

  const handleCopyCurl = async (curl: string) => {
    try {
      await Clipboard.setStringAsync(curl);
      Alert.alert('✅ Copiado', 'Comando curl copiado!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao copiar curl');
    }
  };

  const handleShare = async () => {
    try {
      setLoading(true);
      await curlLogger.shareLog();
      Alert.alert('✅ Sucesso', 'Log exportado/compartilhado!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao exportar log');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Limpar Logs',
      'Tem certeza que deseja limpar todos os logs de requisições?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            await curlLogger.clear();
            setRequests([]);
            Alert.alert('✅ Sucesso', 'Logs limpos!');
          },
        },
      ]
    );
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            cURL Logger
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Stats */}
        <View style={[styles.stats, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {requests.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Requisições Únicas
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleCopyAll}
          >
            <Ionicons name="copy-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Copiar MD</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.info }]}
            onPress={handleCopyRaw}
          >
            <Ionicons name="code-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Copiar Raw</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={handleShare}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Exportar</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.danger }]}
            onPress={handleClear}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Limpar</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhuma requisição registrada ainda
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                Faça ações no app para capturar as chamadas de API.{'\n'}
                Duplicatas são automaticamente ignoradas.
              </Text>
            </View>
          ) : (
            requests.map((req, index) => {
              const isExpanded = expandedIndex === index;
              const timestamp = new Date(req.timestamp).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <View
                  key={index}
                  style={[
                    styles.requestCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.requestHeader}
                    onPress={() => toggleExpand(index)}
                  >
                    <View style={styles.requestInfo}>
                      <View style={[
                        styles.methodBadge,
                        { backgroundColor: req.method === 'GET' ? colors.successLight : 
                          req.method === 'POST' ? colors.primaryLight :
                          req.method === 'DELETE' ? colors.dangerLight : colors.warningLight }
                      ]}>
                        <Text
                          style={[
                            styles.methodText,
                            { color: req.method === 'GET' ? colors.success : 
                              req.method === 'POST' ? colors.primary :
                              req.method === 'DELETE' ? colors.danger : colors.warning }
                          ]}
                        >
                          {req.method}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.requestName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {req.name || req.url.replace(/^https?:\/\//, '').split('?')[0]}
                        </Text>
                        {req.name && (
                          <Text
                            style={[styles.requestUrl, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {req.url.replace(/^https?:\/\//, '').split('?')[0]}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                    {timestamp}
                  </Text>

                  {isExpanded && (
                    <View style={styles.requestDetails}>
                      <View style={[styles.curlContainer, { backgroundColor: colors.background }]}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <Text style={[styles.curlText, { color: colors.textSecondary }]}>
                            {req.curl}
                          </Text>
                        </ScrollView>
                      </View>

                      <TouchableOpacity
                        style={[styles.copyButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleCopyCurl(req.curl)}
                      >
                        <Ionicons name="copy-outline" size={16} color="#fff" />
                        <Text style={styles.copyButtonText}>Copiar cURL</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: fontWeights.bold,
  },
  placeholder: {
    width: 40,
  },
  stats: {
    padding: 20,
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: fontWeights.bold,
  },
  statLabel: {
    fontSize: typography.caption,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  list: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: typography.caption,
    marginTop: 8,
    textAlign: 'center',
  },
  requestCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  methodText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
  },
  requestName: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    marginBottom: 2,
  },
  requestUrl: {
    flex: 1,
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  timestamp: {
    fontSize: typography.micro,
    marginTop: 8,
  },
  requestDetails: {
    marginTop: 12,
    gap: 12,
  },
  curlContainer: {
    padding: 12,
    borderRadius: 8,
  },
  curlText: {
    fontSize: typography.tiny,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  bottomSpacing: {
    height: 20,
  },
});
