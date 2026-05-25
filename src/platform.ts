import { API, StaticPlatformPlugin, Logger, PlatformConfig, AccessoryPlugin, Service, Characteristic, uuid } from 'homebridge';

import fakegato from 'fakegato-history';

import { Connection } from 'knx';

import { LightAccessory } from './accessory.js';
import { normalizePlatformConfig } from './config.js';


export class LightPlatform implements StaticPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly uuid: typeof uuid;

  public readonly fakeGatoHistoryService;

  public readonly connection: Connection;

  private readonly devices: LightAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.uuid = api.hap.uuid;
    this.fakeGatoHistoryService = fakegato(this.api);

    const normalizedConfig = normalizePlatformConfig(config);

    this.connection = new Connection({
      ipAddr: normalizedConfig.ip,
      ipPort: normalizedConfig.port,
      handlers: {
        connected: () => {
          this.log.info('KNX connected');
        },
        error: (connstatus: unknown) => {
          this.log.error(`KNX status: ${connstatus}`);
        },
      },
    });

    for (const invalidDevice of normalizedConfig.invalidDevices) {
      this.log.warn(`Skipping KNX light "${invalidDevice.name}": ${invalidDevice.reason}`);
    }

    for (const device of normalizedConfig.devices) {
      this.devices.push(new LightAccessory(this, device));
    }

    this.log.info(`Finished initializing ${this.devices.length} KNX light(s)`);
  }

  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    callback(this.devices);
  }
}
