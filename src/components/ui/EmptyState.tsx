import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button, type IoniconName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing } from '@/theme/tokens';

export interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
  style,
}: EmptyStateProps) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.content}>
        {icon ? (
          <Ionicons
            name={icon}
            size={28}
            color={colors.textMuted}
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
