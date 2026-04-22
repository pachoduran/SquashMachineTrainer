import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../src/context';
import { COLORS, POD_COLORS } from '../src/theme';

const POD_LABELS: Record<number, string> = { 1: 'Pod 1', 2: 'Pod 2', 3: 'Pod 3' };

function PodsModeSelectorSection() {
  const { t, podsMode, setPodsMode, podCount } = useApp();
  const options = podCount === 0
    ? [{ key: 'disabled', label: 'Off' }]
    : podCount === 1
      ? [{ key: 'disabled', label: 'Off' }, { key: 'sequential', label: t('sequential') }]
      : [{ key: 'disabled', label: 'Off' }, { key: 'sequential', label: t('sequential') }, { key: 'random', label: t('random') }];
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionLabelInline}>{t('podsMode')}</Text>
      <View style={s.segSmall}>
        {options.map((o) => (
          <TouchableOpacity key={o.key} testID={`pods-mode-${o.key}`} style={[s.segBtn, podsMode === o.key && s.segBtnActive]} onPress={() => setPodsMode(o.key)}>
            <Text style={[s.segText, podsMode === o.key && s.segTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ShotModeSelectorSection() {
  const { t, shotMode, setShotMode, configuredShotCount } = useApp();
  const options = [{ key: 'fixed', label: t('fixed') }, { key: 'sequential', label: t('sequential') }, { key: 'random', label: t('random') }];
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionLabelInline}>{t('shotMode')}</Text>
      <View style={s.segSmall}>
        {options.map((o) => {
          const disabled = o.key !== 'fixed' && configuredShotCount < 2;
          return (
            <TouchableOpacity key={o.key} testID={`shot-mode-${o.key}`} style={[s.segBtn, shotMode === o.key && s.segBtnActive, disabled && { opacity: 0.4 }]} onPress={() => !disabled && setShotMode(o.key as any)}>
              <Text style={[s.segText, shotMode === o.key && s.segTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DPad() {
  const { moveHead } = useApp();
  return (
    <View style={s.dpadContainer}>
      <View style={s.dpadRow}>
        <View style={s.dpadSpacer} />
        <TouchableOpacity testID="head-up" style={s.dpadBtn} onPress={() => moveHead('up')}>
          <Ionicons name="caret-up" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.dpadSpacer} />
      </View>
      <View style={s.dpadRow}>
        <TouchableOpacity testID="head-left" style={s.dpadBtn} onPress={() => moveHead('left')}>
          <Ionicons name="caret-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={[s.dpadBtn, s.dpadCenter]}>
          <MaterialCommunityIcons name="target" size={18} color={COLORS.textDisabled} />
        </View>
        <TouchableOpacity testID="head-right" style={s.dpadBtn} onPress={() => moveHead('right')}>
          <Ionicons name="caret-forward" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={s.dpadRow}>
        <View style={s.dpadSpacer} />
        <TouchableOpacity testID="head-down" style={s.dpadBtn} onPress={() => moveHead('down')}>
          <Ionicons name="caret-down" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.dpadSpacer} />
      </View>
    </View>
  );
}

function ShotProgramming() {
  const { t, programmedShots, registerShot, goToShot, resetShots, sendLaunchCommand } = useApp();
  const [expanded, setExpanded] = React.useState(false);
  const configCount = programmedShots.filter(Boolean).length;

  return (
    <View style={s.collapsibleContainer}>
      <TouchableOpacity testID="toggle-shot-program" style={s.collapsibleHeader} onPress={() => setExpanded(!expanded)}>
        <MaterialCommunityIcons name="target-variant" size={20} color={COLORS.primary} />
        <Text style={s.collapsibleTitle}>{t('shotProgram')}</Text>
        <Text style={s.collapsibleBadge}>{configCount}/4</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {expanded && (
        <View style={s.collapsibleContent}>
          <View style={s.shotsGrid}>
            {[1, 2, 3, 4].map((pt) => {
              const set = programmedShots[pt - 1];
              return (
                <View key={pt} style={s.shotRow}>
                  <View style={[s.shotBadge, set && s.shotBadgeSet]}>
                    <Text style={[s.shotBadgeText, set && s.shotBadgeTextSet]}>{pt}</Text>
                  </View>
                  <Text style={[s.shotStatus, set && { color: COLORS.success }]}>{set ? t('configured') : t('notConfigured')}</Text>
                  <TouchableOpacity testID={`register-shot-${pt}`} style={s.shotActionBtn} onPress={() => registerShot(pt)}>
                    <Text style={s.shotActionText}>{t('registerPoint')}</Text>
                  </TouchableOpacity>
                  {set && (
                    <TouchableOpacity testID={`goto-shot-${pt}`} style={[s.shotActionBtn, s.shotGoBtn]} onPress={() => goToShot(pt)}>
                      <Text style={[s.shotActionText, { color: COLORS.primary }]}>{t('goToPoint')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
          <View style={s.shotBtnRow}>
            <TouchableOpacity testID="test-launch" style={s.testLaunchBtn} onPress={sendLaunchCommand}>
              <MaterialCommunityIcons name="rocket-launch-outline" size={16} color="#FFF" />
              <Text style={s.testLaunchText}>{t('testLaunch')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="reset-shots" style={s.resetBtn} onPress={resetShots}>
              <Text style={s.resetBtnText}>{t('resetPoints')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function ValueStepper({ label, onDecrement, onIncrement, displayValue, testIdPrefix }: { label: string; onDecrement: () => void; onIncrement: () => void; displayValue: string; testIdPrefix: string; }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <TouchableOpacity testID={`${testIdPrefix}-decrement`} style={s.stepBtn} onPress={onDecrement}><Ionicons name="remove" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
        <View style={s.valueBox}><Text style={s.valueText}>{displayValue}</Text></View>
        <TouchableOpacity testID={`${testIdPrefix}-increment`} style={s.stepBtn} onPress={onIncrement}><Ionicons name="add" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
      </View>
    </View>
  );
}

export default function ControlsScreen() {
  const { t, hasMachine, timeInterval, setTimeInterval, speed, setSpeed, sendSpeedCommand, sendLaunchCommand, sendInitCommand, launchCount, totalLaunchCount, isTraining, isMotorRunning, activePod, machineType, laserOn, toggleLaser } = useApp();
  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoContainer}><Image source={require('../assets/images/logo.png')} style={s.logo} resizeMode="contain" /></View>
        {!hasMachine && (<View style={s.warningCard} testID="no-machine-warning"><Ionicons name="warning" size={18} color={COLORS.warning} /><Text style={s.warningText}>{t('noMachineWarning')}</Text></View>)}

        {/* Counters */}
        <View style={s.counterCard} testID="launch-counter">
          <View style={s.totalCounterBox} testID="total-launch-counter"><Text style={s.totalLabel}>TOTAL</Text><Text style={s.totalValue}>{totalLaunchCount}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.counterLabel}>{t('launchCounter')}</Text>
            {activePod && (<View style={s.activePodRow}><View style={[s.activePodDot, { backgroundColor: POD_COLORS[`pod${activePod}`] || COLORS.primary }]} /><Text style={[s.activePodText, { color: POD_COLORS[`pod${activePod}`] || COLORS.primary }]}>{POD_LABELS[activePod]}</Text></View>)}
          </View>
          <Text style={[s.counterValue, isTraining && s.counterValueActive]}>{launchCount}</Text>
          {isTraining && (<View style={s.trainingBadge}><View style={s.trainingDot} /><Text style={s.trainingBadgeText}>LIVE</Text></View>)}
        </View>

        {/* Pro: D-Pad + Laser */}
        {machineType === 'pro' && (
          <View style={s.proRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionLabel}>{t('headControl')}</Text>
              <DPad />
            </View>
            <View style={s.laserSection}>
              <Text style={s.sectionLabel}>{t('laser')}</Text>
              <TouchableOpacity testID="toggle-laser" style={[s.laserBtn, laserOn && s.laserBtnOn]} onPress={toggleLaser}>
                <MaterialCommunityIcons name="laser-pointer" size={28} color={laserOn ? '#FFF' : COLORS.textDisabled} />
                <Text style={[s.laserBtnText, laserOn && { color: '#FFF' }]}>{laserOn ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <PodsModeSelectorSection />
        {machineType === 'pro' && <ShotModeSelectorSection />}

        <ValueStepper label={`${t('timeInterval')} (${t('seconds')})`} displayValue={`${timeInterval.toFixed(1)}s`} onDecrement={() => { const n = Math.round((timeInterval - 0.1) * 10) / 10; if (n >= 0.1) setTimeInterval(n); }} onIncrement={() => { const n = Math.round((timeInterval + 0.1) * 10) / 10; if (n <= 10) setTimeInterval(n); }} testIdPrefix="time" />
        <ValueStepper label={t('speed')} displayValue={`${speed}`} onDecrement={() => { if (speed > 0) setSpeed(speed - 1); }} onIncrement={() => { if (speed < 10) setSpeed(speed + 1); }} testIdPrefix="speed" />

        {/* Action Buttons */}
        <View style={s.actionsRow}>
          <TouchableOpacity testID="speed-btn" style={[s.actionBtnHalf, isMotorRunning ? s.actionBtnDanger : s.actionBtnOutline]} onPress={sendSpeedCommand}>
            <Ionicons name={isMotorRunning ? 'stop-circle-outline' : 'speedometer-outline'} size={18} color={isMotorRunning ? '#FFF' : COLORS.primary} />
            <Text style={[s.actionBtnTextSmall, { color: isMotorRunning ? '#FFF' : COLORS.primary }]}>{isMotorRunning ? 'STOP' : t('speedBtn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="launch-btn" style={[s.actionBtnHalf, s.actionBtnPrimary]} onPress={sendLaunchCommand}>
            <MaterialCommunityIcons name="rocket-launch-outline" size={18} color="#FFF" />
            <Text style={s.actionBtnTextSmall}>{t('launch')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity testID="init-btn" style={[s.actionBtnFull, isTraining ? s.actionBtnStop : s.actionBtnInit]} onPress={sendInitCommand}>
          <Ionicons name={isTraining ? 'stop-circle' : 'play-circle'} size={24} color="#FFF" />
          <Text style={s.actionBtnTextLarge}>{isTraining ? 'STOP' : t('init')}</Text>
        </TouchableOpacity>

        {/* Pro: Shot Programming - collapsible, below INIT */}
        {machineType === 'pro' && <ShotProgramming />}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  logoContainer: { alignItems: 'center', marginBottom: 6 },
  logo: { width: 220, height: 90 },
  warningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 8, padding: 8, gap: 8, marginBottom: 10 },
  warningText: { color: COLORS.warning, fontSize: 12, flex: 1 },
  counterCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 10 },
  totalCounterBox: { alignItems: 'center', backgroundColor: COLORS.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  totalLabel: { color: COLORS.textDisabled, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  totalValue: { color: COLORS.textSecondary, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  counterLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  activePodRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  activePodDot: { width: 10, height: 10, borderRadius: 5 },
  activePodText: { fontSize: 12, fontWeight: '700' },
  counterValue: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  counterValueActive: { color: COLORS.success },
  trainingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 10, gap: 4 },
  trainingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  trainingBadgeText: { color: COLORS.success, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  // Pro D-pad + Laser row
  proRow: { flexDirection: 'row', marginBottom: 12, gap: 12 },
  dpadContainer: { alignItems: 'center', gap: 2 },
  dpadRow: { flexDirection: 'row', gap: 2 },
  dpadBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  dpadCenter: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  dpadSpacer: { width: 44, height: 44 },
  laserSection: { alignItems: 'center', justifyContent: 'flex-start' },
  laserBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.surfaceElevated, borderWidth: 2, borderColor: COLORS.textDisabled, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  laserBtnOn: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  laserBtnText: { color: COLORS.textDisabled, fontSize: 10, fontWeight: '800', marginTop: 2 },
  // Section styles
  section: { marginBottom: 12 },
  sectionLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  sectionLabelInline: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  segSmall: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 2 },
  segBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segBtnActive: { backgroundColor: COLORS.primary },
  segText: { color: COLORS.textDisabled, fontWeight: '600', fontSize: 12 },
  segTextActive: { color: '#FFF' },
  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  valueBox: { flex: 1, height: 46, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  valueText: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  // Shot Programming - collapsible
  collapsibleContainer: { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  collapsibleTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  collapsibleBadge: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', backgroundColor: COLORS.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  collapsibleContent: { paddingHorizontal: 14, paddingBottom: 14 },
  shotsGrid: { gap: 6 },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 8 },
  shotBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  shotBadgeSet: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  shotBadgeText: { color: COLORS.textDisabled, fontWeight: '900', fontSize: 13 },
  shotBadgeTextSet: { color: '#FFF' },
  shotStatus: { color: COLORS.textDisabled, fontSize: 11, fontWeight: '600', width: 28 },
  shotActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.textDisabled },
  shotGoBtn: { borderColor: COLORS.primary },
  shotActionText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  shotBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testLaunchBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, gap: 6 },
  testLaunchText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  resetBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.danger },
  resetBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  // Action Buttons
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 10 },
  actionBtnHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 10, gap: 8 },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
  actionBtnDanger: { backgroundColor: COLORS.danger },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnTextSmall: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.8 },
  actionBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 12, gap: 10, marginBottom: 4 },
  actionBtnInit: { backgroundColor: COLORS.success },
  actionBtnStop: { backgroundColor: COLORS.danger },
  actionBtnTextLarge: { color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 1.2 },
});
