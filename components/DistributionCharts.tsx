import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { memo, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { fontWeights } from '../lib/typography'
import { ExchangesPieChart } from './ExchangesPieChart'
import { TokensPieChart } from './TokensPieChart'

type Tab = 'exchanges' | 'tokens'

export const DistributionCharts = memo(function DistributionCharts() {
  const { colors } = useTheme()
  const [activeTab, setActiveTab] = useState<Tab>('exchanges')

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'exchanges' && [styles.activeTab, { backgroundColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('exchanges')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'exchanges' ? '#fff' : colors.textSecondary }
          ]}>
            Exchanges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'tokens' && [styles.activeTab, { backgroundColor: colors.primary }]
          ]}
          onPress={() => setActiveTab('tokens')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'tokens' ? '#fff' : colors.textSecondary }
          ]}>
            Tokens
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chart content */}
      <View style={styles.chartContent}>
        {activeTab === 'exchanges' ? (
          <ExchangesPieChart embedded />
        ) : (
          <TokensPieChart embedded />
        )}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeTab: {
    borderRadius: 8,
  },
  tabText: {
    fontSize: 12,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.3,
  },
  chartContent: {
    minHeight: 100,
  },
})
