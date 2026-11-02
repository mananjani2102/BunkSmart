import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Easing } from 'react-native';

import { TabBar } from '@/components/ui/TabBar';
import { colors, motion } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: motion.transition,
            easing: Easing.out(Easing.cubic),
          },
        },
        sceneStyle: {
          backgroundColor: colors.bg,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={size}
              color={
                typeof color === 'string'
                  ? color
                  : focused
                    ? colors.accent
                    : colors.textMuted
              }
            />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={size}
              color={
                typeof color === 'string'
                  ? color
                  : focused
                    ? colors.accent
                    : colors.textMuted
              }
            />
          ),
        }}
      />
      <Tabs.Screen
        name="subjects"
        options={{
          title: 'Subjects',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size}
              color={
                typeof color === 'string'
                  ? color
                  : focused
                    ? colors.accent
                    : colors.textMuted
              }
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={
                typeof color === 'string'
                  ? color
                  : focused
                    ? colors.accent
                    : colors.textMuted
              }
            />
          ),
        }}
      />
    </Tabs>
  );
}
