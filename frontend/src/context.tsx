import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from './i18n';
import {
  CMD, POD_CMD, REGISTER_POINT_CMD, GOTO_POINT_CMD,
  calculateSpeedValue, bleWrite, bleWriteToPod, bleWriteToAllPods,
  delay, scanForDevices, connectToDevice,
  IS_BLE_AVAILABLE, setOnDataReceived, setDeviceRoles, isDeviceConnected,
  setOnDeviceDisconnected, checkDeviceConnection, reconnectDevice,
} from './bleCommands';

export interface Device { id: string; mac_address: string; name: string; role: string; created_at: string; }
export interface DiscoveredDevice { id: string; name: string; mac_address: string; rssi: number; }
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
export type MachineType = 'lite' | 'pro';
export type ShotMode = 'fixed' | 'sequential' | 'random';

interface AppContextType {
  language: Language; setLanguage: (l: Language) => void; t: (k: string) => string;
  machineType: MachineType; setMachineType: (t: MachineType) => void;
  devices: Device[];
  registerDevice: (d: DiscoveredDevice, role: string) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  connectionStatus: Record<string, ConnectionState>;
  isScanning: boolean; discoveredDevices: DiscoveredDevice[]; startScan: () => void;
  podsMode: string; setPodsMode: (m: string) => void;
  timeInterval: number; setTimeInterval: (t: number) => void;
  speed: number; setSpeed: (s: number) => void;
  vibrator: boolean; toggleVibrator: () => void;
  podsEnabled: boolean; togglePods: () => void;
  heater: boolean; toggleHeater: () => void;
  sendSpeedCommand: () => void; sendLaunchCommand: () => void; sendInitCommand: () => void;
  podCount: number; hasMachine: boolean;
  launchCount: number; totalLaunchCount: number;
  isTraining: boolean; isMotorRunning: boolean;
  activePod: number | null; resetLaunchCount: () => void;
  // Pro features
  laserOn: boolean; toggleLaser: () => void;
  moveHead: (dir: 'up' | 'down' | 'left' | 'right') => void;
  programmedShots: boolean[]; registerShot: (point: number) => void;
  goToShot: (point: number) => void; resetShots: () => void;
  shotMode: ShotMode; setShotMode: (m: ShotMode) => void;
  configuredShotCount: number;
}

