import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';

const AUTH_EDGES = ['top', 'bottom', 'left', 'right'] as const;
const FOCUS_SCROLL_PADDING = spacing.xl;
const KEYBOARD_SETTLE_DELAY_MS = 60;

export interface AuthScrollContextValue {
  notifyFieldFocus: (fieldContainer: ViewInstance | null) => void;
}

const AuthScrollContext = createContext<AuthScrollContextValue | null>(null);

export function useAuthScrollFocus(): AuthScrollContextValue | null {
  return useContext(AuthScrollContext);
}

export interface AuthLayoutHandle {
  scrollToField: (fieldContainer: ViewInstance | null) => void;
}

export interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
  backAccessibilityLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoiding: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewport: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  scrollContentWithBack: {
    paddingTop: spacing.md,
  },
  column: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  main: {
    width: '100%',
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backButtonPressed: {
    backgroundColor: colors.muted,
  },
  backButtonDisabled: {
    opacity: 0.5,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  brandRowCompact: {
    marginBottom: spacing.xl,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
}));

/**
 * Shared layout shell for authentication screens with top-anchored content,
 * optional back button, brand row, keyboard avoidance, bottom-pinned footer,
 * and focused-field scroll adjustment.
 */
export const AuthLayout = forwardRef<AuthLayoutHandle, AuthLayoutProps>(
  function AuthLayout(
    {
      children,
      footer,
      onBack,
      backDisabled = false,
      backAccessibilityLabel = 'Back',
      contentContainerStyle,
    },
    ref
  ) {
    const { colors, scheme } = useTheme();
    const styles = getStyles(colors, scheme);
    const reduceMotion = useReduceMotion();

    const viewportRef = useRef<ViewInstance>(null);
    const scrollViewRef = useRef<ScrollViewInstance>(null);
    const focusedFieldRef = useRef<ViewInstance | null>(null);
    const scrollOffsetRef = useRef(0);
    const contentHeightRef = useRef(0);
    const viewportHeightRef = useRef(0);
    const frameIdRef = useRef<number | null>(null);
    const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearScheduledScroll = useCallback(() => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      if (timerIdRef.current !== null) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
      }
    }, []);

    const scrollFieldIntoView = useCallback(
      (fieldView: ViewInstance | null) => {
        const viewport = viewportRef.current;
        const scrollView = scrollViewRef.current;
        if (
          !fieldView ||
          !viewport ||
          !scrollView ||
          typeof fieldView.measureInWindow !== 'function' ||
          typeof viewport.measureInWindow !== 'function'
        ) {
          return;
        }

        viewport.measureInWindow((_vx, viewportY, _vw, viewportHeight) => {
          if (viewportHeight <= 0) {
            return;
          }
          fieldView.measureInWindow((_fx, fieldY, _fw, fieldHeight) => {
            if (fieldHeight <= 0) {
              return;
            }
            const relTop = fieldY - viewportY;
            const relBottom = fieldY + fieldHeight - viewportY;
            const maxOffset = Math.max(
              0,
              contentHeightRef.current - viewportHeight
            );
            let nextOffset: number | null = null;

            if (relBottom > viewportHeight - FOCUS_SCROLL_PADDING) {
              const neededDelta =
                relBottom - (viewportHeight - FOCUS_SCROLL_PADDING);
              const maxTopDelta = Math.max(0, relTop - FOCUS_SCROLL_PADDING);
              const delta =
                fieldHeight + FOCUS_SCROLL_PADDING * 2 <= viewportHeight
                  ? neededDelta
                  : Math.min(neededDelta, maxTopDelta);
              if (delta > 0) {
                nextOffset = Math.min(
                  maxOffset,
                  scrollOffsetRef.current + delta
                );
              }
            } else if (relTop < FOCUS_SCROLL_PADDING) {
              const delta = FOCUS_SCROLL_PADDING - relTop;
              nextOffset = Math.max(0, scrollOffsetRef.current - delta);
            }

            if (
              nextOffset !== null &&
              Math.abs(nextOffset - scrollOffsetRef.current) > 1
            ) {
              scrollView.scrollTo({
                y: nextOffset,
                animated: !reduceMotion,
              });
            }
          });
        });
      },
      [reduceMotion]
    );

    const scheduleFrameScroll = useCallback(
      (fieldView: ViewInstance | null) => {
        if (!fieldView) {
          return;
        }
        if (frameIdRef.current !== null) {
          cancelAnimationFrame(frameIdRef.current);
        }
        frameIdRef.current = requestAnimationFrame(() => {
          frameIdRef.current = null;
          scrollFieldIntoView(fieldView);
        });
      },
      [scrollFieldIntoView]
    );

    const notifyFieldFocus = useCallback(
      (fieldContainer: ViewInstance | null) => {
        focusedFieldRef.current = fieldContainer;
        scheduleFrameScroll(fieldContainer);
      },
      [scheduleFrameScroll]
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToField: notifyFieldFocus,
      }),
      [notifyFieldFocus]
    );

    useEffect(() => {
      const showEvent =
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

      const showSub = Keyboard.addListener(showEvent, () => {
        if (!focusedFieldRef.current) {
          return;
        }
        if (timerIdRef.current !== null) {
          clearTimeout(timerIdRef.current);
        }
        timerIdRef.current = setTimeout(() => {
          timerIdRef.current = null;
          scheduleFrameScroll(focusedFieldRef.current);
        }, KEYBOARD_SETTLE_DELAY_MS);
      });

      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        focusedFieldRef.current = null;
      });

      return () => {
        showSub.remove();
        hideSub.remove();
        clearScheduledScroll();
      };
    }, [clearScheduledScroll, scheduleFrameScroll]);

    const handleViewportLayout = useCallback(
      (event: LayoutChangeEvent) => {
        const nextHeight = event.nativeEvent.layout.height;
        const prevHeight = viewportHeightRef.current;
        viewportHeightRef.current = nextHeight;

        if (
          prevHeight > 0 &&
          nextHeight < prevHeight &&
          focusedFieldRef.current
        ) {
          scheduleFrameScroll(focusedFieldRef.current);
        }
      },
      [scheduleFrameScroll]
    );

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      },
      []
    );

    const handleContentSizeChange = useCallback(
      (_width: number, height: number) => {
        contentHeightRef.current = height;
      },
      []
    );

    const scrollContextValue = useMemo<AuthScrollContextValue>(
      () => ({ notifyFieldFocus }),
      [notifyFieldFocus]
    );

    const hasBack = Boolean(onBack);
    const webCursor =
      Platform.OS === 'web' && !backDisabled ? ('pointer' as const) : undefined;

    return (
      <SafeAreaView edges={AUTH_EDGES} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <AuthScrollContext.Provider value={scrollContextValue}>
            <View
              ref={viewportRef}
              style={styles.viewport}
              onLayout={handleViewportLayout}
            >
              <ScrollView
                ref={scrollViewRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onContentSizeChange={handleContentSizeChange}
                contentContainerStyle={[
                  styles.scrollContent,
                  hasBack && styles.scrollContentWithBack,
                  contentContainerStyle,
                ]}
              >
                <View style={styles.column}>
                  <View style={styles.main}>
                    {onBack ? (
                      <Pressable
                        onPress={onBack}
                        disabled={backDisabled}
                        android_ripple={
                          !backDisabled
                            ? { color: colors.rippleNeutral, foreground: true }
                            : undefined
                        }
                        accessibilityRole="button"
                        accessibilityLabel={backAccessibilityLabel}
                        accessibilityState={{ disabled: backDisabled }}
                        style={({ pressed }) => [
                          styles.backButton,
                          webCursor && ({ cursor: webCursor } as ViewStyle),
                          backDisabled && styles.backButtonDisabled,
                          pressed && !backDisabled && styles.backButtonPressed,
                        ]}
                      >
                        <Ionicons
                          name="arrow-back"
                          size={22}
                          color={colors.foreground}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                      </Pressable>
                    ) : null}

                    <View
                      style={[
                        styles.brandRow,
                        hasBack && styles.brandRowCompact,
                      ]}
                    >
                      <BrandMark />
                      <AppText variant="heading">BunkSmart</AppText>
                    </View>
                    {children}
                  </View>

                  {footer ? <View style={styles.footer}>{footer}</View> : null}
                </View>
              </ScrollView>
            </View>
          </AuthScrollContext.Provider>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
);
