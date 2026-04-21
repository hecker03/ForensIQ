export const OPERATOR_SNAPSHOT_STORAGE_KEY = "forensiq_operator_snapshot";

export function saveOperatorSnapshot(snapshot) {
  localStorage.setItem(OPERATOR_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function readOperatorSnapshot() {
  try {
    const rawValue = localStorage.getItem(OPERATOR_SNAPSHOT_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}
