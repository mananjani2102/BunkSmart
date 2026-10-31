import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing } from '@/theme/tokens';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  title = 'Could not load data',
  message,
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.content} accessibilityRole="alert">
        <Ionicons
          name="alert-circle-outline"
          size={28}
          color={colors.danger}
          style={styles.icon}
        />

        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>

        <AppText variant="body" tone="muted" style={styles.message}>
          {message}
        </AppText>

        <Button
          title="Try again"
          variant="secondary"
          onPress={onRetry}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
});
