import Svg, { Circle, Line, Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from "react-native-svg"

interface LogoIconProps {
  size?: number
}

export const LogoIcon = ({ size = 24 }: LogoIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
    <Defs>
      <Filter id="glow">
        <FeGaussianBlur stdDeviation="10" result="coloredBlur"/>
        <FeMerge>
          <FeMergeNode in="coloredBlur"/>
          <FeMergeNode in="SourceGraphic"/>
        </FeMerge>
      </Filter>
    </Defs>
    
    {/* Central Hub Circle */}
    <Circle cx="512" cy="512" r="140" fill="#FFC107" filter="url(#glow)"/>
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
    
    {/* Satellite Nodes */}
    <Circle cx="512" cy="200" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="512" cy="200" r="50" fill="#2563EB"/>
    
    <Circle cx="824" cy="512" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="824" cy="512" r="50" fill="#2563EB"/>
    
    <Circle cx="512" cy="824" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="512" cy="824" r="50" fill="#2563EB"/>
    
    <Circle cx="200" cy="512" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="200" cy="512" r="50" fill="#2563EB"/>
    
    {/* Corner nodes */}
    <Circle cx="268" cy="268" r="50" fill="#3B82F6" opacity="0.8"/>
    <Circle cx="756" cy="268" r="50" fill="#3B82F6" opacity="0.8"/>
    <Circle cx="756" cy="756" r="50" fill="#3B82F6" opacity="0.8"/>
    <Circle cx="268" cy="756" r="50" fill="#3B82F6" opacity="0.8"/>
  </Svg>
)
