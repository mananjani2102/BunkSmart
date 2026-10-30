import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  error,
  helperText,
  secureTextEntry = false,
  containerStyle,
  style,
  editable = true,
  ...rest
}: TextFieldProps) {
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);

  const showPasswordToggle = Boolean(secureTextEntry);
  const resolvedSecureEntry = showPasswordToggle ? isPasswordHidden : false;

  return (
    <View style={[styles.container, containerStyle]}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>

      <View
        style={[
          styles.inputRow,
          Boolean(error) && styles.inputRowError,
          !editable && styles.inputRowDisabled,
        ]}
      >
        <TextInput
          editable={editable}
          secureTextEntry={resolvedSecureEntry}
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={1.4}
          style={[
            styles.input,
            showPasswordToggle && styles.inputWithToggle,
            style,
          ]}
          {...rest}
        />

        {showPasswordToggle ? (
          <Pressable
            onPress={() => setIsPasswordHidden((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              isPasswordHidden ? 'Show password' : 'Hide password'
            }
            android_ripple={{ color: colors.rippleNeutral, foreground: true }}
            style={({ pressed }) => [
              styles.toggleButton,
              pressed && styles.toggleButtonPressed,
            ]}
          >
            <Ionicons
              name={isPasswordHidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.message}>
          {error}
        </AppText>
      ) : helperText ? (
        <AppText variant="caption" tone="muted" style={styles.message}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  inputRowDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  inputWithToggle: {
    paddingRight: spacing.xs,
  },
  toggleButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  message: {
    marginTop: spacing.xs,
  },
});
