import { type Tabs } from 'expo-router';
import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { USE_NATIVE_DRIVER, useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { fontFamily, motion, shadows, spacing, type ThemeColors } from '@/theme/tokens';

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
export type CustomTabBarProps = Parameters<TabBarRenderer>[0];
type TabIconRenderer = CustomTabBarProps['descriptors'][string]['options']['tabBarIcon'];

const TAB_BAR_HEIGHT = 56;
const TAB_ITEM_MIN_HEIGHT = 48;
const ICON_SIZE = 22;
const ICON_BOX_SIZE = 24;
const INDICATOR_WIDTH = 24;
const INDICATOR_HEIGHT = 2;
const PRESSED_OPACITY = 0.72;
const ACTIVE_ICON_MIN_SCALE = 0.92;

interface TabItemProps {
  routeKey: string;
  label: string;
  focused: boolean;
  accessibilityLabel?: string;
  testID?: string;
  activeColor: string;
  idleColor: string;
  rippleColor: string;
  reduceMotion: boolean;
  tabBarIcon?: TabIconRenderer;
  onSelectTab: (routeKey: string, focused: boolean) => void;
  onLongPressTab: (routeKey: string) => void;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  container: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.none,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: TAB_BAR_HEIGHT,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    backgroundColor: colors.foreground,
  },
  tabPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TAB_ITEM_MIN_HEIGHT,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none' as const } : {}),
  },
  tabPressed: { opacity: PRESSED_OPACITY },
  tabContent: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconStack: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  labelBase: { width: '100%', alignItems: 'center' },
  labelOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
}));

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof Keyboard.isVisible === 'function' ? Keyboard.isVisible() : false
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}

const TabItem = memo(function TabItem({
  routeKey,
  label,
  focused,
  accessibilityLabel,
  testID,
  activeColor,
  idleColor,
  rippleColor,
  reduceMotion,
  tabBarIcon,
  onSelectTab,
  onLongPressTab,
}: TabItemProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const [activeAnim] = useState(() => new Animated.Value(focused ? 1 : 0));
  const prevFocusedRef = useRef(focused);

  useEffect(() => {
    if (reduceMotion) {
      activeAnim.setValue(focused ? 1 : 0);
      prevFocusedRef.current = focused;
      return;
    }
    if (prevFocusedRef.current === focused) {
      return;
    }
    prevFocusedRef.current = focused;

    const anim = Animated.timing(activeAnim, {
      toValue: focused ? 1 : 0,
      duration: motion.tabItemFade,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [activeAnim, focused, reduceMotion]);

  const inactiveOpacity = useMemo(
    () => activeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    [activeAnim]
  );
  const iconScale = useMemo(
    () => activeAnim.interpolate({ inputRange: [0, 1], outputRange: [ACTIVE_ICON_MIN_SCALE, 1] }),
    [activeAnim]
  );

  const handlePress = useCallback(() => onSelectTab(routeKey, focused), [focused, onSelectTab, routeKey]);
  const handleLongPress = useCallback(() => onLongPressTab(routeKey), [onLongPressTab, routeKey]);
  const accessibilityState = useMemo(() => ({ selected: focused }), [focused]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      android_ripple={{ color: rippleColor, borderless: false }}
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [styles.tabPressable, pressed && styles.tabPressed]}
    >
      <View style={styles.tabContent}>
        <View style={styles.iconStack}>
          <Animated.View pointerEvents="none" style={[styles.iconLayer, { opacity: inactiveOpacity }]}>
            {tabBarIcon ? tabBarIcon({ focused: false, color: idleColor, size: ICON_SIZE }) : null}
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.iconLayer, { opacity: activeAnim, transform: [{ scale: iconScale }] }]}
          >
            {tabBarIcon ? tabBarIcon({ focused: true, color: activeColor, size: ICON_SIZE }) : null}
          </Animated.View>
        </View>
        <View style={styles.labelStack}>
          <Animated.View pointerEvents="none" style={[styles.labelBase, { opacity: inactiveOpacity }]}>
            <AppText
              variant="caption"
              tone="muted"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={styles.tabLabel}
            >
              {label}
            </AppText>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.labelOverlay, { opacity: activeAnim }]}>
            <AppText
              variant="caption"
              tone="default"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.tabLabel}
            >
              {label}
            </AppText>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
});

