import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import {
  AUTHOR_NAME,
  CONTACT_EMAIL,
  type LegalDocumentContent,
} from '@/constants/legal';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

const LEGAL_EDGES = ['bottom', 'left', 'right'] as const;

export interface LegalDocumentProps {
  document: LegalDocumentContent;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 24,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  heroCard: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  groupSection: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontFamily: fontFamily.medium,
    paddingHorizontal: spacing.xs,
  },
  highlightsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  highlightIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextCol: {
    flex: 1,
    gap: 2,
  },
  highlightTitle: {
    fontFamily: fontFamily.semibold,
  },
  sectionsList: {
    gap: spacing.md,
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  sectionIconBox: {
    width: 30,
    height: 30,
    borderRadius: radius.small,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
  },
  paragraphs: {
    gap: spacing.sm + 2,
  },
  paragraphText: {
    lineHeight: 22,
  },
  bulletList: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    paddingLeft: spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: radius.dot,
    backgroundColor: colors.foreground,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    lineHeight: 22,
  },
  footerCard: {
    gap: spacing.md,
  },
  emailRowContainer: {
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  emailRowPressed: {
    backgroundColor: colors.secondary,
  },
  emailIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.small,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailTextCol: {
    flex: 1,
    gap: 1,
  },
  emailAddress: {
    fontFamily: fontFamily.medium,
  },
  footerNote: {
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
}));

export function LegalDocument({ document }: LegalDocumentProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const [contactError, setContactError] = useState<string | null>(null);

  const handleOpenEmail = () => {
    setContactError(null);
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      `BunkSmart - ${document.title}`
    )}`;

    if (typeof Linking?.openURL !== 'function') {
      setContactError(`Send an email to ${CONTACT_EMAIL}.`);
      return;
    }

    try {
      void Promise.resolve(Linking.openURL(mailtoUrl)).catch(() => {
        setContactError(`Send an email to ${CONTACT_EMAIL}.`);
      });
    } catch {
      setContactError(`Send an email to ${CONTACT_EMAIL}.`);
    }
  };

  return (
    <Screen scroll edges={LEGAL_EDGES} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        {/* Hero Overview Card */}
        <Card style={styles.heroCard}>
          <Badge label={document.badge} tone="neutral" />

          <AppText variant="title">{document.title}</AppText>
          <AppText variant="body" tone="muted">
            {document.subtitle}
          </AppText>

          <Divider />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={colors.mutedForeground}
              />
              <AppText variant="caption" tone="muted">
                Last updated: {document.lastUpdated}
              </AppText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons
                name="person-outline"
                size={14}
                color={colors.mutedForeground}
              />
              <AppText variant="caption" tone="muted">
                Developer: {AUTHOR_NAME}
              </AppText>
            </View>
          </View>
        </Card>

        {/* Key Points Summary */}
        <View style={styles.groupSection}>
          <AppText variant="caption" tone="muted" style={styles.groupLabel}>
            At a glance
          </AppText>
          <Card style={styles.highlightsCard}>
            {document.highlights.map((item, index) => (
              <View key={item.label}>
                {index > 0 ? (
                  <Divider insetLeft={spacing.lg + 36 + spacing.md} />
                ) : null}
                <View style={styles.highlightRow}>
                  <View style={styles.highlightIconBox}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={colors.foreground}
                    />
                  </View>
                  <View style={styles.highlightTextCol}>
                    <AppText variant="label" style={styles.highlightTitle}>
                      {item.label}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {item.detail}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* Policy / Terms Sections */}
        <View style={styles.groupSection}>
          <AppText variant="caption" tone="muted" style={styles.groupLabel}>
            Full terms
          </AppText>
          <View style={styles.sectionsList}>
            {document.sections.map((section) => (
              <Card key={section.heading} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons
                      name={section.icon}
                      size={16}
                      color={colors.foreground}
                    />
                  </View>
                  <AppText variant="heading" style={styles.sectionTitle}>
                    {section.heading}
                  </AppText>
                </View>

                <View style={styles.paragraphs}>
                  {section.paragraphs.map((paragraph, index) => (
                    <AppText
                      key={`${section.heading}-p-${index}`}
                      variant="body"
                      style={styles.paragraphText}
                    >
                      {paragraph}
                    </AppText>
                  ))}

                  {section.bullets && section.bullets.length > 0 ? (
                    <View style={styles.bulletList}>
                      {section.bullets.map((bullet, index) => (
                        <View
                          key={`${section.heading}-b-${index}`}
                          style={styles.bulletRow}
                        >
                          <View style={styles.bulletDot} />
                          <AppText
                            variant="body"
                            style={styles.bulletText}
                          >
                            {bullet}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Contact & Related Document Footer */}
        <Card style={styles.footerCard}>
          <AppText variant="heading">Questions or requests</AppText>
          <AppText variant="caption" tone="muted">
            Reach out directly by email for privacy questions, account deletion,
            or legal inquiries.
          </AppText>

          <PressableScale
            onPress={handleOpenEmail}
            scaleTo={0.985}
            rippleColor={colors.rippleNeutral}
            accessibilityRole="link"
            accessibilityLabel={`Email ${CONTACT_EMAIL}`}
            containerStyle={styles.emailRowContainer}
            style={({ pressed }) => [
              styles.emailRow,
              pressed && styles.emailRowPressed,
            ]}
          >
            <View style={styles.emailIconBox}>
              <Ionicons name="mail-outline" size={18} color={colors.blue} />
            </View>
            <View style={styles.emailTextCol}>
              <AppText variant="label" tone="info" style={styles.emailAddress}>
                {CONTACT_EMAIL}
              </AppText>
              <AppText variant="caption" tone="muted">
                Tap to open your mail app
              </AppText>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.blue} />
          </PressableScale>

          {contactError ? (
            <AppText variant="caption" tone="muted" accessibilityRole="text">
              {contactError}
            </AppText>
          ) : null}

          <Button
            title={document.alternateLabel}
            variant="secondary"
            icon="swap-horizontal-outline"
            fullWidth
            onPress={() => router.replace(document.alternateHref)}
          />

          <AppText variant="caption" tone="muted" style={styles.footerNote}>
            {document.footerNote}
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}
