// BLE Command constants for Squash Machine Trainer
// Supports MULTIPLE simultaneous BLE connections (machine + pods)

import { Platform, PermissionsAndroid } from 'react-native';

let BleManager: any = null;
let bleManagerInstance: any = null;

try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
} catch (e) {
  console.log('[BLE] react-native-ble-plx not available, using mock mode');
}

export const IS_BLE_AVAILABLE = BleManager !== null && Platform.OS !== 'web';

// Command constants
export const CMD = {
  MOTOR_START: String.fromCharCode(36),   // chr(36)
  MOTOR_STOP: String.fromCharCode(11),    // chr(11)
  VIBRATOR_ON: String.fromCharCode(12),   // chr(12)
  VIBRATOR_OFF: String.fromCharCode(13),  // chr(13)
  HEATER_ON: String.fromCharCode(38),     // chr(38)
  HEATER_OFF: String.fromCharCode(39),    // chr(39)
  LAUNCH: String.fromCharCode(14),        // chr(14)
  POD_BLUE_ON: 'B',    // Pod 1 = Blue
  POD_GREEN_ON: 'C',   // Pod 2 = Green
  POD_YELLOW_ON: 'D',  // Pod 3 = Yellow
  POD_ALL_OFF: 'H',    // Turn off pod
  POD_TOUCHED: '05',   // Response from pod when touched
};

export const POD_CMD: Record<number, string> = {
  1: CMD.POD_BLUE_ON,
  2: CMD.POD_GREEN_ON,
  3: CMD.POD_YELLOW_ON,
};

export function calculateSpeedValue(speed: number): string {
  return String.fromCharCode(speed * 6 + 3);
}

// ========== MULTI-CONNECTION BLE MANAGER ==========

interface BleConnection {
  device: any;
  writeChar: any;
  notifySub: any;
}

// Store connections by MAC address
const connections: Record<string, BleConnection> = {};

// Role-to-MAC mapping (set by the app)
let macByRole: Record<string, string> = {};

let onDataReceived: ((data: string, fromMac: string) => void) | null = null;

export function getBleManager() {
  if (!IS_BLE_AVAILABLE) return null;
  if (!bleManagerInstance) {
    bleManagerInstance = new BleManager();
  }
  return bleManagerInstance;
}

let onDeviceDisconnected: ((mac: string) => void) | null = null;

export function setOnDeviceDisconnected(callback: ((mac: string) => void) | null) {
  onDeviceDisconnected = callback;
}

export function setOnDataReceived(callback: ((data: string, fromMac: string) => void) | null) {
  onDataReceived = callback;
}

// Set which MAC corresponds to which role
export function setDeviceRoles(roles: Record<string, string>) {
  macByRole = roles; // e.g. { machine: 'AA:BB:...', pod1: 'CC:DD:...' }
  console.log('[BLE] Roles set:', JSON.stringify(roles));
}

// Request Android BLE permissions
async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        { title: 'Bluetooth', message: 'Need location for BLE scan', buttonPositive: 'OK' }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (e) {
    console.error('[BLE] Permission error:', e);
    return false;
  }
}

async function waitForBlePoweredOn(): Promise<boolean> {
  const manager = getBleManager();
  if (!manager) return false;
  return new Promise((resolve) => {
    const sub = manager.onStateChange((state: string) => {
      if (state === 'PoweredOn') { sub.remove(); resolve(true); }
    }, true);
    setTimeout(() => { sub.remove(); resolve(false); }, 5000);
  });
}

