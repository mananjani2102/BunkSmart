import { type Tabs } from 'expo-router';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, motion, radius, spacing } from '@/theme/tokens';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
export type CustomTabBarProps = Parameters<TabBarRenderer>[0];

interface TabItemProps {
  label: string;
  focused: boolean;
  accessibilityLabel?: string;
  testID?: string;
  renderIcon: (color: string, focused: boolean) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({
  label,
  focused,
  accessibilityLabel,
  testID,
  renderIcon,
  onPress,
  onLongPress,
}: TabItemProps) {
  const [pressScale] = useState(() => new Animated.Value(1));
  const [iconLift] = useState(() => new Animated.Value(focused ? -1 : 0));

  useEffect(() => {
    const anim = Animated.timing(iconLift, {
      toValue: focused ? -1 : 0,
      duration: motion.transition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [focused, iconLift]);

  const animatePress = (toValue: number, duration: number) => {
    Animated.timing(pressScale, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const tintColor = focused ? colors.accent : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animatePress(0.94, motion.pressIn)}
      onPressOut={() => animatePress(1, motion.pressOut)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [
        styles.tabPressable,
        pressed && !focused && styles.tabPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.tabContent,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <Animated.View style={{ transform: [{ translateY: iconLift }] }}>
          {renderIcon(tintColor, focused)}
        </Animated.View>
        <AppText
          variant="caption"
          numberOfLines={1}
          style={[
            styles.tabLabel,
            focused ? styles.tabLabelFocused : styles.tabLabelIdle,
          ]}
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: CustomTabBarProps) {
  const [rowWidth, setRowWidth] = useState(0);
  const [indicatorX] = useState(() => new Animated.Value(0));
  const hasPositionedRef = useRef(false);

  const visibleEntries = state.routes
    .map((route, routeIndex) => ({
      route,
      routeIndex,
      descriptor: descriptors[route.key],
    }))
    .filter((entry) => !entry.descriptor?.options.hidden);

  const count = visibleEntries.length;
  const activeVisibleIndex = Math.max(
    0,
    visibleEntries.findIndex((entry) => entry.routeIndex === state.index)
  );
  const tabWidth = count > 0 ? rowWidth / count : 0;

  useEffect(() => {
    if (tabWidth <= 0) {
      return;
    }

    const targetX = activeVisibleIndex * tabWidth;

    if (!hasPositionedRef.current) {
      hasPositionedRef.current = true;
      indicatorX.setValue(targetX);
      return;
    }

    const anim = Animated.timing(indicatorX, {
      toValue: targetX,
      duration: motion.transition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();

    return () => {
      anim.stop();
    };
  }, [activeVisibleIndex, indicatorX, tabWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== rowWidth) {
      setRowWidth(nextWidth);
    }
  };

  const bottomInset = Math.max(insets.bottom, spacing.sm);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomInset,
        },
      ]}
    >
      <View
        style={styles.row}
        onLayout={handleLayout}
        accessibilityRole="tablist"
      >
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeSlot,
              {
                width: tabWidth,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          >
            <View style={styles.activeHighlight}>
              <View style={styles.activeAccentBar} />
            </View>
          </Animated.View>
        ) : null}

        {visibleEntries.map(({ route, routeIndex, descriptor }) => {
          const focused = routeIndex === state.index;
          const options = descriptor.options;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;

          const handlePress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          const handleLongPress = () => {
            emitter.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              focused={focused}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              renderIcon={(color, isFocused) =>
                options.tabBarIcon
                  ? options.tabBarIcon({
                      focused: isFocused,
                      color,
                      size: 22,
                    })
                  : null
              }
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 54,
    position: 'relative',
  },
  activeSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    paddingHorizontal: 4,
  },
  activeHighlight: {
    flex: 1,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.control,
    alignItems: 'center',
    overflow: 'hidden',
  },
  activeAccentBar: {
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.accent,
  },
  tabPressable: {
    flex: 1,
    zIndex: 1,
    marginHorizontal: 4,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer', userSelect: 'none' as const }
      : {}),
  },
  tabPressed: {
    backgroundColor: colors.surfacePressed,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 2,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  tabLabelFocused: {
    color: colors.accent,
    fontWeight: '600',
  },
  tabLabelIdle: {
    color: colors.textMuted,
    fontWeight: '500',
  },
});
