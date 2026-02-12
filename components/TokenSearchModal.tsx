import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBalance } from '../contexts/BalanceContext'
import { typography, fontWeights } from '../lib/typography'
import { getExchangeBalances, getExchangeId, getExchangeName } from '../lib/exchange-helpers'
import { TokenDetailsModal } from './token-details-modal'
import { apiService } from '../services/api'

// Close Icon (X)
const CloseIcon = ({ color }: { color: string }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18M6 6l12 12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

// Search Icon
const SearchIcon = ({ color }: { color: string }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <Circle 
      cx="11" 
      cy="11" 
      r="8" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <Path
      d="m21 21-4.35-4.35"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

interface TokenSearchModalProps {
  visible: boolean
  onClose: () => void
}

export function TokenSearchModal({ visible, onClose }: TokenSearchModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data, loading } = useBalance()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [selectedExchange, setSelectedExchange] = useState<any>(null)
  const [tokenDetailsVisible, setTokenDetailsVisible] = useState(false)
  const [coinGeckoResults, setCoinGeckoResults] = useState<any[]>([])
  const [searchingCoinGecko, setSearchingCoinGecko] = useState(false)
  const [enrichedTokens, setEnrichedTokens] = useState<Map<string, any>>(new Map())
  const inputRef = useRef<TextInput>(null)

  // Reset search quando fecha o modal
  useEffect(() => {
    if (!visible) {
      setSearchQuery('')
      setSelectedToken(null)
      setSelectedExchange(null)
      setCoinGeckoResults([])
      setEnrichedTokens(new Map())
    }
  }, [visible])

  // 🦎 Busca informações na CoinGecko quando o usuário digita
  useEffect(() => {
    const searchCoinGecko = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setCoinGeckoResults([])
        return
      }

      setSearchingCoinGecko(true)
      
      try {
        
        const results = await apiService.searchTokenCoinGecko(searchQuery)
        
        // Filtra resultados (máximo 10)
        const filtered = results.slice(0, 10)
        setCoinGeckoResults(filtered)
        
        // Enriquece tokens locais com informações da CoinGecko
        const enrichmentMap = new Map<string, any>()
        for (const result of filtered) {
          enrichmentMap.set(result.symbol.toUpperCase(), result)
        }
        setEnrichedTokens(enrichmentMap)
        
        
      } catch (error) {
        console.error('❌ Erro ao buscar CoinGecko:', error)
        setCoinGeckoResults([])
      } finally {
        setSearchingCoinGecko(false)
      }
    }

    // Debounce: aguarda 500ms após o usuário parar de digitar
    const timeoutId = setTimeout(searchCoinGecko, 500)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Extrai e agrupa tokens de todas as exchanges
  const allTokens = useMemo(() => {
    if (!data?.exchanges) return []

    const tokenMap = new Map<string, {
      symbol: string
      name?: string
      total_amount: number
      total_usd: number
      exchanges: Array<{
        exchange_id: string
        exchange_name: string
        amount: number
        usd_value: number
      }>
    }>()

    data.exchanges.forEach(exchange => {
      const balances = getExchangeBalances(exchange)
      const exchangeId = getExchangeId(exchange)
      const exchangeName = getExchangeName(exchange)

      Object.entries(balances).forEach(([symbol, tokenData]: [string, any]) => {
        const amount = parseFloat((tokenData.amount || tokenData.total || 0).toString())
        const usdValue = parseFloat((tokenData.value_usd || tokenData.usd_value || 0).toString())

        if (usdValue > 0) {
          const existing = tokenMap.get(symbol)
          
          if (existing) {
            existing.total_amount += amount
            existing.total_usd += usdValue
            existing.exchanges.push({
              exchange_id: exchangeId,
              exchange_name: exchangeName,
              amount,
              usd_value: usdValue,
            })
          } else {
            tokenMap.set(symbol, {
              symbol,
              name: tokenData.name,
              total_amount: amount,
              total_usd: usdValue,
              exchanges: [{
                exchange_id: exchangeId,
                exchange_name: exchangeName,
                amount,
                usd_value: usdValue,
              }],
            })
          }
        }
      })
    })

    // Ordena por valor USD (maior primeiro)
    return Array.from(tokenMap.values()).sort((a, b) => b.total_usd - a.total_usd)
  }, [data])

  // Filtra tokens baseado na busca
  const filteredTokens = useMemo(() => {
    // 🔍 Só mostra resultados se houver texto digitado
    if (!searchQuery.trim()) {
      return []
    }

    const query = searchQuery.toLowerCase().trim()
    return allTokens.filter(token => 
      token.symbol.toLowerCase().includes(query) ||
      token.name?.toLowerCase().includes(query)
    )
  }, [allTokens, searchQuery])

  // Abre detalhes do token
  const handleTokenPress = (token: any) => {
    // Pega a primeira exchange que tem o token (ou a exchange com maior valor)
    const mainExchange = token.exchanges.reduce((prev: any, curr: any) => 
      curr.usd_value > prev.usd_value ? curr : prev
    )
    
    // Busca a exchange completa nos dados
    const exchange = data?.exchanges?.find(ex => 
      getExchangeId(ex) === mainExchange.exchange_id
    )
    
    if (exchange) {
      setSelectedToken(token.symbol)
      setSelectedExchange(exchange)
      setTokenDetailsVisible(true)
    }
  }

  const handleCloseTokenDetails = () => {
    setTokenDetailsVisible(false)
    setTimeout(() => {
      setSelectedToken(null)
      setSelectedExchange(null)
    }, 300)
  }

  // Formata valores
  const formatValue = (value: number) => {
    return apiService.formatUSD(value)
  }

  const formatAmount = (amount: number) => {
    return apiService.formatTokenAmount(amount.toString())
  }

  const renderToken = (token: any) => {
    const priceUSD = token.total_usd / token.total_amount
    const mainExchange = token.exchanges[0] // Primeira exchange
    
    // 🦎 Busca informações enriquecidas da CoinGecko
    const coinGeckoInfo = enrichedTokens.get(token.symbol.toUpperCase())
    
    return (
      <TouchableOpacity
        key={token.symbol}
        style={[styles.tokenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handleTokenPress(token)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          {/* Token Symbol & Name */}
          <View style={styles.tokenInfo}>
            <View style={[styles.symbolBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.symbolText, { color: colors.primary }]}>
                {token.symbol}
              </Text>
            </View>
            {coinGeckoInfo && (
              <View style={styles.tokenNames}>
                <Text style={[styles.tokenName, { color: colors.text }]} numberOfLines={1}>
                  {coinGeckoInfo.name}
                </Text>
                <View style={styles.tokenMeta}>
                  <Text style={[styles.exchangeText, { color: colors.textSecondary }]}>
                    {mainExchange?.exchange_name || 'N/A'}
                  </Text>
                  {coinGeckoInfo.market_cap_rank && (
                    <Text style={[styles.rankBadge, { color: colors.textSecondary }]}>
                      #{coinGeckoInfo.market_cap_rank}
                    </Text>
                  )}
                </View>
              </View>
            )}
            {!coinGeckoInfo && (
              <View style={styles.cardInfo}>
                <Text style={[styles.priceText, { color: colors.text }]}>
                  {formatValue(priceUSD > 0 ? priceUSD : token.total_usd)}
                </Text>
                <Text style={[styles.exchangeText, { color: colors.textSecondary }]}>
                  {mainExchange?.exchange_name || 'N/A'}
                </Text>
              </View>
            )}
          </View>
          
          {/* Total Value */}
          <View style={styles.cardValue}>
            <Text style={[styles.valueText, { color: colors.text }]}>
              {formatValue(token.total_usd)}
            </Text>
            {token.exchanges.length > 1 && (
              <Text style={[styles.multiExchange, { color: colors.textSecondary }]}>
                +{token.exchanges.length - 1} {token.exchanges.length > 1 ? 'exchanges' : 'exchange'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Overlay - fecha ao clicar fora */}
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Container do Search - não propaga o clique */}
        <View style={styles.searchWrapper}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={[styles.searchBox, { backgroundColor: colors.card, shadowColor: colors.text }]}
          >
            {/* Search Input */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <SearchIcon color={colors.textSecondary} />
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' as any }]}
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
                selectionColor={colors.primary}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <CloseIcon color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Results - só aparecem se houver busca */}
            {searchQuery.trim().length > 0 && (
              <View style={styles.resultsContainer}>
                {(loading || searchingCoinGecko) ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {searchingCoinGecko ? '🦎 Buscando na CoinGecko...' : t('common.loading')}
                    </Text>
                  </View>
                ) : filteredTokens.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {coinGeckoResults.length > 0 
                        ? 'Você não possui esses tokens no seu portfólio' 
                        : t('search.noResults')}
                    </Text>
                    {coinGeckoResults.length > 0 && (
                      <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                        💡 Encontramos {coinGeckoResults.length} token(s) na CoinGecko
                      </Text>
                    )}
                  </View>
                ) : (
                  <ScrollView 
                    style={styles.resultsList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredTokens.map((token) => renderToken(token))}
                  </ScrollView>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Token Details Modal */}
      {selectedToken && selectedExchange && (
        <TokenDetailsModal
          visible={tokenDetailsVisible}
          onClose={handleCloseTokenDetails}
          symbol={selectedToken}
          exchangeId={getExchangeId(selectedExchange)}
        />
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 20,
    paddingTop: 80, // Abaixo do header
  },
  searchWrapper: {
    width: '100%',
    maxHeight: '80%', // Limita altura máxima
  },
  searchBox: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    marginLeft: 12,
    fontWeight: fontWeights.regular,
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    maxHeight: 400, // Altura máxima dos resultados
    marginTop: 8,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  
  // Token Card Styles - Simplificado
  tokenCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tokenInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  symbolBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  symbolText: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  tokenNames: {
    flex: 1,
  },
  tokenName: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    marginBottom: 2,
  },
  tokenMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankBadge: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  cardInfo: {
    flex: 1,
  },
  priceText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 2,
  },
  exchangeText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  cardValue: {
    alignItems: 'flex-end',
  },
  valueText: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    marginBottom: 2,
  },
  multiExchange: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  
  // Loading & Empty states
  loadingContainer: {
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  loadingText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  emptyContainer: {
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
    marginTop: 8,
  },
})
