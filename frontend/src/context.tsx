import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from './i18n';
import {
  CMD, POD_CMD, calculateSpeedValue,
  bleWrite, bleWriteToPod, bleWriteToAllPods,
  delay, scanForDevices, connectToDevice,
  IS_BLE_AVAILABLE, setOnDataReceived, setDeviceRoles, isDeviceConnected,
  setOnDeviceDisconnected, checkDeviceConnection, reconnectDevice,
} from './bleCommands';

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
  totalLaunchCount: number;
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
  const [timeInterval, setTimeIntervalState] = useState(2.5);
  const [speed, setSpeed] = useState(1);
  const [vibrator, setVibrator] = useState(false);
  const [podsEnabled, setPodsEnabled] = useState(false);
  const [heater, setHeater] = useState(false);
  const [isMotorRunning, setIsMotorRunning] = useState(false);
  const [launchCount, setLaunchCount] = useState(0);
  const [totalLaunchCount, setTotalLaunchCount] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [activePod, setActivePod] = useState<number | null>(null);

  const trainingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoLaunchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const podSequenceIndexRef = useRef(0);
  const isTrainingRef = useRef(false);
  const activePodRef = useRef<number | null>(null);
  const macByRoleRef = useRef<Record<string, string>>({});
  const timeIntervalRef = useRef(2.5);
  const registeredPodsRef = useRef<number[]>([]);
  const podsModeRef = useRef('disabled');

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
  useEffect(() => { activePodRef.current = activePod; }, [activePod]);
  useEffect(() => { timeIntervalRef.current = timeInterval; }, [timeInterval]);
  useEffect(() => { registeredPodsRef.current = registeredPods; }, [registeredPods.join(',')]);
  useEffect(() => { podsModeRef.current = podsMode; }, [podsMode]);

  // Update BLE role-to-MAC mapping when devices change
  useEffect(() => {
    const roles: Record<string, string> = {};
    devices.forEach((d) => {
      if (d.role !== 'unassigned') {
        roles[d.role] = d.mac_address;
      }
    });
    setDeviceRoles(roles);
    macByRoleRef.current = roles;
  }, [devices]);

  // ========== LOCAL STORAGE ==========

  async function loadDevices() {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const saved = JSON.parse(json);
        setDevices(saved);
        console.log(`[STORAGE] Loaded ${saved.length} devices`);
        return saved as Device[];
      }
    } catch (e) {
      console.error('[STORAGE] Load error:', e);
    }
    return [];
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

  // Load devices + setup BLE + auto-connect + monitor connections
  useEffect(() => {
    loadDevices().then((saved) => {
      if (IS_BLE_AVAILABLE && saved.length > 0) {
        autoConnectAll(saved);
      }
    });

    // Listen for data from ANY device (pods send "0" then "5" separately)
    setOnDataReceived((data: string, fromMac: string) => {
      console.log(`[CTX] Data received: "${data}" from ${fromMac}`);
      if (data.includes('05') && isTrainingRef.current) {
        const current = activePodRef.current;
        if (current) {
          const expectedMac = macByRoleRef.current[`pod${current}`];
          if (!expectedMac || fromMac === expectedMac) {
            console.log(`[CTX] Pod ${current} touched! Launching after timeInterval`);
            handlePodResponse(current);
          }
        }
      }
    });

    // Listen for BLE disconnections → update status + try reconnect
    setOnDeviceDisconnected((mac: string) => {
      console.log(`[CTX] Device disconnected: ${mac}`);
      // Find which device disconnected and update status
      setConnectionStatus((prev) => {
        const updated = { ...prev };
        // Find device by MAC
        for (const dev of devicesRef.current) {
          if (dev.mac_address === mac) {
            updated[dev.id] = 'disconnected';
          }
        }
        return updated;
      });

      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        const dev = devicesRef.current.find((d) => d.mac_address === mac);
        if (dev && dev.role !== 'unassigned') {
          console.log(`[CTX] Auto-reconnecting to ${dev.name}...`);
          setConnectionStatus((prev) => ({ ...prev, [dev.id]: 'connecting' }));
          reconnectDevice(mac).then((ok) => {
            setConnectionStatus((prev) => ({
              ...prev,
              [dev.id]: ok ? 'connected' : 'disconnected',
            }));
            if (!ok) {
              // Retry again in 5 seconds
              scheduleReconnect(mac, dev.id);
            }
          });
        }
      }, 3000);
    });

    // Periodic connection check every 10 seconds
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    if (IS_BLE_AVAILABLE) {
      checkInterval = setInterval(() => {
        checkAllConnections();
      }, 10000);
    }

    return () => {
      setOnDataReceived(null);
      setOnDeviceDisconnected(null);
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  const devicesRef = useRef<Device[]>([]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  function scheduleReconnect(mac: string, devId: string) {
    setTimeout(() => {
      const dev = devicesRef.current.find((d) => d.mac_address === mac);
      if (!dev || dev.role === 'unassigned') return;
      console.log(`[CTX] Retry reconnect to ${mac}...`);
      setConnectionStatus((prev) => ({ ...prev, [devId]: 'connecting' }));
      reconnectDevice(mac).then((ok) => {
        setConnectionStatus((prev) => ({
          ...prev,
          [devId]: ok ? 'connected' : 'disconnected',
        }));
      });
    }, 5000);
  }

  // Check connection status of all registered devices
  async function checkAllConnections() {
    for (const dev of devicesRef.current) {
      if (dev.role === 'unassigned') continue;
      const connected = await checkDeviceConnection(dev.mac_address);
      setConnectionStatus((prev) => {
        const currentStatus = prev[dev.id];
        if (connected && currentStatus !== 'connected') {
          return { ...prev, [dev.id]: 'connected' };
        }
        if (!connected && currentStatus === 'connected') {
          // Lost connection - try reconnect
          console.log(`[CTX] Lost connection to ${dev.name}, reconnecting...`);
          reconnectDevice(dev.mac_address).then((ok) => {
            setConnectionStatus((p) => ({
              ...p,
              [dev.id]: ok ? 'connected' : 'disconnected',
            }));
          });
          return { ...prev, [dev.id]: 'connecting' };
        }
        return prev;
      });
    }
  }

  // Auto-connect to ALL registered devices (machine + pods)
  async function autoConnectAll(deviceList: Device[]) {
    for (const dev of deviceList) {
      if (dev.role === 'unassigned') continue;
      console.log(`[BLE] Auto-connecting ${dev.role}: ${dev.mac_address}`);
      setConnectionStatus((prev) => ({ ...prev, [dev.id]: 'connecting' }));

      connectToDevice(dev.mac_address).then((ok) => {
        setConnectionStatus((prev) => ({
          ...prev,
          [dev.id]: ok ? 'connected' : 'disconnected',
        }));
      });
    }
  }

  // Update connection status when devices change (for non-BLE / mock mode)
  useEffect(() => {
    if (!IS_BLE_AVAILABLE && devices.length > 0) {
      const status: Record<string, ConnectionState> = {};
      devices.forEach((d) => { status[d.id] = 'connecting'; });
      setConnectionStatus(status);
      const timer = setTimeout(() => {
        const connected: Record<string, ConnectionState> = {};
        devices.forEach((d) => { connected[d.id] = 'connected'; });
        setConnectionStatus(connected);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [devices]);

  // Auto-adjust time interval when pods mode changes
  useEffect(() => {
    if (podsMode === 'disabled') {
      setTimeIntervalState(2.5);
    } else {
      setTimeIntervalState(1.0);
    }
  }, [podsMode]);

  function setTimeInterval(val: number) {
    setTimeIntervalState(val);
  }
  useEffect(() => {
    if (podCount === 0) setPodsModeState('disabled');
    else if (podCount === 1) setPodsModeState('sequential');
    else if (podsMode === 'disabled') setPodsModeState('sequential');
  }, [podCount]);

  // Mock: simulate pod touch when active during training (only in mock mode)
  useEffect(() => {
    if (!IS_BLE_AVAILABLE && activePod && isTraining) {
      const mockDelay = 1500 + Math.random() * 2000;
      const timer = setTimeout(() => {
        if (isTrainingRef.current) handlePodResponse(activePod);
      }, mockDelay);
      return () => clearTimeout(timer);
    }
  }, [activePod, isTraining]);

  useEffect(() => { return () => { clearAllTimers(); }; }, []);

  const setPodsMode = useCallback(
    (mode: string) => {
      // Always allow 'disabled' (user can choose no pods even if pods registered)
      if (mode === 'disabled') { setPodsModeState('disabled'); return; }
      if (podCount === 0) return;
      if (podCount === 1 && mode === 'random') return;
      setPodsModeState(mode);
    },
    [podCount]
  );

  // ========== DEVICE MANAGEMENT ==========

  async function registerDevice(discovered: DiscoveredDevice, role: string) {
    console.log(`[REG] Registering ${discovered.name} as ${role}`);
    let updated = [...devices];

    const existingIdx = updated.findIndex((d) => d.mac_address === discovered.mac_address);
    if (existingIdx >= 0) {
      updated[existingIdx] = { ...updated[existingIdx], role, name: discovered.name };
    } else {
      if (role !== 'unassigned') {
        updated = updated.map((d) => d.role === role ? { ...d, role: 'unassigned' } : d);
      }
      updated.push({
        id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mac_address: discovered.mac_address,
        name: discovered.name,
        role,
        created_at: new Date().toISOString(),
      });
    }

    await saveDevices(updated);

    // Connect BLE to this device (machine OR pod)
    if (IS_BLE_AVAILABLE) {
      setConnectionStatus((prev) => {
        const dev = updated.find((d) => d.mac_address === discovered.mac_address);
        if (dev) return { ...prev, [dev.id]: 'connecting' };
        return prev;
      });

      connectToDevice(discovered.mac_address).then((ok) => {
        const dev = updated.find((d) => d.mac_address === discovered.mac_address);
        if (dev) {
          setConnectionStatus((prev) => ({
            ...prev,
            [dev.id]: ok ? 'connected' : 'disconnected',
          }));
        }
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
    if (!isTrainingRef.current) return;
    const pods = registeredPodsRef.current;
    if (pods.length === 0) return;

    let nextPodNum: number;
    if (podsModeRef.current === 'random' && pods.length > 1) {
      const available = pods.filter((p) => p !== activePodRef.current);
      nextPodNum = available[Math.floor(Math.random() * available.length)];
    } else {
      // Sequential: cycle through pods
      nextPodNum = pods[podSequenceIndexRef.current % pods.length];
      podSequenceIndexRef.current++;
    }

    setActivePod(nextPodNum);
    const cmd = POD_CMD[nextPodNum];
    if (cmd) bleWriteToPod(nextPodNum, cmd);
  }

  function handlePodResponse(podNum: number) {
    if (!isTrainingRef.current) return;
    // Turn off the pod that was touched
    bleWriteToPod(podNum, CMD.POD_ALL_OFF);
    setActivePod(null);

    // Wait EXACT timeInterval (from ref, not stale closure), then launch + next pod
    const intervalMs = timeIntervalRef.current * 1000;
    addTimer(() => {
      bleWrite(CMD.LAUNCH);
      setLaunchCount((prev) => prev + 1);
      setTotalLaunchCount((prev) => prev + 1);
      lightNextPod();
    }, intervalMs);
  }

  // ========== COMMANDS ==========

  // Vibrator: sent to MACHINE
  function toggleVibrator() {
    const next = !vibrator;
    setVibrator(next);
    bleWrite(next ? CMD.VIBRATOR_ON : CMD.VIBRATOR_OFF);
  }

  // Pods on/off: sent to EACH POD
  function togglePods() {
    const next = !podsEnabled;
    setPodsEnabled(next);
    if (next) {
      // Turn on each registered pod with its color
      registeredPods.forEach((p) => {
        const cmd = POD_CMD[p];
        if (cmd) bleWriteToPod(p, cmd);
      });
    } else {
      // Turn off all pods
      bleWriteToAllPods(CMD.POD_ALL_OFF);
    }
  }

  // Heater: sent to MACHINE
  function toggleHeater() {
    const next = !heater;
    setHeater(next);
    bleWrite(next ? CMD.HEATER_ON : CMD.HEATER_OFF);
  }

  // Speed: sent to MACHINE
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

  // Launch: sent to MACHINE (manual launch also counts)
  function sendLaunchCommand() {
    bleWrite(CMD.LAUNCH);
    setLaunchCount((prev) => prev + 1);
    setTotalLaunchCount((prev) => prev + 1);
  }

  // Init: vibrator + motor to MACHINE, pods to respective PODS
  async function sendInitCommand() {
    if (isTraining) {
      // STOP everything
      clearAllTimers();
      setIsTraining(false);
      setActivePod(null);
      bleWrite(CMD.MOTOR_STOP);       // stop motor on machine
      bleWrite(CMD.VIBRATOR_OFF);     // stop vibrator on machine
      bleWriteToAllPods(CMD.POD_ALL_OFF); // turn off all pods
      setIsMotorRunning(false);
      setVibrator(false);
      return;
    }

    // START training
    setIsTraining(true);
    setLaunchCount(0);
    setActivePod(null);
    podSequenceIndexRef.current = 0;

    // 1. Vibrator on (machine)
    setVibrator(true);
    bleWrite(CMD.VIBRATOR_ON);
    await delay(500);
    if (!isTrainingRef.current) return;

    // 2. Motor start (machine)
    setIsMotorRunning(true);
    bleWrite(CMD.MOTOR_START);
    await delay(500);
    if (!isTrainingRef.current) return;

    // 3. Set speed (machine)
    bleWrite(calculateSpeedValue(speed));

    if (podCount === 0 || podsMode === 'disabled') {
      // No pods or pods disabled: auto-launch from machine
      // First ball after 5 seconds, then every timeInterval
      addTimer(() => {
        bleWrite(CMD.LAUNCH);
        setLaunchCount((prev) => prev + 1);
        setTotalLaunchCount((prev) => prev + 1);
        autoLaunchRef.current = setInterval(() => {
          if (isTrainingRef.current) {
            bleWrite(CMD.LAUNCH);
            setLaunchCount((prev) => prev + 1);
            setTotalLaunchCount((prev) => prev + 1);
          }
        }, timeIntervalRef.current * 1000);
      }, 5000);
    } else {
      // With pods: light first pod after 7 seconds
      addTimer(() => {
        lightNextPod();
      }, 7000);
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
        podCount, hasMachine, launchCount, totalLaunchCount, isTraining, isMotorRunning,
        activePod, resetLaunchCount: () => setLaunchCount(0),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
