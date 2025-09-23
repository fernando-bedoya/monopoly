// player.js (corregido y modular)
import { fetchCountryInfoByCode, validateCountryCodeService, submitPlayerScoreService } from "../controllers/player.service.js";
import {
  normalizeCountries,
  resolveCountryInfo,
  isValidCountryCode,
  getFlagUrl as flagUrlFromUtils,
  passedGo,
  calcNetWorth,
  toScorePayload
} from "../utils/playerUtils.js";

class Player {
  constructor(nickname, countryCode, color) {
    // Datos básicos
    this.nickname = String(nickname || "").trim();
    this.countryCode = String(countryCode || "").trim().toUpperCase();
    this.color = color || null;

    // Estado del juego
    this.dinero = 1500;
    this.posicion = 0;
    this.propiedades = [];
    this.propiedadesHipotecadas = [];

    // Cárcel
    this.estaEnCarcel = false;
    this.turnosCarcel = 0;

    // Info país
    this.countryInfo = null;
  }

  /** Intenta validar y fijar la info del país llamando al backend */
  async hydrateCountry() {
    this.countryInfo = await fetchCountryInfoByCode(this.countryCode);
    if (!this.countryInfo) {
      throw new Error(`Código de país inválido: ${this.countryCode}`);
    }
    return this.countryInfo;
  }

  /** URL de banderita (derivado del code) */
  getFlagUrl() {
    return flagUrlFromUtils(this.countryCode);
  }

  /** Recibir/Pagar dinero */
  receiveMoney(amount) {
    const val = Number(amount) || 0;
    this.dinero += val;
    return this.dinero;
  }
  payMoney(amount) {
    const val = Number(amount) || 0;
    this.dinero -= val;
    return this.dinero;
  }

  /** Movimiento en el tablero con detección de Salida */
  move(steps, boardSize = 40) {
    const { newPos, passed } = passedGo(this.posicion, steps, boardSize);
    this.posicion = newPos;
    if (passed) this.receiveMoney(200);
    return this.posicion;
  }

  /** Compra de propiedad (simplificado) */
  buyProperty(property) {
    if (!property) return false;
    const price = Number(property.price || 0);
    if (price > this.dinero) return false;
    this.payMoney(price);
    this.propiedades.push({ ...property, houses: property.houses || 0, hotel: property.hotel || false });
    return true;
  }

  /** Hipotecar / Deshipotecar (helpers simples) */
  mortgageProperty(propertyId) {
    const idx = this.propiedades.findIndex(p => p.id === propertyId);
    if (idx === -1) return false;
    const p = this.propiedades[idx];
    if (p.isMortgaged) return false;
    this.receiveMoney(Number(p.mortgage || 0));
    p.isMortgaged = true;
    this.propiedadesHipotecadas.push(p);
    return true;
  }
  unmortgageProperty(propertyId) {
    const i = this.propiedadesHipotecadas.findIndex(p => p.id === propertyId);
    if (i === -1) return false;
    const p = this.propiedadesHipotecadas[i];
    const cost = Math.ceil(Number(p.mortgage || 0) * 1.10);
    if (cost > this.dinero) return false;
    this.payMoney(cost);
    p.isMortgaged = false;
    this.propiedadesHipotecadas.splice(i, 1);
    return true;
  }

  /** Patrimonio total (delegado a utils) */
  calculateNetWorth() {
    return calcNetWorth(this);
  }

  /** Serialización para UI */
  serialize() {
    return {
      nickname: this.nickname,
      countryCode: this.countryCode,
      color: this.color,
      money: this.dinero,
      position: this.posicion,
      properties: this.propiedades.length,
      mortgagedProperties: this.propiedadesHipotecadas.length,
      isInJail: this.estaEnCarcel,
      jailTurns: this.turnosCarcel,
      netWorth: this.calculateNetWorth(),
      flagUrl: this.getFlagUrl(),
      countryInfo: this.countryInfo
    };
  }

  /** Envío de score al backend */
  async submitScore() {
    return await submitPlayerScoreService(this);
  }

  // ===== Helpers estáticos =====

  /** Crea un jugador validando el countryCode contra /countries */
  static async create(nickname, countryCode, color) {
    const player = new Player(nickname, countryCode, color);
    await player.hydrateCountry(); // lanza error si el code no existe
    return player;
  }

  /** Valida un código de país sin instanciar */
  static async validateCountryCode(code) {
    return await validateCountryCodeService(code);
  }
}

export { Player };
