import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { translations, Language } from './i18n';
import { CMD, POD_CMD, calculateSpeedValue, bleWrite, delay, scanForDevices, connectToDevice, IS_BLE_AVAILABLE, setOnDataReceived, disconnectDevice } from './bleCommands';

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
  isMotorRunning: boolean;
  activePod: number | null;
  resetLaunchCount: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

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

  // Get sorted list of registered pod numbers
  const registeredPods = devices
    .filter((d) => d.role.startsWith('pod'))
    .map((d) => parseInt(d.role.replace('pod', ''), 10))
    .sort();
  const podCount = registeredPods.length;
  const hasMachine = devices.some((d) => d.role === 'machine');

  // Keep isTrainingRef in sync
  useEffect(() => {
    isTrainingRef.current = isTraining;
  }, [isTraining]);

  // Fetch devices on mount + setup BLE data listener
  useEffect(() => {
    fetchDevices();
    // Listen for BLE data (pod touch "05")
    setOnDataReceived((data: string) => {
      if (data === CMD.POD_TOUCHED && isTrainingRef.current) {
        // Pod was touched - handle response for active pod
        const currentPod = activePod;
        if (currentPod) {
          handlePodResponse(currentPod);
        }
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

  // Auto-adjust pods mode based on pod count
  useEffect(() => {
    if (podCount === 0) setPodsModeState('disabled');
    else if (podCount === 1) setPodsModeState('sequential');
    else if (podsMode === 'disabled') setPodsModeState('sequential');
  }, [podCount]);

  // Mock: simulate pod touch when a pod is active during training
  useEffect(() => {
    if (activePod && isTraining) {
      const mockDelay = 1500 + Math.random() * 2000; // 1.5-3.5s
      const timer = setTimeout(() => {
        if (isTrainingRef.current) {
          handlePodResponse(activePod);
        }
      }, mockDelay);
      return () => clearTimeout(timer);
    }
  }, [activePod, isTraining]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  const setPodsMode = useCallback(
    (mode: string) => {
      if (podCount === 0) return;
      if (podCount === 1 && mode !== 'sequential') return;
      setPodsModeState(mode);
    },
    [podCount]
  );

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

  // === Pod Logic ===

  function lightNextPod() {
    if (!isTrainingRef.current || registeredPods.length === 0) return;

    let nextPodNum: number;
    if (podsMode === 'random' && registeredPods.length > 1) {
      // Random: pick a different pod than current
      const available = registeredPods.filter((p) => p !== activePod);
      nextPodNum = available[Math.floor(Math.random() * available.length)];
    } else {
      // Sequential
      nextPodNum = registeredPods[podSequenceIndexRef.current % registeredPods.length];
      podSequenceIndexRef.current++;
    }

    setActivePod(nextPodNum);
    const cmd = POD_CMD[nextPodNum];
    if (cmd) bleWrite(cmd);
  }

  function handlePodResponse(podNum: number) {
    if (!isTrainingRef.current) return;

    // Turn off all pods
    bleWrite(CMD.POD_ALL_OFF);
    setActivePod(null);

    // Wait timeInterval, then launch ball and light next pod
    addTimer(() => {
      bleWrite(CMD.LAUNCH);
      setLaunchCount((prev) => prev + 1);
      lightNextPod();
    }, timeInterval * 1000);
  }

  // === BLE Command Functions ===

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

    const found: DiscoveredDevice[] = [];
    scanForDevices(
      (device) => {
        // Avoid duplicates
        if (!found.some((d) => d.mac_address === device.mac_address)) {
          found.push(device);
          setDiscoveredDevices([...found]);
        }
      },
      () => {
        setIsScanning(false);
      },
      5000
    );
  }

  // Auto-connect to registered devices on startup (BLE real only)
  async function autoConnectDevices() {
    if (!IS_BLE_AVAILABLE) return;
    for (const device of devices) {
      if (device.role !== 'unassigned') {
        const connected = await connectToDevice(device.mac_address);
        if (connected) {
          setConnectionStatus((prev) => ({ ...prev, [device.id]: 'connected' }));
        } else {
          setConnectionStatus((prev) => ({ ...prev, [device.id]: 'disconnected' }));
        }
      }
    }
  }

  // Register device and try to connect
  async function registerDeviceAndConnect(discovered: DiscoveredDevice, role: string) {
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
        // Try to connect via BLE
        if (IS_BLE_AVAILABLE) {
          await connectToDevice(discovered.mac_address);
        }
        await fetchDevices();
      }
    } catch (e) {
      console.error('Failed to register device:', e);
    }
  }

  // Vibrator: chr(12) on, chr(13) off
  function toggleVibrator() {
    const next = !vibrator;
    setVibrator(next);
    bleWrite(next ? CMD.VIBRATOR_ON : CMD.VIBRATOR_OFF);
  }

  // Pods: send B/C/D to turn on, H to turn off all
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

  // Heater: chr(38) on, chr(39) off
  function toggleHeater() {
    const next = !heater;
    setHeater(next);
    bleWrite(next ? CMD.HEATER_ON : CMD.HEATER_OFF);
  }

  // Speed: chr(36), wait 200ms, chr(speed*6+3)
  // Stop: chr(11)
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

  // Launch: chr(14)
  function sendLaunchCommand() {
    bleWrite(CMD.LAUNCH);
  }

  // Init: full training sequence
  async function sendInitCommand() {
    if (isTraining) {
      // === STOP TRAINING ===
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

    // === START TRAINING ===
    setIsTraining(true);
    setLaunchCount(0);
    setActivePod(null);
    podSequenceIndexRef.current = 0;

    // 1. Start vibrator
    setVibrator(true);
    bleWrite(CMD.VIBRATOR_ON);
    await delay(500);

    if (!isTrainingRef.current) return; // cancelled during delay

    // 2. Start motor
    setIsMotorRunning(true);
    bleWrite(CMD.MOTOR_START);
    await delay(500);

    if (!isTrainingRef.current) return;

    // 3. Set speed
    bleWrite(calculateSpeedValue(speed));

    if (podCount === 0) {
      // No pods: auto-launch mode
      // First ball after 5 seconds, then every timeInterval
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
      // Pods mode: light first pod
      lightNextPod();
    }
  }

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        devices,
        fetchDevices,
        registerDevice: registerDeviceAndConnect,
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
        isMotorRunning,
        activePod,
        resetLaunchCount: () => setLaunchCount(0),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
