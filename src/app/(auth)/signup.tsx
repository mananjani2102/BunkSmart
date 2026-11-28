import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  View,
  type TextInputInstance,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { AuthLayout, type AuthLayoutHandle } from '@/components/ui/AuthLayout';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { LinkRow } from '@/components/ui/LinkRow';
import { TextField } from '@/components/ui/TextField';
import { useAuthActions } from '@/context/AuthProvider';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, spacing, type ThemeColors } from '@/theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignUpErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

type SignUpField = keyof SignUpErrors;

function validateFullName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < 1) {
    return 'Enter your full name.';
  }
  if (trimmed.length > 80) {
    return 'Full name must be 80 characters or fewer.';
  }
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 'Enter your email address.';
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return 'Enter a valid email address.';
  }
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return undefined;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  formError: {
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  passwordGroup: {
    gap: spacing.xs,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  submitButton: {
    height: 48,
    marginTop: spacing.xs,
  },
  legalNotice: {
    alignItems: 'center',
  },
  legalLead: {
    textAlign: 'center',
    marginBottom: -spacing.xs,
  },
  legalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalPolicyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalLinkButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.control,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  legalLinkPressed: {
    backgroundColor: colors.muted,
    opacity: 0.75,
  },
  legalLinkDisabled: {
    opacity: 0.5,
  },
  legalLinkText: {
    fontFamily: fontFamily.medium,
    textDecorationLine: 'underline',
  },
  legalConnector: {
    paddingHorizontal: 2,
  },
  confirmationBlock: {
    gap: spacing.xl,
  },
  confirmationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.control,
    padding: spacing.lg,
  },
  confirmationIcon: {
    marginTop: 2,
  },
  confirmationText: {
    flex: 1,
  },
}));

interface LegalLinkProps {
  label: string;
  disabled: boolean;
  rippleColor: string;
  styles: ReturnType<typeof getStyles>;
  onPress: () => void;
}

