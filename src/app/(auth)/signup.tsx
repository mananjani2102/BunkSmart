import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
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

interface SignUpErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateSignUp(
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string
): SignUpErrors {
  const errors: SignUpErrors = {};
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();

  if (trimmedName.length < 1) {
    errors.fullName = 'Enter your full name.';
  } else if (trimmedName.length > 80) {
    errors.fullName = 'Full name must be 80 characters or fewer.';
  }

  if (!trimmedEmail) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignUpErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleFullNameChange = (value: string) => {
    setFullName(value);
    if (fieldErrors.fullName) {
      setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
    }
    if (formError) {
      setFormError(null);
    }
  };

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

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (fieldErrors.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
    if (formError) {
      setFormError(null);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const errors = validateSignUp(fullName, email, password, confirmPassword);
    setFieldErrors(errors);
    setFormError(null);

    if (
      errors.fullName ||
      errors.email ||
      errors.password ||
      errors.confirmPassword
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await signUp(fullName, email, password);
      if (result.error) {
        setFormError(result.error);
        return;
      }

      if (result.needsEmailConfirmation) {
        router.replace({
          pathname: '/(auth)/login',
          params: { notice: 'confirm_email' },
        });
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
          <AppText variant="title">Create your account</AppText>
        </View>

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
            label="Full name"
            value={fullName}
            onChangeText={handleFullNameChange}
            error={fieldErrors.fullName}
            editable={!submitting}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />

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
            helperText="At least 8 characters"
            editable={!submitting}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
          />

          <TextField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            error={fieldErrors.confirmPassword}
            editable={!submitting}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          <Button
            title="Create account"
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
          <Link href="/(auth)/login" replace asChild>
            <Pressable
              disabled={submitting}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.linkPressed,
              ]}
            >
              <AppText variant="label" style={styles.linkText}>
                I already have an account
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
  legalNotice: {
    textAlign: 'center',
  },
  inlineLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
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
