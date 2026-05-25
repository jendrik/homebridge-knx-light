import { AccessoryPlugin, CharacteristicValue, Service } from 'homebridge';

import { Datapoint } from 'knx';
import fakegato from 'fakegato-history';

import { PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_DISPLAY_NAME } from './settings.js';

import { hsvToRgb, hsvToRgbw } from './color.js';
import { detectLightMode, type LightDeviceConfig } from './config.js';
import { createDatapoint } from './datapoints.js';
import type { LightPlatform } from './platform.js';

export const FADING_TIME_MS = 500;


export class LightAccessory implements AccessoryPlugin {
  private readonly uuid_base: string;
  private readonly name: string;
  private readonly displayName: string;

  private readonly lightService: Service;
  private readonly loggingService: fakegato;
  private readonly informationService: Service;

  private timer: ReturnType<typeof setTimeout> | undefined;

  private red: number | undefined;
  private green: number | undefined;
  private blue: number | undefined;
  private white: number | undefined;

  private hue: number | undefined;
  private saturation: number | undefined;
  private brightness: number | undefined;

  constructor(
    private readonly platform: LightPlatform,
    private readonly config: LightDeviceConfig,
  ) {
    this.name = config.name;
    this.uuid_base = platform.uuid.generate(PLUGIN_NAME + '-' + this.name + '-' + this.config.listenStatus);
    this.displayName = this.uuid_base;

    this.informationService = new platform.Service.AccessoryInformation()
      .setCharacteristic(platform.Characteristic.Name, this.name)
      .setCharacteristic(platform.Characteristic.Manufacturer, '@jendrik')
      .setCharacteristic(platform.Characteristic.Model, PLUGIN_DISPLAY_NAME)
      .setCharacteristic(platform.Characteristic.SerialNumber, this.displayName)
      .setCharacteristic(platform.Characteristic.FirmwareRevision, PLUGIN_VERSION);

    this.lightService = new platform.Service.Lightbulb(this.name);

    this.loggingService = new platform.fakeGatoHistoryService('switch', this, { storage: 'fs', log: platform.log });

    this.configureOnCharacteristic();

    const mode = detectLightMode(config);
    if (mode.rgb || mode.rgbw) {
      this.configureColorMode(mode.rgbw);
    } else if (mode.dimmer) {
      this.configureDimmerMode();
    }
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.lightService,
      this.loggingService,
    ];
  }

  private configureOnCharacteristic(): void {
    const dpListenStatus = createDatapoint(this.platform.connection, {
      groupAddress: this.config.listenStatus,
      dpt: 'DPT1.001',
      autoread: true,
    });

    const dpSetStatus = createDatapoint(this.platform.connection, {
      groupAddress: this.config.setStatus,
      dpt: 'DPT1.001',
    });

    dpListenStatus.on('change', (_oldValue: unknown, newValue: unknown) => {
      const status = Boolean(newValue);
      this.platform.log.info(`${this.name}: status ${this.config.listenStatus} -> ${status}`);
      this.lightService.getCharacteristic(this.platform.Characteristic.On).updateValue(status);
      this.loggingService._addEntry({ time: Math.round(Date.now() / 1000), status: status ? 1 : 0 });
    });

    this.lightService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        if (this.timer !== undefined) {
          this.platform.log.info(`${this.name}: ignoring on/off write during color fade`);
          return;
        }

        const status = Boolean(value);
        this.platform.log.info(`${this.name}: set ${this.config.setStatus} -> ${status}`);
        dpSetStatus.write(status);
      });
  }

  private configureDimmerMode(): void {
    this.lightService.addCharacteristic(this.platform.Characteristic.Brightness);

    if (this.config.listenBrightness) {
      const dpListenBrightness = createDatapoint(this.platform.connection, {
        groupAddress: this.config.listenBrightness,
        dpt: 'DPT5.001',
        autoread: true,
      });

      dpListenBrightness.on('change', (_oldValue: unknown, newValue: unknown) => {
        const brightness = Number(newValue);
        this.platform.log.info(`${this.name}: brightness ${this.config.listenBrightness} -> ${brightness}`);
        this.lightService.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(brightness);
      });
    }

    if (this.config.setBrightness) {
      const dpSetBrightness = createDatapoint(this.platform.connection, {
        groupAddress: this.config.setBrightness,
        dpt: 'DPT5.001',
      });

      this.lightService.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(async (value: CharacteristicValue) => {
          this.startFadeTimer();

          const brightness = Number(value);
          this.platform.log.info(`${this.name}: set brightness ${this.config.setBrightness} -> ${brightness}`);
          dpSetBrightness.write(brightness);
        });
    }
  }

  private configureColorMode(rgbw: boolean): void {
    this.lightService.addCharacteristic(this.platform.Characteristic.Hue);
    this.lightService.addCharacteristic(this.platform.Characteristic.Saturation);
    this.lightService.addCharacteristic(this.platform.Characteristic.Brightness);

    this.configureColorListenDatapoints(rgbw);

    const dpSetRed = this.createRequiredDatapoint(this.config.setBrightnessR, 'DPT5');
    const dpSetGreen = this.createRequiredDatapoint(this.config.setBrightnessG, 'DPT5');
    const dpSetBlue = this.createRequiredDatapoint(this.config.setBrightnessB, 'DPT5');
    const dpSetWhite = rgbw ? this.createRequiredDatapoint(this.config.setBrightness, 'DPT5.001') : undefined;

    const writeColorState = (): void => {
      if (this.hue === undefined || this.saturation === undefined || this.brightness === undefined) {
        return;
      }

      if (rgbw) {
        const rgbwValue = hsvToRgbw(this.hue, this.saturation, this.brightness);
        this.platform.log.info(
          `${this.name}: set RGBW -> ${rgbwValue.r}/${rgbwValue.g}/${rgbwValue.b}/${rgbwValue.w}`,
        );
        dpSetRed.write(rgbwValue.r);
        dpSetGreen.write(rgbwValue.g);
        dpSetBlue.write(rgbwValue.b);
        dpSetWhite?.write(rgbwValue.w);
        return;
      }

      const rgbValue = hsvToRgb(this.hue, this.saturation, this.brightness);
      this.platform.log.info(`${this.name}: set RGB -> ${rgbValue.r}/${rgbValue.g}/${rgbValue.b}`);
      dpSetRed.write(rgbValue.r);
      dpSetGreen.write(rgbValue.g);
      dpSetBlue.write(rgbValue.b);
    };

    this.lightService.getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(async (value: CharacteristicValue) => {
        this.startFadeTimer();
        this.hue = Number(value);
        this.platform.log.info(`${this.name}: hue -> ${this.hue}`);
        writeColorState();
      });

    this.lightService.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(async (value: CharacteristicValue) => {
        this.startFadeTimer();
        this.saturation = Number(value);
        this.platform.log.info(`${this.name}: saturation -> ${this.saturation}`);
        writeColorState();
      });

    this.lightService.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(async (value: CharacteristicValue) => {
        this.startFadeTimer();
        this.brightness = Number(value);
        this.platform.log.info(`${this.name}: brightness -> ${this.brightness}`);
        writeColorState();
      });
  }

  private configureColorListenDatapoints(rgbw: boolean): void {
    this.configureOptionalColorListenDatapoint(this.config.listenBrightnessR, 'R', value => {
      this.red = value;
    });
    this.configureOptionalColorListenDatapoint(this.config.listenBrightnessG, 'G', value => {
      this.green = value;
    });
    this.configureOptionalColorListenDatapoint(this.config.listenBrightnessB, 'B', value => {
      this.blue = value;
    });

    if (rgbw) {
      this.configureOptionalColorListenDatapoint(this.config.listenBrightness, 'W', value => {
        this.white = value;
      });
    }
  }

  private configureOptionalColorListenDatapoint(
    groupAddress: string | undefined,
    channel: string,
    update: (value: number) => void,
  ): void {
    if (!groupAddress) {
      return;
    }

    const datapoint = createDatapoint(this.platform.connection, {
      groupAddress,
      dpt: 'DPT5.001',
      autoread: true,
    });

    datapoint.on('change', (_oldValue: unknown, newValue: unknown) => {
      const channelValue = Number(newValue);
      update(channelValue);
      this.platform.log.info(`${this.name}: color ${channel} ${groupAddress} -> ${channelValue}`);
    });
  }

  private createRequiredDatapoint(groupAddress: string | undefined, dpt: string): Datapoint {
    if (!groupAddress) {
      throw new Error(`${this.name}: missing required KNX group address for ${dpt}`);
    }

    return createDatapoint(this.platform.connection, {
      groupAddress,
      dpt,
    });
  }

  private startFadeTimer(): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
    }, FADING_TIME_MS);
  }
}