function LegalLink({
  label,
  disabled,
  rippleColor,
  styles,
  onPress,
}: LegalLinkProps) {
  const webCursor =
    Platform.OS === 'web' && !disabled ? ('pointer' as const) : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={
        !disabled ? { color: rippleColor, foreground: true } : undefined
      }
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.legalLinkButton,
        webCursor && ({ cursor: webCursor } as ViewStyle),
        disabled && styles.legalLinkDisabled,
        pressed && !disabled && styles.legalLinkPressed,
      ]}
    >
      <AppText variant="caption" tone="info" style={styles.legalLinkText}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function SignUpScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { signUp } = useAuthActions();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignUpErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] =
    useState(false);

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const authLayoutRef = useRef<AuthLayoutHandle>(null);
  const fullNameInputRef = useRef<TextInputInstance>(null);
  const emailInputRef = useRef<TextInputInstance>(null);
  const passwordInputRef = useRef<TextInputInstance>(null);
  const fullNameBoxRef = useRef<ViewInstance>(null);
  const emailBoxRef = useRef<ViewInstance>(null);
  const passwordBoxRef = useRef<ViewInstance>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearErrorOnEdit = (field: SignUpField) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (formError) {
      setFormError(null);
    }
  };

  const applyBlurError = (field: SignUpField, error: string | undefined) => {
    if (submittingRef.current) {
      return;
    }
    setFieldErrors((prev) =>
      prev[field] === error ? prev : { ...prev, [field]: error }
    );
  };

  const handleFullNameChange = (value: string) => {
    setFullName(value);
    clearErrorOnEdit('fullName');
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    clearErrorOnEdit('email');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    clearErrorOnEdit('password');
  };

  const handleFullNameBlur = () => {
    applyBlurError('fullName', validateFullName(fullName));
  };

  const handleEmailBlur = () => {
    applyBlurError('email', validateEmail(email));
  };

  const handlePasswordBlur = () => {
    applyBlurError('password', validatePassword(password));
  };

  const handleFocusEmail = () => {
    emailInputRef.current?.focus();
  };

  const handleFocusPassword = () => {
    passwordInputRef.current?.focus();
  };

  const navigateToLogin = useCallback(() => {
    if (submittingRef.current) {
      return;
    }
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  }, []);

  const handleOpenLegal = (route: '/legal/terms' | '/legal/privacy') => {
    if (submittingRef.current) {
      return;
    }
    Keyboard.dismiss();
    router.push(route);
  };

  const focusFirstInvalid = (errors: SignUpErrors) => {
    if (errors.fullName) {
      fullNameInputRef.current?.focus();
      authLayoutRef.current?.scrollToField(fullNameBoxRef.current);
      return;
    }
    if (errors.email) {
      emailInputRef.current?.focus();
      authLayoutRef.current?.scrollToField(emailBoxRef.current);
      return;
    }
    if (errors.password) {
      passwordInputRef.current?.focus();
      authLayoutRef.current?.scrollToField(passwordBoxRef.current);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const errors: SignUpErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    setFormError(null);

    if (errors.fullName || errors.email || errors.password) {
      focusFirstInvalid(errors);
      return;
    }

    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await signUp(trimmedName, normalizedEmail, password);
      if (!mountedRef.current) {
        return;
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.needsEmailConfirmation) {
        Keyboard.dismiss();
        setEmailConfirmationRequired(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setFormError(getFriendlyErrorMessage(err));
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const passwordRuleMet = password.length >= 8;

  const footer = useMemo(
    () =>
      emailConfirmationRequired ? null : (
        <LinkRow
          prompt="Already have an account?"
          actionLabel="Log in"
          onPress={navigateToLogin}
          disabled={submitting}
        />
      ),
    [emailConfirmationRequired, navigateToLogin, submitting]
  );

  return (
    <AuthLayout
      ref={authLayoutRef}
      onBack={navigateToLogin}
      backDisabled={submitting}
      backAccessibilityLabel="Back"
      footer={footer}
    >
      {emailConfirmationRequired ? (
        <View style={styles.confirmationBlock}>
          <View
            accessible
            accessibilityRole="text"
            style={styles.confirmationCard}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={colors.success}
              style={styles.confirmationIcon}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <AppText
              variant="body"
              tone="success"
              style={styles.confirmationText}
            >
              Account created. Confirm your email address, then log in.
            </AppText>
          </View>

          <Button
            title="Go to log in"
            onPress={navigateToLogin}
            fullWidth
            style={styles.submitButton}
          />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <AppText variant="title" accessibilityRole="header">
              Create your account
            </AppText>
            <AppText variant="body" tone="muted">
              Track attendance per subject and see how many classes you can skip.
            </AppText>
          </View>

          <FormError message={formError} style={styles.formError} />

          <View style={styles.form}>
            <View ref={fullNameBoxRef}>
              <TextField
                ref={fullNameInputRef}
                label="Full name"
                placeholder="Your name"
                value={fullName}
                onChangeText={handleFullNameChange}
                onBlur={handleFullNameBlur}
                error={fieldErrors.fullName}
                editable={!submitting}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                importantForAutofill="yes"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={handleFocusEmail}
              />
            </View>

            <View ref={emailBoxRef}>
              <TextField
                ref={emailInputRef}
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={handleEmailChange}
                onBlur={handleEmailBlur}
                error={fieldErrors.email}
                editable={!submitting}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                importantForAutofill="yes"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={handleFocusPassword}
              />
            </View>

            <View ref={passwordBoxRef} style={styles.passwordGroup}>
              <TextField
                ref={passwordInputRef}
                label="Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={handlePasswordBlur}
                error={fieldErrors.password}
                editable={!submitting}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="yes"
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleSubmit();
                }}
              />

              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={
                  passwordRuleMet
                    ? 'At least 8 characters, met'
                    : 'At least 8 characters, not met'
                }
                style={styles.ruleRow}
              >
                {passwordRuleMet ? (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color={colors.success}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
                <AppText
                  variant="caption"
                  tone={passwordRuleMet ? 'success' : 'muted'}
                >
                  At least 8 characters
                </AppText>
              </View>
            </View>

            <Button
              title="Create account"
              loadingLabel="Creating account"
              onPress={() => {
                void handleSubmit();
              }}
              loading={submitting}
              disabled={submitting}
              fullWidth
              style={styles.submitButton}
            />

            <View style={styles.legalNotice}>
              <AppText variant="caption" tone="muted" style={styles.legalLead}>
                By creating an account you agree to the
              </AppText>
              <View style={styles.legalLinksRow}>
                <LegalLink
                  label="Terms and Conditions"
                  disabled={submitting}
                  rippleColor={colors.rippleNeutral}
                  styles={styles}
                  onPress={() => handleOpenLegal('/legal/terms')}
                />

                <AppText
                  variant="caption"
                  tone="muted"
                  style={styles.legalConnector}
                >
                  and
                </AppText>

                <View style={styles.legalPolicyGroup}>
                  <LegalLink
                    label="Privacy Policy"
                    disabled={submitting}
                    rippleColor={colors.rippleNeutral}
                    styles={styles}
                    onPress={() => handleOpenLegal('/legal/privacy')}
                  />
                  <AppText variant="caption" tone="muted">
                    .
                  </AppText>
                </View>
              </View>
            </View>
          </View>
        </>
      )}
    </AuthLayout>
  );
}
