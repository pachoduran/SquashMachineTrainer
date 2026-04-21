import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from './i18n';
import { CMD, POD_CMD, calculateSpeedValue, bleWrite, delay, scanForDevices, connectToDevice, IS_BLE_AVAILABLE, setOnDataReceived } from './bleCommands';

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
  isMotorRunning: boolean;
  activePod: number | null;
  resetLaunchCount: () => void;
}

const AppContext = createContext<AppContextType | null>(null);
const STORAGE_KEY = '@smt_devices';

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

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
  const [activePod, setActivePod] = useState<number | null>(null);

  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trainingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoLaunchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const podSequenceIndexRef = useRef(0);
  const isTrainingRef = useRef(false);

  const t = useCallback(
    (key: string) => translations[language][key] || key,
    [language]
  );

  const registeredPods = devices
    .filter((d) => d.role.startsWith('pod'))
    .map((d) => parseInt(d.role.replace('pod', ''), 10))
    .sort();
  const podCount = registeredPods.length;
  const hasMachine = devices.some((d) => d.role === 'machine');

  useEffect(() => { isTrainingRef.current = isTraining; }, [isTraining]);

  // ========== LOCAL STORAGE ==========

  async function loadDevices() {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const saved = JSON.parse(json);
        setDevices(saved);
        console.log(`[STORAGE] Loaded ${saved.length} devices`);
      }
    } catch (e) {
      console.error('[STORAGE] Load error:', e);
    }
  }

  async function saveDevices(newDevices: Device[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDevices));
      setDevices(newDevices);
      console.log(`[STORAGE] Saved ${newDevices.length} devices`);
    } catch (e) {
      console.error('[STORAGE] Save error:', e);
    }
  }

  // Load devices on mount + setup BLE data listener
  useEffect(() => {
    loadDevices();
    setOnDataReceived((data: string) => {
      if (data === CMD.POD_TOUCHED && isTrainingRef.current) {
        const currentPod = activePod;
        if (currentPod) handlePodResponse(currentPod);
      }
    });
    return () => setOnDataReceived(null);
  }, []);

  // Simulate BLE connection when devices change
  useEffect(() => {
    if (devices.length === 0) {
      setConnectionStatus({});
      return;
    }
    const status: Record<string, ConnectionState> = {};
    devices.forEach((d) => { status[d.id] = 'connecting'; });
    setConnectionStatus(status);

    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = setTimeout(() => {
      const connected: Record<string, ConnectionState> = {};
      devices.forEach((d) => { connected[d.id] = 'connected'; });
      setConnectionStatus(connected);
    }, 1500);

    return () => {
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    };
  }, [devices]);

  // Auto-adjust pods mode
  useEffect(() => {
    if (podCount === 0) setPodsModeState('disabled');
    else if (podCount === 1) setPodsModeState('sequential');
    else if (podsMode === 'disabled') setPodsModeState('sequential');
  }, [podCount]);

  // Mock: simulate pod touch when active during training
  useEffect(() => {
    if (activePod && isTraining) {
      const mockDelay = 1500 + Math.random() * 2000;
      const timer = setTimeout(() => {
        if (isTrainingRef.current) handlePodResponse(activePod);
      }, mockDelay);
      return () => clearTimeout(timer);
    }
  }, [activePod, isTraining]);

  useEffect(() => {
    return () => { clearAllTimers(); };
  }, []);

  const setPodsMode = useCallback(
    (mode: string) => {
      if (podCount === 0) return;
      if (podCount === 1 && mode !== 'sequential') return;
      setPodsModeState(mode);
    },
    [podCount]
  );

  // ========== DEVICE MANAGEMENT (LOCAL) ==========

  async function registerDevice(discovered: DiscoveredDevice, role: string) {
    console.log(`[REG] Registering ${discovered.name} as ${role}`);

    let updated = [...devices];

    // If same MAC exists, update its role
    const existingIdx = updated.findIndex((d) => d.mac_address === discovered.mac_address);
    if (existingIdx >= 0) {
      updated[existingIdx] = { ...updated[existingIdx], role, name: discovered.name };
    } else {
      // Unassign role from other device if taken
      if (role !== 'unassigned') {
        updated = updated.map((d) =>
          d.role === role ? { ...d, role: 'unassigned' } : d
        );
      }
      // Add new device
      updated.push({
        id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mac_address: discovered.mac_address,
        name: discovered.name,
        role,
        created_at: new Date().toISOString(),
      });
    }

    await saveDevices(updated);

    // Try BLE connect in background
    if (IS_BLE_AVAILABLE) {
      connectToDevice(discovered.mac_address).catch((e: any) => {
        console.log('[REG] BLE connect deferred:', e?.message || e);
      });
    }
  }

  async function removeDevice(id: string) {
    const updated = devices.filter((d) => d.id !== id);
    await saveDevices(updated);
  }

  // ========== SCANNING ==========

  function startScan() {
    setIsScanning(true);
    setDiscoveredDevices([]);

    const found: DiscoveredDevice[] = [];
    scanForDevices(
      (device) => {
        if (!found.some((d) => d.mac_address === device.mac_address)) {
          found.push(device);
          setDiscoveredDevices([...found]);
        }
      },
      () => { setIsScanning(false); },
      8000
    );
  }

  // ========== TRAINING LOGIC ==========

  function clearAllTimers() {
    trainingTimersRef.current.forEach(clearTimeout);
    trainingTimersRef.current = [];
    if (autoLaunchRef.current) {
      clearInterval(autoLaunchRef.current);
      autoLaunchRef.current = null;
    }
  }

  function addTimer(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      if (isTrainingRef.current) fn();
    }, ms);
    trainingTimersRef.current.push(timer);
    return timer;
  }

  function lightNextPod() {
    if (!isTrainingRef.current || registeredPods.length === 0) return;

    let nextPodNum: number;
    if (podsMode === 'random' && registeredPods.length > 1) {
      const available = registeredPods.filter((p) => p !== activePod);
      nextPodNum = available[Math.floor(Math.random() * available.length)];
    } else {
      nextPodNum = registeredPods[podSequenceIndexRef.current % registeredPods.length];
      podSequenceIndexRef.current++;
    }

    setActivePod(nextPodNum);
    const cmd = POD_CMD[nextPodNum];
    if (cmd) bleWrite(cmd);
  }

  function handlePodResponse(podNum: number) {
    if (!isTrainingRef.current) return;
    bleWrite(CMD.POD_ALL_OFF);
    setActivePod(null);

    addTimer(() => {
      bleWrite(CMD.LAUNCH);
      setLaunchCount((prev) => prev + 1);
      lightNextPod();
    }, timeInterval * 1000);
  }

  // ========== COMMANDS ==========

  function toggleVibrator() {
    const next = !vibrator;
    setVibrator(next);
    bleWrite(next ? CMD.VIBRATOR_ON : CMD.VIBRATOR_OFF);
  }

  function togglePods() {
    const next = !podsEnabled;
    setPodsEnabled(next);
    if (next) {
      registeredPods.forEach((p) => {
        const cmd = POD_CMD[p];
        if (cmd) bleWrite(cmd);
      });
    } else {
      bleWrite(CMD.POD_ALL_OFF);
    }
  }

  function toggleHeater() {
    const next = !heater;
    setHeater(next);
    bleWrite(next ? CMD.HEATER_ON : CMD.HEATER_OFF);
  }

  async function sendSpeedCommand() {
    if (isMotorRunning) {
      setIsMotorRunning(false);
      bleWrite(CMD.MOTOR_STOP);
    } else {
      setIsMotorRunning(true);
      bleWrite(CMD.MOTOR_START);
      await delay(200);
      bleWrite(calculateSpeedValue(speed));
    }
  }

  function sendLaunchCommand() {
    bleWrite(CMD.LAUNCH);
  }

  async function sendInitCommand() {
    if (isTraining) {
      clearAllTimers();
      setIsTraining(false);
      setActivePod(null);
      bleWrite(CMD.MOTOR_STOP);
      bleWrite(CMD.VIBRATOR_OFF);
      bleWrite(CMD.POD_ALL_OFF);
      setIsMotorRunning(false);
      setVibrator(false);
      return;
    }

    setIsTraining(true);
    setLaunchCount(0);
    setActivePod(null);
    podSequenceIndexRef.current = 0;

    setVibrator(true);
    bleWrite(CMD.VIBRATOR_ON);
    await delay(500);
    if (!isTrainingRef.current) return;

    setIsMotorRunning(true);
    bleWrite(CMD.MOTOR_START);
    await delay(500);
    if (!isTrainingRef.current) return;

    bleWrite(calculateSpeedValue(speed));

    if (podCount === 0) {
      addTimer(() => {
        bleWrite(CMD.LAUNCH);
        setLaunchCount((prev) => prev + 1);
        autoLaunchRef.current = setInterval(() => {
          if (isTrainingRef.current) {
            bleWrite(CMD.LAUNCH);
            setLaunchCount((prev) => prev + 1);
          }
        }, timeInterval * 1000);
      }, 5000);
    } else {
      lightNextPod();
    }
  }

  return (
    <AppContext.Provider
      value={{
        language, setLanguage, t,
        devices, registerDevice, removeDevice,
        connectionStatus, isScanning, discoveredDevices, startScan,
        podsMode, setPodsMode, timeInterval, setTimeInterval,
        speed, setSpeed,
        vibrator, toggleVibrator, podsEnabled, togglePods, heater, toggleHeater,
        sendSpeedCommand, sendLaunchCommand, sendInitCommand,
        podCount, hasMachine, launchCount, isTraining, isMotorRunning,
        activePod, resetLaunchCount: () => setLaunchCount(0),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
