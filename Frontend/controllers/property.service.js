// controllers/property.service.js
import { getBoard } from "./api.js";
import { normalizeBoardProperty, groupKeyFor } from "../utils/propertyUtils.js";

let __BOARD_CACHE = null;

export async function fetchBoardNormalized() {
  if (__BOARD_CACHE) return __BOARD_CACHE;
  const rawBoard = await getBoard();
  let list = [];
  if (Array.isArray(rawBoard)) {
    list = rawBoard;
  } else if (rawBoard && (rawBoard.squares || rawBoard.casillas)) {
    list = rawBoard.squares || rawBoard.casillas || [];
  } else if (rawBoard && (rawBoard.bottom || rawBoard.left || rawBoard.top || rawBoard.right)) {
    const sides = ["bottom", "left", "top", "right"];
    for (const k of sides) {
      if (Array.isArray(rawBoard[k])) list = list.concat(rawBoard[k]);
    }
  }
  __BOARD_CACHE = list.map(normalizeBoardProperty).filter(Boolean);
  return __BOARD_CACHE;
}

export async function getPropertyById(id) {
  const board = await fetchBoardNormalized();
  return board.find(p => String(p.id) === String(id)) || null;
}

export async function getGroupProperties(prop) {
  if (!prop) return [];
  const board = await fetchBoardNormalized();
  const key = groupKeyFor(prop);
  if (!key) return [];
  if (prop.type === "property") {
    return board.filter(p => p.type === "property" && p.color === prop.color);
  }
  return board.filter(p => groupKeyFor(p) === key);
}

export async function countOwnedByType(ownerId, type) {
  const board = await fetchBoardNormalized();
  return board.filter(p => p.ownerId === ownerId && p.type === type).length;
}

/** Mutadores sobre el cache (solo para pruebas / front): asigna owner por id */
export function setOwnerInCacheById(id, ownerId) {
  if (!__BOARD_CACHE) return false;
  const idx = __BOARD_CACHE.findIndex(p => String(p.id) == String(id));
  if (idx === -1) return false;
  __BOARD_CACHE[idx] = { ...__BOARD_CACHE[idx], ownerId };
  return true;
}

/** Actualiza una propiedad completa en el cache */
export function updatePropertyInCache(property) {
  if (!__BOARD_CACHE || !property) return false;
  const idx = __BOARD_CACHE.findIndex(p => String(p.id) === String(property.id));
  if (idx === -1) return false;
  __BOARD_CACHE[idx] = { ...property.serialize() };
  return true;
}

/** Asigna owner a TODO el grupo de la propiedad dada (incluida ella) */
export async function setOwnerForGroup(prop, ownerId) {
  const group = await getGroupProperties(prop);
  let count = 0;
  for (const p of group) {
    const ok = setOwnerInCacheById(p.id, ownerId);
    if (ok) count++;
  }
  return count;
}