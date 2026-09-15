import type { Units } from './db';

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** kg stored internally -> display value in the user's preferred unit, rounded to 1dp */
export function displayWeight(weightKg: number, units: Units): number {
  const value = units === 'kg' ? weightKg : kgToLb(weightKg);
  return Math.round(value * 10) / 10;
}

/** value typed by the user in their preferred unit -> kg for storage */
export function toStorageWeightKg(value: number, units: Units): number {
  return units === 'kg' ? value : lbToKg(value);
}

export function weightUnitLabel(units: Units): string {
  return units;
}
