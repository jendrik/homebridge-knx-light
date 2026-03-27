# Homebridge KNX Light

Homebridge plugin for controlling KNX lights via Apple HomeKit.

## Features

- On/Off switching via KNX group addresses
- Brightness control (dimming)
- RGB color control
- RGBW color control (with white channel)
- HSV to RGB/RGBW conversion
- Eve history support via [fakegato-history](https://github.com/simont77/fakegato-history)

## Requirements

- [Homebridge](https://homebridge.io) v1.8.0 or later (including v2.0)
- Node.js v18.20.4, v20.15.1, or v22+
- A KNX IP router or interface

## Installation

### Via Homebridge UI

Search for `homebridge-knx-light` in the Homebridge UI plugin search and install it.

### Via CLI

```sh
npm install -g @jendrik/homebridge-knx-light
```

## Configuration

Configure the plugin through the Homebridge UI or add the following to your `config.json`:

```json
{
  "platforms": [
    {
      "platform": "knx-light",
      "ip": "224.0.23.12",
      "port": 3671,
      "devices": [
        {
          "name": "Living Room Light",
          "set_status": "1/1/1",
          "listen_status": "1/1/2"
        }
      ]
    }
  ]
}
```

### Platform Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `platform` | Yes | — | Must be `knx-light` |
| `ip` | No | `224.0.23.12` | IP address of the KNX router or interface |
| `port` | No | `3671` | KNX port |
| `devices` | Yes | — | Array of light devices |

### Device Options

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Display name for the light |
| `set_status` | Yes | KNX group address for switching (e.g. `1/1/1`) |
| `listen_status` | Yes | KNX group address for status feedback |
| `set_brightness` | No | KNX group address for setting brightness (white/dimmer) |
| `listen_brightness` | No | KNX group address for brightness feedback |
| `set_brightness_r` | No | KNX group address for setting red channel |
| `listen_brightness_r` | No | KNX group address for red channel feedback |
| `set_brightness_g` | No | KNX group address for setting green channel |
| `listen_brightness_g` | No | KNX group address for green channel feedback |
| `set_brightness_b` | No | KNX group address for setting blue channel |
| `listen_brightness_b` | No | KNX group address for blue channel feedback |

### Light Modes

The plugin supports three modes depending on which addresses you configure:

**On/Off only** — Provide only `set_status` and `listen_status`.

**Dimmable** — Additionally provide `set_brightness` and/or `listen_brightness`.

**RGB color** — Provide `set_brightness_r`, `set_brightness_g`, and `set_brightness_b`. Optionally add `listen_brightness_r/g/b` for feedback.

**RGBW color** — Provide all RGB addresses plus `set_brightness` (used as the white channel). Optionally add `listen_brightness` for white channel feedback.

### Example: RGBW Light

```json
{
  "name": "LED Strip",
  "set_status": "1/1/1",
  "listen_status": "1/1/2",
  "set_brightness": "1/1/3",
  "listen_brightness": "1/1/4",
  "set_brightness_r": "1/1/5",
  "listen_brightness_r": "1/1/6",
  "set_brightness_g": "1/1/7",
  "listen_brightness_g": "1/1/8",
  "set_brightness_b": "1/1/9",
  "listen_brightness_b": "1/1/10"
}
```

## Development

### Setup

```sh
npm install
npm run build
```

### Watch Mode

```sh
npm run watch
```

This will build the plugin, link it to Homebridge, and restart on source changes.

### Lint

```sh
npm run lint
```

## License

[Apache-2.0](LICENSE)
