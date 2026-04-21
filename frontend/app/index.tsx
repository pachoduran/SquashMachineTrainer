import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../src/context';
import { COLORS, POD_COLORS } from '../src/theme';

const POD_LABELS: Record<number, string> = { 1: 'Pod 1', 2: 'Pod 2', 3: 'Pod 3' };

function PodsModeSelectorSection() {
  const { t, podsMode, setPodsMode, podCount } = useApp();

  const options =
    podCount === 0
      ? [{ key: 'disabled', label: t('disabled') }]
      : podCount === 1
        ? [
            { key: 'disabled', label: 'Off' },
            { key: 'sequential', label: t('sequential') },
          ]
        : [
            { key: 'disabled', label: 'Off' },
            { key: 'sequential', label: t('sequential') },
            { key: 'random', label: t('random') },
          ];

  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabelInline}>{t('podsMode')}</Text>
      <View style={styles.segmentedSmall}>
        {options.map((opt) => {
          const active = podsMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              testID={`pods-mode-${opt.key}`}
              style={[styles.segBtnSmall, active && styles.segBtnSmallActive]}
              onPress={() => setPodsMode(opt.key)}
              disabled={podCount === 0}
            >
              <Text style={[styles.segTextSmall, active && styles.segTextSmallActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ValueStepper({
  label,
  onDecrement,
  onIncrement,
  displayValue,
  testIdPrefix,
}: {
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  displayValue: string;
  testIdPrefix: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          testID={`${testIdPrefix}-decrement`}
          style={styles.stepBtn}
          onPress={onDecrement}
        >
          <Ionicons name="remove" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>{displayValue}</Text>
        </View>
        <TouchableOpacity
          testID={`${testIdPrefix}-increment`}
          style={styles.stepBtn}
          onPress={onIncrement}
        >
          <Ionicons name="add" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ControlsScreen() {
  const {
    t,
    hasMachine,
    timeInterval,
    setTimeInterval,
    speed,
    setSpeed,
    sendSpeedCommand,
    sendLaunchCommand,
    sendInitCommand,
    launchCount,
    isTraining,
    isMotorRunning,
    activePod,
    totalLaunchCount,
  } = useApp();

  const adjustTime = (delta: number) => {
    const next = Math.round((timeInterval + delta) * 10) / 10;
    if (next >= 0.1 && next <= 10.0) setTimeInterval(next);
  };

  const adjustSpeed = (delta: number) => {
    const next = speed + delta;
    if (next >= 0 && next <= 10) setSpeed(next);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Warning if no machine */}
        {!hasMachine && (
          <View style={styles.warningCard} testID="no-machine-warning">
            <Ionicons name="warning" size={18} color={COLORS.warning} />
            <Text style={styles.warningText}>{t('noMachineWarning')}</Text>
          </View>
        )}

        {/* Launch Counters: Total (left) + Session (right) */}
        <View style={styles.counterCard} testID="launch-counter">
          {/* Total counter - small, left */}
          <View style={styles.totalCounterBox} testID="total-launch-counter">
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{totalLaunchCount}</Text>
          </View>

          {/* Session counter + active pod */}
          <View style={{ flex: 1 }}>
            <Text style={styles.counterLabel}>{t('launchCounter')}</Text>
            {activePod && (
              <View style={styles.activePodRow}>
                <View style={[styles.activePodDot, { backgroundColor: POD_COLORS[`pod${activePod}`] || COLORS.primary }]} />
                <Text style={[styles.activePodText, { color: POD_COLORS[`pod${activePod}`] || COLORS.primary }]}>
                  {POD_LABELS[activePod]}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.counterValue, isTraining && styles.counterValueActive]}>
            {launchCount}
          </Text>
          {isTraining && (
            <View style={styles.trainingBadge}>
              <View style={styles.trainingDot} />
              <Text style={styles.trainingBadgeText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Pods Mode - compact inline */}
        <PodsModeSelectorSection />

        {/* Time Interval */}
        <ValueStepper
          label={`${t('timeInterval')} (${t('seconds')})`}
          displayValue={`${timeInterval.toFixed(1)}s`}
          onDecrement={() => adjustTime(-0.1)}
          onIncrement={() => adjustTime(0.1)}
          testIdPrefix="time"
        />

        {/* Speed */}
        <ValueStepper
          label={t('speed')}
          displayValue={`${speed}`}
          onDecrement={() => adjustSpeed(-1)}
          onIncrement={() => adjustSpeed(1)}
          testIdPrefix="speed"
        />

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID="speed-btn"
            style={[styles.actionBtnHalf, isMotorRunning ? styles.actionBtnDanger : styles.actionBtnOutline]}
            onPress={sendSpeedCommand}
          >
            <Ionicons name={isMotorRunning ? 'stop-circle-outline' : 'speedometer-outline'} size={18} color={isMotorRunning ? '#FFF' : COLORS.primary} />
            <Text style={[styles.actionBtnTextSmall, { color: isMotorRunning ? '#FFF' : COLORS.primary }]}>
              {isMotorRunning ? 'STOP' : t('speedBtn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="launch-btn"
            style={[styles.actionBtnHalf, styles.actionBtnPrimary]}
            onPress={sendLaunchCommand}
          >
            <MaterialCommunityIcons name="rocket-launch-outline" size={18} color="#FFF" />
            <Text style={styles.actionBtnTextSmall}>{t('launch')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="init-btn"
          style={[styles.actionBtnFull, isTraining ? styles.actionBtnStop : styles.actionBtnInit]}
          onPress={sendInitCommand}
        >
          <Ionicons name={isTraining ? 'stop-circle' : 'play-circle'} size={24} color="#FFF" />
          <Text style={styles.actionBtnTextLarge}>
            {isTraining ? 'STOP' : t('init')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  logoContainer: { alignItems: 'center', marginBottom: 6 },
  logo: { width: 220, height: 90 },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    padding: 8,
    gap: 8,
    marginBottom: 10,
  },
  warningText: { color: COLORS.warning, fontSize: 12, flex: 1 },

  // Launch Counter
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  totalCounterBox: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalLabel: {
    color: COLORS.textDisabled,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  totalValue: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  counterLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  activePodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  activePodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activePodText: {
    fontSize: 12,
    fontWeight: '700',
  },
  counterValue: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  counterValueActive: { color: COLORS.success },
  trainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 10,
    gap: 4,
  },
  trainingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  trainingBadgeText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Pods Mode - compact inline
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionLabelInline: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  segmentedSmall: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 2,
  },
  segBtnSmall: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segBtnSmallActive: { backgroundColor: COLORS.primary },
  segTextSmall: { color: COLORS.textDisabled, fontWeight: '600', fontSize: 12 },
  segTextSmallActive: { color: '#FFF' },

  // Stepper
  section: { marginBottom: 12 },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBox: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },

  // Action Buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  actionBtnHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionBtnDanger: {
    backgroundColor: COLORS.danger,
  },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnTextSmall: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  actionBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    gap: 10,
    marginBottom: 4,
  },
  actionBtnInit: { backgroundColor: COLORS.success },
  actionBtnStop: { backgroundColor: COLORS.danger },
  actionBtnTextLarge: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1.2,
  },
});
