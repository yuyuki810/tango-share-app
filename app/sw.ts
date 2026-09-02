import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. テスト送信・回答保存などのAPIルートは絶対にキャッシュせず常にネットワーク優先
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // 2. 動的ページ（ダッシュボード・グループ・弱点マップ等）: NetworkFirst 戦略
    // オンライン時は常に最新を取得し、回線切断・不安定時のみ直近のキャッシュにフォールバック
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 3,
      }),
    },
    // 3. 静的アセット・フォント・画像などのデフォルトキャッシュ
    ...defaultCache,
  ],
});

serwist.addEventListeners();
