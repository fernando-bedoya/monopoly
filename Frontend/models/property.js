// models/property.js
import { calcRent, canBuildOnProperty, buildCosts, mortgageValue, unmortgageCost } from "../utils/propertyUtils.js";
import { getGroupProperties, countOwnedByType } from "../controllers/property.service.js";

export class Property {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.name = data.name ?? "";
    this.type = (data.type ?? "property").toLowerCase();
    this.color = data.color ?? null;
    this.price = Number(data.price ?? 0);
    this.mortgage = Number(data.mortgage ?? 0);
    this.rent = data.rent ?? { base: 0, withHouse: [0,0,0,0], withHotel: 0 };

    this.ownerId = data.ownerId ?? null;
    this.houses = Number(data.houses ?? 0);
    this.hotel = !!data.hotel;
    this.isMortgaged = !!data.isMortgaged;
  }

  setOwner(ownerId) { this.ownerId = ownerId ?? null; }
  clearOwner() { this.ownerId = null; this.houses = 0; this.hotel = false; this.isMortgaged = false; }

  mortgage() {
    if (this.isMortgaged) return { ok: false, reason: "Ya está hipotecada" };
    if (this.houses > 0 || this.hotel) return { ok: false, reason: "Vende edificaciones antes de hipotecar" };
    this.isMortgaged = true;
    return { ok: true, amount: mortgageValue(this) };
  }

  unmortgage(currentMoney) {
    if (!this.isMortgaged) return { ok: false, reason: "No está hipotecada" };
    const cost = unmortgageCost(this);
    if ((Number(currentMoney) || 0) < cost) return { ok: false, reason: "Dinero insuficiente", cost };
    this.isMortgaged = false;
    return { ok: true, cost };
  }

  async canBuild(ownerId) {
    if (this.type !== "property") return { ok: false, reason: "No edificable" };
    const groupProps = await getGroupProperties(this);
    return canBuildOnProperty(this, groupProps, ownerId);
  }

  async buildHouse(ownerMoney) {
    const check = await this.canBuild(this.ownerId);
    if (!check.ok) return check;
    const cost = buildCosts().house;
    if ((Number(ownerMoney) || 0) < cost) return { ok: false, reason: "Dinero insuficiente", cost };
    if (this.houses >= 4 || this.hotel) return { ok: false, reason: "Máximo de casas alcanzado" };
    this.houses += 1;
    return { ok: true, cost, houses: this.houses };
  }

  async buildHotel(ownerMoney) {
    const check = await this.canBuild(this.ownerId);
    if (!check.ok) return check;
    const cost = buildCosts().hotel;
    if ((Number(ownerMoney) || 0) < cost) return { ok: false, reason: "Dinero insuficiente", cost };
    if (this.hotel) return { ok: false, reason: "Ya tiene hotel" };
    if (this.houses < 4) return { ok: false, reason: "Necesitas 4 casas antes del hotel" };
    this.houses = 0;
    this.hotel = true;
    return { ok: true, cost, hotel: true };
  }

  sellHouse() {
    if (this.houses <= 0) return { ok: false, reason: "No hay casas para vender" };
    this.houses -= 1;
    const refund = Math.floor(buildCosts().house / 2);
    return { ok: true, refund, houses: this.houses };
  }

  sellHotel() {
    if (!this.hotel) return { ok: false, reason: "No hay hotel para vender" };
    this.hotel = false;
    this.houses = 4;
    const refund = Math.floor(buildCosts().hotel / 2);
    return { ok: true, refund, houses: this.houses };
  }

  async calculateRent({ diceRoll } = {}) {
    if (this.isMortgaged) return 0;

    if (this.type === "railroad") {
      const owned = await countOwnedByType(this.ownerId, "railroad");
      return calcRent(this, { railroadsOwnedByOwner: owned });
    }
    if (this.type === "utility") {
      const owned = await countOwnedByType(this.ownerId, "utility");
      return calcRent(this, { diceRoll, utilitiesOwnedByOwner: owned });
    }
    if (this.type === "property") {
      const groupProps = await getGroupProperties(this);
      return calcRent(this, { groupProps });
    }
    return 0;
  }

  serialize() {
    return {
      id: this.id, name: this.name, type: this.type, color: this.color,
      price: this.price, mortgage: this.mortgage, rent: this.rent,
      ownerId: this.ownerId, houses: this.houses, hotel: this.hotel, isMortgaged: this.isMortgaged,
    };
  }
}
