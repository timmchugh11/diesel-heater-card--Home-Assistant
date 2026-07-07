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
  entity_fuel: "",
  fuel_max_litres: 20,
  temp_decimals: 1,
  duty_control_mode: "input_number", // "input_number" | "buttons"
};

function normalizeConfig(config) {
  const c = config || {};
  return {
    ...DEFAULT_CONFIG,
    ...c,
    fuel_max_litres: Math.max(0.1, Number(c.fuel_max_litres ?? DEFAULT_CONFIG.fuel_max_litres) || DEFAULT_CONFIG.fuel_max_litres),
    temp_decimals: Math.max(0, Number(c.temp_decimals ?? DEFAULT_CONFIG.temp_decimals) || 0),
    duty_control_mode: c.duty_control_mode === "buttons" ? "buttons" : "input_number",
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
    --ha-card-background: transparent;
    --ha-card-box-shadow: none;
    border: none; background: transparent; box-shadow: none; overflow: visible;
  }
  .heater-card {
    position: relative;
    width: 100%;
    container-type: inline-size;
    overflow: hidden;
    border-radius: var(--ha-card-border-radius, 12px);
    background:
      radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05), transparent 38%),
      linear-gradient(145deg, #1c1c1c, #121212);
    border: 1px solid rgba(255,255,255,0.12);
    color: #f2f2f2;
    font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
    padding: 12px;
  }
  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 760;
    letter-spacing: .07em;
  }
  .title svg { width: 21px; height: 21px; color: #ff8a22; filter: drop-shadow(0 0 10px rgba(255,116,24,.22)); flex: 0 0 auto; }
  .state-pill {
    min-width: 86px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px;
    padding: 6px 11px;
    text-align: center;
    font-size: 12px;
    font-weight: 720;
    color: var(--state-fg, #e8e8e8);
    background: var(--state-bg, rgba(255,255,255,0.04));
    border-color: var(--state-border, rgba(255,255,255,0.12));
    cursor: pointer;
  }
  .power-btn {
    height: 34px;
    border-radius: 13px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.03);
    color: #efefef;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
    transition: background .14s ease, border-color .14s ease, color .14s ease;
  }
  .power-btn svg { width: 18px; height: 18px; flex: 0 0 auto; }
  .power-btn.active {
    color: #ffd6a3;
    background: rgba(255,116,24,.15);
    border-color: rgba(255,138,34,.44);
  }
  .main-layout {
    display: grid;
    grid-template-columns: minmax(118px, 158px) minmax(0, 1fr) minmax(128px, 166px);
    gap: 10px;
    align-items: stretch;
  }
  .panel {
    min-width: 0;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
    padding: 10px 9px;
  }
  .panel-title {
    font-size: 12px;
    font-weight: 760;
    letter-spacing: .09em;
    text-align: center;
    color: #bdbdbd;
  }
  .fuel-panel { display: flex; flex-direction: column; gap: 8px; }
  .fuel-gauge {
    position: relative;
    flex: 1;
    min-height: 132px;
    width: 100%;
    border: 1px solid rgba(255,255,255,0.16);
    border-radius: 16px;
    overflow: hidden;
    background: rgba(0,0,0,0.28);
    box-shadow: inset 0 0 22px rgba(0,0,0,0.4);
    display: grid;
    place-items: center;
  }
  .fuel-fill {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 0%;
    background: linear-gradient(180deg, rgba(52,169,255,0.26), rgba(52,169,255,0.66));
    border-top: 2px solid #7cd0ff;
    box-shadow: 0 -2px 26px rgba(52,169,255,0.38);
    transition: height .5s cubic-bezier(.4,0,.2,1), background .2s ease, border-color .2s ease;
  }
  .fuel-fill.low {
    background: linear-gradient(180deg, rgba(255,58,48,0.24), rgba(255,58,48,0.62));
    border-top-color: #ff7a72;
  }
  .fuel-value { position: relative; z-index: 1; text-align: center; text-shadow: 0 2px 10px rgba(0,0,0,0.75); }
  .fuel-litres { font-size: 27px; font-weight: 380; letter-spacing: -0.03em; line-height: 1; }
  .fuel-litres span { font-size: 14px; margin-left: 3px; color: #dfefff; }
  .fuel-percent { margin-top: 6px; font-size: 12px; color: #b6c4d6; }
  .flame-panel {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(92px, 1fr) auto;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }
  .temp-readout { cursor: pointer; }
  .temp-value {
    margin-top: 4px;
    font-size: 40px;
    font-weight: 320;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .temp-value span { font-size: 20px; color: #d7d7d7; margin-left: 4px; }
  .flame-stage {
    position: relative;
    min-height: 92px;
    display: grid;
    place-items: end center;
    padding-bottom: 4px;
  }
  .flame {
    width: calc(44px + var(--flame-duty, 0) * 42px);
    height: calc(34px + var(--flame-duty, 0) * 60px);
    position: relative;
    opacity: calc(.44 + var(--flame-duty, 0) * .56);
    filter: drop-shadow(0 0 calc(7px + var(--flame-duty, 0) * 18px) rgba(255,92,24,.42));
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
    background: linear-gradient(135deg, #ffef8a 0%, #ffae31 34%, #ff6823 64%, rgba(180,35,19,.12) 100%);
  }
  .flame::after {
    inset: auto 26% 0 26%;
    height: 68%;
    background: linear-gradient(135deg, #fff6b2 0%, #ffd55e 48%, rgba(255,140,34,.35) 100%);
    animation: flame-core .78s ease-in-out infinite alternate;
  }
  .ember {
    width: 72px;
    height: 9px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(255,170,45,.42), rgba(255,85,24,.10) 60%, transparent 72%);
    margin-top: -2px;
  }
  .center-state {
    color: #bcbcbc;
    font-size: 13px;
    font-weight: 620;
    min-height: 18px;
    cursor: pointer;
  }
  .duty-panel { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
  .set-duty {
    flex: 1;
    min-height: 82px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    background: rgba(0,0,0,0.18);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .set-duty-value { font-size: 44px; font-weight: 320; line-height: 1; letter-spacing: -0.03em; }
  .set-duty-label { margin-top: 5px; color: #aaa; font-size: 11px; letter-spacing: .06em; font-weight: 700; }
  .stepper { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .step-btn {
    height: 34px;
    border-radius: 13px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.025);
    color: #efefef;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    transition: background .12s ease, border-color .12s ease;
  }
  .step-btn:active { background: rgba(255,138,34,.15); border-color: rgba(255,138,34,.48); }
  .step-btn svg { width: 20px; height: 20px; color: #ff9b31; }
  .duty-now {
    text-align: center;
    color: #bdbdbd;
    font-size: 12px;
    line-height: 1.35;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .stat {
    min-width: 0;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    background: rgba(0,0,0,0.14);
    padding: 8px 10px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    cursor: pointer;
  }
  .stat svg { width: 17px; height: 17px; color: #34a9ff; opacity: .9; }
  .stat-label { color: #a9a9a9; font-size: 11px; letter-spacing: .07em; font-weight: 730; }
  .stat-value { margin-top: 1px; font-size: 15px; font-weight: 560; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @keyframes flame-sway {
    0% { transform: translateX(-1px) scaleX(.95) rotate(-2deg); }
    100% { transform: translateX(1px) scaleX(1.04) rotate(2deg); }
  }
  @keyframes flame-core {
    0% { transform: rotate(45deg) scale(.92); opacity: .78; }
    100% { transform: rotate(45deg) scale(1.06); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .flame, .flame::after { animation: none; }
    .fuel-fill { transition: none; }
  }
  @container (max-width: 720px) {
    .heater-card { padding: 10px; }
    .header { gap: 8px; margin-bottom: 8px; }
    .title { font-size: 15px; gap: 7px; }
    .title svg { width: 20px; height: 20px; }
    .state-pill { min-width: 70px; padding: 6px 9px; font-size: 12px; }
    .power-btn { height: 34px; padding: 0 10px; font-size: 12px; border-radius: 11px; }
    .power-btn svg { width: 16px; height: 16px; }
    .main-layout { gap: 8px; grid-template-columns: minmax(86px, 116px) minmax(0, 1fr) minmax(92px, 122px); }
    .panel { padding: 9px 7px; border-radius: 14px; }
    .panel-title { font-size: 11px; letter-spacing: .06em; }
    .fuel-gauge { min-height: 112px; border-radius: 13px; }
    .fuel-litres { font-size: 24px; }
    .fuel-litres span, .fuel-percent { font-size: 11px; }
    .temp-value { font-size: 32px; }
    .temp-value span { font-size: 15px; }
    .flame-panel { grid-template-rows: auto minmax(82px, 1fr) auto; }
    .flame-stage { min-height: 82px; }
    .set-duty { min-height: 72px; }
    .set-duty-value { font-size: 38px; }
    .stepper { gap: 8px; }
    .step-btn { height: 32px; border-radius: 11px; }
    .stats { gap: 7px; margin-top: 8px; }
    .stat { padding: 7px 8px; border-radius: 12px; gap: 6px; }
    .stat svg { width: 16px; height: 16px; }
    .stat-value { font-size: 14px; }
    .stat-label { font-size: 10px; }
  }
  @container (max-width: 500px) {
    .heater-card { padding: 8px; }
    .header { grid-template-columns: minmax(0, 1fr) auto auto; margin-bottom: 7px; }
    .title { font-size: 13px; letter-spacing: .04em; }
    .state-pill { order: 0; grid-column: auto; width: auto; min-width: 58px; padding: 5px 7px; }
    .power-btn span { display: none; }
    .power-btn { width: 36px; padding: 0; }
    .main-layout { gap: 6px; grid-template-columns: minmax(76px, .85fr) minmax(0, 1.3fr) minmax(76px, .85fr); }
    .flame-panel { grid-column: auto; grid-row: auto; }
    .fuel-panel { grid-column: auto; grid-row: auto; }
    .duty-panel { grid-column: auto; grid-row: auto; }
    .panel { padding: 8px 5px; border-radius: 12px; }
    .fuel-gauge { min-height: 92px; }
    .fuel-litres { font-size: 18px; }
    .fuel-percent { margin-top: 4px; }
    .temp-value { font-size: 27px; }
    .flame-panel { grid-template-rows: auto minmax(70px, 1fr) auto; }
    .flame-stage { min-height: 70px; }
    .flame { width: calc(34px + var(--flame-duty, 0) * 34px); height: calc(30px + var(--flame-duty, 0) * 46px); }
    .set-duty { min-height: 58px; }
    .set-duty-value { font-size: 30px; }
    .set-duty-label, .duty-now, .center-state { font-size: 10px; }
    .step-btn { height: 28px; }
    .step-btn svg { width: 18px; height: 18px; }
    .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .stat { padding: 7px 5px; grid-template-columns: 1fr; gap: 3px; text-align: center; }
    .stat svg { display: none; }
    .stat-value { font-size: 12px; }
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
              <div class="panel-title">CHAMBER TEMP</div>
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
            <div class="panel-title">HEAT LEVEL</div>
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
            <div class="duty-now">now -</div>
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
      dutyNow: root.querySelector(".duty-now"),
      stepUp: root.querySelector('[data-step="up"]'),
      stepDown: root.querySelector('[data-step="down"]'),
      stats: {
        fan: root.querySelector('[data-stat="fan"]'),
        pump: root.querySelector('[data-stat="pump"]'),
        duty: root.querySelector('[data-stat="duty"]'),
      },
    };

    this._el.power.addEventListener("click", () => this._pressPower());
    this._el.stepUp.addEventListener("click", () => this._changeDuty(1));
    this._el.stepDown.addEventListener("click", () => this._changeDuty(-1));
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

    const duty = this._stateNum(this.config.entity_duty);
    const dutyPct = duty == null ? 0 : clamp(duty, 0, 100);
    this._el.card.style.setProperty("--flame-duty", String(dutyPct / 100));
    this._el.stats.duty.textContent = duty == null ? "-" : `${this._fmt(duty, 0)} %`;
    this._el.dutyNow.textContent = duty == null ? "now -" : `now ${this._fmt(duty, 0)}%`;

    const setDuty = this._stateNum(this.config.entity_duty_set);
    this._el.dutySetValue.textContent = setDuty == null ? "-" : this._fmt(setDuty, this._setDutyDecimals());

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
    if (this.config.duty_control_mode === "buttons") {
      const entity = direction > 0 ? this.config.entity_duty_up : this.config.entity_duty_down;
      if (entity) this._hass?.callService("button", "press", { entity_id: entity });
      return;
    }

    const entity = this.config.entity_duty_set;
    const state = this._hass?.states?.[entity];
    if (!entity || !state) return;
    const attrs = state.attributes || {};
    const min = Number.isFinite(Number(attrs.min)) ? Number(attrs.min) : 0;
    const max = Number.isFinite(Number(attrs.max)) ? Number(attrs.max) : 100;
    const step = Number.isFinite(Number(attrs.step)) && Number(attrs.step) > 0 ? Number(attrs.step) : 1;
    const current = this._stateNum(entity);
    if (current == null) return;
    const next = clamp(current + direction * step, min, max);
    this._hass?.callService("input_number", "set_value", { entity_id: entity, value: Number(next.toFixed(4)) });
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
    const attrs = this._hass?.states?.[this.config.entity_duty_set]?.attributes || {};
    const step = Number(attrs.step);
    if (!Number.isFinite(step) || step >= 1) return 0;
    const text = String(step);
    return text.includes(".") ? text.split(".")[1].length : 0;
  }

  _isOffState(value) {
    const s = String(value || "").trim().toLowerCase();
    return !s || s === "off" || s === "unavailable" || s === "unknown";
  }

  _stateInfo(value) {
    const raw = String(value || "").trim();
    const s = raw.toLowerCase();
    if (!raw || s === "unavailable" || s === "unknown") {
      return { label: "Unavailable", fg: "#d1d1d1", bg: "rgba(255,255,255,.045)", border: "rgba(255,255,255,.14)" };
    }
    if (s === "off" || s.includes("standby")) {
      return { label: raw, fg: "#d8d8d8", bg: "rgba(255,255,255,.045)", border: "rgba(255,255,255,.14)" };
    }
    if (s.includes("fault") || s.includes("error") || s.includes("alarm")) {
      return { label: raw, fg: "#ffd0cc", bg: "rgba(255,58,48,.18)", border: "rgba(255,58,48,.48)" };
    }
    if (s.includes("cool")) {
      return { label: raw, fg: "#d8efff", bg: "rgba(52,169,255,.15)", border: "rgba(52,169,255,.42)" };
    }
    if (s.includes("start") || s.includes("glow") || s.includes("prime") || s.includes("pump")) {
      return { label: raw, fg: "#ffedbf", bg: "rgba(255,196,0,.16)", border: "rgba(255,196,0,.42)" };
    }
    if (s.includes("run") || s.includes("heat") || s.includes("on")) {
      return { label: raw, fg: "#d9ffd3", bg: "rgba(61,220,104,.13)", border: "rgba(61,220,104,.38)" };
    }
    return { label: raw, fg: "#ffdcb5", bg: "rgba(255,138,34,.14)", border: "rgba(255,138,34,.38)" };
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
        .section-title { font-size: 15px; font-weight: 700; margin-top: 10px; border-top: 1px solid var(--divider-color, #444); padding-top: 12px; }
        label { font-size: 13px; font-weight: 600; }
        select, input[type="number"] { padding: 8px; font: inherit; width: 100%; box-sizing: border-box; }
      </style>
      <div class="editor">
        <div class="section-title">Status and controls</div>
        ${this._select("entity_state", "Heater state", "sensor", "Select sensor")}
        ${this._select("entity_power", "Power button", "button", "Select button")}
        <div class="field">
          <label for="f-duty_control_mode">Duty control</label>
          <select id="f-duty_control_mode" data-key="duty_control_mode">
            <option value="input_number"${this._config.duty_control_mode !== "buttons" ? " selected" : ""}>Set input number directly</option>
            <option value="buttons"${this._config.duty_control_mode === "buttons" ? " selected" : ""}>Press heater up/down buttons</option>
          </select>
        </div>

        <div class="section-title">Readouts</div>
        ${this._select("entity_chamber_temp", "Chamber temperature", "sensor", "Select sensor")}
        ${this._select("entity_fan", "Fan speed", "sensor", "Select sensor")}
        ${this._select("entity_pump", "Pump frequency", "sensor", "Select sensor")}
        ${this._select("entity_duty", "Current duty", "sensor", "Select sensor")}

        <div class="section-title">Heat level</div>
        ${this._select("entity_duty_set", "Set duty input number", "input_number", "Select input number")}
        ${this._select("entity_duty_up", "Duty up button", "button", "Select button")}
        ${this._select("entity_duty_down", "Duty down button", "button", "Select button")}

        <div class="section-title">Fuel</div>
        ${this._select("entity_fuel", "Fuel remaining", "input_number", "Select input number")}
        <div class="row">
          ${this._number("fuel_max_litres", "Full tank litres", "0.1")}
          ${this._number("temp_decimals", "Temperature decimals", "1")}
        </div>
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