const AppContext = createContext<AppContextType | null>(null);
const STORAGE_KEY = '@smt_devices';
const MACHINE_TYPE_KEY = '@smt_machine_type';

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [machineType, setMachineTypeState] = useState<MachineType>('lite');
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
  // Pro state
  const [laserOn, setLaserOn] = useState(false);
  const [programmedShots, setProgrammedShots] = useState<boolean[]>([false, false, false, false]);
  const [shotMode, setShotModeState] = useState<ShotMode>('fixed');

  const trainingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoLaunchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const podSequenceIndexRef = useRef(0);
  const shotSequenceIndexRef = useRef(0);
  const isTrainingRef = useRef(false);
  const activePodRef = useRef<number | null>(null);
  const macByRoleRef = useRef<Record<string, string>>({});
  const timeIntervalRef = useRef(2.5);
  const registeredPodsRef = useRef<number[]>([]);
  const podsModeRef = useRef('disabled');
  const shotModeRef = useRef<ShotMode>('fixed');
  const programmedShotsRef = useRef<boolean[]>([false, false, false, false]);
  const machineTypeRef = useRef<MachineType>('lite');
  const devicesRef = useRef<Device[]>([]);

  const t = useCallback((key: string) => translations[language][key] || key, [language]);

  const registeredPods = devices.filter((d) => d.role.startsWith('pod')).map((d) => parseInt(d.role.replace('pod', ''), 10)).sort();
  const podCount = registeredPods.length;
  const hasMachine = devices.some((d) => d.role === 'machine');
  const configuredShotCount = programmedShots.filter(Boolean).length;
  const configuredShotIndices = programmedShots.map((v, i) => v ? i + 1 : -1).filter((v) => v > 0);

  // Keep refs synced
  useEffect(() => { isTrainingRef.current = isTraining; }, [isTraining]);
  useEffect(() => { activePodRef.current = activePod; }, [activePod]);
  useEffect(() => { timeIntervalRef.current = timeInterval; }, [timeInterval]);
  useEffect(() => { registeredPodsRef.current = registeredPods; }, [registeredPods.join(',')]);
  useEffect(() => { podsModeRef.current = podsMode; }, [podsMode]);
  useEffect(() => { shotModeRef.current = shotMode; }, [shotMode]);
  useEffect(() => { programmedShotsRef.current = programmedShots; }, [programmedShots]);
  useEffect(() => { machineTypeRef.current = machineType; }, [machineType]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // Role-to-MAC mapping
  useEffect(() => {
    const roles: Record<string, string> = {};
    devices.forEach((d) => { if (d.role !== 'unassigned') roles[d.role] = d.mac_address; });
    setDeviceRoles(roles);
    macByRoleRef.current = roles;
  }, [devices]);

  // ========== STORAGE ==========
  async function loadDevices() {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) { const saved = JSON.parse(json); setDevices(saved); return saved as Device[]; }
    } catch (e) { console.error('[STORAGE] Load error:', e); }
    return [];
  }
  async function saveDevices(nd: Device[]) {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nd)); setDevices(nd); } catch (e) { console.error('[STORAGE] Save error:', e); }
  }
  async function loadMachineType() {
    try { const v = await AsyncStorage.getItem(MACHINE_TYPE_KEY); if (v === 'pro' || v === 'lite') { setMachineTypeState(v); machineTypeRef.current = v; } } catch (e) {}
  }
  function setMachineType(t: MachineType) {
    setMachineTypeState(t); machineTypeRef.current = t;
    AsyncStorage.setItem(MACHINE_TYPE_KEY, t).catch(() => {});
  }

  // ========== INIT + BLE MONITORING ==========
  useEffect(() => {
    loadMachineType();
    loadDevices().then((saved) => { if (IS_BLE_AVAILABLE && saved.length > 0) autoConnectAll(saved); });

    setOnDataReceived((data: string, fromMac: string) => {
      if (data.includes('05') && isTrainingRef.current) {
        const current = activePodRef.current;
        if (current) {
          const expectedMac = macByRoleRef.current[`pod${current}`];
          if (!expectedMac || fromMac === expectedMac) handlePodResponse(current);
        }
      }
    });

    setOnDeviceDisconnected((mac: string) => {
      setConnectionStatus((prev) => {
        const updated = { ...prev };
        for (const dev of devicesRef.current) { if (dev.mac_address === mac) updated[dev.id] = 'disconnected'; }
        return updated;
      });
      setTimeout(() => {
        const dev = devicesRef.current.find((d) => d.mac_address === mac);
        if (dev && dev.role !== 'unassigned') {
          setConnectionStatus((prev) => ({ ...prev, [dev.id]: 'connecting' }));
          reconnectDevice(mac).then((ok) => {
            setConnectionStatus((prev) => ({ ...prev, [dev.id]: ok ? 'connected' : 'disconnected' }));
            if (!ok) setTimeout(() => {
              reconnectDevice(mac).then((ok2) => { setConnectionStatus((p) => ({ ...p, [dev.id]: ok2 ? 'connected' : 'disconnected' })); });
            }, 5000);
          });
        }
      }, 3000);
    });

    let checkInterval: ReturnType<typeof setInterval> | null = null;
    if (IS_BLE_AVAILABLE) {
      checkInterval = setInterval(() => {
        for (const dev of devicesRef.current) {
          if (dev.role === 'unassigned') continue;
          checkDeviceConnection(dev.mac_address).then((ok) => {
            setConnectionStatus((prev) => {
              if (ok && prev[dev.id] !== 'connected') return { ...prev, [dev.id]: 'connected' };
              if (!ok && prev[dev.id] === 'connected') {
                reconnectDevice(dev.mac_address).then((r) => { setConnectionStatus((p) => ({ ...p, [dev.id]: r ? 'connected' : 'disconnected' })); });
                return { ...prev, [dev.id]: 'connecting' };
              }
              return prev;
            });
          });
        }
      }, 10000);
    }
    return () => { setOnDataReceived(null); setOnDeviceDisconnected(null); if (checkInterval) clearInterval(checkInterval); };
  }, []);

  async function autoConnectAll(list: Device[]) {
    for (const dev of list) {
      if (dev.role === 'unassigned') continue;
      setConnectionStatus((p) => ({ ...p, [dev.id]: 'connecting' }));
      connectToDevice(dev.mac_address).then((ok) => { setConnectionStatus((p) => ({ ...p, [dev.id]: ok ? 'connected' : 'disconnected' })); });
    }
  }

  // Mock connection for web
  useEffect(() => {
    if (!IS_BLE_AVAILABLE && devices.length > 0) {
      const s: Record<string, ConnectionState> = {}; devices.forEach((d) => { s[d.id] = 'connecting'; }); setConnectionStatus(s);
      const t = setTimeout(() => { const c: Record<string, ConnectionState> = {}; devices.forEach((d) => { c[d.id] = 'connected'; }); setConnectionStatus(c); }, 1500);
      return () => clearTimeout(t);
    }
  }, [devices]);

  // Auto-adjust time + pods mode
  useEffect(() => { setTimeIntervalState(podsMode === 'disabled' ? 2.5 : 1.0); }, [podsMode]);
  useEffect(() => {
    if (podCount === 0) setPodsModeState('disabled');
    else if (podCount === 1 && podsMode !== 'disabled') setPodsModeState('sequential');
  }, [podCount]);

  // Mock pod touch (web only)
  useEffect(() => {
    if (!IS_BLE_AVAILABLE && activePod && isTraining) {
      const t = setTimeout(() => { if (isTrainingRef.current) handlePodResponse(activePod); }, 1500 + Math.random() * 2000);
      return () => clearTimeout(t);
    }
  }, [activePod, isTraining]);

  useEffect(() => { return () => { clearAllTimers(); }; }, []);

  function setTimeInterval(v: number) { setTimeIntervalState(v); }
  const setPodsMode = useCallback((mode: string) => {
    if (mode === 'disabled') { setPodsModeState('disabled'); return; }
    if (podCount === 0) return;
    if (podCount === 1 && mode === 'random') return;
    setPodsModeState(mode);
  }, [podCount]);
  function setShotMode(m: ShotMode) { setShotModeState(m); }

  // ========== DEVICE MANAGEMENT ==========
  async function registerDevice(discovered: DiscoveredDevice, role: string) {
    let updated = [...devices];
    const idx = updated.findIndex((d) => d.mac_address === discovered.mac_address);
    if (idx >= 0) { updated[idx] = { ...updated[idx], role, name: discovered.name }; }
    else {
      if (role !== 'unassigned') updated = updated.map((d) => d.role === role ? { ...d, role: 'unassigned' } : d);
      updated.push({ id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mac_address: discovered.mac_address, name: discovered.name, role, created_at: new Date().toISOString() });
    }
    await saveDevices(updated);
    if (IS_BLE_AVAILABLE) {
      const dev = updated.find((d) => d.mac_address === discovered.mac_address);
      if (dev) { setConnectionStatus((p) => ({ ...p, [dev.id]: 'connecting' })); connectToDevice(discovered.mac_address).then((ok) => { setConnectionStatus((p) => ({ ...p, [dev.id]: ok ? 'connected' : 'disconnected' })); }); }
    }
  }
  async function removeDevice(id: string) { await saveDevices(devices.filter((d) => d.id !== id)); }

  function startScan() {
    setIsScanning(true); setDiscoveredDevices([]);
    const found: DiscoveredDevice[] = [];
    scanForDevices((d) => { if (!found.some((f) => f.mac_address === d.mac_address)) { found.push(d); setDiscoveredDevices([...found]); } }, () => { setIsScanning(false); }, 8000);
  }

  // ========== TRAINING ==========
  function clearAllTimers() {
    trainingTimersRef.current.forEach(clearTimeout); trainingTimersRef.current = [];
    if (autoLaunchRef.current) { clearInterval(autoLaunchRef.current); autoLaunchRef.current = null; }
  }
  function addTimer(fn: () => void, ms: number) {
    const t = setTimeout(() => { if (isTrainingRef.current) fn(); }, ms);
    trainingTimersRef.current.push(t); return t;
  }

  function getNextShotPoint(): number | null {
    const shots = programmedShotsRef.current;
    const indices = shots.map((v, i) => v ? i + 1 : -1).filter((v) => v > 0);
    if (indices.length === 0) return null;
    const mode = shotModeRef.current;
    if (mode === 'fixed') return null;
    if (mode === 'random' && indices.length > 1) {
      return indices[Math.floor(Math.random() * indices.length)];
    }
    const pt = indices[shotSequenceIndexRef.current % indices.length];
    shotSequenceIndexRef.current++;
    return pt;
  }

  function lightNextPod() {
    if (!isTrainingRef.current) return;
    const pods = registeredPodsRef.current;
    if (pods.length === 0) return;
    let next: number;
    if (podsModeRef.current === 'random' && pods.length > 1) {
      const avail = pods.filter((p) => p !== activePodRef.current);
      next = avail[Math.floor(Math.random() * avail.length)];
    } else {
      next = pods[podSequenceIndexRef.current % pods.length];
      podSequenceIndexRef.current++;
    }
    setActivePod(next);
    const cmd = POD_CMD[next];
    if (cmd) bleWriteToPod(next, cmd);
  }

  function moveToNextShot() {
    if (machineTypeRef.current !== 'pro') return;
    const pt = getNextShotPoint();
    if (pt) {
      const cmd = GOTO_POINT_CMD[pt];
      if (cmd) bleWrite(cmd);
    }
  }

  function handlePodResponse(podNum: number) {
    if (!isTrainingRef.current) return;
    bleWriteToPod(podNum, CMD.POD_ALL_OFF);
    setActivePod(null);
    const ms = timeIntervalRef.current * 1000;
    addTimer(() => {
      bleWrite(CMD.LAUNCH);
      setLaunchCount((p) => p + 1);
      setTotalLaunchCount((p) => p + 1);
      moveToNextShot(); // Pro: move to next position after launch
      lightNextPod();
    }, ms);
  }

  // ========== COMMANDS ==========
  function toggleVibrator() { const n = !vibrator; setVibrator(n); bleWrite(n ? CMD.VIBRATOR_ON : CMD.VIBRATOR_OFF); }
  function togglePods() {
    const n = !podsEnabled; setPodsEnabled(n);
    if (n) { registeredPods.forEach((p) => { const c = POD_CMD[p]; if (c) bleWriteToPod(p, c); }); }
    else { bleWriteToAllPods(CMD.POD_ALL_OFF); }
  }
  function toggleHeater() { const n = !heater; setHeater(n); bleWrite(n ? CMD.HEATER_ON : CMD.HEATER_OFF); }
  function toggleLaser() { const n = !laserOn; setLaserOn(n); bleWrite(n ? CMD.LASER_ON : CMD.LASER_OFF); }
  function moveHead(dir: 'up' | 'down' | 'left' | 'right') {
    const cmds = { up: CMD.HEAD_UP, down: CMD.HEAD_DOWN, left: CMD.HEAD_LEFT, right: CMD.HEAD_RIGHT };
    bleWrite(cmds[dir]);
  }
  function registerShot(point: number) {
    const cmd = REGISTER_POINT_CMD[point];
    if (cmd) { bleWrite(cmd); const ns = [...programmedShots]; ns[point - 1] = true; setProgrammedShots(ns); }
  }
  function goToShot(point: number) { const cmd = GOTO_POINT_CMD[point]; if (cmd) bleWrite(cmd); }
  function resetShots() { setProgrammedShots([false, false, false, false]); shotSequenceIndexRef.current = 0; }

  async function sendSpeedCommand() {
    if (isMotorRunning) { setIsMotorRunning(false); bleWrite(CMD.MOTOR_STOP); }
    else { setIsMotorRunning(true); bleWrite(CMD.MOTOR_START); await delay(200); bleWrite(calculateSpeedValue(speed)); }
  }
  function sendLaunchCommand() { bleWrite(CMD.LAUNCH); setLaunchCount((p) => p + 1); setTotalLaunchCount((p) => p + 1); }

  async function sendInitCommand() {
    if (isTraining) {
      clearAllTimers(); setIsTraining(false); setActivePod(null);
      bleWrite(CMD.MOTOR_STOP); bleWrite(CMD.VIBRATOR_OFF); bleWriteToAllPods(CMD.POD_ALL_OFF);
      setIsMotorRunning(false); setVibrator(false);
      return;
    }
    setIsTraining(true); setLaunchCount(0); setActivePod(null);
    podSequenceIndexRef.current = 0; shotSequenceIndexRef.current = 0;

    setVibrator(true); bleWrite(CMD.VIBRATOR_ON); await delay(500);
    if (!isTrainingRef.current) return;
    setIsMotorRunning(true); bleWrite(CMD.MOTOR_START); await delay(500);
    if (!isTrainingRef.current) return;
    bleWrite(calculateSpeedValue(speed));

    // Pro: move to first shot position
    if (machineTypeRef.current === 'pro' && shotModeRef.current !== 'fixed' && configuredShotCount > 0) {
      moveToNextShot();
    }

    const usePods = podsModeRef.current !== 'disabled' && registeredPodsRef.current.length > 0;
    if (usePods) {
      addTimer(() => { lightNextPod(); }, 7000);
    } else {
      addTimer(() => {
        bleWrite(CMD.LAUNCH); setLaunchCount((p) => p + 1); setTotalLaunchCount((p) => p + 1);
        autoLaunchRef.current = setInterval(() => {
          if (isTrainingRef.current) {
            bleWrite(CMD.LAUNCH); setLaunchCount((p) => p + 1); setTotalLaunchCount((p) => p + 1);
            moveToNextShot();
          }
        }, timeIntervalRef.current * 1000);
      }, 5000);
    }
  }

  return (
    <AppContext.Provider value={{
      language, setLanguage, t, machineType, setMachineType,
      devices, registerDevice, removeDevice, connectionStatus, isScanning, discoveredDevices, startScan,
      podsMode, setPodsMode, timeInterval, setTimeInterval, speed, setSpeed,
      vibrator, toggleVibrator, podsEnabled, togglePods, heater, toggleHeater,
      sendSpeedCommand, sendLaunchCommand, sendInitCommand,
      podCount, hasMachine, launchCount, totalLaunchCount, isTraining, isMotorRunning,
      activePod, resetLaunchCount: () => setLaunchCount(0),
      laserOn, toggleLaser, moveHead,
      programmedShots, registerShot, goToShot, resetShots,
      shotMode, setShotMode, configuredShotCount,
    }}>
      {children}
    </AppContext.Provider>
  );
}
