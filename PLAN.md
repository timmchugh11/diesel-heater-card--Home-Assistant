# Diesel Heater Card — Plan

A Home Assistant Lovelace custom card for the Chinese diesel night heater, in the
same dark style as `suspension-card`, packaged as its own **self-contained,
HACS-installable** single-file card.

It replaces the current dashboard heater section (a 5-entity glance + a 3-row
entities card) with one designed card covering the same **8 items**, plus the
existing up/down duty buttons for control.

> **Reference:** use the sibling repo
> `C:\Users\timmc\Documents\HomeAssistant\suspension-card--Home-Assistant`
> as the template for both **styling** (dark card, container-query responsive
> layout, `--ha-card-border-radius` framing, gauge/panel treatment, tab/button
> styles, colour accents) and **scaffolding** (repo structure, `hacs.json` /
> `package.json`, single self-contained `.js` entry, `HTMLElement` card + visual
> editor pattern, the local headless-Chrome render harness for testing). Copy and
> adapt rather than starting from scratch.

---

## Entities (from the live `lovelace` dashboard)

| # | Role | Entity | Type / unit | Now |
|---|------|--------|-------------|-----|
| 1 | Chamber temp | `sensor.chinese_night_heater_chamber_temperature` | °C | 24 |
| 2 | Pump frequency | `sensor.chinese_night_heater_pump_frequency` | Hz | 0 |
| 3 | Fan speed | `sensor.chinese_night_heater_fan_speed` | RPM | 0 |
| 4 | Duty (current) | `sensor.chinese_night_heater_duty_cycle` | % | ~4 |
| 5 | State | `sensor.chinese_night_heater_state` | text | Off |
| 6 | Power | `button.chinese_night_heater_power` | button (press) | — |
| 7 | Heat level (set) | `input_number.heater_duty` | number (slider) | 9 |
| 8 | Fuel remaining | `input_number.diesel_heater_fuel_level` | Litres | 17.9 |

