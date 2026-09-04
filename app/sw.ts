import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. API ルートおよび Next.js App Router の RSC ペイロードはキャッシュ待機せずダイレクト通信
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") || url.searchParams.has("_rsc"),
      handler: new NetworkOnly(),
    },
    // 2. ページ全体の初期読み込み: 短いタイムアウト (1.2s) で即座にフォールバック
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 1.2,
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
