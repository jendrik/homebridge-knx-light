import { AccessoryConfig, AccessoryPlugin, CharacteristicValue, Service } from 'homebridge';

import { Datapoint } from 'knx';
import fakegato from 'fakegato-history';

import { PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_DISPLAY_NAME } from './settings';

import { LightPlatform } from './platform';

import colorsys from 'colorsys';

export const FADING_TIME_MS = 500;


export class LightAccessory implements AccessoryPlugin {
  private readonly uuid_base: string;
  private readonly name: string;
  private readonly displayName: string;
  private readonly set_status: string;
  private readonly listen_status: string;
  private readonly set_brightness: string;
  private readonly listen_brightness: string;
  private readonly set_brightness_r: string;
  private readonly listen_brightness_r: string;
  private readonly set_brightness_g: string;
  private readonly listen_brightness_g: string;
  private readonly set_brightness_b: string;
  private readonly listen_brightness_b: string;

  private readonly lightService: Service;
  private readonly loggingService: fakegato;
  private readonly informationService: Service;

  private timer;

  private r;
  private g;
  private b;
  private w;

  private hue;
  private saturation;
  private brightness;

  constructor(
    private readonly platform: LightPlatform,
    private readonly config: AccessoryConfig,
  ) {
    this.name = config.name;
    this.set_status = config.set_status;
    this.listen_status = config.listen_status;
    this.set_brightness = config.set_brightness;
    this.listen_brightness = config.listen_brightness;
    this.set_brightness_r = config.set_brightness_r;
    this.listen_brightness_r = config.listen_brightness_r;
    this.set_brightness_g = config.set_brightness_g;
    this.listen_brightness_g = config.listen_brightness_g;
    this.set_brightness_b = config.set_brightness_b;
    this.listen_brightness_b = config.listen_brightness_b;
    this.uuid_base = platform.uuid.generate(PLUGIN_NAME + '-' + this.name + '-' + this.listen_status);
    this.displayName = this.uuid_base;

    this.r = undefined;

    this.informationService = new platform.Service.AccessoryInformation()
      .setCharacteristic(platform.Characteristic.Name, this.name)
      .setCharacteristic(platform.Characteristic.Identify, this.name)
      .setCharacteristic(platform.Characteristic.Manufacturer, '@jendrik')
      .setCharacteristic(platform.Characteristic.Model, PLUGIN_DISPLAY_NAME)
      .setCharacteristic(platform.Characteristic.SerialNumber, this.displayName)
      .setCharacteristic(platform.Characteristic.FirmwareRevision, PLUGIN_VERSION);

    this.lightService = new platform.Service.Lightbulb(this.name);

    this.loggingService = new platform.fakeGatoHistoryService('switch', this, { storage: 'fs', log: platform.log });

    const dp_listen_status = new Datapoint({
      ga: this.listen_status,
      dpt: 'DPT1.001',
      autoread: true,
    }, platform.connection);

    const dp_set_status = new Datapoint({
      ga: this.set_status,
      dpt: 'DPT1.001',
    }, platform.connection);

    dp_listen_status.on('change', (oldValue: number, newValue: number) => {
      platform.log.info(`Light Status: ${newValue}`);
      this.lightService.getCharacteristic(platform.Characteristic.On).updateValue(newValue);
      this.loggingService._addEntry({ time: Math.round(new Date().valueOf() / 1000), status: newValue ? 1 : 0 });
    });

    this.lightService.getCharacteristic(platform.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        if (this.timer !== undefined) {
          // the timer is still running, so we do not accept any new ON commands from homekit
          platform.log.info(`Ignoring Set Status: ${value}`);
          //clearTimeout(this.timer);
        } else {
          platform.log.info(`Set Status: ${value}`);
          dp_set_status.write(Boolean(value));
        }
      });

    if (this.set_brightness !== undefined
      && this.set_brightness_r !== undefined
      && this.set_brightness_g !== undefined
      && this.set_brightness_b !== undefined) {
      this.lightService.addCharacteristic(platform.Characteristic.Hue);
      this.lightService.addCharacteristic(platform.Characteristic.Saturation);
      this.lightService.addCharacteristic(platform.Characteristic.Brightness);

      if (this.listen_brightness_r !== undefined) {
        const dp_listen_brightness_r = new Datapoint({
          ga: this.listen_brightness_r,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness_r.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness R: ${newValue}`);
          this.r = newValue;
        });
      }

      if (this.listen_brightness_g !== undefined) {
        const dp_listen_brightness_g = new Datapoint({
          ga: this.listen_brightness_g,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness_g.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness G: ${newValue}`);
          this.g = newValue;
        });
      }

