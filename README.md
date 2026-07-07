# Diesel Heater Card

A Home Assistant Lovelace custom card for a Chinese diesel night heater. It combines heater state, power, fuel remaining, chamber temperature, heat-level controls, and live fan/pump/duty stats into one compact dark card.

The shipped `diesel-heater-card.js` is self-contained and has no runtime dependencies.

## Install

### HACS

1. HACS -> three-dot menu -> **Custom repositories**.
2. Add this repository as category **Dashboard**.
3. Install **Diesel Heater Card**.
4. HACS should add the dashboard resource automatically. If not, add it manually:

   ```yaml
   url: /hacsfiles/diesel-heater-card/diesel-heater-card.js
   type: module
   ```

### Manual

1. Copy `diesel-heater-card.js` into your Home Assistant `config/www/` directory, for example `config/www/diesel-heater-card/`.
2. Add the dashboard resource:

   ```yaml
   url: /local/diesel-heater-card/diesel-heater-card.js
   type: module
   ```

## Example

```yaml
type: custom:diesel-heater-card
entity_state: sensor.chinese_night_heater_state
entity_chamber_temp: sensor.chinese_night_heater_chamber_temperature
entity_fan: sensor.chinese_night_heater_fan_speed
entity_pump: sensor.chinese_night_heater_pump_frequency
entity_duty: sensor.chinese_night_heater_duty_cycle
entity_power: button.chinese_night_heater_power
entity_duty_set: input_number.heater_duty
entity_duty_up: button.chinese_night_heater_up
entity_duty_down: button.chinese_night_heater_down
entity_fuel: input_number.diesel_heater_fuel_level
fuel_max_litres: 20
temp_decimals: 1
```

## Options

| Option | Default | Description |
|---|---:|---|
| `entity_state` | — | Heater state sensor. |
| `entity_chamber_temp` | — | Chamber temperature sensor. |
| `entity_fan` | — | Fan speed sensor, shown as RPM. |
| `entity_pump` | — | Pump frequency sensor, shown as Hz. |
| `entity_duty` | — | Current duty cycle sensor, shown as %. |
| `entity_power` | — | Button entity pressed by the Power control. |
| `entity_duty_set` | — | `input_number` used for the heat-level set value. The card steps this helper, so existing automations can translate it into heater up/down presses. |
| `entity_duty_up` / `entity_duty_down` | — | Optional fallback button entities used only if no set-duty input number is available. |
| `entity_fuel` | — | Fuel remaining `input_number`, shown in litres. |
| `fuel_max_litres` | `20` | Fuel level that represents a full tank. |
| `temp_decimals` | `1` | Chamber temperature decimal places. |

## Development

Open `preview.test.html` through a local web server to preview the card with stub Home Assistant data.

Useful query parameters:

```text
preview.test.html?state=Running&duty=70&set=9&fuel=4.2&temp=92&fan=2200&pump=3.5
preview.test.html?state=Cooling&duty=15&set=3&fuel=17.9
preview.test.html?state=Fault&duty=0&fuel=1.5
```
