// BLE Command constants for Squash Machine Trainer
// These map to the serial commands sent to the Arduino Mega via JDY-32

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

// Mock BLE write - logs command for debugging
// In real implementation, this writes to BLE characteristic
export async function bleWrite(command: string): Promise<void> {
  const codes = command.split('').map((c) => c.charCodeAt(0));
  console.log(`[BLE] Send: ${JSON.stringify(codes)} (${command})`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
