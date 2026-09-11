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
    // 1. API ルートおよび Next.js App Router の RSC ペイロードはキャッシュ待機せずダイレクト通信 (不可侵)
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

// --- Web Push リスナー (フェーズF-12) ---
self.addEventListener("push", (event: any) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "単語道場";
    const options = {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/icon-192x192.png",
      data: {
        url: data.url || "/dashboard",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Push event error:", err);
  }
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: any[]) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// iOSでの購読失効対策: ブラウザによる購読更新イベント
self.addEventListener("pushsubscriptionchange", (event: any) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((newSubscription: any) => {
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSubscription),
        });
      })
      .catch((err: any) => console.error("Subscription refresh error:", err))
  );
});
