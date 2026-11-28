import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { type ColorValue } from 'react-native';

import { TabBar, type CustomTabBarProps } from '@/components/ui/TabBar';
import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';

interface TabIconProps {
  color: ColorValue;
  focused: boolean;
  size: number;
}

function resolveIconColor(color: ColorValue): string | undefined {
  return typeof color === 'string' ? color : undefined;
}

function OverviewTabIcon({ color, focused, size }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? 'grid' : 'grid-outline'}
      size={size}
      color={resolveIconColor(color)}
    />
  );
}

function TodayTabIcon({ color, focused, size }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'}
      size={size}
      color={resolveIconColor(color)}
    />
  );
}

function SubjectsTabIcon({ color, focused, size }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? 'calendar' : 'calendar-outline'}
      size={size}
      color={resolveIconColor(color)}
    />
  );
}

function ProfileTabIcon({ color, focused, size }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? 'person' : 'person-outline'}
      size={size}
      color={resolveIconColor(color)}
    />
  );
}

const OVERVIEW_OPTIONS = {
  title: 'Overview',
  tabBarIcon: OverviewTabIcon,
};

const TODAY_OPTIONS = {
  title: 'Today',
  tabBarIcon: TodayTabIcon,
};

const SUBJECTS_OPTIONS = {
  title: 'Subjects',
  tabBarIcon: SubjectsTabIcon,
};

const PROFILE_OPTIONS = {
  title: 'Profile',
  tabBarIcon: ProfileTabIcon,
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  const renderTabBar = useCallback(
    (props: CustomTabBarProps) => <TabBar {...props} />,
    []
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      freezeOnBlur: true,
      detachInactiveScreens: true,
      animation: (reduceMotion ? 'none' : 'fade') as 'none' | 'fade',
      sceneStyle: {
        backgroundColor: colors.background,
      },
    }),
    [colors.background, reduceMotion]
  );

  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={renderTabBar}
      screenOptions={screenOptions}
    >
      <Tabs.Screen name="index" options={OVERVIEW_OPTIONS} />
      <Tabs.Screen name="today" options={TODAY_OPTIONS} />
      <Tabs.Screen name="subjects" options={SUBJECTS_OPTIONS} />
      <Tabs.Screen name="profile" options={PROFILE_OPTIONS} />
    </Tabs>
  );
}
