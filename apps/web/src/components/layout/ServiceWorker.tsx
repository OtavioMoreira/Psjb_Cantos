"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/offline";

/** Registra o service worker (Modo Missa sem internet). Não desenha nada. */
export function ServiceWorker() {
  useEffect(() => registerServiceWorker(), []);
  return null;
}
