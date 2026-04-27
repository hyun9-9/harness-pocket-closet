import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import { theme } from '../../constants/theme';

type IconProps = { color: string; size: number };

function ClosetIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l-2.5 2 -5 2 1 12h13l1-12-5-2L12 3z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FittingIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={6} r={3} stroke={color} strokeWidth={1.6} />
      <Path
        d="M5 21c0-4 3-7 7-7s7 3 7 7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function RecommendIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon
        points="12,3 14.6,9.3 21,9.9 16,14.1 17.6,20.5 12,17 6.4,20.5 8,14.1 3,9.9 9.4,9.3"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.point,
          tabBarInactiveTintColor: theme.muted,
          tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        }}
      >
        <Tabs.Screen
          name="closet"
          options={{
            title: '옷장',
            tabBarIcon: ({ color, size }) => <ClosetIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="fitting"
          options={{
            title: '피팅',
            tabBarIcon: ({ color, size }) => <FittingIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="recommend"
          options={{
            title: '추천',
            tabBarIcon: ({ color, size }) => <RecommendIcon color={color} size={size} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
