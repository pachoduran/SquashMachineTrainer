import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppProvider, useApp, ConnectionState } from '../src/context';
import { COLORS, POD_COLORS } from '../src/theme';

function ConnectionStatusBar() {
  const { devices, connectionStatus, t } = useApp();
  const machine = devices.find((d) => d.role === 'machine');
  const pods = devices.filter((d) => d.role.startsWith('pod')).sort((a, b) => a.role.localeCompare(b.role));

  if (devices.length === 0) {
    return (
      <View style={csStyles.container}>
        <View style={csStyles.dot} />
        <Text style={csStyles.noDevText}>{t('noDevices')}</Text>
      </View>
    );
  }

  const dotColor = (state: ConnectionState, role?: string) => {
    if (state === 'connected') {
      if (role && POD_COLORS[role]) return POD_COLORS[role];
      return COLORS.success;
    }
    if (state === 'connecting') return COLORS.warning;
    return COLORS.danger;
  };

  return (
    <View style={csStyles.container}>
      {machine && (
        <View style={csStyles.item} testID="connection-status-machine">
          <View style={[csStyles.statusDot, { backgroundColor: dotColor(connectionStatus[machine.id] || 'disconnected') }]} />
          <Text style={csStyles.label}>M</Text>
        </View>
      )}
      {pods.map((pod) => {
        const podColor = dotColor(connectionStatus[pod.id] || 'disconnected', pod.role);
        return (
          <View key={pod.id} style={csStyles.item} testID={`connection-status-${pod.role}`}>
            <View style={[csStyles.statusDot, { backgroundColor: podColor }]} />
            <Text style={[csStyles.label, { color: podColor }]}>{pod.role.replace('pod', 'P')}</Text>
          </View>
        );
      })}
    </View>
  );
}

const csStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginRight: 14, gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.textDisabled },
  noDevText: { color: COLORS.textDisabled, fontSize: 12, maxWidth: 120 },
});

function TabLayout() {
  const { t } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border } as any,
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
        headerRight: () => <ConnectionStatusBar />,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 8,
          paddingTop: 4,
          marginBottom: 30,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textDisabled,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('controls'),
          tabBarIcon: ({ color, size }) => <Ionicons name="game-controller" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: t('devices'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bluetooth-connect" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <TabLayout />
    </AppProvider>
  );
}
