import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button, type IoniconName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard empty state card with one muted outline icon, short title, one
 * sentence, and at most one primary action.
 */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.content}>
        {icon ? (
          <Ionicons
            name={icon}
            size={32}
            color={colors.mutedForeground}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={styles.icon}
          />
        ) : null}

        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>

        <AppText variant="body" tone="muted" style={styles.message}>
          {message}
        </AppText>

        {actionLabel && onAction ? (
          <Button
            title={actionLabel}
            onPress={onAction}
            style={styles.action}
          />
        ) : null}
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
