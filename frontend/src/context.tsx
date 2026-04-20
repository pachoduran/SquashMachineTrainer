import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { translations, Language } from './i18n';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface Device {
  id: string;
  mac_address: string;
  name: string;
  role: string;
  created_at: string;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  mac_address: string;
  rssi: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  devices: Device[];
  fetchDevices: () => Promise<void>;
  registerDevice: (discovered: DiscoveredDevice, role: string) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  connectionStatus: Record<string, ConnectionState>;
  isScanning: boolean;
  discoveredDevices: DiscoveredDevice[];
  startScan: () => void;
  podsMode: string;
  setPodsMode: (mode: string) => void;
  timeInterval: number;
  setTimeInterval: (t: number) => void;
  speed: number;
  setSpeed: (s: number) => void;
  vibrator: boolean;
  toggleVibrator: () => void;
  podsEnabled: boolean;
  togglePods: () => void;
  heater: boolean;
  toggleHeater: () => void;
  sendSpeedCommand: () => void;
  sendLaunchCommand: () => void;
  sendInitCommand: () => void;
  podCount: number;
  hasMachine: boolean;
  launchCount: number;
  isTraining: boolean;
  resetLaunchCount: () => void;
  isMotorRunning: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

const MOCK_DISCOVERED: DiscoveredDevice[] = [
  { id: 'mock-1', name: 'JDY-32-A1B2', mac_address: 'AA:BB:CC:DD:EE:01', rssi: -42 },
  { id: 'mock-2', name: 'JDY-23-C3D4', mac_address: 'AA:BB:CC:DD:EE:02', rssi: -55 },
  { id: 'mock-3', name: 'JDY-23-E5F6', mac_address: 'AA:BB:CC:DD:EE:03', rssi: -61 },
  { id: 'mock-4', name: 'JDY-08-G7H8', mac_address: 'AA:BB:CC:DD:EE:04', rssi: -58 },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionState>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [podsMode, setPodsModeState] = useState('disabled');
  const [timeInterval, setTimeInterval] = useState(2.5);
  const [speed, setSpeed] = useState(1);
  const [vibrator, setVibrator] = useState(false);
  const [podsEnabled, setPodsEnabled] = useState(false);
  const [heater, setHeater] = useState(false);
  const [isMotorRunning, setIsMotorRunning] = useState(false);
  const [launchCount, setLaunchCount] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const trainingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useCallback(
    (key: string) => translations[language][key] || key,
    [language]
  );

  const podCount = devices.filter((d) => d.role.startsWith('pod')).length;
  const hasMachine = devices.some((d) => d.role === 'machine');

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Simulate BLE connection when devices change
  useEffect(() => {
    if (devices.length === 0) {
      setConnectionStatus({});
      return;
    }
    const status: Record<string, ConnectionState> = {};
    devices.forEach((d) => {
      status[d.id] = 'connecting';
    });
    setConnectionStatus(status);

    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = setTimeout(() => {
      const connected: Record<string, ConnectionState> = {};
      devices.forEach((d) => {
        connected[d.id] = 'connected';
      });
      setConnectionStatus(connected);
    }, 1500);

    return () => {
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    };
  }, [devices]);

  // Auto-adjust pods mode based on pod count
  useEffect(() => {
    if (podCount === 0) setPodsModeState('disabled');
    else if (podCount === 1) setPodsModeState('sequential');
    else if (podsMode === 'disabled') setPodsModeState('sequential');
  }, [podCount]);

  const setPodsMode = useCallback(
    (mode: string) => {
      if (podCount === 0) return;
      if (podCount === 1 && mode !== 'sequential') return;
      setPodsModeState(mode);
    },
    [podCount]
  );

  async function fetchDevices() {
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (e) {
      console.error('Failed to fetch devices:', e);
    }
  }

  async function registerDevice(discovered: DiscoveredDevice, role: string) {
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac_address: discovered.mac_address,
          name: discovered.name,
          role,
        }),
      });
      if (res.ok) {
        await fetchDevices();
      }
    } catch (e) {
      console.error('Failed to register device:', e);
    }
  }

  async function removeDevice(id: string) {
    try {
      await fetch(`${API_BASE}/api/devices/${id}`, { method: 'DELETE' });
      await fetchDevices();
    } catch (e) {
      console.error('Failed to remove device:', e);
    }
  }

  function startScan() {
    setIsScanning(true);
    setDiscoveredDevices([]);
    setTimeout(() => {
      setDiscoveredDevices(MOCK_DISCOVERED);
      setIsScanning(false);
    }, 2500);
  }

  function toggleVibrator() {
    setVibrator(!vibrator);
  }

  function togglePods() {
    setPodsEnabled(!podsEnabled);
  }

  function toggleHeater() {
    setHeater(!heater);
  }

  function sendSpeedCommand() {
    setIsMotorRunning(!isMotorRunning);
  }

  function sendLaunchCommand() {
    // BLE command will be sent here
  }

  function sendInitCommand() {
    if (isTraining) {
      if (trainingTimerRef.current) {
        clearInterval(trainingTimerRef.current);
        trainingTimerRef.current = null;
      }
      setIsTraining(false);
    } else {
      setIsTraining(true);
      setLaunchCount(0);
      const intervalMs = timeInterval * 1000;
      trainingTimerRef.current = setInterval(() => {
        setLaunchCount((prev) => prev + 1);
      }, intervalMs);
    }
  }

  // Cleanup training timer on unmount
  useEffect(() => {
    return () => {
      if (trainingTimerRef.current) clearInterval(trainingTimerRef.current);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        devices,
        fetchDevices,
        registerDevice,
        removeDevice,
        connectionStatus,
        isScanning,
        discoveredDevices,
        startScan,
        podsMode,
        setPodsMode,
        timeInterval,
        setTimeInterval,
        speed,
        setSpeed,
        vibrator,
        toggleVibrator,
        podsEnabled,
        togglePods,
        heater,
        toggleHeater,
        sendSpeedCommand,
        sendLaunchCommand,
        sendInitCommand,
        podCount,
        hasMachine,
        launchCount,
        isTraining,
        resetLaunchCount: () => setLaunchCount(0),
        isMotorRunning,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
