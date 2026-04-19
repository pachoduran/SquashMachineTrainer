# Squash Machine Trainer Lite - PRD

## Overview
Mobile app to control a squash ball training machine via Bluetooth BLE. Supports device registration (machine + up to 3 sensor pods), training controls, and device settings.

## Features

### 1. Device Registration (Devices Tab)
- Scan for BLE devices (JDY-23/JDY-08/JDY-32)
- Register devices with roles: Machine, Pod 1, Pod 2, Pod 3
- Persistent storage via MongoDB backend
- Connection status indicators in header (green=connected, yellow=connecting, red=disconnected)
- Remove registered devices

### 2. Training Controls (Controls Tab)
- **Pods Mode**: Disabled (0 pods), Sequential (1 pod), Sequential/Random (2-3 pods)
- **Time Interval**: 0.1s to 10.0s with +/- steppers
- **Speed**: 0-10 with +/- steppers
- **Action Buttons**: Speed (start motors), Launch (fire balls), Init (start training)

### 3. Settings Tab
- Vibrator on/off toggle
- Pods on/off toggle
- Heater on/off toggle (red accent for safety)
- Language switcher (English / Español)

### 4. Bilingual Support
- Full EN/ES translation throughout the app
- Switchable via Settings

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 with expo-router
- **Backend**: FastAPI + MongoDB
- **BLE**: MOCKED in preview (ready for react-native-ble-plx integration)

## API Endpoints
- `GET /api/devices` - List registered devices
- `POST /api/devices` - Register/update device
- `PUT /api/devices/{id}` - Update device role
- `DELETE /api/devices/{id}` - Remove device

## Design
- Dark theme (#050505 base) matching logo aesthetic
- Blue (#3B82F6) primary, Red (#EF4444) for heater/danger, Green (#10B981) for success/init
- Large touch targets for sports use

## Next Steps
- Integrate real BLE via react-native-ble-plx (requires dev build)
- Implement serial commands to Arduino Mega via JDY-32
- Add training session history/analytics
