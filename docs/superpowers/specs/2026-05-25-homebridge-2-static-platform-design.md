# Homebridge 2 Static Platform Modernization Design

## Goal

Update the plugin for Homebridge 2 only while keeping the current `StaticPlatformPlugin` integration model. Backward compatibility with Homebridge 1 and older Node runtimes is not required.

The plugin should remain recognizable to existing users of this repository: it still registers one static platform, creates KNX light accessories from platform configuration, keeps `fakegato-history`, and supports switch, dimmer, RGB, and RGBW light setups.

## Non-Goals

- Do not rewrite the plugin as a dynamic platform.
- Do not remove `fakegato-history`.
- Do not redesign the public configuration format beyond changes needed for Homebridge 2 readiness, validation correctness, and clear failures.
- Do not add unrelated UI, discovery, or KNX topology features.

## Runtime And Package Metadata

The package will target the current Homebridge 2 line:

- `engines.homebridge`: `^2.0.2`
- `engines.node`: `^22 || ^24`
- development dependency `homebridge`: `^2.0.2`

The README and CI configuration must match those supported versions. Homebridge 1, Node 18, and Node 20 references should be removed.

Dependency updates should stay focused:

- update `knx` to the latest compatible `2.5.x`
- update `fakegato-history` to the latest compatible `0.6.x`
- update `typescript-eslint` within the current major
- keep ESLint and TypeScript majors stable unless Homebridge 2 types or lockfile resolution require a larger update

## Architecture

The Homebridge entrypoint remains a default export that registers `LightPlatform` under the existing platform alias.

`LightPlatform` continues to implement `StaticPlatformPlugin`. It should own:

- Homebridge API references used by accessories
- KNX connection setup
- `fakegato-history` service creation
- platform config normalization and validation
- creation of static `LightAccessory` instances

`LightAccessory` remains the Homebridge `AccessoryPlugin` implementation. Its constructor should become a wiring layer rather than the place where every behavior is implemented inline.

The implementation should introduce small internal units for:

- typed platform and device config normalization
- light mode detection: switch, dimmer, RGB, RGBW
- KNX datapoint creation
- characteristic update handlers
- color conversion and RGB/RGBW write logic

These units can be private helpers or separate source modules. Separate modules are preferred when they make tests clearer or keep `accessory.ts` focused.

## Configuration

The existing config field names can stay:

- platform fields: `ip`, `port`, `devices`
- device fields: `name`, `set_status`, `listen_status`, `set_brightness`, `listen_brightness`, `set_brightness_r`, `listen_brightness_r`, `set_brightness_g`, `listen_brightness_g`, `set_brightness_b`, `listen_brightness_b`

The schema and runtime parser should be tightened:

- `port` is a number in `config.schema.json`, matching README examples and runtime usage
- `devices` is required in the schema
- each valid device requires `name`, `set_status`, and `listen_status`
- KNX group address fields use the existing group-address pattern
- incomplete required RGB set addresses do not create RGB characteristics
- incomplete required RGBW set addresses do not create RGBW behavior
- optional listen addresses may be omitted without disabling the corresponding set capability

Invalid devices should be skipped with a clear log message that includes the device name when available. Invalid optional feature sets should log which capability was skipped and which address is missing.

## Light Modes

Mode detection should be explicit and deterministic:

1. Switch mode is always present for valid devices.
2. Dimmer mode is enabled when `set_brightness` or `listen_brightness` is configured and the device is not using that brightness address as the RGBW white channel.
3. RGB mode is enabled when all RGB set addresses are configured.
4. RGBW mode is enabled when all RGB set addresses and `set_brightness` are configured.

RGBW takes precedence over plain RGB because the existing plugin treats `set_brightness` as the white channel when RGB set addresses are also present.

## Behavior

On/off behavior:

- `On` writes boolean values to `set_status` using `DPT1.001`
- `listen_status` updates the `On` characteristic
- status changes add `fakegato-history` entries with the existing switch history shape

Brightness behavior:

- `Brightness` writes numeric values to `set_brightness` using `DPT5.001`
- `listen_brightness` updates the `Brightness` characteristic for dimmer mode

RGB behavior:

- `Hue`, `Saturation`, and `Brightness` are exposed together
- hue, saturation, and brightness setters update local color state
- a single shared write path emits RGB channel values when all three color state values are known

RGBW behavior:

- `Hue`, `Saturation`, and `Brightness` are exposed together
- the shared color write path converts HSV to RGBW
- red, green, blue, and white values are written to their configured KNX group addresses

The current short timer that suppresses new `On` commands during color fades should be preserved initially, but typed and documented in code. Any behavioral change to that debounce should be tested separately from the Homebridge 2 upgrade.

## Error Handling And Logging

Logs should identify the device and group address involved where practical.

The plugin should log:

- KNX connection success
- KNX connection errors
- skipped devices caused by missing required config
- skipped optional capabilities caused by incomplete address sets
- characteristic writes at debug level when possible, or concise info level if no debug API is available

The plugin should avoid throwing from normal config mistakes after Homebridge has loaded the platform. Bad devices should not prevent valid devices from being exposed.

## Testing And Verification

Add a test script and focused tests that do not require a KNX router.

Tests should cover:

- platform config normalization defaults
- invalid device rejection
- mode detection for switch, dimmer, RGB, and RGBW
- HSV to RGBW conversion edge cases
- characteristic wiring helpers where they can be tested without a real Homebridge runtime

Required local verification:

- `npm run lint`
- `npm run build`
- `npm test`

CI should run lint, build, and tests. If practical, run the CI matrix on Node 22 and Node 24 to match the Homebridge 2 supported runtime range.

## Migration Notes

This change intentionally drops Homebridge 1 and Node 18/20 support. Users should run Homebridge 2 on Node 22 or Node 24 before installing the updated plugin.

The static platform config remains the expected shape. Users should not need to migrate to dynamic accessory configuration.
