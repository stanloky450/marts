import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, "nigeria-lgas.json"), "utf8")
);

const normalize = (value) => String(value || "").trim().toLowerCase();

const stateToLgas = new Map();

for (const item of raw) {
  const state = String(item?.state_name || "").trim();
  const localGovernment = String(item?.name || "").trim();
  if (!state || !localGovernment) continue;

  const current = stateToLgas.get(state) || new Set();
  current.add(localGovernment);
  stateToLgas.set(state, current);
}

export const nigeriaLocationCatalog = Array.from(stateToLgas.entries())
  .map(([state, lgasSet]) => {
    const localGovernments = Array.from(lgasSet).sort((a, b) => a.localeCompare(b));
    return {
      state,
      localGovernments,
      localGovernmentCount: localGovernments.length,
    };
  })
  .sort((a, b) => a.state.localeCompare(b.state));

const stateIndex = new Map(
  nigeriaLocationCatalog.map((entry) => [
    normalize(entry.state),
    new Set(entry.localGovernments.map((a) => normalize(a))),
  ])
);

export const getLocalGovernmentsByState = (state) => {
  const key = normalize(state);
  const found = nigeriaLocationCatalog.find((entry) => normalize(entry.state) === key);
  return found?.localGovernments || [];
};

export const isValidCatalogState = (state) => stateIndex.has(normalize(state));

export const isValidLocalGovernmentForState = (state, localGovernment) => {
  const lgas = stateIndex.get(normalize(state));
  if (!lgas) return false;
  return lgas.has(normalize(localGovernment));
};
