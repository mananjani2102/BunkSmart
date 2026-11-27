import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
export const SKELETON_DELAY_MS = 200;

const SKELETON_MIN_OPACITY = 0.45;
const SKELETON_MAX_OPACITY = 0.95;
const SKELETON_IDLE_OPACITY = 0.7;

let cachedReduceMotion = false;
let reduceMotionInitialized = false;
const reduceMotionListeners = new Set<(enabled: boolean) => void>();

function ensureReduceMotionSubscription(): void {
  if (reduceMotionInitialized) {
    return;
  }
  reduceMotionInitialized = true;

  if (typeof AccessibilityInfo?.isReduceMotionEnabled === 'function') {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (enabled !== cachedReduceMotion) {
          cachedReduceMotion = enabled;
          for (const listener of reduceMotionListeners) {
            listener(enabled);
          }
          syncSkeletonPulse();
        }
      })
      .catch(() => undefined);
  }

  if (typeof AccessibilityInfo?.addEventListener === 'function') {
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      cachedReduceMotion = enabled;
      for (const listener of reduceMotionListeners) {
        listener(enabled);
      }
      syncSkeletonPulse();
    });
  }
}

/**
 * Subscribes to the system reduce-motion setting using a single shared listener.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(cachedReduceMotion);

  useEffect(() => {
    let cancelled = false;
    ensureReduceMotionSubscription();
    reduceMotionListeners.add(setReduceMotion);
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setReduceMotion((prev) =>
          prev === cachedReduceMotion ? prev : cachedReduceMotion
        );
      }
    });
    return () => {
      cancelled = true;
      reduceMotionListeners.delete(setReduceMotion);
    };
  }, []);

  return reduceMotion;
}

const sharedSkeletonOpacity = new Animated.Value(SKELETON_MIN_OPACITY);
let activeSkeletonCount = 0;
let activePulseAnimation: Animated.CompositeAnimation | null = null;

function syncSkeletonPulse(): void {
  if (activeSkeletonCount <= 0 || cachedReduceMotion) {
    if (activePulseAnimation) {
      activePulseAnimation.stop();
      activePulseAnimation = null;
    }
    sharedSkeletonOpacity.setValue(
      cachedReduceMotion ? SKELETON_IDLE_OPACITY : SKELETON_MIN_OPACITY
    );
    return;
  }

  if (activePulseAnimation) {
    return;
  }

  sharedSkeletonOpacity.setValue(SKELETON_MIN_OPACITY);
  activePulseAnimation = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedSkeletonOpacity, {
        toValue: SKELETON_MAX_OPACITY,
        duration: 750,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(sharedSkeletonOpacity, {
        toValue: SKELETON_MIN_OPACITY,
        duration: 750,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ])
  );
  activePulseAnimation.start();
}

/**
 * Returns the single shared skeleton pulse Animated.Value and starts/stops the
 * shared loop automatically based on mounted skeleton count and reduce-motion.
 */
export function useSharedSkeletonOpacity(): Animated.Value {
  useEffect(() => {
    ensureReduceMotionSubscription();
    activeSkeletonCount += 1;
    syncSkeletonPulse();

    return () => {
      activeSkeletonCount = Math.max(0, activeSkeletonCount - 1);
      syncSkeletonPulse();
    };
  }, []);

  return sharedSkeletonOpacity;
}

/**
 * Delays showing a loading skeleton until `active` has remained true past `delayMs`.
 */
export function useDelayedVisible(
  active: boolean,
  delayMs: number = SKELETON_DELAY_MS
): boolean {
  const [prevActive, setPrevActive] = useState(active);
  const [visible, setVisible] = useState(false);

  if (prevActive !== active) {
    setPrevActive(active);
    if (!active || visible) {
      setVisible(false);
    }
  }

  useEffect(() => {
    if (!active || delayMs <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [active, delayMs]);

  if (delayMs <= 0) {
    return active;
  }

  return active && visible;
}
