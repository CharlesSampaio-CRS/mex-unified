/**
 * TokenIcon
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente reutilizável que exibe o ícone de um token crypto.
 *
 * Fluxo:
 *  1. Consulta GET /api/v1/token-icons/{symbol}/url no MongoDB (via useTokenIcon)
 *  2. Se encontrar → renderiza <Image source={{ uri }} />
 *  3. Se não encontrar / erro → renderiza fallback com as iniciais do símbolo
 *
 * Cache em memória de módulo garante que a mesma URL não é re-buscada durante
 * a sessão, mesmo ao rolar listas longas.
 *
 * Props:
 *  symbol   – símbolo do token (ex: 'BTC', 'ETH'). Obrigatório.
 *  size     – dimensão do ícone em px (padrão: 32)
 *  style    – estilo extra para o contêiner View
 *  enabled  – passa false para desabilitar a busca (padrão: true)
 */

import React from 'react'
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native'
import { useTokenIcon } from '@/hooks/useTokenIcon'

interface TokenIconProps {
  symbol: string
  size?: number
  style?: ViewStyle
  enabled?: boolean
}

export function TokenIcon({ symbol, size = 32, style, enabled = true }: TokenIconProps) {
  const { iconUrl } = useTokenIcon(symbol, enabled)

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
  }

  if (iconUrl) {
    // ?v=2 força o React Native a ignorar o cache de imagem do dispositivo
    // (pode ser removido após todos os devices terem baixado os ícones atualizados)
    const uri = iconUrl.includes('?') ? `${iconUrl}&v=2` : `${iconUrl}?v=2`
    return (
      <View style={[containerStyle, styles.imageWrapper, style]}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onError={() => {/* silencioso – o componente já trata com o fallback abaixo */}}
        />
      </View>
    )
  }

  // Fallback: círculo colorido com até 2 iniciais do símbolo
  const initials = symbol?.toUpperCase().slice(0, 2) ?? '?'
  const bgColor = symbolToColor(symbol)
  const fontSize = size <= 20 ? size * 0.38 : size * 0.33

  return (
    <View
      style={[
        containerStyle,
        styles.fallback,
        { backgroundColor: bgColor, width: size, height: size },
        style,
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize, lineHeight: size }]}>
        {initials}
      </Text>
    </View>
  )
}

// ─── Gera uma cor determinística para o símbolo (hue baseado no hash) ─────────
function symbolToColor(symbol: string): string {
  if (!symbol) return '#3B82F6'
  let hash = 0
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash)
  }
  // Converte hash para HSL com saturação e luminosidade fixas (visual agradável)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 45%)`
}

const styles = StyleSheet.create({
  imageWrapper: {
    backgroundColor: '#FFFFFF', // fundo branco garante boa visibilidade em dark mode
    borderWidth: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
})
