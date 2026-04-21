// BLE Command constants for Squash Machine Trainer
// Uses react-native-ble-plx for real Bluetooth on native builds
// Falls back to console.log mock on web/Expo Go

import { Platform } from 'react-native';

let BleManager: any = null;
let bleManagerInstance: any = null;

// Try to load react-native-ble-plx (only works in native builds)
try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
} catch (e) {
  console.log('[BLE] react-native-ble-plx not available, using mock mode');
}

export const IS_BLE_AVAILABLE = BleManager !== null && Platform.OS !== 'web';

// Command constants
export const CMD = {
  MOTOR_START: String.fromCharCode(36),   // chr(36) = '$'
  MOTOR_STOP: String.fromCharCode(11),    // chr(11)
  VIBRATOR_ON: String.fromCharCode(12),   // chr(12)
  VIBRATOR_OFF: String.fromCharCode(13),  // chr(13)
  HEATER_ON: String.fromCharCode(38),     // chr(38) = '&'
  HEATER_OFF: String.fromCharCode(39),    // chr(39) = "'"
  LAUNCH: String.fromCharCode(14),        // chr(14)
  POD_BLUE_ON: 'B',    // Pod 1 = Blue
  POD_GREEN_ON: 'C',   // Pod 2 = Green
  POD_YELLOW_ON: 'D',  // Pod 3 = Yellow
  POD_ALL_OFF: 'H',    // Turn off all pods
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

// ========== BLE Manager ==========

let connectedDevice: any = null;
let writeCharacteristic: any = null;
let notifySubscription: any = null;
let onDataReceived: ((data: string) => void) | null = null;

export function getBleManager() {
  if (!IS_BLE_AVAILABLE) return null;
  if (!bleManagerInstance) {
    bleManagerInstance = new BleManager();
  }
  return bleManagerInstance;
}

export function setOnDataReceived(callback: ((data: string) => void) | null) {
  onDataReceived = callback;
}

// Scan for JDY devices
export async function scanForDevices(
  onDeviceFound: (device: { id: string; name: string; mac_address: string; rssi: number }) => void,
  onScanComplete: () => void,
  timeoutMs: number = 5000
): Promise<void> {
  const manager = getBleManager();
  if (!manager) {
    // Mock mode: return fake devices after delay
    console.log('[BLE MOCK] Scanning...');
    setTimeout(() => {
      onDeviceFound({ id: 'mock-1', name: 'JDY-32-A1B2', mac_address: 'AA:BB:CC:DD:EE:01', rssi: -42 });
      onDeviceFound({ id: 'mock-2', name: 'JDY-23-C3D4', mac_address: 'AA:BB:CC:DD:EE:02', rssi: -55 });
      onDeviceFound({ id: 'mock-3', name: 'JDY-23-E5F6', mac_address: 'AA:BB:CC:DD:EE:03', rssi: -61 });
      onDeviceFound({ id: 'mock-4', name: 'JDY-08-G7H8', mac_address: 'AA:BB:CC:DD:EE:04', rssi: -58 });
      onScanComplete();
    }, 2500);
    return;
  }

  // Real BLE scan
  const seen = new Set<string>();
  manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
    if (error) {
      console.error('[BLE] Scan error:', error);
      return;
    }
    if (!device || !device.name) return;
    // Filter for JDY devices
    const name = device.name || '';
    if (name.startsWith('JDY') && !seen.has(device.id)) {
      seen.add(device.id);
      onDeviceFound({
        id: device.id,
        name: name,
        mac_address: device.id, // On Android, device.id IS the MAC address
        rssi: device.rssi || -100,
      });
    }
  });

  // Stop scan after timeout
  setTimeout(() => {
    manager.stopDeviceScan();
    onScanComplete();
  }, timeoutMs);
}

// Connect to a device by MAC/ID
export async function connectToDevice(deviceId: string): Promise<boolean> {
  const manager = getBleManager();
  if (!manager) {
    console.log(`[BLE MOCK] Connected to ${deviceId}`);
    return true;
  }

  try {
    const device = await manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    connectedDevice = device;

    // Find the UART/serial characteristic for JDY modules
    // JDY-32/23/08 typically use FFE0 service, FFE1 characteristic
    const services = await device.services();
    for (const service of services) {
      const chars = await service.characteristics();
      for (const char of chars) {
        if (char.isWritableWithoutResponse || char.isWritableWithResponse) {
          writeCharacteristic = char;
          console.log(`[BLE] Write characteristic found: ${char.uuid}`);
        }
        if (char.isNotifiable) {
          // Subscribe to notifications (for pod responses like "05")
          notifySubscription = char.monitor((error: any, characteristic: any) => {
            if (error) {
              console.error('[BLE] Notify error:', error);
              return;
            }
            if (characteristic?.value) {
              // Decode base64 value
              const decoded = atob(characteristic.value);
              console.log(`[BLE] Received: ${decoded}`);
              if (onDataReceived) onDataReceived(decoded);
            }
          });
          console.log(`[BLE] Notify characteristic found: ${char.uuid}`);
        }
      }
    }

    // Monitor disconnection
    device.onDisconnected((error: any, disconnectedDevice: any) => {
      console.log(`[BLE] Device disconnected: ${disconnectedDevice?.id}`);
      connectedDevice = null;
      writeCharacteristic = null;
    });

    return true;
  } catch (error) {
    console.error(`[BLE] Connect error:`, error);
    return false;
  }
}

// Write data to connected device
export async function bleWrite(command: string): Promise<void> {
  const codes = command.split('').map((c) => c.charCodeAt(0));
  console.log(`[BLE] Send: ${JSON.stringify(codes)}`);

  if (!IS_BLE_AVAILABLE || !writeCharacteristic) {
    // Mock mode - just log
    return;
  }

  try {
    // Encode to base64 for react-native-ble-plx
    const base64 = btoa(command);
    if (writeCharacteristic.isWritableWithoutResponse) {
      await writeCharacteristic.writeWithoutResponse(base64);
    } else {
      await writeCharacteristic.writeWithResponse(base64);
    }
  } catch (error) {
    console.error('[BLE] Write error:', error);
  }
}

// Disconnect from current device
export async function disconnectDevice(): Promise<void> {
  if (notifySubscription) {
    notifySubscription.remove();
    notifySubscription = null;
  }
  if (connectedDevice) {
    try {
      await connectedDevice.cancelConnection();
    } catch (e) {
      // Already disconnected
    }
    connectedDevice = null;
    writeCharacteristic = null;
  }
}

// Check if BLE is powered on
export async function checkBleState(): Promise<string> {
  const manager = getBleManager();
  if (!manager) return 'Mock';
  return new Promise((resolve) => {
    const sub = manager.onStateChange((state: string) => {
      sub.remove();
      resolve(state);
    }, true);
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
