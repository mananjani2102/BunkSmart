import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDelayedVisible } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  sectionStack: {
    gap: spacing.lg,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroRightCol: {
    flex: 1,
    gap: spacing.xs,
  },
  heroFooter: {
    gap: spacing.xs,
  },
  heroLinkSlot: {
    minHeight: 44,
    justifyContent: 'center',
  },
  navRowCard: {
    padding: spacing.lg,
  },
  navRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navRowLeft: {
    flex: 1,
    gap: 2,
  },
  todayRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayRightText: {
    alignItems: 'flex-end',
    gap: 2,
  },
  subjectsSection: {
    gap: spacing.md,
  },
  groupedCard: {
    padding: 0,
    overflow: 'hidden',
  },
  overviewSubjectRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 44,
  },
  subjectTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subjectNameCol: {
    flex: 1,
    gap: 2,
  },
  subjectBarWrapper: {
    height: 6,
    justifyContent: 'center',
  },
  todayListSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  todaySummary: {
    gap: spacing.xs + 2,
  },
  todaySummaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  todayCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  todayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  todaySegmentedGap: {
    marginTop: spacing.xs,
  },
  todayHint: {
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  subjectsListWrap: {
    marginTop: spacing.lg,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  subjectRowLeft: {
    flex: 1,
    gap: 2,
  },
  subjectRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  timetableContainer: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  timetableDayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  timetableDayCell: {
    flex: 1,
  },
  timetableSlotGroup: {
    gap: spacing.md,
  },
  timetableSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  timetableTimeCol: {
    minWidth: 84,
    gap: 2,
  },
  detailStack: {
    gap: spacing.lg,
  },
  detailCard: {
    gap: spacing.md,
  },
  detailTopBlock: {
    gap: spacing.xs,
  },
  detailInsightGap: {
    marginTop: spacing.xs,
  },
  detailStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  detailStatCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  detailTargetSection: {
    gap: spacing.xs,
  },
  detailTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  simCard: {
    gap: spacing.lg,
  },
  simSteppersRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  simStepperCol: {
    flex: 1,
    gap: spacing.xs,
  },
  simResultSection: {
    gap: spacing.sm,
  },
  simPresetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  simPresetBtn: {
    flex: 1,
  },
  trendFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  profileGroup: {
    gap: spacing.xl,
  },
  profileSection: {
    gap: spacing.sm,
  },
  profileSectionHeader: {
    marginLeft: spacing.xs,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  profileRowStack: {
    flex: 1,
    gap: 2,
  },
  profileRemindersRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  modalGroup: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
}));

export function OverviewSkeleton({ delayed = true }: { delayed?: boolean }) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading overview"
      style={styles.sectionStack}
    >
      <Card style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Skeleton width={96} height={96} borderRadius={radius.card} />
          <View style={styles.heroRightCol}>
            <Skeleton width="68%" height={24} />
            <Skeleton width="42%" height={18} />
          </View>
        </View>
        <Skeleton width="90%" height={22} />
        <View style={styles.heroFooter}>
          <Skeleton width="84%" height={16} />
          <View style={styles.heroLinkSlot}>
            <Skeleton width={156} height={18} />
          </View>
        </View>
      </Card>

      <Card style={styles.navRowCard}>
        <View style={styles.navRowContent}>
          <View style={styles.navRowLeft}>
            <Skeleton width={64} height={24} />
            <Skeleton width={144} height={16} />
          </View>
          <View style={styles.todayRightGroup}>
            <View style={styles.todayRightText}>
              <Skeleton width={72} height={18} />
              <Skeleton width={56} height={16} />
            </View>
            <Skeleton width={16} height={16} />
          </View>
        </View>
      </Card>

      <Card style={styles.navRowCard}>
        <View style={styles.navRowContent}>
          <Skeleton width={148} height={24} />
          <Skeleton width={16} height={16} />
        </View>
      </Card>

      <View style={styles.subjectsSection}>
        <Skeleton width={88} height={24} />
        <Card style={styles.groupedCard}>
          {[0, 1, 2].map((key, index) => (
            <View key={`overview-skel-${key}`}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.overviewSubjectRow}>
                <View style={styles.subjectTopRow}>
                  <View style={styles.subjectNameCol}>
                    <Skeleton width="58%" height={24} />
                    <Skeleton width="38%" height={16} />
                  </View>
                  <Skeleton width={46} height={24} />
                </View>
                <View style={styles.subjectBarWrapper}>
                  <Skeleton width="100%" height={4} borderRadius={2} />
                </View>
                <Skeleton width="36%" height={16} />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </View>
  );
}

function TodayClassCardSkeleton() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <Card style={styles.todayCard}>
      <Skeleton width="44%" height={16} />
      <View style={styles.todayTitleRow}>
        <Skeleton width="64%" height={24} />
        <Skeleton width={46} height={24} />
      </View>
      <Skeleton width="56%" height={16} />
      <Skeleton
        width="100%"
        height={48}
        borderRadius={radius.control}
        style={styles.todaySegmentedGap}
      />
    </Card>
  );
}

