import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface SilhouetteOverlayProps {
  style?: ViewStyle;
  color?: string;
  opacity?: number;
}

const PERSON_PATH =
  'M50 10 ' +
  'C42 10 36 16 36 24 ' +
  'C36 32 42 38 50 38 ' +
  'C58 38 64 32 64 24 ' +
  'C64 16 58 10 50 10 Z ' +
  'M32 44 ' +
  'L68 44 ' +
  'C74 44 78 48 80 54 ' +
  'L86 80 ' +
  'C86 84 82 86 80 82 ' +
  'L74 64 ' +
  'L74 110 ' +
  'C74 114 72 116 68 116 ' +
  'L60 116 ' +
  'L58 170 ' +
  'C58 174 54 176 52 176 ' +
  'C50 176 48 174 48 170 ' +
  'L48 120 ' +
  'L44 170 ' +
  'C44 174 42 176 40 176 ' +
  'C38 176 36 174 36 170 ' +
  'L32 116 ' +
  'L24 116 ' +
  'C20 116 18 114 18 110 ' +
  'L18 64 ' +
  'L14 82 ' +
  'C12 86 8 84 8 80 ' +
  'L14 54 ' +
  'C16 48 20 44 26 44 Z';

export function SilhouetteOverlay({
  style,
  color = '#FFFFFF',
  opacity = 0.35,
}: SilhouetteOverlayProps) {
  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <Svg viewBox="0 0 100 190" style={styles.svg} preserveAspectRatio="xMidYMid meet">
        <Path d={PERSON_PATH} fill={color} fillOpacity={opacity} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    width: '70%',
    height: '80%',
  },
});
