import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp, Device, DiscoveredDevice, ConnectionState } from '../src/context';
import { COLORS } from '../src/theme';

const ROLES = ['machine', 'pod1', 'pod2', 'pod3'];
const ROLE_LABELS: Record<string, string> = {
  machine: 'Machine',
  pod1: 'Pod 1',
  pod2: 'Pod 2',
  pod3: 'Pod 3',
};

function RegisteredDeviceCard({ device }: { device: Device }) {
  const { removeDevice, connectionStatus, t } = useApp();
  const status: ConnectionState = connectionStatus[device.id] || 'disconnected';
  const dotColor =
    status === 'connected'
      ? COLORS.success
      : status === 'connecting'
        ? COLORS.warning
        : COLORS.danger;
  const roleName = ROLE_LABELS[device.role] || device.role;

  return (
    <View style={dStyles.card} testID={`registered-device-${device.id}`}>
      <View style={dStyles.cardRow}>
        <View style={[dStyles.statusDot, { backgroundColor: dotColor }]} />
        <View style={dStyles.cardInfo}>
          <Text style={dStyles.cardRole}>{roleName}</Text>
          <Text style={dStyles.cardName}>{device.name}</Text>
          <Text style={dStyles.cardMac}>{device.mac_address}</Text>
        </View>
        <TouchableOpacity
          testID={`remove-device-${device.id}`}
          style={dStyles.removeBtn}
          onPress={() => removeDevice(device.id)}
        >
          <Ionicons name="close-circle" size={24} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DiscoveredDeviceCard({ device }: { device: DiscoveredDevice }) {
  const { registerDevice, devices } = useApp();
  const existing = devices.find((d) => d.mac_address === device.mac_address);
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async (role: string) => {
    setAssigning(true);
    await registerDevice(device, role);
    setAssigning(false);
  };

  const isRoleTaken = (role: string) => {
    return devices.some(
      (d) => d.role === role && d.mac_address !== device.mac_address
    );
  };

  return (
    <View style={dStyles.discoveredCard} testID={`discovered-device-${device.id}`}>
      <View style={dStyles.discRow}>
        <MaterialCommunityIcons name="bluetooth" size={20} color={COLORS.primary} />
        <View style={dStyles.discInfo}>
          <Text style={dStyles.discName}>{device.name}</Text>
          <Text style={dStyles.discMac}>{device.mac_address}</Text>
        </View>
        <Text style={dStyles.rssi}>{device.rssi} dBm</Text>
      </View>

      {existing ? (
        <View style={dStyles.assignedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
          <Text style={dStyles.assignedText}>
            {ROLE_LABELS[existing.role] || existing.role}
          </Text>
        </View>
      ) : assigning ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 8 }} />
      ) : (
        <View style={dStyles.roleRow}>
          {ROLES.map((role) => {
            const taken = isRoleTaken(role);
            return (
              <TouchableOpacity
                key={role}
                testID={`assign-${device.id}-${role}`}
                style={[dStyles.roleBtn, taken ? dStyles.roleBtnTaken : dStyles.roleBtnFree]}
                onPress={() => handleAssign(role)}
              >
                <Text
                  style={[dStyles.roleBtnText, !taken && dStyles.roleBtnTextFree]}
                >
                  {ROLE_LABELS[role]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function DevicesScreen() {
  const { t, devices, isScanning, discoveredDevices, startScan } = useApp();

  const registered = devices.filter((d) => d.role !== 'unassigned');

  return (
    <SafeAreaView style={dStyles.safeArea} edges={['bottom']}>
      <ScrollView
        style={dStyles.scroll}
        contentContainerStyle={dStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Registered Devices */}
        <Text style={dStyles.sectionTitle}>{t('registeredDevices')}</Text>
        {registered.length === 0 ? (
          <View style={dStyles.emptyCard}>
            <MaterialCommunityIcons
              name="bluetooth-off"
              size={32}
              color={COLORS.textDisabled}
            />
            <Text style={dStyles.emptyText}>{t('noDevicesFound')}</Text>
          </View>
        ) : (
          registered.map((d) => <RegisteredDeviceCard key={d.id} device={d} />)
        )}

        {/* Scan Button */}
        <TouchableOpacity
          testID="scan-devices-btn"
          style={dStyles.scanBtn}
          onPress={startScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={dStyles.scanBtnText}>{t('scanning')}</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="bluetooth-audio" size={22} color="#FFF" />
              <Text style={dStyles.scanBtnText}>{t('scanDevices')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Discovered Devices */}
        {discoveredDevices.length > 0 && (
          <>
            <Text style={[dStyles.sectionTitle, { marginTop: 24 }]}>
              {t('discoveredDevices')}
            </Text>
            {discoveredDevices.map((d) => (
              <DiscoveredDeviceCard key={d.id} device={d} />
            ))}
          </>
        )}

        {/* Mock Note */}
        <Text style={dStyles.mockNote}>{t('bleMockNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const dStyles = StyleSheet.create({
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
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  emptyText: { color: COLORS.textDisabled, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardRole: { color: COLORS.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  cardName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  cardMac: { color: COLORS.textDisabled, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  removeBtn: { padding: 4 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  scanBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.8 },
  discoveredCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  discRow: { flexDirection: 'row', alignItems: 'center' },
  discInfo: { flex: 1, marginLeft: 10 },
  discName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  discMac: { color: COLORS.textDisabled, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  rssi: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 4,
  },
  assignedText: { color: COLORS.success, fontSize: 13, fontWeight: '600' },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  roleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
  },
  roleBtnFree: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  roleBtnTaken: {
    borderColor: COLORS.textDisabled,
    backgroundColor: 'transparent',
  },
  roleBtnText: {
    color: COLORS.textDisabled,
    fontSize: 13,
    fontWeight: '700',
  },
  roleBtnTextFree: { color: COLORS.primary },
  mockNote: {
    color: COLORS.textDisabled,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
  },
});