export function TodaySkeleton({
  count = 3,
  includeWrapper = true,
  delayed = true,
}: {
  count?: number;
  includeWrapper?: boolean;
  delayed?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  const cardCount = Math.max(1, Math.min(6, count));

  const content = (
    <>
      <View style={styles.todaySummary}>
        <View style={styles.todaySummaryLabelRow}>
          <Skeleton width={104} height={18} />
          <Skeleton width={120} height={16} />
        </View>
        <Skeleton width="100%" height={4} borderRadius={2} />
      </View>

      {Array.from({ length: cardCount }, (_, index) => (
        <TodayClassCardSkeleton key={`today-skel-${index}`} />
      ))}

      <Skeleton width={210} height={16} style={styles.todayHint} />
    </>
  );

  if (!includeWrapper) {
    return (
      <View
        accessible
        accessibilityLabel="Loading classes"
        style={styles.detailStack}
      >
        {content}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading classes"
      style={styles.todayListSection}
    >
      {content}
    </View>
  );
}

export function SubjectsSkeleton({
  tab,
  delayed = true,
}: {
  tab: 'subjects' | 'timetable';
  delayed?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  if (tab === 'timetable') {
    return (
      <View
        accessible
        accessibilityLabel="Loading timetable"
        style={styles.timetableContainer}
      >
        <View style={styles.timetableDayRow}>
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <View key={`tt-day-skel-${day}`} style={styles.timetableDayCell}>
              <Skeleton
                width="100%"
                height={44}
                borderRadius={radius.control}
              />
            </View>
          ))}
        </View>

        <View style={styles.timetableSlotGroup}>
          <Card style={styles.groupedCard}>
            {[0, 1, 2].map((item) => (
              <View key={`tt-slot-skel-${item}`}>
                {item > 0 ? <Divider /> : null}
                <View style={styles.timetableSlotRow}>
                  <View style={styles.timetableTimeCol}>
                    <Skeleton width={64} height={18} />
                    <Skeleton width={64} height={16} />
                  </View>
                  <Skeleton width="56%" height={22} />
                </View>
              </View>
            ))}
          </Card>

          <Skeleton width="100%" height={44} borderRadius={radius.control} />
        </View>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading subjects"
      style={styles.subjectsListWrap}
    >
      <Card style={styles.groupedCard}>
        {[0, 1, 2, 3].map((item) => (
          <View key={`subject-skel-${item}`}>
            {item > 0 ? <Divider /> : null}
            <View style={styles.subjectRow}>
              <View style={styles.subjectRowLeft}>
                <Skeleton width="55%" height={22} />
                <Skeleton width="72%" height={16} />
              </View>
              <View style={styles.subjectRowRight}>
                <Skeleton width={42} height={18} />
                <Skeleton width={16} height={16} />
              </View>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

export function SubjectLogsSkeleton({ delayed = true }: { delayed?: boolean }) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading attendance history"
      style={styles.detailStack}
    >
      <Card style={styles.detailCard}>
        <Skeleton width={56} height={24} />
        <Skeleton width="100%" height={168} />
        <View style={styles.trendFooterRow}>
          <Skeleton width={72} height={16} />
          <Skeleton width={76} height={16} />
        </View>
      </Card>

      <Card style={styles.detailCard}>
        <Skeleton width={68} height={24} />
        <Skeleton width={104} height={18} />
        <Skeleton width="100%" height={48} borderRadius={radius.control} />
        <Skeleton width="100%" height={48} borderRadius={radius.control} />
      </Card>
    </View>
  );
}

export function SubjectDetailSkeleton({ delayed = true }: { delayed?: boolean }) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading subject details"
      style={styles.detailStack}
    >
      <Card style={styles.detailCard}>
        <View style={styles.detailTopBlock}>
          <Skeleton width={116} height={48} />
          <Skeleton width={128} height={22} />
          <Skeleton width="90%" height={22} style={styles.detailInsightGap} />
        </View>

        <Divider />

        <View style={styles.detailStatsRow}>
          <View style={styles.detailStatCol}>
            <Skeleton width={32} height={24} />
            <Skeleton width={56} height={16} />
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.detailStatCol}>
            <Skeleton width={32} height={24} />
            <Skeleton width={40} height={16} />
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.detailStatCol}>
            <Skeleton width={32} height={24} />
            <Skeleton width={62} height={16} />
          </View>
        </View>

        <Divider />

        <View style={styles.detailTargetSection}>
          <View style={styles.detailTargetRow}>
            <Skeleton width={88} height={22} />
            <Skeleton width={54} height={18} />
          </View>
          <Skeleton width="76%" height={16} />
        </View>
      </Card>

      <Card style={styles.simCard}>
        <Skeleton width={140} height={24} />
        <View style={styles.simSteppersRow}>
          <View style={styles.simStepperCol}>
            <Skeleton width="82%" height={18} />
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
          <View style={styles.simStepperCol}>
            <Skeleton width="82%" height={18} />
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
        </View>
        <Divider />
        <View style={styles.simResultSection}>
          <Skeleton width={68} height={24} />
          <Skeleton width="86%" height={22} />
          <Skeleton width="100%" height={8} borderRadius={2} />
        </View>
        <View style={styles.simPresetsRow}>
          <View style={styles.simPresetBtn}>
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
          <View style={styles.simPresetBtn}>
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
        </View>
      </Card>

      <SubjectLogsSkeleton delayed={false} />
    </View>
  );
}