function areTabBarPropsEqual(prev: CustomTabBarProps, next: CustomTabBarProps): boolean {
  if (
    prev.state.index !== next.state.index ||
    prev.insets.bottom !== next.insets.bottom ||
    prev.insets.left !== next.insets.left ||
    prev.insets.right !== next.insets.right ||
    prev.state.routes.length !== next.state.routes.length
  ) {
    return false;
  }

  for (let i = 0; i < prev.state.routes.length; i += 1) {
    const prevRoute = prev.state.routes[i];
    const nextRoute = next.state.routes[i];
    if (
      prevRoute.key !== nextRoute.key ||
      prevRoute.name !== nextRoute.name ||
      prevRoute.params !== nextRoute.params
    ) {
      return false;
    }
    const prevOptions = prev.descriptors[prevRoute.key]?.options;
    const nextOptions = next.descriptors[nextRoute.key]?.options;
    if (
      prevOptions?.hidden !== nextOptions?.hidden ||
      prevOptions?.title !== nextOptions?.title ||
      prevOptions?.tabBarLabel !== nextOptions?.tabBarLabel ||
      prevOptions?.tabBarIcon !== nextOptions?.tabBarIcon ||
      prevOptions?.tabBarAccessibilityLabel !== nextOptions?.tabBarAccessibilityLabel ||
      prevOptions?.tabBarButtonTestID !== nextOptions?.tabBarButtonTestID
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Custom bottom tab bar with a shared native-driven line indicator, per-tab
 * icon/label crossfades, single layout width measurement, and keyboard hiding.
 */
export const TabBar = memo(function TabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: CustomTabBarProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const reduceMotion = useReduceMotion();
  const keyboardVisible = useKeyboardVisible();
  const [barWidth, setBarWidth] = useState(() => Dimensions.get('window').width);

  const visibleEntries = useMemo(
    () =>
      state.routes
        .map((route, routeIndex) => ({ route, routeIndex, descriptor: descriptors[route.key] }))
        .filter((entry) => !entry.descriptor?.options.hidden),
    [descriptors, state.routes]
  );

  const foundVisibleIndex = visibleEntries.findIndex((entry) => entry.routeIndex === state.index);
  const activeVisibleIndex = foundVisibleIndex >= 0 ? foundVisibleIndex : 0;

  const [indicatorPosition] = useState(() => new Animated.Value(activeVisibleIndex));
  const prevIndexRef = useRef(activeVisibleIndex);
  const emitterRef = useRef(emitter);
  const navigateToTabRef = useRef(navigateToTab);

  useEffect(() => {
    emitterRef.current = emitter;
    navigateToTabRef.current = navigateToTab;
  }, [emitter, navigateToTab]);

  useEffect(() => {
    if (keyboardVisible || reduceMotion) {
      indicatorPosition.setValue(activeVisibleIndex);
      prevIndexRef.current = activeVisibleIndex;
      return;
    }
    if (prevIndexRef.current === activeVisibleIndex) {
      return;
    }
    prevIndexRef.current = activeVisibleIndex;

    const anim = Animated.timing(indicatorPosition, {
      toValue: activeVisibleIndex,
      duration: motion.tabIndicator,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [activeVisibleIndex, indicatorPosition, keyboardVisible, reduceMotion]);

  const handleRowLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setBarWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    }
  }, []);

  const handleSelectTab = useCallback((routeKey: string, focused: boolean) => {
    if (focused) {
      return;
    }
    const event = emitterRef.current.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!event.defaultPrevented) {
      navigateToTabRef.current(routeKey);
    }
  }, []);

  const handleLongPressTab = useCallback((routeKey: string) => {
    emitterRef.current.emit({ type: 'tabLongPress', target: routeKey });
  }, []);

  const translateX = useMemo(() => {
    const tabCount = Math.max(visibleEntries.length, 1);
    const itemWidth = barWidth / tabCount;
    const baseOffset = (itemWidth - INDICATOR_WIDTH) / 2;
    if (tabCount <= 1) {
      return indicatorPosition.interpolate({ inputRange: [0, 1], outputRange: [baseOffset, baseOffset] });
    }
    const maxIndex = tabCount - 1;
    return indicatorPosition.interpolate({
      inputRange: [0, maxIndex],
      outputRange: [baseOffset, baseOffset + maxIndex * itemWidth],
    });
  }, [barWidth, indicatorPosition, visibleEntries.length]);

  if (keyboardVisible || visibleEntries.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.row} onLayout={handleRowLayout} accessibilityRole="tablist">
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.indicator, { transform: [{ translateX }] }]}
        />
        {visibleEntries.map(({ route, routeIndex, descriptor }) => {
          const options = descriptor.options;
          const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;

          return (
            <TabItem
              key={route.key}
              routeKey={route.key}
              label={label}
              focused={routeIndex === state.index}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              activeColor={colors.foreground}
              idleColor={colors.mutedForeground}
              rippleColor={colors.rippleNeutral}
              reduceMotion={reduceMotion}
              tabBarIcon={options.tabBarIcon}
              onSelectTab={handleSelectTab}
              onLongPressTab={handleLongPressTab}
            />
          );
        })}
      </View>
    </View>
  );
}, areTabBarPropsEqual);
