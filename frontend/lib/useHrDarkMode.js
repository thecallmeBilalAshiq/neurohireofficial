"use client";

import { useCallback, useSyncExternalStore } from "react";

export const HR_DARK_MODE_STORAGE_KEY = "neurohire_hr_dark_mode";
const LEGACY_KEY = "darkMode";
const CHANGE_EVENT = "neurohire-hr-dark-mode";

function readStored() {
  if (typeof window === "undefined") return false;
  let raw = localStorage.getItem(HR_DARK_MODE_STORAGE_KEY);
  if (raw === null) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      raw = legacy;
      localStorage.setItem(HR_DARK_MODE_STORAGE_KEY, legacy);
    }
  }
  return raw === "true";
}

function writeStored(value) {
  const s = value ? "true" : "false";
  localStorage.setItem(HR_DARK_MODE_STORAGE_KEY, s);
  localStorage.setItem(LEGACY_KEY, s);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onStoreChange) {
  const onStorage = (e) => {
    if (e.key === HR_DARK_MODE_STORAGE_KEY || e.key === LEGACY_KEY || e.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

/**
 * Shared HR light/dark preference: one key, persists across dashboard, job posting, ranked candidates.
 */
export function useHrDarkMode() {
  const darkMode = useSyncExternalStore(subscribe, readStored, () => false);
  const setDarkMode = useCallback((next) => {
    const resolved = typeof next === "function" ? next(readStored()) : next;
    writeStored(Boolean(resolved));
  }, []);
  return [darkMode, setDarkMode];
}
