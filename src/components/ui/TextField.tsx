import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useRef, useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type BlurEvent,
  type FocusEvent,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAuthScrollFocus } from '@/components/ui/AuthLayout';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography, type ThemeColors } from '@/theme/tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  showError?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
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
    backgroundColor: colors.fieldBackground,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  inputRowMultiline: {
    height: undefined,
    minHeight: 48,
  },
  inputRowFocused: {
    borderColor: colors.foreground,
  },
  inputRowError: {
    borderColor: colors.destructiveText,
  },
  inputRowDisabled: {
    backgroundColor: colors.muted,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    color: colors.foreground,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    letterSpacing: typography.body.letterSpacing,
    includeFontPadding: false,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 46,
    paddingVertical: spacing.xs,
  },
  inputWithToggle: {
    paddingRight: spacing.xs,
  },
  toggleButton: {
    width: 44,
    height: 44,
    marginRight: 2,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toggleButtonPressed: {
    backgroundColor: colors.muted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    flex: 1,
  },
  message: {
    marginTop: spacing.xs,
  },
}));

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function TextField(
    {
      label,
      error,
      helperText,
      showError,
      secureTextEntry = false,
      multiline = false,
      containerStyle,
      style,
      editable = true,
      accessibilityLabel,
      accessibilityHint,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) {
    const { colors, scheme } = useTheme();
    const styles = getStyles(colors, scheme);
    const authScroll = useAuthScrollFocus();
    const containerRef = useRef<ViewInstance>(null);
    const [isPasswordHidden, setIsPasswordHidden] = useState(true);
    const [focused, setFocused] = useState(false);

    const showPasswordToggle = Boolean(secureTextEntry);
    const resolvedSecureEntry = showPasswordToggle ? isPasswordHidden : false;
    const visibleError = showError !== false && error ? error : undefined;

    const handleFocus = (event: FocusEvent) => {
      setFocused(true);
      authScroll?.notifyFieldFocus(containerRef.current);
      onFocus?.(event);
    };

    const handleBlur = (event: BlurEvent) => {
      setFocused(false);
      onBlur?.(event);
    };

    return (
      <View ref={containerRef} style={[styles.container, containerStyle]}>
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>

        <View
          style={[
            styles.inputRow,
            multiline && styles.inputRowMultiline,
            focused && editable && styles.inputRowFocused,
            Boolean(visibleError) && styles.inputRowError,
            !editable && styles.inputRowDisabled,
          ]}
        >
          <TextInput
            ref={ref}
            editable={editable}
            multiline={multiline}
            secureTextEntry={resolvedSecureEntry}
            placeholderTextColor={colors.mutedForeground}
            selectionColor={colors.foreground}
            maxFontSizeMultiplier={1.4}
            textAlignVertical={multiline ? 'top' : 'center'}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={accessibilityHint ?? visibleError ?? helperText}
            accessibilityState={{ disabled: !editable }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              showPasswordToggle && styles.inputWithToggle,
              style,
            ]}
            {...rest}
          />

          {showPasswordToggle ? (
            <Pressable
              onPress={() => setIsPasswordHidden((current) => !current)}
              disabled={!editable}
              accessibilityRole="button"
              accessibilityLabel={
                isPasswordHidden ? 'Show password' : 'Hide password'
              }
              accessibilityState={{ disabled: !editable }}
              android_ripple={
                editable
                  ? { color: colors.rippleNeutral, foreground: true }
                  : undefined
              }
              style={({ pressed }) => [
                styles.toggleButton,
                pressed && editable && styles.toggleButtonPressed,
              ]}
            >
              <Ionicons
                name={isPasswordHidden ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>

        {visibleError ? (
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.errorRow}
          >
            <Ionicons
              name="alert-circle-outline"
              size={15}
              color={colors.destructiveText}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <AppText variant="caption" tone="danger" style={styles.errorText}>
              {visibleError}
            </AppText>
          </View>
        ) : helperText ? (
          <AppText variant="caption" tone="muted" style={styles.message}>
            {helperText}
          </AppText>
        ) : null}
      </View>
    );
  }
);
