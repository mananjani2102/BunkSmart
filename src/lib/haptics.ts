import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Light tactile tap used only when marking a class on Today.
 */
export function triggerLightHaptic(): void {
  if (Platform.OS === 'web') {
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
    () => undefined
  );
}

/**
 * Stronger tactile tap used only when confirming a destructive action.
 */
export function triggerDestructiveHaptic(): void {
  if (Platform.OS === 'web') {
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
    () => undefined
  );
}