// Scan for JDY devices
export async function scanForDevices(
  onDeviceFound: (device: { id: string; name: string; mac_address: string; rssi: number }) => void,
  onScanComplete: () => void,
  timeoutMs: number = 8000
): Promise<void> {
  const manager = getBleManager();
  if (!manager) {
    console.log('[BLE MOCK] Scanning...');
    setTimeout(() => {
      onDeviceFound({ id: 'mock-1', name: 'JDY-32-A1B2', mac_address: 'AA:BB:CC:DD:EE:01', rssi: -42 });
      onDeviceFound({ id: 'mock-2', name: 'JDY-23-C3D4', mac_address: 'AA:BB:CC:DD:EE:02', rssi: -55 });
      onDeviceFound({ id: 'mock-3', name: 'JDY-23-E5F6', mac_address: 'AA:BB:CC:DD:EE:03', rssi: -61 });
      onScanComplete();
    }, 2500);
    return;
  }

  const hasPermission = await requestBlePermissions();
  if (!hasPermission) { onScanComplete(); return; }

  const powered = await waitForBlePoweredOn();
  if (!powered) { onScanComplete(); return; }

  console.log('[BLE] Starting scan...');
  const seen = new Set<string>();

  manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
    if (error) { console.error('[BLE] Scan error:', error.message); return; }
    if (!device) return;

    const deviceName = device.name || device.localName || '';
    if (!deviceName || seen.has(device.id)) return;
    if (!deviceName.toUpperCase().includes('JDY')) return;

    seen.add(device.id);
    console.log(`[BLE] Found: ${deviceName} (${device.id}) RSSI:${device.rssi}`);
    onDeviceFound({
      id: device.id,
      name: deviceName,
      mac_address: device.id,
      rssi: device.rssi || -100,
    });
  });

  setTimeout(() => {
    manager.stopDeviceScan();
    console.log(`[BLE] Scan done. Found ${seen.size} devices`);
    onScanComplete();
  }, timeoutMs);
}

// Connect to a device and store the connection
export async function connectToDevice(deviceMac: string): Promise<boolean> {
  const manager = getBleManager();
  if (!manager) {
    console.log(`[BLE MOCK] Connected to ${deviceMac}`);
    return true;
  }

  // Already connected?
  if (connections[deviceMac]?.device) {
    try {
      const isConn = await connections[deviceMac].device.isConnected();
      if (isConn) {
        console.log(`[BLE] Already connected to ${deviceMac}`);
        return true;
      }
    } catch (e) { /* not connected */ }
  }

  try {
    console.log(`[BLE] Connecting to ${deviceMac}...`);
    const device = await manager.connectToDevice(deviceMac, { timeout: 10000 });
    await device.discoverAllServicesAndCharacteristics();

    let writeChar: any = null;
    let notifySub: any = null;

    const services = await device.services();
    for (const service of services) {
      const chars = await service.characteristics();
      for (const char of chars) {
        const uuid = char.uuid.toLowerCase();

        // Write characteristic (prefer FFE1 for JDY modules)
        if (!writeChar && (uuid.includes('ffe1') || char.isWritableWithoutResponse || char.isWritableWithResponse)) {
          writeChar = char;
          console.log(`[BLE] ${deviceMac} write char: ${uuid}`);
        }

// Buffer per device to accumulate incoming data (pods send "0" and "5" separately)
const dataBuffers: Record<string, string> = {};
const bufferTimers: Record<string, ReturnType<typeof setTimeout>> = {};

        // Notify characteristic (for receiving data like "05" from pods)
        if (char.isNotifiable) {
          notifySub = char.monitor((error: any, characteristic: any) => {
            if (error) return;
            if (characteristic?.value) {
              try {
                const decoded = atob(characteristic.value);
                console.log(`[BLE] Raw from ${deviceMac}: "${decoded}" (${decoded.split('').map(c => c.charCodeAt(0))})`);

                // Accumulate in buffer - pods may send "0" then "5" separately
                if (!dataBuffers[deviceMac]) dataBuffers[deviceMac] = '';
                dataBuffers[deviceMac] += decoded;

                // Clear previous timer and set new one
                if (bufferTimers[deviceMac]) clearTimeout(bufferTimers[deviceMac]);
                bufferTimers[deviceMac] = setTimeout(() => {
                  const buffered = dataBuffers[deviceMac] || '';
                  dataBuffers[deviceMac] = '';
                  if (buffered.length > 0) {
                    console.log(`[BLE] Buffered from ${deviceMac}: "${buffered}"`);
                    if (onDataReceived) onDataReceived(buffered, deviceMac);
                  }
                }, 100); // Wait 100ms for more data before processing

                // Also check immediately if we have "05" in buffer
                if (dataBuffers[deviceMac].includes('05')) {
                  if (bufferTimers[deviceMac]) clearTimeout(bufferTimers[deviceMac]);
                  const buffered = dataBuffers[deviceMac];
                  dataBuffers[deviceMac] = '';
                  console.log(`[BLE] Got "05" from ${deviceMac}`);
                  if (onDataReceived) onDataReceived(buffered, deviceMac);
                }
              } catch (e) { /* decode error */ }
            }
          });
          console.log(`[BLE] ${deviceMac} notify char: ${uuid}`);
        }
      }
    }

    connections[deviceMac] = { device, writeChar, notifySub };

    device.onDisconnected(() => {
      console.log(`[BLE] Disconnected: ${deviceMac}`);
      if (connections[deviceMac]?.notifySub) {
        connections[deviceMac].notifySub.remove();
      }
      delete connections[deviceMac];
      // Notify context about disconnection
      if (onDeviceDisconnected) onDeviceDisconnected(deviceMac);
    });

    console.log(`[BLE] Connected to ${deviceMac} ✓`);
    return true;
  } catch (error: any) {
    console.error(`[BLE] Connect error ${deviceMac}:`, error.message || error);
    return false;
  }
}

