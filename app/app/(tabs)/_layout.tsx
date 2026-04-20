import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#7A8450' }}>
      <Tabs.Screen name="closet" options={{ title: '옷장' }} />
      <Tabs.Screen name="fitting" options={{ title: '피팅' }} />
      <Tabs.Screen name="recommend" options={{ title: '추천' }} />
    </Tabs>
  );
}