export function ProfileSkeleton({ delayed = true }: { delayed?: boolean }) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading profile"
      style={styles.profileGroup}
    >
      <View style={styles.profileSection}>
        <Skeleton width={60} height={16} style={styles.profileSectionHeader} />
        <Card style={styles.groupedCard}>
          <View style={styles.profileRow}>
            <Skeleton width={48} height={22} />
            <Skeleton width={112} height={16} />
          </View>
          <Divider />
          <View style={styles.profileRow}>
            <Skeleton width={44} height={22} />
            <Skeleton width={152} height={16} />
          </View>
        </Card>
      </View>

      <View style={styles.profileSection}>
        <Skeleton width={76} height={16} style={styles.profileSectionHeader} />
        <Card style={styles.groupedCard}>
          <View style={styles.profileRow}>
            <Skeleton width={104} height={22} />
            <Skeleton width={40} height={16} />
          </View>
          <Divider />
          <View style={styles.profileRow}>
            <View style={styles.profileRowStack}>
              <Skeleton width={136} height={22} />
              <Skeleton width={92} height={16} />
            </View>
            <Skeleton width={16} height={16} />
          </View>
        </Card>
      </View>

      <View style={styles.profileSection}>
        <Skeleton width={72} height={16} style={styles.profileSectionHeader} />
        <Card style={styles.groupedCard}>
          <View style={styles.profileRow}>
            <Skeleton width={118} height={22} />
            <Skeleton width={44} height={24} borderRadius={radius.control} />
          </View>
          <Divider />
          <View style={styles.profileRemindersRow}>
            <Skeleton width={124} height={16} />
            <Skeleton width="100%" height={48} borderRadius={radius.control} />
          </View>
        </Card>
      </View>

      <View style={styles.profileSection}>
        <Skeleton width={80} height={16} style={styles.profileSectionHeader} />
        <Skeleton width="100%" height={48} borderRadius={radius.control} />
      </View>

      <View style={styles.profileSection}>
        <Skeleton width={46} height={16} style={styles.profileSectionHeader} />
        <Card style={styles.groupedCard}>
          <View style={styles.profileRow}>
            <Skeleton width={104} height={22} />
            <Skeleton width={16} height={16} />
          </View>
          <Divider />
          <View style={styles.profileRow}>
            <Skeleton width={148} height={22} />
            <Skeleton width={16} height={16} />
          </View>
          <Divider />
          <View style={styles.profileRow}>
            <Skeleton width={84} height={22} />
            <Skeleton width={38} height={16} />
          </View>
        </Card>
      </View>

      <View style={styles.profileSection}>
        <Skeleton width={36} height={16} style={styles.profileSectionHeader} />
        <Card style={styles.groupedCard}>
          <View style={styles.profileRow}>
            <Skeleton width={164} height={22} />
          </View>
        </Card>
      </View>

      <Skeleton width="100%" height={44} borderRadius={radius.control} />
    </View>
  );
}

export function ModalFieldSkeleton({
  rows = 3,
  delayed = true,
}: {
  rows?: number;
  delayed?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.modalGroup}>
      <Skeleton width="45%" height={18} />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={`modal-skel-${index}`}
          width="100%"
          height={44}
          borderRadius={radius.control}
        />
      ))}
    </View>
  );
}

export function SimulatorSkeleton({ delayed = true }: { delayed?: boolean }) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visible = useDelayedVisible(true, delayed ? undefined : 0);

  if (!visible) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel="Loading simulator"
      style={styles.modalGroup}
    >
      <Skeleton width={80} height={18} />
      <View style={styles.chipRow}>
        <Skeleton width={104} height={44} borderRadius={radius.control} />
        <Skeleton width={120} height={44} borderRadius={radius.control} />
      </View>
      <Card style={styles.simCard}>
        <Skeleton width={140} height={24} />
        <View style={styles.simSteppersRow}>
          <View style={styles.simStepperCol}>
            <Skeleton width="82%" height={18} />
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
          <View style={styles.simStepperCol}>
            <Skeleton width="82%" height={18} />
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
        </View>
        <Divider />
        <View style={styles.simResultSection}>
          <Skeleton width={68} height={24} />
          <Skeleton width="86%" height={22} />
          <Skeleton width="100%" height={8} borderRadius={2} />
        </View>
        <View style={styles.simPresetsRow}>
          <View style={styles.simPresetBtn}>
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
          <View style={styles.simPresetBtn}>
            <Skeleton width="100%" height={44} borderRadius={radius.control} />
          </View>
        </View>
      </Card>
    </View>
  );
}
