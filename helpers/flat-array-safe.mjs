import { flatten } from "flat";

export const arraySafeFlatten = (obj) => {
  const toReturn = {};
  const safeFlattened = flatten(obj, {
    safe: true,
  });

  const keys = Object.keys(safeFlattened);
  keys.forEach((key) => {
    let val = safeFlattened[key];
    if (Array.isArray(val)) {
      val = JSON.stringify(val);
    }
    toReturn[key] = val;
  });

  return toReturn;
};
