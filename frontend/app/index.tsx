import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../src/context';
import { COLORS } from '../src/theme';

function PodsModeSelectorSection() {
  const { t, podsMode, setPodsMode, podCount } = useApp();

  const options =
    podCount === 0
      ? [{ key: 'disabled', label: t('disabled') }]
      : podCount === 1
        ? [{ key: 'sequential', label: t('sequential') }]
        : [
            { key: 'sequential', label: t('sequential') },
            { key: 'random', label: t('random') },
          ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('podsMode')}</Text>
      <View style={styles.segmented}>
        {options.map((opt) => {
          const active = podsMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              testID={`pods-mode-${opt.key}`}
              style={[styles.segBtn, active && styles.segBtnActive]}
              onPress={() => setPodsMode(opt.key)}
              disabled={podCount === 0}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {podCount === 0 && (
        <Text style={styles.hint}>
          {t('disabled')} — 0 pods
        </Text>
      )}
    </View>
  );
}

function ValueStepper({
  label,
  value,
  onDecrement,
  onIncrement,
  displayValue,
  testIdPrefix,
}: {
  label: string;
  value: number;
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
          <Ionicons name="remove" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>{displayValue}</Text>
        </View>
        <TouchableOpacity
          testID={`${testIdPrefix}-increment`}
          style={styles.stepBtn}
          onPress={onIncrement}
        >
          <Ionicons name="add" size={28} color={COLORS.textPrimary} />
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
            <Ionicons name="warning" size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>{t('noMachineWarning')}</Text>
          </View>
        )}

        {/* Pods Mode */}
        <PodsModeSelectorSection />

        {/* Time Interval */}
        <ValueStepper
          label={`${t('timeInterval')} (${t('seconds')})`}
          value={timeInterval}
          displayValue={`${timeInterval.toFixed(1)}s`}
          onDecrement={() => adjustTime(-0.1)}
          onIncrement={() => adjustTime(0.1)}
          testIdPrefix="time"
        />

        {/* Speed */}
        <ValueStepper
          label={t('speed')}
          value={speed}
          displayValue={`${speed}`}
          onDecrement={() => adjustSpeed(-1)}
          onIncrement={() => adjustSpeed(1)}
          testIdPrefix="speed"
        />

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            testID="speed-btn"
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={sendSpeedCommand}
          >
            <Ionicons name="speedometer-outline" size={22} color={COLORS.primary} />
            <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>
              {t('speedBtn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="launch-btn"
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={sendLaunchCommand}
          >
            <MaterialCommunityIcons name="rocket-launch-outline" size={22} color="#FFF" />
            <Text style={styles.actionBtnText}>{t('launch')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="init-btn"
            style={[styles.actionBtn, styles.actionBtnInit]}
            onPress={sendInitCommand}
          >
            <Ionicons name="play-circle" size={26} color="#FFF" />
            <Text style={[styles.actionBtnText, { fontSize: 18 }]}>
              {t('init')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mock Note */}
        <Text style={styles.mockNote}>{t('bleMockNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 180, height: 80 },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  warningText: { color: COLORS.warning, fontSize: 13, flex: 1 },
  section: { marginBottom: 20 },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segBtnActive: { backgroundColor: COLORS.primary },
  segText: { color: COLORS.textDisabled, fontWeight: '600', fontSize: 14 },
  segTextActive: { color: '#FFF' },
  hint: { color: COLORS.textDisabled, fontSize: 11, marginTop: 6 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  actionsSection: { gap: 12, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    gap: 10,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnInit: {
    backgroundColor: COLORS.success,
    height: 64,
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
  mockNote: {
    color: COLORS.textDisabled,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 20,
  },
});