      if (this.listen_brightness_b !== undefined) {
        const dp_listen_brightness_b = new Datapoint({
          ga: this.listen_brightness_b,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness_b.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness B: ${newValue}`);
          this.b = newValue;
        });
      }

      if (this.listen_brightness !== undefined) {
        const dp_listen_brightness = new Datapoint({
          ga: this.listen_brightness,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness W: ${newValue}`);
          this.w = newValue;
        });
      }

      const dp_set_brightness_r = new Datapoint({
        ga: this.set_brightness_r,
        dpt: 'DPT5',
      }, platform.connection);

      const dp_set_brightness_g = new Datapoint({
        ga: this.set_brightness_g,
        dpt: 'DPT5',
      }, platform.connection);

      const dp_set_brightness_b = new Datapoint({
        ga: this.set_brightness_b,
        dpt: 'DPT5',
      }, platform.connection);

      const dp_set_brightness_w = new Datapoint({
        ga: this.set_brightness,
        dpt: 'DPT5.001',
      }, platform.connection);

      this.lightService.getCharacteristic(platform.Characteristic.Hue)
        .onSet(async (value: CharacteristicValue) => {
          this.timer = setTimeout(() => {
            this.timer = undefined;
          }, FADING_TIME_MS);

          platform.log.info(`Set Hue: ${value} - ${Number(value)}`);
          this.hue = Number(value);
          if (this.hue !== undefined && this.saturation !== undefined && this.brightness !== undefined) {
            platform.log.info(`HSV ${this.hue} - ${this.saturation} - ${this.brightness}`);
            const rgb = colorsys.hsv2Rgb(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGB ${rgb.r} - ${rgb.g} - ${rgb.b}`);
            const rgbw = this.hsv2rgbw(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGBW ${rgbw.r} - ${rgbw.g} - ${rgbw.b} - ${rgbw.w}`);
            dp_set_brightness_r.write(rgbw.r);
            dp_set_brightness_g.write(rgbw.g);
            dp_set_brightness_b.write(rgbw.b);
            dp_set_brightness_w.write(rgbw.w);
          }
        });

      this.lightService.getCharacteristic(platform.Characteristic.Saturation)
        .onSet(async (value: CharacteristicValue) => {
          this.timer = setTimeout(() => {
            this.timer = undefined;
          }, FADING_TIME_MS);

          platform.log.info(`Set Saturation: ${value} - ${Number(value)}`);
          this.saturation = Number(value);
          if (this.hue !== undefined && this.saturation !== undefined && this.brightness !== undefined) {
            platform.log.info(`HSV ${this.hue} - ${this.saturation} - ${this.brightness}`);
            const rgb = colorsys.hsv2Rgb(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGB ${rgb.r} - ${rgb.g} - ${rgb.b}`);
            const rgbw = this.hsv2rgbw(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGBW ${rgbw.r} - ${rgbw.g} - ${rgbw.b} - ${rgbw.w}`);
            dp_set_brightness_r.write(rgbw.r);
            dp_set_brightness_g.write(rgbw.g);
            dp_set_brightness_b.write(rgbw.b);
            dp_set_brightness_w.write(rgbw.w);
          }
        });

      this.lightService.getCharacteristic(platform.Characteristic.Brightness)
        .onSet(async (value: CharacteristicValue) => {
          this.timer = setTimeout(() => {
            this.timer = undefined;
          }, FADING_TIME_MS);

          platform.log.info(`Set Brightness: ${value} - ${Number(value)}`);
          this.brightness = Number(value);
          if (this.hue !== undefined && this.saturation !== undefined && this.brightness !== undefined) {
            platform.log.info(`HSV ${this.hue} - ${this.saturation} - ${this.brightness}`);
            const rgb = colorsys.hsv2Rgb(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGB ${rgb.r} - ${rgb.g} - ${rgb.b}`);
            const rgbw = this.hsv2rgbw(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGBW ${rgbw.r} - ${rgbw.g} - ${rgbw.b} - ${rgbw.w}`);
            dp_set_brightness_r.write(rgbw.r);
            dp_set_brightness_g.write(rgbw.g);
            dp_set_brightness_b.write(rgbw.b);
            dp_set_brightness_w.write(rgbw.w);
          }
        });

    } else if (this.set_brightness_r !== undefined
      && this.set_brightness_g !== undefined
      && this.set_brightness_b !== undefined) {
      this.lightService.addCharacteristic(platform.Characteristic.Hue);
      this.lightService.addCharacteristic(platform.Characteristic.Saturation);
      this.lightService.addCharacteristic(platform.Characteristic.Brightness);

      if (this.listen_brightness_r !== undefined) {
        const dp_listen_brightness_r = new Datapoint({
          ga: this.listen_brightness_r,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness_r.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness R: ${newValue}`);
          this.r = newValue;
          if (this.r !== undefined && this.g !== undefined && this.b !== undefined) {
            platform.log.info(`RGB ${this.r} - ${this.g} - ${this.b}`);
            const hsv = colorsys.rgb2Hsv(this.r, this.g, this.b);
            platform.log.info(`HSV ${hsv.h} - ${hsv.s} - ${hsv.v}`);
            // this.lightService.getCharacteristic(platform.Characteristic.Hue).updateValue(hsv.h);
            // this.lightService.getCharacteristic(platform.Characteristic.Saturation).updateValue(hsv.s);
            // this.lightService.getCharacteristic(platform.Characteristic.Brightness).updateValue(hsv.v);
          }
        });
      }

      if (this.listen_brightness_g !== undefined) {
        const dp_listen_brightness_g = new Datapoint({
          ga: this.listen_brightness_g,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness_g.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness G: ${newValue}`);
          this.g = newValue;
          if (this.r !== undefined && this.g !== undefined && this.b !== undefined) {
            platform.log.info(`RGB ${this.r} - ${this.g} - ${this.b}`);
            const hsv = colorsys.rgb2Hsv(this.r, this.g, this.b);
            platform.log.info(`HSV ${hsv.h} - ${hsv.s} - ${hsv.v}`);
            // this.lightService.getCharacteristic(platform.Characteristic.Hue).updateValue(hsv.h);
            // this.lightService.getCharacteristic(platform.Characteristic.Saturation).updateValue(hsv.s);
            // this.lightService.getCharacteristic(platform.Characteristic.Brightness).updateValue(hsv.v);
          }
        });
      }

      if (this.listen_brightness_b !== undefined) {
        const dp_listen_brightness_b = new Datapoint({
          ga: this.listen_brightness_b,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness_b.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness B: ${newValue}`);
          this.b = newValue;
          if (this.r !== undefined && this.g !== undefined && this.b !== undefined) {
            platform.log.info(`RGB ${this.r} - ${this.g} - ${this.b}`);
            const hsv = colorsys.rgb2Hsv(this.r, this.g, this.b);
            platform.log.info(`HSV ${hsv.h} - ${hsv.s} - ${hsv.v}`);
            // this.lightService.getCharacteristic(platform.Characteristic.Hue).updateValue(hsv.h);
            // this.lightService.getCharacteristic(platform.Characteristic.Saturation).updateValue(hsv.s);
            // this.lightService.getCharacteristic(platform.Characteristic.Brightness).updateValue(hsv.v);
          }
        });
      }

      const dp_set_brightness_r = new Datapoint({
        ga: this.set_brightness_r,
        dpt: 'DPT5',
      }, platform.connection);

      const dp_set_brightness_g = new Datapoint({
        ga: this.set_brightness_g,
        dpt: 'DPT5',
      }, platform.connection);

      const dp_set_brightness_b = new Datapoint({
        ga: this.set_brightness_b,
        dpt: 'DPT5',
      }, platform.connection);

      this.lightService.getCharacteristic(platform.Characteristic.Hue)
        .onSet(async (value: CharacteristicValue) => {
          this.timer = setTimeout(() => {
            this.timer = undefined;
          }, FADING_TIME_MS);

          platform.log.info(`Set Hue: ${value} - ${Number(value)}`);
          this.hue = Number(value);
          if (this.hue !== undefined && this.saturation !== undefined && this.brightness !== undefined) {
            platform.log.info(`HSV ${this.hue} - ${this.saturation} - ${this.brightness}`);
            const rgb = colorsys.hsv2Rgb(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGB ${rgb.r} - ${rgb.g} - ${rgb.b}`);
            dp_set_brightness_r.write(rgb.r);
            dp_set_brightness_g.write(rgb.g);
            dp_set_brightness_b.write(rgb.b);
          }
        });

      this.lightService.getCharacteristic(platform.Characteristic.Saturation)
        .onSet(async (value: CharacteristicValue) => {
          this.timer = setTimeout(() => {
            this.timer = undefined;
          }, FADING_TIME_MS);

          platform.log.info(`Set Saturation: ${value} - ${Number(value)}`);
          this.saturation = Number(value);
          if (this.hue !== undefined && this.saturation !== undefined && this.brightness !== undefined) {
            platform.log.info(`HSV ${this.hue} - ${this.saturation} - ${this.brightness}`);
            const rgb = colorsys.hsv2Rgb(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGB ${rgb.r} - ${rgb.g} - ${rgb.b}`);
            dp_set_brightness_r.write(rgb.r);
            dp_set_brightness_g.write(rgb.g);
            dp_set_brightness_b.write(rgb.b);
          }
        });

      this.lightService.getCharacteristic(platform.Characteristic.Brightness)
        .onSet(async (value: CharacteristicValue) => {
          this.timer = setTimeout(() => {
            this.timer = undefined;
          }, FADING_TIME_MS);

          platform.log.info(`Set Brightness: ${value} - ${Number(value)}`);
          this.brightness = Number(value);
          if (this.hue !== undefined && this.saturation !== undefined && this.brightness !== undefined) {
            platform.log.info(`HSV ${this.hue} - ${this.saturation} - ${this.brightness}`);
            const rgb = colorsys.hsv2Rgb(this.hue, this.saturation, this.brightness);
            platform.log.info(`RGB ${rgb.r} - ${rgb.g} - ${rgb.b}`);
            dp_set_brightness_r.write(rgb.r);
            dp_set_brightness_g.write(rgb.g);
            dp_set_brightness_b.write(rgb.b);
          }
        });

    } else if (this.listen_brightness !== undefined || this.set_brightness !== undefined) {
      this.lightService.addCharacteristic(platform.Characteristic.Brightness);

      if (this.listen_brightness !== undefined) {
        const dp_listen_brightness = new Datapoint({
          ga: this.listen_brightness,
          dpt: 'DPT5.001',
          autoread: true,
        }, platform.connection);

        dp_listen_brightness.on('change', (oldValue: number, newValue: number) => {
          platform.log.info(`Light Brightness: ${newValue}`);
          this.lightService.getCharacteristic(platform.Characteristic.Brightness).updateValue(newValue);
          // TODO: update on/off state here as well?
        });
      }

      if (this.set_brightness !== undefined) {
        const dp_set_brightness = new Datapoint({
          ga: this.set_brightness,
          dpt: 'DPT5.001',
        }, platform.connection);

        this.lightService.getCharacteristic(platform.Characteristic.Brightness)
          .onSet(async (value: CharacteristicValue) => {
            this.timer = setTimeout(() => {
              this.timer = undefined;
            }, FADING_TIME_MS);

            platform.log.info(`Set Brightness: ${value} - ${Number(value)}`);
            dp_set_brightness.write(Number(value));
          });
      }
    }
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.lightService,
      this.loggingService,
    ];
  }

  hsv2rgbw(h, s, v) {
    const rgb = colorsys.hsv2Rgb(h, s, v);

    // Source: https://stackoverflow.com/questions/40312216/converting-rgb-to-rgbw
    const tM = Math.max(rgb.r, Math.max(rgb.g, rgb.b));
    if (tM === 0) { // black
      return { r: 0, g: 0, b: 0, w: 0 };
    }

    // This section serves to figure out what the color with 100% hue is
    const multiplier = 255.0 / tM;
    const hR = rgb.r * multiplier;
    const hG = rgb.g * multiplier;
    const hB = rgb.b * multiplier;

    // This calculates the Whiteness (not strictly speaking Luminance) of the color
    const M = Math.max(hR, Math.max(hG, hB));
    const m = Math.min(hR, Math.min(hG, hB));
    const Luminance = ((M + m) / 2.0 - 127.5) * (255.0 / 127.5) / multiplier;

    // Calculate the output values
    const Ro = Math.round(rgb.r - Luminance);
    const Go = Math.round(rgb.g - Luminance);
    const Bo = Math.round(rgb.b - Luminance);
    const Wo = Math.round(Luminance);

    return {
      r: Math.max(Math.min(Ro, 255), 0),
      g: Math.max(Math.min(Go, 255), 0),
      b: Math.max(Math.min(Bo, 255), 0),
      w: Math.max(Math.min(Wo, 255), 0),
    };
  }
}