**Also available (for control / future):**
- `button.chinese_night_heater_up` / `button.chinese_night_heater_down` — nudge duty (the `Diesel Heater Duty` automation syncs actual → set).
- `sensor.chinese_night_heater_set_duty` — the heater's own reported set duty (mirror of `input_number.heater_duty`).
- `input_boolean.diesel_heater_thermo`, `climate.diesel_heater` — thermostat mode / target temp (out of scope for v1; the current dashboard doesn't use them).

---

## Layout (dark card, same design language as suspension-card)

3 columns with a header and a stats row, collapsing gracefully via **container
queries** (responds to the card's own width, like suspension-card).

```
┌──────────────────────────────────────────────────────────────┐
│  🔥 DIESEL HEATER                     [ Off ]        [ Power ] │  header: title · state pill · power
├───────────────┬──────────────────────────┬───────────────────┤
│               │                          │                   │
│   FUEL        │      CHAMBER TEMP         │    HEAT LEVEL     │
│   ▓▓▓▓        │        24 °C              │       9           │
│   ▓▓▓▓        │      (flame visual        │     ▲  ▼          │  duty stepper (input_number
│   ▓▓▓▓        │       scales w/ duty)     │   set 9 · now 4%  │  .heater_duty + up/down)
│   17.9 L      │        [ Running ]        │                   │
│               │                          │                   │
├───────────────┴──────────────────────────┴───────────────────┤
│     Fan 0 RPM    ·    Pump 0.0 Hz    ·    Duty 4 %            │  live stats row
└──────────────────────────────────────────────────────────────┘
```

- **Header** — flame icon + "DIESEL HEATER"; a **state pill** colour-coded from
  `sensor.chinese_night_heater_state` (grey = Off, amber = starting/priming,
  orange/green = running normally, red = fault/cooldown); a **Power** button
  bound to `button.chinese_night_heater_power` (press), highlighted while the
  heater is not Off.
- **Left — Fuel tank** — full-height vertical gauge (reusing the suspension-card
  gauge treatment) filling with fuel %, litres value centred. Tank capacity
  configurable (`fuel_max_litres`, e.g. 20 L).
- **Centre — Flame / temperature** — large chamber-temp readout with an
  **animated flame** whose height/opacity/flicker scales with the current duty
  cycle (idle = tiny ember, high duty = tall flame). CSS/SVG only, no assets.
  State text under it.
- **Right — Heat level** — big **set-duty** number with **▲ / ▼** buttons.
  Primary action sets `input_number.heater_duty` (`input_number.set_value`,
  clamped to its min/max/step); optionally also fire the `_up`/`_down` buttons.
  Shows set vs current duty %.
- **Bottom — stats row** — Fan RPM · Pump Hz · Duty % as three compact tiles.

---

## Config schema (all entities configurable via the visual editor)

```yaml
type: custom:diesel-heater-card
entity_state: sensor.chinese_night_heater_state
entity_chamber_temp: sensor.chinese_night_heater_chamber_temperature
entity_fan: sensor.chinese_night_heater_fan_speed
entity_pump: sensor.chinese_night_heater_pump_frequency
entity_duty: sensor.chinese_night_heater_duty_cycle          # current %
entity_power: button.chinese_night_heater_power              # press to toggle
entity_duty_set: input_number.heater_duty                    # heat-level control
entity_duty_up: button.chinese_night_heater_up               # optional nudge
entity_duty_down: button.chinese_night_heater_down           # optional nudge
entity_fuel: input_number.diesel_heater_fuel_level
fuel_max_litres: 20
temp_decimals: 1
```

- Legacy-free (new card), but the editor mirrors suspension-card's: grouped
  dropdowns filtered by domain (sensor / button / input_number), numeric fields.
- Duty control writes `input_number.set_value` on `entity_duty_set`, reading its
  `min`/`max`/`step` attributes; if `entity_duty_up`/`down` are set, ▲/▼ press
  those instead (so the heater's own stepping/automation stays authoritative).

---

## Packaging & build

- **New git repo** `diesel-heater-card--Home-Assistant`, HACS category
  **Dashboard**, `hacs.json` `filename: diesel-heater-card.js`, `content_in_root`.
- **Single self-contained file** — the flame and gauges are pure CSS/SVG, so
  unlike suspension-card there are **no image/model assets to inline and no build
  step**: `diesel-heater-card.js` is authored directly and shipped as-is.
  (If we later add a raster asset, add the same `build.mjs` base64 approach.)
- Files: `diesel-heater-card.js`, `hacs.json`, `package.json`, `README.md`.

---

## Interactions

- **Power** → `button.press` on `entity_power`; button styled active while state ≠ Off.
- **Heat level ▲/▼** → clamp and `input_number.set_value` on `entity_duty_set`
  (or press `entity_duty_up`/`down` if configured).
- **State pill** → colour + label from `entity_state`; clicking any readout opens
  `hass-more-info` for that entity.
- **Flame** → animation speed/size driven by `entity_duty` (current duty %).

---

## Build steps

1. Scaffold repo (`git init`, `hacs.json`, `package.json`, `README.md`).
2. Build `diesel-heater-card.js` (card + visual editor), reusing suspension-card
   patterns: container-query responsive layout, gauge treatment, editor.
3. CSS/SVG flame that reacts to duty; state-colour logic; duty stepper wiring.
4. Verify locally in headless Chrome (stub `hass`) at wide + narrow widths and
   across states (Off / Running / high duty / low fuel).
5. README + install notes; push; add as HACS custom repo.

---

## Open questions

1. **Heat-level control** — prefer the **slider** (like the current dashboard's
   `input_number` slider) or a **▲/▼ stepper** (cleaner in a tile)? Plan assumes
   stepper; easy to switch.
2. **Fuel tank capacity** — what's full? (default assumed 20 L; the reading was
   17.9 L.)
3. **Thermostat mode** — include `input_boolean.diesel_heater_thermo` /
   `climate.diesel_heater` target temp now, or keep v1 to the 8 dashboard items?
4. **State values** — exact strings the heater reports (e.g. "Running Normally",
   "Glow Plug", "Cooling") so the state pill colours map correctly. I'll read
   them from history / your input.
