import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeView } from '@/components/ui/FadeView';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/context/DataProvider';
import {
  canSkip,
  clampTarget,
  formatDisplayPercent,
  getAttendanceLevel,
  getAttendanceRatio,
  levelToTone,
  meetsTarget,
  mustAttend,
  pluralizeClasses,
} from '@/lib/attendance';
import {
  formatTime12Hour,
  getIsoWeekday,
  getTodayDateString,
  LONG_WEEKDAYS,
  SHORT_WEEKDAYS,
  timeStringToMinutes,
} from '@/lib/dates';
import { colors, radius, spacing } from '@/theme/tokens';
import { type Subject } from '@/types/db';

type SubjectsTab = 'subjects' | 'timetable';

const TAB_OPTIONS: readonly SegmentedOption<SubjectsTab>[] = [
  { label: 'All Subjects', value: 'subjects' },
  { label: 'Weekly Timetable', value: 'timetable' },
];

function getSubjectInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return 'SB';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function formatSlotDuration(startStr: string, endStr: string | null): string | null {
  if (!endStr) return null;
  try {
    const startMins = timeStringToMinutes(startStr);
    const endMins = timeStringToMinutes(endStr);
    const diff = endMins - startMins;
    if (diff <= 0) return null;
    if (diff >= 60) {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${diff}m`;
  } catch {
    return null;
  }
}

export default function SubjectsScreen() {
  const { status, error, subjects, slots, statsBySubject, reload } = useData();
  const [activeTab, setActiveTab] = useState<SubjectsTab>('subjects');
  const [selectedWeekday, setSelectedWeekday] = useState<number>(() =>
    getIsoWeekday(getTodayDateString())
  );
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const todayWeekday = useMemo(() => getIsoWeekday(getTodayDateString()), []);

  const slotCountBySubject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of slots) {
      counts[slot.subject_id] = (counts[slot.subject_id] ?? 0) + 1;
    }
    return counts;
  }, [slots]);

  const subjectById = useMemo(() => {
    const map: Record<string, Subject> = {};
    for (const subject of subjects) {
      map[subject.id] = subject;
    }
    return map;
  }, [subjects]);

  const daySlots = useMemo(() => {
    return slots
      .filter((slot) => slot.weekday === selectedWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slots, selectedWeekday]);

  const slotsCountByWeekday = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 7; i++) {
      counts[i] = 0;
    }
    for (const slot of slots) {
      counts[slot.weekday] = (counts[slot.weekday] ?? 0) + 1;
    }
    return counts;
  }, [slots]);

  const handleRefresh = async () => {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await reload(true);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  };

  const openNewSubject = () => {
    router.push('/subject-form');
  };

  const openSubjectDetail = (subjectId: string) => {
    router.push(`/subject/${encodeURIComponent(subjectId)}`);
  };

  const openNewSlot = () => {
    router.push(`/slot-form?weekday=${selectedWeekday}`);
  };

  const openEditSlot = (slotId: string) => {
    router.push(`/slot-form?id=${encodeURIComponent(slotId)}`);
  };

  const selectedWeekdayName = LONG_WEEKDAYS[selectedWeekday - 1];

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Top Header: Title, Summary & Primary Creation Button */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <AppText variant="title">Subjects & Timetable</AppText>
            <AppText variant="caption" tone="muted">
              {activeTab === 'subjects'
                ? `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} enrolled`
                : `${slots.length} ${pluralizeClasses(slots.length)} scheduled weekly`}
            </AppText>
          </View>

          {subjects.length > 0 && (
            <Button
              title={activeTab === 'subjects' ? 'Add Subject' : 'Add Class'}
              icon="add"
              variant="primary"
              onPress={activeTab === 'subjects' ? openNewSubject : openNewSlot}
              style={styles.headerActionBtn}
            />
          )}
        </View>

        {/* Top Tab Switcher */}
        <Segmented
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
          style={styles.topSegmented}
        />

        {status === 'loading' ? (
          <View
            accessible
            accessibilityLabel={
              activeTab === 'subjects'
                ? 'Loading subjects'
                : 'Loading timetable'
            }
            style={styles.loadingSection}
          >
            {activeTab === 'timetable' ? (
              <>
                <View style={styles.weekdaySkeletonRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton
                      key={`day-skeleton-${i}`}
                      width={44}
                      height={48}
                      borderRadius={radius.control}
                    />
                  ))}
                </View>
                {[0, 1, 2].map((item) => (
                  <Card key={`timetable-skeleton-${item}`} style={styles.skeletonCard}>
                    <View style={styles.skeletonTimelineRow}>
                      <Skeleton width={70} height={36} borderRadius={6} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="60%" height={20} />
                        <Skeleton width="40%" height={14} />
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            ) : (
              [0, 1, 2].map((item) => (
                <Card key={`subject-list-skeleton-${item}`} style={styles.skeletonCard}>
                  <View style={styles.skeletonSubjectRow}>
                    <Skeleton width={44} height={44} borderRadius={22} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="60%" height={20} />
                      <Skeleton width="35%" height={14} />
                    </View>
                    <Skeleton width={60} height={24} borderRadius={6} />
                  </View>
                  <Skeleton width="100%" height={6} borderRadius={3} style={{ marginTop: 12 }} />
                </Card>
              ))
            )}
          </View>
        ) : status === 'error' ? (
          <ErrorState
            message={error ?? 'Something went wrong. Try again.'}
            onRetry={() => {
              void reload();
            }}
            style={styles.stateCard}
          />
        ) : (
          <FadeView transitionKey={activeTab}>
            {activeTab === 'subjects' ? (
              subjects.length === 0 ? (
                <EmptyState
                  icon="book-outline"
                  title="No subjects tracked yet"
                  message="Add the subjects you attend this semester. You can customize the target attendance percentage for each course."
                  actionLabel="Add your first subject"
                  onAction={openNewSubject}
                  style={styles.stateCard}
                />
              ) : (
                <View style={styles.subjectsList}>
                  {subjects.map((subject) => {
                    const count = slotCountBySubject[subject.id] ?? 0;
                    const stats = statsBySubject[subject.id];
                    const attended = stats?.attended ?? subject.initial_present;
                    const held = stats?.conducted ?? subject.initial_total;
                    const target = clampTarget(subject.target_percent);
                    const level = getAttendanceLevel(attended, held, target);
                    const tone = levelToTone(level);
                    const ratio = getAttendanceRatio(attended, held);
                    const displayPercent = formatDisplayPercent(attended, held);
                    const canBunk = canSkip(attended, held, target);
                    const needed = mustAttend(attended, held, target);

                    let badgeText = 'No data';
                    if (held > 0) {
                      if (!meetsTarget(attended, held, target)) {
                        badgeText = `Need ${needed} ${needed === 1 ? 'class' : 'classes'}`;
                      } else if (canBunk === 0) {
                        badgeText = 'On margin';
                      } else {
                        badgeText = `Can bunk ${canBunk}`;
                      }
                    }

                    const isSafe = tone === 'safe';
                    const isBelow = tone === 'danger';
                    const isWarn = tone === 'warn';

                    const avatarBg = isSafe
                      ? colors.safeBg
                      : isBelow
                        ? colors.dangerBg
                        : isWarn
                          ? colors.warnBg
                          : colors.surfaceMuted;

                    const avatarColor = isSafe
                      ? colors.safe
                      : isBelow
                        ? colors.danger
                        : isWarn
                          ? colors.warn
                          : colors.textMuted;

                    return (
                      <Card
                        key={subject.id}
                        onPress={() => openSubjectDetail(subject.id)}
                        accessibilityLabel={`${subject.name}, Target ${subject.target_percent}%, ${count} ${pluralizeClasses(count)} per week, Attendance ${displayPercent}`}
                        style={styles.subjectCard}
                      >
                        <View style={styles.subjectTopRow}>
                          {/* Subject Initials Avatar */}
                          <View
                            style={[
                              styles.subjectAvatar,
                              { backgroundColor: avatarBg },
                            ]}
                          >
                            <AppText
                              variant="label"
                              style={[
                                styles.subjectAvatarText,
                                { color: avatarColor },
                              ]}
                            >
                              {getSubjectInitials(subject.name)}
                            </AppText>
                          </View>

                          {/* Subject Info */}
                          <View style={styles.subjectInfoCol}>
                            <AppText
                              variant="heading"
                              numberOfLines={1}
                              style={styles.subjectName}
                            >
                              {subject.name}
                            </AppText>
                            <View style={styles.subjectMetaPills}>
                              <View style={styles.metaChip}>
                                <Ionicons
                                  name="flag-outline"
                                  size={11}
                                  color={colors.textMuted}
                                />
                                <AppText
                                  variant="caption"
                                  tone="muted"
                                  style={styles.metaChipText}
                                >
                                  Target {subject.target_percent}%
                                </AppText>
                              </View>
                              <View style={styles.metaChip}>
                                <Ionicons
                                  name="calendar-outline"
                                  size={11}
                                  color={colors.textMuted}
                                />
                                <AppText
                                  variant="caption"
                                  tone="muted"
                                  style={styles.metaChipText}
                                >
                                  {count} {count === 1 ? 'class/wk' : 'classes/wk'}
                                </AppText>
                              </View>
                            </View>
                          </View>

                          {/* Stat & Action Pill */}
                          <View style={styles.subjectStatCol}>
                            <AppText
                              variant="heading"
                              style={[
                                styles.subjectPercent,
                                { color: avatarColor },
                              ]}
                            >
                              {displayPercent}
                            </AppText>
                            <View
                              style={[
                                styles.actionPill,
                                { backgroundColor: avatarBg },
                              ]}
                            >
                              <AppText
                                variant="caption"
                                style={[
                                  styles.actionPillText,
                                  { color: avatarColor },
                                ]}
                              >
                                {badgeText}
                              </AppText>
                            </View>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.textMuted}
                            style={styles.subjectChevron}
                          />
                        </View>

                        {/* Benchmark Progress Bar with Target Pin */}
                        {held > 0 && (
                          <View style={styles.progressBarWrapper}>
                            <View style={styles.progressBarTrack}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  {
                                    width: `${Math.min(100, Math.max(0, ratio ?? 0))}%`,
                                    backgroundColor: avatarColor,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.targetPin,
                                  { left: `${target}%` },
                                ]}
                              />
                            </View>
                            <View style={styles.progressLabelsRow}>
                              <AppText
                                variant="caption"
                                tone="muted"
                                style={styles.progressFraction}
                              >
                                {attended} of {held} recorded
                              </AppText>
                              <AppText
                                variant="caption"
                                tone="muted"
                                style={styles.progressFraction}
                              >
                                Goal: {target}%
                              </AppText>
                            </View>
                          </View>
                        )}
                      </Card>
                    );
                  })}
                </View>
              )
            ) : subjects.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No subjects available"
                message="Add at least one subject before scheduling your weekly timetable slots."
                actionLabel="Add Subject"
                onAction={openNewSubject}
                style={styles.stateCard}
              />
            ) : (
              <View style={styles.timetableSection}>
                {/* Modern Day Selector Bar */}
                <View style={styles.daySelectorContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.daySelectorScroll}
                  >
                    {SHORT_WEEKDAYS.map((dayLabel, index) => {
                      const dayNumber = index + 1;
                      const isSelected = selectedWeekday === dayNumber;
                      const isToday = todayWeekday === dayNumber;
                      const slotCount = slotsCountByWeekday[dayNumber] ?? 0;

                      return (
                        <PressableScale
                          key={`day-btn-${dayNumber}`}
                          onPress={() => setSelectedWeekday(dayNumber)}
                          style={[
                            styles.dayChip,
                            isSelected && styles.dayChipSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${LONG_WEEKDAYS[index]}, ${slotCount} classes${isToday ? ', Today' : ''}`}
                        >
                          <AppText
                            variant="label"
                            style={[
                              styles.dayChipLabel,
                              isSelected && styles.dayChipLabelSelected,
                            ]}
                          >
                            {dayLabel}
                          </AppText>

                          <View style={styles.dayChipBadgeRow}>
                            {isToday && (
                              <View
                                style={[
                                  styles.todayDot,
                                  isSelected && styles.todayDotSelected,
                                ]}
                              />
                            )}
                            <AppText
                              variant="caption"
                              style={[
                                styles.dayChipSlotCount,
                                isSelected && styles.dayChipSlotCountSelected,
                              ]}
                            >
                              {slotCount}
                            </AppText>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Day Summary Heading */}
                <View style={styles.dayHeaderRow}>
                  <View style={styles.dayHeadingGroup}>
                    <AppText variant="heading">
                      {selectedWeekdayName}
                      {selectedWeekday === todayWeekday ? ' (Today)' : ''}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {daySlots.length === 0
                        ? 'No classes scheduled'
                        : `${daySlots.length} ${pluralizeClasses(daySlots.length)}`}
                    </AppText>
                  </View>

                  <PressableScale
                    onPress={openNewSlot}
                    style={styles.inlineAddClassBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Add class on ${selectedWeekdayName}`}
                  >
                    <Ionicons name="add" size={16} color={colors.accent} />
                    <AppText variant="label" style={styles.inlineAddClassText}>
                      Add Class
                    </AppText>
                  </PressableScale>
                </View>

                {/* Day Classes Timeline List */}
                <FadeView transitionKey={selectedWeekday}>
                  {daySlots.length === 0 ? (
                    <EmptyState
                      icon="calendar-outline"
                      title="No classes scheduled"
                      message={`No classes on ${selectedWeekdayName}. Enjoy your free time or add a slot.`}
                      actionLabel={`Add class on ${selectedWeekdayName}`}
                      onAction={openNewSlot}
                      style={styles.stateCard}
                    />
                  ) : (
                    <View style={styles.timelineList}>
                      {daySlots.map((slot) => {
                        const subject = subjectById[slot.subject_id];
                        const subjectName = subject?.name ?? 'Subject';
                        const startTime = formatTime12Hour(slot.start_time);
                        const endTime = slot.end_time
                          ? formatTime12Hour(slot.end_time)
                          : null;
                        const duration = formatSlotDuration(
                          slot.start_time,
                          slot.end_time
                        );

                        return (
                          <Card
                            key={slot.id}
                            onPress={() => openEditSlot(slot.id)}
                            accessibilityLabel={`${subjectName}, ${startTime}${endTime ? ` to ${endTime}` : ''}`}
                            style={styles.slotTimelineCard}
                          >
                            <View style={styles.slotTimelineRow}>
                              {/* Left Time Block */}
                              <View style={styles.timeBlock}>
                                <AppText variant="label" style={styles.timeStartText}>
                                  {startTime}
                                </AppText>
                                {endTime && (
                                  <AppText
                                    variant="caption"
                                    tone="muted"
                                    style={styles.timeEndText}
                                  >
                                    {endTime}
                                  </AppText>
                                )}
                                {duration && (
                                  <View style={styles.durationPill}>
                                    <AppText
                                      variant="caption"
                                      style={styles.durationText}
                                    >
                                      {duration}
                                    </AppText>
                                  </View>
                                )}
                              </View>

                              {/* Vertical Timeline Divider */}
                              <View style={styles.timelineDivider} />

                              {/* Right Subject Info */}
                              <View style={styles.slotDetailCol}>
                                <AppText
                                  variant="heading"
                                  numberOfLines={2}
                                  style={styles.slotSubjectTitle}
                                >
                                  {subjectName}
                                </AppText>
                                <View style={styles.slotMetaRow}>
                                  {subject && (
                                    <View style={styles.slotTargetBadge}>
                                      <AppText
                                        variant="caption"
                                        tone="muted"
                                        style={styles.slotTargetText}
                                      >
                                        Goal: {subject.target_percent}%
                                      </AppText>
                                    </View>
                                  )}
                                  <AppText
                                    variant="caption"
                                    tone="muted"
                                    style={styles.slotTapHint}
                                  >
                                    Tap to edit
                                  </AppText>
                                </View>
                              </View>

                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={colors.textMuted}
                              />
                            </View>
                          </Card>
                        );
                      })}
                    </View>
                  )}
                </FadeView>
              </View>
            )}
          </FadeView>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  headerActionBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  topSegmented: {
    marginTop: spacing.lg,
  },
  stateCard: {
    marginTop: spacing.lg,
  },
  loadingSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  skeletonCard: {
    padding: spacing.md,
  },
  skeletonSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weekdaySkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  /* Subjects Tab */
  subjectsList: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  subjectCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  subjectTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subjectAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectAvatarText: {
    fontWeight: '700',
    fontSize: 15,
  },
  subjectInfoCol: {
    flex: 1,
    gap: 4,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
  },
  subjectMetaPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  subjectStatCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  subjectPercent: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionPillText: {
    fontWeight: '600',
    fontSize: 11,
  },
  subjectChevron: {
    marginLeft: 2,
  },
  progressBarWrapper: {
    gap: 4,
    paddingTop: 4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  targetPin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.text,
    marginLeft: -1,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressFraction: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  /* Timetable Tab */
  timetableSection: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  daySelectorContainer: {
    marginHorizontal: -spacing.lg,
  },
  daySelectorScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs + 2,
  },
  dayChip: {
    minWidth: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayChipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dayChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  dayChipLabelSelected: {
    color: colors.surface,
  },
  dayChipBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  todayDotSelected: {
    backgroundColor: colors.surface,
  },
  dayChipSlotCount: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dayChipSlotCountSelected: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayHeadingGroup: {
    gap: 2,
  },
  inlineAddClassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.control,
  },
  inlineAddClassText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  timelineList: {
    gap: spacing.md,
  },
  slotTimelineCard: {
    padding: spacing.md,
  },
  slotTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timeBlock: {
    minWidth: 72,
    alignItems: 'flex-start',
    gap: 2,
  },
  timeStartText: {
    fontWeight: '700',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  timeEndText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  durationPill: {
    marginTop: 2,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  timelineDivider: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: colors.accentSoft,
    borderRadius: 1,
  },
  slotDetailCol: {
    flex: 1,
    gap: 4,
  },
  slotSubjectTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slotTargetBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  slotTargetText: {
    fontSize: 11,
    fontWeight: '500',
  },
  slotTapHint: {
    fontSize: 11,
  },
});
