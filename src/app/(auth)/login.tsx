import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import appIcon from '@/assets/images/icon.png';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/context/AuthProvider';
import { colors, radius, spacing } from '@/theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_SCREEN_EDGES = ['top', 'bottom', 'left', 'right'] as const;

interface LoginErrors {
  email?: string;
  password?: string;
}

function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ notice?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [dismissNotice, setDismissNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

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

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    setFormError(null);

    if (errors.email || errors.password) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setDismissNotice(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setFormError(result.error);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        scroll
        edges={AUTH_SCREEN_EDGES}
        contentContainerStyle={styles.screenContent}
      >
        <View style={styles.header}>
          <Image
            source={appIcon}
            style={styles.logo}
            contentFit="cover"
            accessibilityLabel="BunkSmart logo"
          />
          <AppText variant="title">Log in</AppText>
          <AppText variant="body" tone="muted" style={styles.subtitle}>
            Your subjects and attendance sync across your devices.
          </AppText>
        </View>

        {showConfirmationNotice ? (
          <View style={styles.noticeBanner} accessibilityRole="text">
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={colors.safe}
              style={styles.bannerIcon}
            />
            <AppText variant="caption" tone="safe" style={styles.bannerText}>
              Account created. Confirm your email address, then log in.
            </AppText>
          </View>
        ) : null}

        {formError ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.danger}
              style={styles.bannerIcon}
            />
            <AppText variant="caption" tone="danger" style={styles.bannerText}>
              {formError}
            </AppText>
          </View>
        ) : null}

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={handleEmailChange}
            error={fieldErrors.email}
            editable={!submitting}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={handlePasswordChange}
            error={fieldErrors.password}
            editable={!submitting}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          <Button
            title="Log in"
            onPress={() => {
              void handleSubmit();
            }}
            loading={submitting}
            disabled={submitting}
            fullWidth
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Link href="/(auth)/signup" asChild>
            <Pressable
              disabled={submitting}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.linkPressed,
              ]}
            >
              <AppText variant="label" style={styles.linkText}>
                Create an account
              </AppText>
            </Pressable>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContent: {
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginBottom: spacing.md,
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.safeBg,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  bannerText: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  linkButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkPressed: {
    backgroundColor: colors.accentSoft,
  },
  linkText: {
    color: colors.accent,
  },
});