// Write to a SPECIFIC device by MAC
export async function bleWriteTo(deviceMac: string, command: string): Promise<void> {
  const codes = command.split('').map((c) => c.charCodeAt(0));
  console.log(`[BLE] Send to ${deviceMac}: ${JSON.stringify(codes)}`);

  if (!IS_BLE_AVAILABLE) return;

  const conn = connections[deviceMac];
  if (!conn?.writeChar) {
    console.warn(`[BLE] No write char for ${deviceMac}`);
    return;
  }

  try {
    const base64 = btoa(command);
    if (conn.writeChar.isWritableWithoutResponse) {
      await conn.writeChar.writeWithoutResponse(base64);
    } else {
      await conn.writeChar.writeWithResponse(base64);
    }
  } catch (error: any) {
    console.error(`[BLE] Write error ${deviceMac}:`, error.message || error);
  }
}

// Write to MACHINE
export async function bleWrite(command: string): Promise<void> {
  const machineMac = macByRole['machine'];
  if (machineMac) {
    await bleWriteTo(machineMac, command);
  } else {
    const codes = command.split('').map((c) => c.charCodeAt(0));
    console.log(`[BLE] Send (no machine): ${JSON.stringify(codes)}`);
  }
}

// Write to a specific POD by pod number (1, 2, 3)
export async function bleWriteToPod(podNum: number, command: string): Promise<void> {
  const podMac = macByRole[`pod${podNum}`];
  if (podMac) {
    await bleWriteTo(podMac, command);
  } else {
    console.log(`[BLE] Pod ${podNum} not registered, can't send`);
  }
}

// Write to ALL pods
export async function bleWriteToAllPods(command: string): Promise<void> {
  const podKeys = Object.keys(macByRole).filter((k) => k.startsWith('pod'));
  for (const key of podKeys) {
    await bleWriteTo(macByRole[key], command);
  }
}

// Disconnect all
export async function disconnectAll(): Promise<void> {
  for (const mac of Object.keys(connections)) {
    try {
      if (connections[mac].notifySub) connections[mac].notifySub.remove();
      await connections[mac].device.cancelConnection();
    } catch (e) { /* already disconnected */ }
  }
}

// Check if a device is connected
export function isDeviceConnected(mac: string): boolean {
  return !!connections[mac];
}

// Check actual connection status of a device (async)
export async function checkDeviceConnection(mac: string): Promise<boolean> {
  const manager = getBleManager();
  if (!manager) return true; // mock mode

  const conn = connections[mac];
  if (!conn?.device) return false;

  try {
    const connected = await conn.device.isConnected();
    return connected;
  } catch (e) {
    return false;
  }
}

// Try to reconnect a disconnected device
export async function reconnectDevice(mac: string): Promise<boolean> {
  console.log(`[BLE] Attempting reconnect to ${mac}...`);
  // Clean up old connection if any
  if (connections[mac]) {
    try {
      if (connections[mac].notifySub) connections[mac].notifySub.remove();
    } catch (e) { /* ignore */ }
    delete connections[mac];
  }
  return await connectToDevice(mac);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
