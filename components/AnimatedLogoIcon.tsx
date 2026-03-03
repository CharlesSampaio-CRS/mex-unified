import { useEffect, useRef, useState } from "react"
import { Animated, Easing, View, StyleSheet } from "react-native"
import Svg, { Circle, Line, Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from "react-native-svg"

interface AnimatedLogoIconProps {
  size?: number
  /** Array de mensagens que rotacionam automaticamente abaixo do ícone */
  messages?: string[]
  /** Intervalo em ms entre cada mensagem (default: 2000) */
  messageInterval?: number
  /** Cor do texto (default: #94A3B8 - slate-400) */
  textColor?: string
  /** Tamanho da fonte (default: 13) */
  fontSize?: number
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export const AnimatedLogoIcon = ({ 
  size = 40, 
  messages,
  messageInterval = 2000,
  textColor = '#94A3B8',
  fontSize = 13,
}: AnimatedLogoIconProps) => {
  // Valores para pulsar as cores
  const colorAnim1 = useRef(new Animated.Value(0)).current
  const colorAnim2 = useRef(new Animated.Value(0)).current
  const colorAnim3 = useRef(new Animated.Value(0)).current
  const colorAnim4 = useRef(new Animated.Value(0)).current

  // Animação do texto
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const textOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Animação de pulsação das cores (azul -> amarelo -> azul)
    const createColorPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      )
    }

    // Inicia as animações em sequência
    createColorPulse(colorAnim1, 0).start()
    createColorPulse(colorAnim2, 150).start()
    createColorPulse(colorAnim3, 300).start()
    createColorPulse(colorAnim4, 450).start()
  }, [])

  // Rotação automática das mensagens com fade in/out
  useEffect(() => {
    if (!messages || messages.length <= 1) return

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Troca a mensagem
        setCurrentMessageIndex(prev => (prev + 1) % messages.length)
        // Fade in
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
      })
    }, messageInterval)

    return () => clearInterval(interval)
  }, [messages, messageInterval])

  // Interpolar cores: azul (#3B82F6) -> amarelo (#FFC107)
  const getColor = (anim: Animated.Value) => {
    return anim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgb(59, 130, 246)', 'rgb(255, 193, 7)'] // azul -> amarelo
    })
  }

  const hasMessages = messages && messages.length > 0

  return (
    <View style={styles.container}>
      <Svg 
        width={size} 
        height={size} 
        viewBox="0 0 1024 1024" 
        fill="none"
      >
        <Defs>
          <Filter id="glow-anim">
            <FeGaussianBlur stdDeviation="10" result="coloredBlur"/>
            <FeMerge>
              <FeMergeNode in="coloredBlur"/>
              <FeMergeNode in="SourceGraphic"/>
            </FeMerge>
          </Filter>
        </Defs>
        
        {/* Central Hub Circle - sempre amarelo */}
        <Circle cx="512" cy="512" r="140" fill="#FFC107" filter="url(#glow-anim)"/>
        <Circle cx="512" cy="512" r="100" fill="#F59E0B"/>
        
        {/* Connection lines */}
        <Line x1="512" y1="412" x2="512" y2="220" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
        <Line x1="612" y1="512" x2="804" y2="512" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
        <Line x1="512" y1="612" x2="512" y2="804" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
        <Line x1="412" y1="512" x2="220" y2="512" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
        
        {/* Diagonal connections */}
        <Line x1="598" y1="426" x2="738" y2="286" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
        <Line x1="598" y1="598" x2="738" y2="738" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
        <Line x1="426" y1="598" x2="286" y2="738" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
        <Line x1="426" y1="426" x2="286" y2="286" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
        
        {/* Satellite Nodes - APENAS ESTES pulsam entre azul e amarelo */}
        <AnimatedCircle cx="512" cy="200" r="70" fill={getColor(colorAnim1)} filter="url(#glow-anim)"/>
        <AnimatedCircle cx="512" cy="200" r="50" fill={getColor(colorAnim1)} />
        
        <AnimatedCircle cx="824" cy="512" r="70" fill={getColor(colorAnim2)} filter="url(#glow-anim)"/>
        <AnimatedCircle cx="824" cy="512" r="50" fill={getColor(colorAnim2)} />
        
        <AnimatedCircle cx="512" cy="824" r="70" fill={getColor(colorAnim3)} filter="url(#glow-anim)"/>
        <AnimatedCircle cx="512" cy="824" r="50" fill={getColor(colorAnim3)} />
        
        <AnimatedCircle cx="200" cy="512" r="70" fill={getColor(colorAnim4)} filter="url(#glow-anim)"/>
        <AnimatedCircle cx="200" cy="512" r="50" fill={getColor(colorAnim4)} />
        
        {/* Corner nodes - FIXOS em azul */}
        <Circle cx="268" cy="268" r="50" fill="#3B82F6" opacity="0.8"/>
        <Circle cx="756" cy="268" r="50" fill="#3B82F6" opacity="0.8"/>
        <Circle cx="756" cy="756" r="50" fill="#3B82F6" opacity="0.8"/>
        <Circle cx="268" cy="756" r="50" fill="#3B82F6" opacity="0.8"/>
      </Svg>

      {hasMessages && (
        <Animated.Text 
          style={[
            styles.messageText, 
            { 
              opacity: textOpacity, 
              color: textColor,
              fontSize,
              marginTop: size * 0.3,
            }
          ]}
        >
          {messages[currentMessageIndex]}
        </Animated.Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
})
