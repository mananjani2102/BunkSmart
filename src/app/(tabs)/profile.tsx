import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Stepper } from '@/components/ui/Stepper';
import { useAuth } from '@/context/AuthProvider';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';

const TARGET_PRESETS = [75, 80, 85] as const;

function getUserInitials(name: string, email: string): string {
  const clean = name.trim();
  if (clean && clean !== 'Not set') {
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }
  return (email.slice(0, 2) || 'ST').toUpperCase();
}

export default function ProfileScreen() {
  const { user, profile, signOut, updateProfile } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signingOutRef = useRef(false);
  const savingTargetRef = useRef(false);

  const metadataName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : '';
  const displayName = profile?.full_name.trim() || metadataName || 'Student';
  const displayEmail = user?.email ?? 'Account Email';
  const initials = getUserInitials(displayName, displayEmail);
  const currentTarget = pendingTarget ?? profile?.default_target ?? 75;
  const actionBusy = signingOut || savingTarget;

  const handleDefaultTargetChange = async (nextTarget: number) => {
    if (
      savingTargetRef.current ||
      signingOutRef.current ||
      !profile ||
      nextTarget === profile.default_target
    ) {
      return;
    }

    savingTargetRef.current = true;
    setSavingTarget(true);
    setPendingTarget(nextTarget);
    setErrorMessage(null);

    try {
      await updateProfile({ default_target: nextTarget });
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Update default target failed:', err);
      }
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      savingTargetRef.current = false;
      setSavingTarget(false);
      setPendingTarget(null);
    }
  };

  const handleSignOut = async () => {
    if (signingOutRef.current) {
      return;
    }

    signingOutRef.current = true;
    setSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.titleGroup}>
          <AppText variant="title">Profile</AppText>
          <AppText variant="caption" tone="muted">
            Manage your account and default attendance targets
          </AppText>
        </View>

        <View style={styles.contentGroup}>
          <Card style={styles.identityCard}>
            <View style={styles.identityRow}>
              <View style={styles.avatarCircle}>
                <AppText variant="heading" style={styles.avatarInitials}>
                  {initials}
                </AppText>
              </View>
              <View style={styles.identityTextGroup}>
                <AppText variant="heading" numberOfLines={1} style={styles.userName}>
                  {displayName}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.userEmail}>
                  {displayEmail}
                </AppText>
              </View>
            </View>
          </Card>

          <View style={styles.section}>
            <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
              ACADEMIC GOALS
            </AppText>

            <Card style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="speedometer-outline"
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.cardHeaderInfo}>
                  <AppText variant="label" style={styles.cardHeaderTitle}>
                    Default Attendance Target
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    Applied automatically when adding new subjects
                  </AppText>
                </View>
              </View>

              <View style={styles.stepperContainer}>
                <Stepper
                  label="Target Percentage"
                  value={currentTarget}
                  min={50}
                  max={95}
                  step={1}
                  suffix="%"
                  disabled={!profile || actionBusy}
                  onChange={(nextValue) => {
                    void handleDefaultTargetChange(nextValue);
                  }}
                />
              </View>

              <View style={styles.presetsRow}>
                <AppText variant="caption" tone="muted" style={styles.presetsLabel}>
                  Standard Presets:
                </AppText>
                <View style={styles.presetChips}>
                  {TARGET_PRESETS.map((preset) => {
                    const isSelected = currentTarget === preset;
                    return (
                      <PressableScale
                        key={`preset-${preset}`}
                        onPress={() => {
                          void handleDefaultTargetChange(preset);
                        }}
                        disabled={!profile || actionBusy}
                        style={[
                          styles.presetChip,
                          isSelected && styles.presetChipActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Set target to ${preset} percent`}
                      >
                        <AppText
                          variant="caption"
                          style={[
                            styles.presetChipText,
                            isSelected && styles.presetChipTextActive,
                          ]}
                        >
                          {preset}%{preset === 75 ? ' (Recommended)' : ''}
                        </AppText>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            </Card>
          </View>

          <Button
            title="Sign out of account"
            variant="secondary"
            icon="log-out-outline"
            fullWidth
            loading={signingOut}
            disabled={actionBusy}
            onPress={() => {
              void handleSignOut();
            }}
          />

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.danger}
                style={styles.errorIcon}
              />
              <AppText variant="caption" tone="danger" style={styles.errorText}>
                {errorMessage}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl + 40,
  },
  container: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  titleGroup: {
    gap: 4,
  },
  skeletonSection: {
    gap: spacing.lg,
  },
  contentGroup: {
    gap: spacing.xl,
  },

  /* Identity Card */
  identityCard: {
    padding: spacing.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
  identityTextGroup: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 13,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.safeBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.safe,
  },
  statusPillText: {
    color: colors.safe,
    fontWeight: '600',
    fontSize: 11,
  },

  /* Section Styles */
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  sectionCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  savingBadge: {
    alignSelf: 'flex-start',
  },
  savingText: {
    fontSize: 12,
  },
  stepperContainer: {
    paddingTop: spacing.xs,
  },
  presetsRow: {
    gap: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  presetsLabel: {
    fontSize: 12,
  },
  presetChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  presetChipActive: {
    backgroundColor: colors.accent,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  presetChipTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },

  /* Grouped Menu Card */
  groupedCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  menuRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  menuStaticTextCol: {
    flex: 1,
    gap: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + 32 + spacing.md,
  },
  versionBadge: {
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },

  /* Danger Zone */
  dangerZoneCard: {
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  dangerActionBtn: {
    marginTop: spacing.xs,
  },
  signOutBtn: {
    marginTop: spacing.sm,
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
  },
});
