import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../src/context';
import { COLORS } from '../src/theme';

function ToggleRow({ icon, label, value, onToggle, testId, accentColor }: { icon: React.ReactNode; label: string; value: boolean; onToggle: () => void; testId: string; accentColor?: string; }) {
  return (
    <View style={ss.toggleRow}>
      <View style={ss.toggleLeft}>{icon}<Text style={ss.toggleLabel}>{label}</Text></View>
      <Switch testID={testId} value={value} onValueChange={onToggle} trackColor={{ false: COLORS.surfaceElevated, true: accentColor || COLORS.primary }} thumbColor={value ? '#FFF' : COLORS.textDisabled} />
    </View>
  );
}

export default function SettingsScreen() {
  const { t, language, setLanguage, vibrator, toggleVibrator, podsEnabled, togglePods, heater, toggleHeater, machineType, setMachineType } = useApp();
  return (
    <SafeAreaView style={ss.safeArea} edges={['bottom']}>
      <ScrollView style={ss.scroll} contentContainerStyle={ss.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Machine Type */}
        <Text style={ss.sectionTitle}>{t('machineType')}</Text>
        <View style={ss.card}>
          <View style={ss.machineTypeRow}>
            <MaterialCommunityIcons name="robot-industrial" size={22} color={COLORS.primary} />
            <Text style={ss.toggleLabel}>{t('machineType')}</Text>
            <View style={ss.machineTypeBtns}>
              <TouchableOpacity testID="machine-type-lite" style={[ss.mtBtn, machineType === 'lite' && ss.mtBtnActive]} onPress={() => setMachineType('lite')}>
                <Text style={[ss.mtBtnText, machineType === 'lite' && ss.mtBtnTextActive]}>{t('lite')}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="machine-type-pro" style={[ss.mtBtn, machineType === 'pro' && ss.mtBtnActive]} onPress={() => setMachineType('pro')}>
                <Text style={[ss.mtBtnText, machineType === 'pro' && ss.mtBtnTextActive]}>{t('pro')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Device Controls */}
        <Text style={[ss.sectionTitle, { marginTop: 20 }]}>{t('deviceControls')}</Text>
        <View style={ss.card}>
          <ToggleRow icon={<MaterialCommunityIcons name="vibrate" size={22} color={COLORS.primary} />} label={t('vibrator')} value={vibrator} onToggle={toggleVibrator} testId="toggle-vibrator" />
          <View style={ss.divider} />
          <ToggleRow icon={<MaterialCommunityIcons name="access-point" size={22} color={COLORS.primary} />} label={t('pods')} value={podsEnabled} onToggle={togglePods} testId="toggle-pods" />
          <View style={ss.divider} />
          <ToggleRow icon={<MaterialCommunityIcons name="fire" size={22} color={COLORS.danger} />} label={t('heater')} value={heater} onToggle={toggleHeater} testId="toggle-heater" accentColor={COLORS.danger} />
        </View>

        {/* App Settings */}
        <Text style={[ss.sectionTitle, { marginTop: 20 }]}>{t('appSettings')}</Text>
        <View style={ss.card}>
          <View style={ss.langRow}>
            <View style={ss.toggleLeft}><Ionicons name="language" size={22} color={COLORS.primary} /><Text style={ss.toggleLabel}>{t('language')}</Text></View>
            <View style={ss.langButtons}>
              <TouchableOpacity testID="lang-en" style={[ss.langBtn, language === 'en' && ss.langBtnActive]} onPress={() => setLanguage('en')}><Text style={[ss.langBtnText, language === 'en' && ss.langBtnTextActive]}>EN</Text></TouchableOpacity>
              <TouchableOpacity testID="lang-es" style={[ss.langBtn, language === 'es' && ss.langBtnActive]} onPress={() => setLanguage('es')}><Text style={[ss.langBtnText, language === 'es' && ss.langBtnTextActive]}>ES</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  machineTypeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  machineTypeBtns: { flexDirection: 'row', marginLeft: 'auto', backgroundColor: COLORS.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 2 },
  mtBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  mtBtnActive: { backgroundColor: COLORS.primary },
  mtBtnText: { color: COLORS.textDisabled, fontWeight: '700', fontSize: 14 },
  mtBtnTextActive: { color: '#FFF' },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  langButtons: { flexDirection: 'row', backgroundColor: COLORS.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 2 },
  langBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  langBtnActive: { backgroundColor: COLORS.primary },
  langBtnText: { color: COLORS.textDisabled, fontWeight: '700', fontSize: 13 },
  langBtnTextActive: { color: '#FFF' },
});
