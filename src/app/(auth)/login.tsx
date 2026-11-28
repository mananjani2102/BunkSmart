import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View, type TextInputInstance } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { LinkRow } from '@/components/ui/LinkRow';
import { TextField } from '@/components/ui/TextField';
import { useAuthActions } from '@/context/AuthProvider';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginErrors {
  email?: string;
  password?: string;
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
  if (value.length === 0) {
    return 'Enter your password.';
  }
  return undefined;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerText: {
    flex: 1,
  },
  formError: {
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  submitButton: {
    height: 48,
    marginTop: spacing.xs,
  },
}));

export default function LoginScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { signIn } = useAuthActions();
  const params = useLocalSearchParams<{ notice?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [dismissNotice, setDismissNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const passwordInputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const showConfirmationNotice =
    !dismissNotice && params.notice === 'confirm_email';

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (formError) {
      setFormError(null);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (formError) {
      setFormError(null);
    }
  };

  const handleEmailBlur = () => {
    if (submittingRef.current) {
      return;
    }
    const emailError = validateEmail(email);
    setFieldErrors((prev) =>
      prev.email === emailError ? prev : { ...prev, email: emailError }
    );
  };

  const handlePasswordBlur = () => {
    if (submittingRef.current) {
      return;
    }
    const passwordError = validatePassword(password);
    setFieldErrors((prev) =>
      prev.password === passwordError ? prev : { ...prev, password: passwordError }
    );
  };

  const handleFocusPassword = () => {
    passwordInputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({ email: emailError, password: passwordError });
    setFormError(null);

    if (emailError || passwordError) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    submittingRef.current = true;
    setSubmitting(true);
    setDismissNotice(true);

    try {
      const result = await signIn(normalizedEmail, password);
      if (mountedRef.current && result.error) {
        setFormError(result.error);
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

  const handleCreateAccount = useCallback(() => {
    if (submittingRef.current) {
      return;
    }
    Keyboard.dismiss();
    router.push('/(auth)/signup');
  }, []);

  const footer = useMemo(
    () => (
      <LinkRow
        prompt="New to BunkSmart?"
        actionLabel="Create an account"
        onPress={handleCreateAccount}
        disabled={submitting}
      />
    ),
    [handleCreateAccount, submitting]
  );

  return (
    <AuthLayout footer={footer}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Welcome back
        </AppText>
        <AppText variant="body" tone="muted">
          Log in to see your attendance and skip limits.
        </AppText>
      </View>

      {showConfirmationNotice ? (
        <View style={styles.noticeBanner} accessibilityRole="text">
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={colors.success}
            style={styles.bannerIcon}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <AppText variant="label" tone="success" style={styles.bannerText}>
            Account created. Confirm your email address, then log in.
          </AppText>
        </View>
      ) : null}

      <FormError message={formError} style={styles.formError} />

      <View style={styles.form}>
        <TextField
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

        <TextField
          ref={passwordInputRef}
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={handlePasswordChange}
          onBlur={handlePasswordBlur}
          error={fieldErrors.password}
          editable={!submitting}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          importantForAutofill="yes"
          returnKeyType="done"
          onSubmitEditing={() => {
            void handleSubmit();
          }}
        />

        <Button
          title="Log in"
          loadingLabel="Logging in"
          onPress={() => {
            void handleSubmit();
          }}
          loading={submitting}
          disabled={submitting}
          fullWidth
          style={styles.submitButton}
        />
      </View>
    </AuthLayout>
  );
}
