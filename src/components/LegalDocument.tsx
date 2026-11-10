import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { type LegalDocumentContent } from '@/constants/legal';
import { spacing } from '@/theme/tokens';

const LEGAL_EDGES = ['bottom', 'left', 'right'] as const;

export interface LegalDocumentProps {
  document: LegalDocumentContent;
}

export function LegalDocument({ document }: LegalDocumentProps) {
  return (
    <Screen scroll edges={LEGAL_EDGES} contentContainerStyle={styles.content}>
      <AppText variant="caption" tone="muted">
        Last updated: {document.lastUpdated}
      </AppText>

      {document.sections.map((section) => (
        <Card key={section.heading} style={styles.sectionCard}>
          <AppText variant="heading">{section.heading}</AppText>
          <View style={styles.paragraphs}>
            {section.paragraphs.map((paragraph, index) => (
              <AppText key={`${section.heading}-${index}`} variant="body">
                {paragraph}
              </AppText>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  paragraphs: {
    gap: spacing.sm,
  },
});
