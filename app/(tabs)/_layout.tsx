import { Tabs } from 'expo-router';
import { House, ChartBar, ClockCounterClockwise, UserCircle } from 'phosphor-react-native';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.accent600,
      tabBarInactiveTintColor: colors.neutral500,
      tabBarStyle: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopColor: colors.neutral200,
        paddingTop: 8,
      },
      tabBarPressColor: 'transparent',
      tabBarActiveBackgroundColor: 'transparent',
      tabBarInactiveBackgroundColor: 'transparent',
      tabBarLabelStyle: {
        fontFamily: 'DMSans_700Bold',
        fontSize: 10,
        letterSpacing: 0.5,
      },
    }}>
      <Tabs.Screen name="index" options={{
        title: 'HOME',
        tabBarIcon: ({ color, focused }) => <House size={22} weight={focused ? 'bold' : 'regular'} color={color as string} />,
      }} />
      <Tabs.Screen name="analysis" options={{
        title: 'STATS',
        tabBarIcon: ({ color, focused }) => <ChartBar size={22} weight={focused ? 'bold' : 'regular'} color={color as string} />,
      }} />
      <Tabs.Screen name="history" options={{
        title: 'HISTORY',
        tabBarIcon: ({ color, focused }) => <ClockCounterClockwise size={22} weight={focused ? 'bold' : 'regular'} color={color as string} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'PROFILE',
        tabBarIcon: ({ color, focused }) => <UserCircle size={22} weight={focused ? 'bold' : 'regular'} color={color as string} />,
      }} />
    </Tabs>
  );
}
