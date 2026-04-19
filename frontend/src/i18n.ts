export type Language = 'en' | 'es';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Tabs
    controls: 'Controls',
    devices: 'Devices',
    settings: 'Settings',

    // Connection
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    machine: 'Machine',
    pod: 'Pod',
    noDevices: 'No devices registered',

    // Controls
    podsMode: 'PODS MODE',
    disabled: 'Disabled',
    sequential: 'Sequential',
    random: 'Random',
    timeInterval: 'TIME INTERVAL',
    seconds: 'sec',
    speed: 'SPEED',
    speedBtn: 'SPEED',
    launch: 'LAUNCH',
    init: 'INIT',
    noMachineWarning: 'No machine connected. Go to Devices tab to register.',
    commandSent: 'Command Sent',
    speedStarted: 'Motors started at speed',
    ballLaunched: 'Ball launch triggered',
    trainingStarted: 'Training session initiated',

    // Devices
    scanDevices: 'SCAN FOR DEVICES',
    scanning: 'Scanning...',
    noDevicesFound: 'No devices found. Tap scan to search.',
    registeredDevices: 'REGISTERED DEVICES',
    discoveredDevices: 'DISCOVERED DEVICES',
    remove: 'Remove',
    assignAs: 'Assign as:',
    unassigned: 'Unassigned',
    signalStrength: 'Signal',

    // Settings
    vibrator: 'Vibrator',
    pods: 'Pods',
    heater: 'Heater',
    language: 'Language',
    on: 'ON',
    off: 'OFF',
    english: 'English',
    spanish: 'Español',
    deviceControls: 'DEVICE CONTROLS',
    appSettings: 'APP SETTINGS',
    vibratorOn: 'Vibrator activated',
    vibratorOff: 'Vibrator deactivated',
    podsOn: 'Pods activated',
    podsOff: 'Pods deactivated',
    heaterOn: 'Heater activated',
    heaterOff: 'Heater deactivated',

    // BLE Note
    bleMockNote: 'BLE is simulated in preview. Real Bluetooth works on device.',
  },
  es: {
    // Tabs
    controls: 'Controles',
    devices: 'Dispositivos',
    settings: 'Ajustes',

    // Connection
    connected: 'Conectado',
    connecting: 'Conectando...',
    disconnected: 'Desconectado',
    machine: 'Máquina',
    pod: 'Pod',
    noDevices: 'Sin dispositivos registrados',

    // Controls
    podsMode: 'MODO PODS',
    disabled: 'Desactivado',
    sequential: 'Secuencial',
    random: 'Aleatorio',
    timeInterval: 'INTERVALO DE TIEMPO',
    seconds: 'seg',
    speed: 'VELOCIDAD',
    speedBtn: 'VELOCIDAD',
    launch: 'LANZAR',
    init: 'INICIAR',
    noMachineWarning: 'Sin máquina conectada. Ve a Dispositivos para registrar.',
    commandSent: 'Comando Enviado',
    speedStarted: 'Motores iniciados a velocidad',
    ballLaunched: 'Lanzamiento de bola activado',
    trainingStarted: 'Sesión de entrenamiento iniciada',

    // Devices
    scanDevices: 'BUSCAR DISPOSITIVOS',
    scanning: 'Buscando...',
    noDevicesFound: 'Sin dispositivos. Toca buscar para escanear.',
    registeredDevices: 'DISPOSITIVOS REGISTRADOS',
    discoveredDevices: 'DISPOSITIVOS ENCONTRADOS',
    remove: 'Eliminar',
    assignAs: 'Asignar como:',
    unassigned: 'Sin asignar',
    signalStrength: 'Señal',

    // Settings
    vibrator: 'Vibrador',
    pods: 'Pods',
    heater: 'Calentador',
    language: 'Idioma',
    on: 'ON',
    off: 'OFF',
    english: 'English',
    spanish: 'Español',
    deviceControls: 'CONTROLES DEL EQUIPO',
    appSettings: 'AJUSTES DE LA APP',
    vibratorOn: 'Vibrador activado',
    vibratorOff: 'Vibrador desactivado',
    podsOn: 'Pods activados',
    podsOff: 'Pods desactivados',
    heaterOn: 'Calentador activado',
    heaterOff: 'Calentador desactivado',

    // BLE Note
    bleMockNote: 'BLE simulado en preview. Bluetooth real funciona en dispositivo.',
  },
};
