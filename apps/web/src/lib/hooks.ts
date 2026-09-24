"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true só depois da hidratação — evita divergência com dados do localStorage. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
