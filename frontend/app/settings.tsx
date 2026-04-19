import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../src/context';
import { COLORS } from '../src/theme';

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onToggle: () => void;
  testId: string;
  accentColor?: string;
}

function ToggleRow({ icon, label, value, onToggle, testId, accentColor }: ToggleRowProps) {
  const trackColor = accentColor || COLORS.primary;
  return (
    <View style={sStyles.toggleRow}>
      <View style={sStyles.toggleLeft}>
        {icon}
        <Text style={sStyles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        testID={testId}
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.surfaceElevated, true: trackColor }}
        thumbColor={value ? '#FFF' : COLORS.textDisabled}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const {
    t,
    language,
    setLanguage,
    vibrator,
    toggleVibrator,
    podsEnabled,
    togglePods,
    heater,
    toggleHeater,
  } = useApp();

  return (
    <SafeAreaView style={sStyles.safeArea} edges={['bottom']}>
      <ScrollView
        style={sStyles.scroll}
        contentContainerStyle={sStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Device Controls */}
        <Text style={sStyles.sectionTitle}>{t('deviceControls')}</Text>
        <View style={sStyles.card}>
          <ToggleRow
            icon={<MaterialCommunityIcons name="vibrate" size={22} color={COLORS.primary} />}
            label={t('vibrator')}
            value={vibrator}
            onToggle={toggleVibrator}
            testId="toggle-vibrator"
          />
          <View style={sStyles.divider} />
          <ToggleRow
            icon={<MaterialCommunityIcons name="access-point" size={22} color={COLORS.primary} />}
            label={t('pods')}
            value={podsEnabled}
            onToggle={togglePods}
            testId="toggle-pods"
          />
          <View style={sStyles.divider} />
          <ToggleRow
            icon={<MaterialCommunityIcons name="fire" size={22} color={COLORS.danger} />}
            label={t('heater')}
            value={heater}
            onToggle={toggleHeater}
            testId="toggle-heater"
            accentColor={COLORS.danger}
          />
        </View>

        {/* App Settings */}
        <Text style={[sStyles.sectionTitle, { marginTop: 28 }]}>{t('appSettings')}</Text>
        <View style={sStyles.card}>
          <View style={sStyles.langRow}>
            <View style={sStyles.toggleLeft}>
              <Ionicons name="language" size={22} color={COLORS.primary} />
              <Text style={sStyles.toggleLabel}>{t('language')}</Text>
            </View>
            <View style={sStyles.langButtons}>
              <TouchableOpacity
                testID="lang-en"
                style={[sStyles.langBtn, language === 'en' && sStyles.langBtnActive]}
                onPress={() => setLanguage('en')}
              >
                <Text
                  style={[
                    sStyles.langBtnText,
                    language === 'en' && sStyles.langBtnTextActive,
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="lang-es"
                style={[sStyles.langBtn, language === 'es' && sStyles.langBtnActive]}
                onPress={() => setLanguage('es')}
              >
                <Text
                  style={[
                    sStyles.langBtnText,
                    language === 'es' && sStyles.langBtnTextActive,
                  ]}
                >
                  ES
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Mock Note */}
        <Text style={sStyles.mockNote}>{t('bleMockNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const sStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  langButtons: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  langBtnActive: { backgroundColor: COLORS.primary },
  langBtnText: { color: COLORS.textDisabled, fontWeight: '700', fontSize: 13 },
  langBtnTextActive: { color: '#FFF' },
  mockNote: {
    color: COLORS.textDisabled,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 28,
  },
});
