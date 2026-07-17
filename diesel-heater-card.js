/* diesel-heater-card - Lovelace card for a Chinese diesel night heater.
   State, fuel, chamber temperature, duty controls and live fan/pump/duty stats.
   No external dependencies. */

const DEFAULT_CONFIG = {
  entity_state: "",
  entity_chamber_temp: "",
  entity_fan: "",
  entity_pump: "",
  entity_duty: "",
  entity_power: "",
  entity_duty_set: "",
  entity_duty_up: "",
  entity_duty_down: "",
  duty_display_mode: "raw",
  duty_min: null,
  duty_max: null,
  entity_fuel: "",
  fuel_max_litres: 20,
  temp_decimals: 1,
  flame_max_temp: 160,
};

function normalizeConfig(config) {
  const c = config || {};
  return {
    ...DEFAULT_CONFIG,
    ...c,
    fuel_max_litres: Math.max(0.1, Number(c.fuel_max_litres ?? DEFAULT_CONFIG.fuel_max_litres) || DEFAULT_CONFIG.fuel_max_litres),
    temp_decimals: Math.max(0, Number(c.temp_decimals ?? DEFAULT_CONFIG.temp_decimals) || 0),
    flame_max_temp: Math.max(1, Number(c.flame_max_temp ?? DEFAULT_CONFIG.flame_max_temp) || DEFAULT_CONFIG.flame_max_temp),
    duty_display_mode: c.duty_display_mode === "percent" ? "percent" : "raw",
    duty_min: c.duty_min == null || c.duty_min === "" ? null : Number(c.duty_min),
    duty_max: c.duty_max == null || c.duty_max === "" ? null : Number(c.duty_max),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

const CARD_STYLE = `
  :host { display: block; }
  *, *::before, *::after { box-sizing: border-box; }
  ha-card {
    display: block;
    --ha-card-border-width: 0;
    border: none; background: transparent; box-shadow: none; overflow: visible;
  }
  .heater-card {
    --dh-card-bg: var(--ha-card-background, var(--card-background-color));
    --dh-panel-bg: color-mix(in srgb, var(--dh-card-bg), white 4%);
    --dh-panel-bg-soft: color-mix(in srgb, var(--dh-card-bg), white 7%);
    --dh-border: var(--divider-color);
    --dh-border-soft: color-mix(in srgb, var(--divider-color), transparent 35%);
    --dh-text: var(--primary-text-color);
    --dh-text-muted: var(--secondary-text-color);
    --dh-text-dim: var(--disabled-text-color);
    --dh-accent: var(--accent-color);
    --dh-heater: var(--state-climate-heat-color, var(--accent-color));
    --dh-fan: var(--state-fan-on-color, var(--accent-color));
    --dh-fuel: #ff9800;
    --dh-ok: var(--state-binary_sensor-on-color, var(--success-color, #7fa66a));
    position: relative;
    width: 100%;
    min-height: 330px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--dh-card-bg);
    border: 1px solid var(--dh-border);
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--dh-text);
    font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
    padding: 8px;
  }
  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 6px;
    margin-bottom: 7px;
  }
  .title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 760;
    letter-spacing: .04em;
    white-space: nowrap;
  }
  .title svg {
    width: 17px; height: 17px; color: var(--dh-heater);
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--dh-heater), transparent 82%));
    flex: 0 0 auto;
  }
  .state-pill {
    min-width: 58px;
    border: 1px solid var(--dh-border-soft);
    border-radius: 999px;
    padding: 5px 7px;
    text-align: center;
    font-size: 11px;
    font-weight: 720;
    color: var(--state-fg, var(--dh-text));
    background: var(--state-bg, var(--dh-panel-bg));
    border-color: var(--state-border, var(--dh-border-soft));
    cursor: pointer;
    white-space: nowrap;
  }
  .power-btn {
    width: 34px;
    height: 30px;
    border-radius: 11px;
    border: 1px solid color-mix(in srgb, var(--dh-heater), transparent 65%);
    background: color-mix(in srgb, var(--dh-heater), transparent 88%);
    color: var(--dh-heater);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    user-select: none;
    transition: background .14s ease, border-color .14s ease, color .14s ease;
  }
  .power-btn span { display: none; }
  .power-btn svg { width: 17px; height: 17px; flex: 0 0 auto; }
  .power-btn.active {
    color: color-mix(in srgb, var(--dh-heater), white 25%);
    background: color-mix(in srgb, var(--dh-heater), transparent 82%);
    border-color: color-mix(in srgb, var(--dh-heater), transparent 55%);
  }
  .main-layout {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr) 82px;
    gap: 6px;
    align-items: stretch;
    min-height: 0;
  }
  .panel {
    min-width: 0;
    border: 1px solid var(--dh-border-soft);
    border-radius: 12px;
    background: var(--dh-panel-bg);
    padding: 8px 7px;
  }
  .panel-title {
    font-size: 9px;
    font-weight: 760;
    letter-spacing: .06em;
    text-align: center;
    color: var(--dh-text-muted);
    white-space: nowrap;
  }
  .fuel-panel { display: flex; flex-direction: column; gap: 6px; }
  .fuel-gauge {
    position: relative;
    flex: 1;
    min-height: 86px;
    width: 100%;
    border: 1px solid var(--dh-border-soft);
    border-radius: 11px;
    overflow: hidden;
    background: color-mix(in srgb, var(--dh-panel-bg), black 12%);
    box-shadow: inset 0 0 16px color-mix(in srgb, var(--dh-text), transparent 95%);
    display: grid;
    place-items: center;
  }
  .fuel-fill {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 0%;
    background: linear-gradient(to top, color-mix(in srgb, var(--dh-fuel), black 30%), color-mix(in srgb, var(--dh-fuel), white 5%));
    border-top: 2px solid color-mix(in srgb, var(--dh-fuel), white 18%);
    box-shadow: 0 -2px 14px color-mix(in srgb, var(--dh-fuel), transparent 78%);
    transition: height .5s cubic-bezier(.4,0,.2,1), background .2s ease, border-color .2s ease;
  }
  .fuel-fill.low {
    background: linear-gradient(to top, color-mix(in srgb, var(--error-color, #db4437), black 25%), color-mix(in srgb, var(--error-color, #db4437), white 8%));
    border-top-color: color-mix(in srgb, var(--error-color, #db4437), white 15%);
  }
  .fuel-value { position: relative; z-index: 1; text-align: center; text-shadow: 0 2px 8px color-mix(in srgb, var(--dh-card-bg), black 35%); }
  .fuel-litres { font-size: 17px; font-weight: 460; letter-spacing: -0.02em; line-height: 1; }
  .fuel-litres span { font-size: 10px; margin-left: 1px; color: var(--dh-text-muted); }
  .fuel-percent { margin-top: 4px; font-size: 10px; color: var(--dh-text-muted); }
  .flame-panel {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }
  .temp-readout { cursor: pointer; }
  .temp-value {
    margin-top: 3px;
    font-size: 25px;
    font-weight: 330;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .temp-value span { font-size: 12px; color: var(--dh-text-muted); margin-left: 2px; }
  .flame-stage {
    position: relative;
    min-height: 0;
    display: grid;
    place-items: center;
    padding-bottom: 3px;
  }
  .flame {
    width: calc(30px + var(--flame-duty, 0) * 30px);
    height: calc(28px + var(--flame-duty, 0) * 40px);
    position: relative;
    opacity: calc(.44 + var(--flame-duty, 0) * .56);
    filter: drop-shadow(0 0 calc(5px + var(--flame-duty, 0) * 13px) color-mix(in srgb, var(--dh-heater), transparent 82%));
    transform-origin: 50% 100%;
    animation: flame-sway calc(1.9s - var(--flame-duty, 0) * .85s) ease-in-out infinite alternate;
  }
  .flame::before,
  .flame::after {
    content: "";
    position: absolute;
    inset: auto 8% 0 8%;
    height: 100%;
    border-radius: 52% 48% 50% 50% / 68% 68% 30% 30%;
    transform: rotate(45deg);
    transform-origin: 50% 82%;
  }
  .flame::before {
    background: linear-gradient(135deg, color-mix(in srgb, var(--dh-heater), white 38%) 0%, color-mix(in srgb, var(--dh-heater), white 14%) 38%, var(--dh-heater) 68%, color-mix(in srgb, var(--dh-heater), transparent 88%) 100%);
  }
  .flame::after {
    inset: auto 26% 0 26%;
    height: 68%;
    background: linear-gradient(135deg, color-mix(in srgb, var(--dh-heater), white 48%) 0%, color-mix(in srgb, var(--dh-heater), white 22%) 52%, color-mix(in srgb, var(--dh-heater), transparent 65%) 100%);
    animation: flame-core .78s ease-in-out infinite alternate;
  }
  .ember {
    width: 54px;
    height: 7px;
    border-radius: 999px;
    background: radial-gradient(circle, color-mix(in srgb, var(--dh-heater), transparent 64%), color-mix(in srgb, var(--dh-heater), transparent 88%) 60%, transparent 72%);
    margin-top: -2px;
  }
  .center-state {
    color: var(--dh-text-muted);
    font-size: 10px;
    font-weight: 620;
    min-height: 13px;
    cursor: pointer;
  }
  .duty-panel { display: flex; flex-direction: column; gap: 7px; align-items: stretch; }
  .set-duty {
    flex: 1;
    min-height: 52px;
    border: 1px solid var(--dh-border-soft);
    border-radius: 11px;
    background: var(--dh-panel-bg);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .set-duty-value { font-size: 28px; font-weight: 340; line-height: 1; letter-spacing: -0.02em; }
  .set-duty-label { margin-top: 4px; color: var(--dh-text-muted); font-size: 10px; letter-spacing: .05em; font-weight: 700; }
  .stepper { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .step-btn {
    height: 26px;
    min-width: 0;
    border-radius: 10px;
    border: 1px solid var(--dh-border-soft);
    background: var(--dh-panel-bg);
    color: var(--dh-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    transition: background .12s ease, border-color .12s ease;
  }
  .step-btn:active { background: color-mix(in srgb, var(--dh-heater), transparent 86%); border-color: color-mix(in srgb, var(--dh-heater), transparent 60%); }
  .step-btn svg { width: 17px; height: 17px; color: var(--dh-heater); }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin-top: 7px;
  }
  .stat {
    min-width: 0;
    border: 1px solid var(--dh-border-soft);
    border-radius: 11px;
    background: var(--dh-panel-bg);
    padding: 7px 5px;
    display: grid;
    grid-template-columns: 1fr;
    align-items: center;
    gap: 2px;
    text-align: center;
    cursor: pointer;
  }
  .stat svg { display: none; }
  .stat-label { color: var(--dh-text-muted); font-size: 10px; letter-spacing: .06em; font-weight: 730; }
  .stat-value { font-size: 11px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @keyframes flame-sway {
    0% { transform: translateX(-1px) scaleX(.95) rotate(-2deg); }
    100% { transform: translateX(1px) scaleX(1.04) rotate(2deg); }
  }
  @keyframes flame-core {
    0% { transform: rotate(45deg) scale(.92); opacity: .78; }
    100% { transform: rotate(45deg) scale(1.06); opacity: 1; }
  }
`;

const ICON_FLAME = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.7 2.1c.4 2.5-.5 4.1-1.7 5.6-.9 1.1-1.9 2.2-2.1 3.9-1.1-.9-1.7-2.1-1.8-3.4C5.8 10.2 4.5 12.8 4.5 15.5A7.5 7.5 0 0 0 12 23a7.5 7.5 0 0 0 7.5-7.5c0-4.8-3.3-6.7-5.8-13.4ZM12 20a3.6 3.6 0 0 1-3.6-3.6c0-1.6.8-3.1 2.2-4.2.1 1.2.6 2.2 1.5 3 .4-1.2 1.2-2.1 2.1-3 .8 1.5 1.4 2.7 1.4 4.2A3.6 3.6 0 0 1 12 20Z"/></svg>`;
const ICON_POWER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>`;
const ICON_UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`;
const ICON_DOWN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
const ICON_FAN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M12 10c1-5 7-6 8-2 .8 3.2-3.2 4.7-6.2 4.2"/><path d="M13.7 13c3.8 3.5 1.8 9-2.2 8.4-3.2-.5-2.6-4.8-.7-7.2"/><path d="M10.3 13c-4.8 1.5-8.8-2.8-6.4-6.1 1.9-2.6 5.4 0 6.8 2.9"/></svg>`;
const ICON_PUMP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V6h10v14"/><path d="M7 6V3h4v3"/><path d="M14 9h3l3 3v8"/><path d="M17 20h3"/><path d="M7 11h4"/></svg>`;
const ICON_DUTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 19V5"/><path d="M9 19V9"/><path d="M14 19v-6"/><path d="M19 19V3"/></svg>`;

class DieselHeaterCard extends HTMLElement {
  static getConfigElement() { return document.createElement("diesel-heater-card-editor"); }
  static getStubConfig() {
    return {
      type: "custom:diesel-heater-card",
      entity_state: "",
      entity_chamber_temp: "",
      entity_fan: "",
      entity_pump: "",
      entity_duty: "",
      entity_power: "",
      entity_duty_set: "",
      entity_fuel: "",
      fuel_max_litres: 20,
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
  }

  getCardSize() { return 4; }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  disconnectedCallback() { this._built = false; }

  _build() {
    const root = document.createElement("ha-card");
    root.innerHTML = `
      <style>${CARD_STYLE}</style>
      <div class="heater-card">
        <header class="header">
          <div class="title">${ICON_FLAME}<span>DIESEL HEATER</span></div>
          <div class="state-pill" data-entity="state">-</div>
          <button class="power-btn" type="button">${ICON_POWER}<span>Power</span></button>
        </header>
        <section class="main-layout">
          <aside class="panel fuel-panel">
            <div class="panel-title">FUEL</div>
            <div class="fuel-gauge" data-entity="fuel">
              <div class="fuel-fill"></div>
              <div class="fuel-value">
                <div class="fuel-litres">-<span>L</span></div>
                <div class="fuel-percent">-</div>
              </div>
            </div>
          </aside>
          <main class="panel flame-panel">
            <div class="temp-readout" data-entity="chamber">
            <div class="panel-title">TEMP</div>
              <div class="temp-value">-<span>°C</span></div>
            </div>
            <div class="flame-stage" aria-hidden="true">
              <div>
                <div class="flame"></div>
                <div class="ember"></div>
              </div>
            </div>
            <div class="center-state" data-entity="state-text">-</div>
          </main>
          <aside class="panel duty-panel">
            <div class="panel-title">HEAT</div>
            <div class="set-duty" data-entity="duty-set">
              <div>
                <div class="set-duty-value">-</div>
                <div class="set-duty-label">SET</div>
              </div>
            </div>
            <div class="stepper">
              <button class="step-btn" type="button" data-step="up" aria-label="Increase heat level">${ICON_UP}</button>
              <button class="step-btn" type="button" data-step="down" aria-label="Decrease heat level">${ICON_DOWN}</button>
            </div>
          </aside>
        </section>
        <section class="stats">
          <div class="stat" data-entity="fan">${ICON_FAN}<div><div class="stat-label">FAN</div><div class="stat-value" data-stat="fan">-</div></div></div>
          <div class="stat" data-entity="pump">${ICON_PUMP}<div><div class="stat-label">PUMP</div><div class="stat-value" data-stat="pump">-</div></div></div>
          <div class="stat" data-entity="duty">${ICON_DUTY}<div><div class="stat-label">DUTY</div><div class="stat-value" data-stat="duty">-</div></div></div>
        </section>
      </div>
    `;
    this.shadowRoot.innerHTML = "";
    this.shadowRoot.appendChild(root);
    this._el = {
      card: root.querySelector(".heater-card"),
      state: root.querySelector(".state-pill"),
      power: root.querySelector(".power-btn"),
      fuelGauge: root.querySelector(".fuel-gauge"),
      fuelFill: root.querySelector(".fuel-fill"),
      fuelLitres: root.querySelector(".fuel-litres"),
      fuelPercent: root.querySelector(".fuel-percent"),
      tempReadout: root.querySelector(".temp-readout"),
      tempValue: root.querySelector(".temp-value"),
      flame: root.querySelector(".flame"),
      centerState: root.querySelector(".center-state"),
      dutySet: root.querySelector(".set-duty"),
      dutySetValue: root.querySelector(".set-duty-value"),
      stepUp: root.querySelector('[data-step="up"]'),
      stepDown: root.querySelector('[data-step="down"]'),
      stats: {
        fan: root.querySelector('[data-stat="fan"]'),
        pump: root.querySelector('[data-stat="pump"]'),
        duty: root.querySelector('[data-stat="duty"]'),
      },
    };

    this._el.power.addEventListener("click", () => this._pressPower());
    this._bindDutyButton(this._el.stepUp, 1);
    this._bindDutyButton(this._el.stepDown, -1);
    this._el.state.addEventListener("click", () => this._moreInfo(this.config.entity_state));
    this._el.centerState.addEventListener("click", () => this._moreInfo(this.config.entity_state));
    this._el.fuelGauge.addEventListener("click", () => this._moreInfo(this.config.entity_fuel));
    this._el.tempReadout.addEventListener("click", () => this._moreInfo(this.config.entity_chamber_temp));
    this._el.dutySet.addEventListener("click", () => this._moreInfo(this.config.entity_duty_set));
    root.querySelector('[data-entity="fan"]').addEventListener("click", () => this._moreInfo(this.config.entity_fan));
    root.querySelector('[data-entity="pump"]').addEventListener("click", () => this._moreInfo(this.config.entity_pump));
    root.querySelector('[data-entity="duty"]').addEventListener("click", () => this._moreInfo(this.config.entity_duty));
    this._built = true;
  }

  _update() {
    const stateRaw = this._stateText(this.config.entity_state);
    const stateInfo = this._stateInfo(stateRaw);
    this._el.state.textContent = stateInfo.label;
    this._el.centerState.textContent = stateInfo.label;
    this._el.state.style.setProperty("--state-bg", stateInfo.bg);
    this._el.state.style.setProperty("--state-fg", stateInfo.fg);
    this._el.state.style.setProperty("--state-border", stateInfo.border);
    this._el.power.classList.toggle("active", !this._isOffState(stateRaw));

    const fuel = this._stateNum(this.config.entity_fuel);
    const fuelPct = fuel == null ? null : clamp((fuel / this.config.fuel_max_litres) * 100, 0, 100);
    this._el.fuelFill.style.height = `${fuelPct ?? 0}%`;
    this._el.fuelFill.classList.toggle("low", fuelPct != null && fuelPct <= 18);
    this._el.fuelLitres.innerHTML = `${fuel == null ? "-" : this._fmt(fuel, 1)}<span>L</span>`;
    this._el.fuelPercent.textContent = fuelPct == null ? "-" : `${Math.round(fuelPct)}%`;

    const temp = this._stateNum(this.config.entity_chamber_temp);
    this._el.tempValue.innerHTML = `${temp == null ? "-" : this._fmt(temp, this.config.temp_decimals)}<span>°C</span>`;
    const flameTempPct = temp == null ? 0 : clamp(temp / this.config.flame_max_temp, 0, 1);
    this._el.card.style.setProperty("--flame-duty", String(flameTempPct));

    const duty = this._stateNum(this.config.entity_duty);
    this._el.stats.duty.textContent = duty == null ? "-" : `${this._fmt(duty, 0)} %`;

    const setDuty = this._stateNum(this.config.entity_duty_set);
    if (setDuty == null) {
      this._el.dutySetValue.textContent = "-";
    } else if (this.config.duty_display_mode === "percent") {
      this._el.dutySetValue.textContent = `${this._fmt(this._rawDutyToPercent(setDuty), 0)}%`;
    } else {
      this._el.dutySetValue.textContent = this._fmt(setDuty, this._setDutyDecimals());
    }

    const fan = this._stateNum(this.config.entity_fan);
    const pump = this._stateNum(this.config.entity_pump);
    this._el.stats.fan.textContent = fan == null ? "-" : `${this._fmt(fan, 0)} RPM`;
    this._el.stats.pump.textContent = pump == null ? "-" : `${this._fmt(pump, 1)} Hz`;
  }

  _pressPower() {
    if (this.config.entity_power) {
      this._hass?.callService("button", "press", { entity_id: this.config.entity_power });
    }
  }

  _changeDuty(direction) {
    const entity = this.config.entity_duty_set;
    const state = this._hass?.states?.[entity];
    if (entity && state) {
      const { min, max } = this._dutyRange();
      const attrs = state.attributes || {};
      const step = Number.isFinite(Number(attrs.step)) && Number(attrs.step) > 0 ? Number(attrs.step) : 1;
      const current = this._stateNum(entity);
      if (current != null) {
        const next = clamp(current + direction * step, min, max);
        if (next !== current) {
          this._hass?.callService("input_number", "set_value", { entity_id: entity, value: Number(next.toFixed(4)) });
        }
        return;
      }
    }

    const fallback = direction > 0 ? this.config.entity_duty_up : this.config.entity_duty_down;
    if (fallback) this._hass?.callService("button", "press", { entity_id: fallback });
  }

  _bindDutyButton(button, direction) {
    let holdTimer = null;
    let held = false;

    const cancelHold = () => {
      if (holdTimer != null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      held = false;
      cancelHold();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        held = true;
        this._setDutyExtreme(direction);
      }, 600);
    });
    button.addEventListener("pointerup", cancelHold);
    button.addEventListener("pointercancel", cancelHold);
    button.addEventListener("pointerleave", cancelHold);
    button.addEventListener("click", () => {
      if (held) {
        held = false;
        return;
      }
      this._changeDuty(direction);
    });
  }

  _setDutyExtreme(direction) {
    const entity = this.config.entity_duty_set;
    if (entity && this._hass?.states?.[entity]) {
      const { min, max } = this._dutyRange();
      this._hass?.callService("input_number", "set_value", {
        entity_id: entity,
        value: direction > 0 ? max : min,
      });
      return;
    }

    const fallback = direction > 0 ? this.config.entity_duty_up : this.config.entity_duty_down;
    if (fallback) this._hass?.callService("button", "press", { entity_id: fallback });
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }

  _stateNum(entityId) {
    const s = this._hass?.states?.[entityId];
    if (!s) return null;
    const v = parseFloat(s.state);
    return Number.isFinite(v) ? v : null;
  }

  _stateText(entityId) {
    const s = this._hass?.states?.[entityId];
    if (!s || s.state == null || s.state === "unknown" || s.state === "unavailable") return "Unavailable";
    return String(s.state);
  }

  _fmt(value, decimals) {
    return Number(value).toFixed(Math.max(0, decimals)).replace(/\.0+$/, "");
  }

  _setDutyDecimals() {
    if (this.config.duty_display_mode === "percent") return 0;
    const attrs = this._hass?.states?.[this.config.entity_duty_set]?.attributes || {};
    const step = Number(attrs.step);
    if (!Number.isFinite(step) || step >= 1) return 0;
    const text = String(step);
    return text.includes(".") ? text.split(".")[1].length : 0;
  }

  _dutyRange() {
    const attrs = this._hass?.states?.[this.config.entity_duty_set]?.attributes || {};
    const attrMin = Number(attrs.min);
    const attrMax = Number(attrs.max);
    const configMin = Number(this.config.duty_min);
    const configMax = Number(this.config.duty_max);
    const min = Number.isFinite(configMin) ? configMin : Number.isFinite(attrMin) ? attrMin : 0;
    const max = Number.isFinite(configMax) ? configMax : Number.isFinite(attrMax) ? attrMax : 100;
    return max > min ? { min, max } : { min: 0, max: 100 };
  }

  _rawDutyToPercent(value) {
    const { min, max } = this._dutyRange();
    return clamp(((value - min) / (max - min)) * 100, 0, 100);
  }

  _isOffState(value) {
    const s = String(value || "").trim().toLowerCase();
    return !s || s === "off" || s === "unavailable" || s === "unknown";
  }

  _stateInfo(value) {
    const raw = String(value || "").trim();
    const s = raw.toLowerCase();
    if (!raw || s === "unavailable" || s === "unknown") {
      return { label: "Unavailable", fg: "var(--dh-text-dim)", bg: "var(--dh-panel-bg)", border: "var(--dh-border-soft)" };
    }
    if (s === "off" || s.includes("standby")) {
      return { label: raw, fg: "var(--dh-text-muted)", bg: "var(--dh-panel-bg)", border: "var(--dh-border-soft)" };
    }
    if (s.includes("fault") || s.includes("error") || s.includes("alarm")) {
      return { label: raw, fg: "color-mix(in srgb, var(--error-color, #db4437), white 25%)", bg: "color-mix(in srgb, var(--error-color, #db4437), transparent 84%)", border: "color-mix(in srgb, var(--error-color, #db4437), transparent 62%)" };
    }
    if (s.includes("cool")) {
      return { label: raw, fg: "color-mix(in srgb, var(--dh-fan), white 25%)", bg: "color-mix(in srgb, var(--dh-fan), transparent 86%)", border: "color-mix(in srgb, var(--dh-fan), transparent 65%)" };
    }
    if (s.includes("start") || s.includes("glow") || s.includes("prime") || s.includes("pump")) {
      return { label: raw, fg: "color-mix(in srgb, var(--dh-heater), white 25%)", bg: "color-mix(in srgb, var(--dh-heater), transparent 84%)", border: "color-mix(in srgb, var(--dh-heater), transparent 62%)" };
    }
    if (s.includes("run") || s.includes("heat") || s.includes("on")) {
      return { label: raw, fg: "color-mix(in srgb, var(--dh-ok), white 25%)", bg: "color-mix(in srgb, var(--dh-ok), transparent 82%)", border: "color-mix(in srgb, var(--dh-ok), transparent 62%)" };
    }
    return { label: raw, fg: "color-mix(in srgb, var(--dh-heater), white 25%)", bg: "color-mix(in srgb, var(--dh-heater), transparent 86%)", border: "color-mix(in srgb, var(--dh-heater), transparent 65%)" };
  }
}

customElements.define("diesel-heater-card", DieselHeaterCard);

class DieselHeaterCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULT_CONFIG };
    this._hass = null;
    this._sig = "";
  }

  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, type: "custom:diesel-heater-card", ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const sig = this._entitySignature();
    if (!this.shadowRoot.innerHTML || sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  _entitiesByDomain(domain) {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter((entity) => entity.startsWith(domain + "."))
      .sort((a, b) => a.localeCompare(b));
  }

  _entitySignature() {
    if (!this._hass) return "";
    return JSON.stringify({
      sensor: this._entitiesByDomain("sensor").length,
      button: this._entitiesByDomain("button").length,
      input_number: this._entitiesByDomain("input_number").length,
    });
  }

  _emit(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
  }

  _options(selected, entities, placeholder) {
    const out = [`<option value="">${escapeHtml(placeholder)}</option>`];
    entities.forEach((entity) => {
      out.push(`<option value="${escapeHtml(entity)}"${entity === selected ? " selected" : ""}>${escapeHtml(entity)}</option>`);
    });
    return out.join("");
  }

  _select(key, label, domain, placeholder) {
    const sel = this._config[key] || "";
    return `
      <div class="field">
        <label for="f-${key}">${label}</label>
        <select id="f-${key}" data-key="${key}">${this._options(sel, this._entitiesByDomain(domain), placeholder)}</select>
      </div>`;
  }

  _number(key, label, step = "0.1") {
    return `
      <div class="field">
        <label for="f-${key}">${label}</label>
        <input id="f-${key}" data-key="${key}" data-type="number" type="number" step="${step}" value="${Number(this._config[key] ?? 0)}">
      </div>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        .editor { display: grid; gap: 12px; padding: 12px 0; }
        .field { display: grid; gap: 6px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .section-title { font-size: 15px; font-weight: 700; margin-top: 10px; border-top: 1px solid var(--divider-color); padding-top: 12px; }
        label { font-size: 13px; font-weight: 600; }
        select, input[type="number"] { padding: 8px; font: inherit; width: 100%; box-sizing: border-box; }
      </style>
      <div class="editor">
        <div class="section-title">Status and controls</div>
        ${this._select("entity_state", "Heater state", "sensor", "Select sensor")}
        ${this._select("entity_power", "Power button", "button", "Select button")}
        <div class="section-title">Readouts</div>
        ${this._select("entity_chamber_temp", "Chamber temperature", "sensor", "Select sensor")}
        ${this._select("entity_fan", "Fan speed", "sensor", "Select sensor")}
        ${this._select("entity_pump", "Pump frequency", "sensor", "Select sensor")}
        ${this._select("entity_duty", "Current duty", "sensor", "Select sensor")}

        <div class="section-title">Heat level</div>
        ${this._select("entity_duty_set", "Set duty input number", "input_number", "Select input number")}
        ${this._select("entity_duty_up", "Duty up button", "button", "Select button")}
        ${this._select("entity_duty_down", "Duty down button", "button", "Select button")}

        <div class="section-title">Temperature</div>
        <div class="row">
          ${this._number("temp_decimals", "Temperature decimals", "1")}
          ${this._number("flame_max_temp", "Flame max temp (°C)", "1")}
        </div>

        <div class="section-title">Fuel</div>
        ${this._select("entity_fuel", "Fuel remaining", "input_number", "Select input number")}
        ${this._number("fuel_max_litres", "Full tank litres", "0.1")}
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-key]").forEach((el) => {
      const key = el.dataset.key;
      const type = el.dataset.type;
      el.addEventListener("change", (event) => {
        const target = event.target;
        const value = type === "number" ? Number(target.value) : target.value;
        this._emit(key, value);
      });
    });
  }
}

customElements.define("diesel-heater-card-editor", DieselHeaterCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "diesel-heater-card",
  name: "Diesel Heater Card",
  description: "Diesel night heater state, fuel, chamber temperature, heat level and live fan/pump/duty stats.",
  preview: false,
  documentationURL: "https://github.com/timmchugh11/diesel-heater-card--Home-Assistant",
});
