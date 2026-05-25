import type { PlatformConfig } from 'homebridge';

const DEFAULT_KNX_IP = '224.0.23.12';
const DEFAULT_KNX_PORT = 3671;

export interface LightDeviceConfig {
  readonly name: string;
  readonly setStatus: string;
  readonly listenStatus: string;
  readonly skippedCapabilities: string[];
  readonly setBrightness?: string;
  readonly listenBrightness?: string;
  readonly setBrightnessR?: string;
  readonly listenBrightnessR?: string;
  readonly setBrightnessG?: string;
  readonly listenBrightnessG?: string;
  readonly setBrightnessB?: string;
  readonly listenBrightnessB?: string;
}

export interface LightMode {
  readonly dimmer: boolean;
  readonly rgb: boolean;
  readonly rgbw: boolean;
}

export interface InvalidDeviceConfig {
  readonly name: string;
  readonly reason: string;
}

export interface NormalizedPlatformConfig {
  readonly ip: string;
  readonly port: number;
  readonly devices: LightDeviceConfig[];
  readonly invalidDevices: InvalidDeviceConfig[];
}

type RawPlatformConfig = PlatformConfig | Record<string, unknown>;
type RawDeviceConfig = Record<string, unknown>;

function isRecord(value: unknown): value is RawDeviceConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readPort(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_KNX_PORT;
}

function requiredMissingFields(fields: Record<string, string | undefined>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value === undefined)
    .map(([field]) => field);
}

function skippedCapabilities(fields: Record<string, string | undefined>): string[] {
  const rgbFields = {
    set_brightness_r: fields.set_brightness_r,
    set_brightness_g: fields.set_brightness_g,
    set_brightness_b: fields.set_brightness_b,
  };
  const configuredRgbFields = Object.values(rgbFields).filter(Boolean).length;

  if (configuredRgbFields === 0 || configuredRgbFields === Object.keys(rgbFields).length) {
    return [];
  }

  const missingRgbFields = requiredMissingFields(rgbFields);
  const skippedMode = fields.set_brightness ? 'RGB/RGBW' : 'RGB';

  return [
    `${skippedMode} color disabled; missing required field(s): ${missingRgbFields.join(', ')}`,
  ];
}

function normalizeDeviceConfig(rawDevice: unknown): LightDeviceConfig | InvalidDeviceConfig {
  if (!isRecord(rawDevice)) {
    return {
      name: 'Unnamed light',
      reason: 'device must be an object',
    };
  }

  const name = readString(rawDevice.name);
  const setStatus = readString(rawDevice.set_status);
  const listenStatus = readString(rawDevice.listen_status);
  const setBrightness = readString(rawDevice.set_brightness);
  const listenBrightness = readString(rawDevice.listen_brightness);
  const setBrightnessR = readString(rawDevice.set_brightness_r);
  const listenBrightnessR = readString(rawDevice.listen_brightness_r);
  const setBrightnessG = readString(rawDevice.set_brightness_g);
  const listenBrightnessG = readString(rawDevice.listen_brightness_g);
  const setBrightnessB = readString(rawDevice.set_brightness_b);
  const listenBrightnessB = readString(rawDevice.listen_brightness_b);
  const missingFields = requiredMissingFields({
    name,
    set_status: setStatus,
    listen_status: listenStatus,
  });

  if (missingFields.length > 0 || !name || !setStatus || !listenStatus) {
    return {
      name: name ?? 'Unnamed light',
      reason: `missing required field(s): ${missingFields.join(', ')}`,
    };
  }

  return {
    name,
    setStatus,
    listenStatus,
    skippedCapabilities: skippedCapabilities({
      set_brightness: setBrightness,
      set_brightness_r: setBrightnessR,
      set_brightness_g: setBrightnessG,
      set_brightness_b: setBrightnessB,
    }),
    setBrightness,
    listenBrightness,
    setBrightnessR,
    listenBrightnessR,
    setBrightnessG,
    listenBrightnessG,
    setBrightnessB,
    listenBrightnessB,
  };
}

export function normalizePlatformConfig(config: RawPlatformConfig): NormalizedPlatformConfig {
  const ip = readString(config.ip) ?? DEFAULT_KNX_IP;
  const port = readPort(config.port);
  const rawDevices = Array.isArray(config.devices) ? config.devices : [];
  const devices: LightDeviceConfig[] = [];
  const invalidDevices: InvalidDeviceConfig[] = [];

  for (const rawDevice of rawDevices) {
    const normalizedDevice = normalizeDeviceConfig(rawDevice);

    if ('reason' in normalizedDevice) {
      invalidDevices.push(normalizedDevice);
    } else {
      devices.push(normalizedDevice);
    }
  }

  return {
    ip,
    port,
    devices,
    invalidDevices,
  };
}

export function detectLightMode(device: LightDeviceConfig): LightMode {
  const rgb = Boolean(device.setBrightnessR && device.setBrightnessG && device.setBrightnessB);
  const rgbw = rgb && Boolean(device.setBrightness);

  return {
    dimmer: Boolean((device.setBrightness || device.listenBrightness) && !rgbw),
    rgb,
    rgbw,
  };
}
