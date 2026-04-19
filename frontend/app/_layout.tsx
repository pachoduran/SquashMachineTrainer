import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppProvider, useApp, ConnectionState } from '../src/context';
import { COLORS } from '../src/theme';

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

  const dotColor = (state: ConnectionState) => {
    if (state === 'connected') return COLORS.success;
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
      {pods.map((pod, i) => (
        <View key={pod.id} style={csStyles.item} testID={`connection-status-pod-${i + 1}`}>
          <View style={[csStyles.statusDot, { backgroundColor: dotColor(connectionStatus[pod.id] || 'disconnected') }]} />
          <Text style={csStyles.label}>P{i + 1}</Text>
        </View>
      ))}
    </View>
  );
}

const csStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginRight: 14, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  label: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.textDisabled },
  noDevText: { color: COLORS.textDisabled, fontSize: 10, maxWidth: 100 },
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
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textDisabled,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
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
