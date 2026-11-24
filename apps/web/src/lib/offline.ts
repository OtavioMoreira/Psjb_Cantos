"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BASE_PATH } from "./routes";

// Modo Missa sem internet: registra o service worker (public/sw.js) e pede para guardar a página,
// os scripts e o índice de cantos. As missas já ficam no localStorage (store.ts).

const supported = () => typeof navigator !== "undefined" && "serviceWorker" in navigator;

/** Só no build de produção: em desenvolvimento o cache atrapalharia o recarregamento automático. */
export function registerServiceWorker() {
  if (!supported() || process.env.NODE_ENV !== "production") return;
  navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => undefined);
}

/** Tudo o que esta página carregou do próprio site (scripts, estilos, fontes) + a página e o índice de cantos. */
function usedUrls() {
  const own = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(location.origin));
  return [...new Set([location.href, `${location.origin}${BASE_PATH}/dados/cantos.json`, ...own])];
}

/**
 * Guarda o Modo Missa para abrir sem internet. Devolve "pronto" quando o service worker confirmou,
 * "indisponivel" quando não há suporte (ou em desenvolvimento).
 */
export function useOfflineReady(enabled: boolean): "guardando" | "pronto" | "indisponivel" {
  const [state, setState] = useState<"guardando" | "pronto" | "indisponivel">("guardando");
  useEffect(() => {
    if (!enabled) return;
    if (!supported() || process.env.NODE_ENV !== "production") {
      queueMicrotask(() => setState("indisponivel"));
      return;
    }
    let alive = true;
    const onMessage = (e: MessageEvent) => e.data?.type === "cached" && alive && setState("pronto");
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "cache-urls", urls: usedUrls() }));
    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled]);
  return state;
}

/** true quando o aparelho está sem internet. */
export function useOffline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => !navigator.onLine,
    () => false,
  );
}
