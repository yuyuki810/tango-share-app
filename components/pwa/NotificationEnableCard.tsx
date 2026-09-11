'use client';

import React, { useState, useEffect } from "react";
import { Bell, Check, Share, PlusSquare, X, AlertCircle } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationEnableCard() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    setIsIOS(isIOSSafari);
    setIsStandalone(standalone);

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/").then((reg) => {
        if (reg?.pushManager) {
          reg.pushManager.getSubscription().then((sub) => {
            setIsSubscribed(!!sub);
          });
        }
      });
    }
  }, []);

  if (!mounted || !isIOS) {
    return null;
  }

  const handleEnableNotification = async () => {
    setErrorMessage(null);

    if (!isStandalone) {
      setShowIOSModal(true);
      return;
    }

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setErrorMessage("お使いの環境はプッシュ通知に対応していません（iOS 16.4以上が必要です）");
      return;
    }

    setIsLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setIsLoading(false);
        setErrorMessage("通知の許可がキャンセルされました。iPhoneの設定アプリから通知を許可してください。");
        return;
      }

      // 1. Service Worker を登録して即座に ready を待機
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;

      // 2. VAPID公開鍵の取得
      let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        const keyRes = await fetch("/api/push/vapid-public-key");
        const keyData = await keyRes.json();
        vapidPublicKey = keyData.publicKey;
      }

      if (!vapidPublicKey) {
        throw new Error("通知サーバーの公開鍵が取得できませんでした。Vercelの環境変数を確認してください。");
      }

      // 3. PushManager による購読
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      // 4. バックエンドへの保存
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "サーバーへの購読登録に失敗しました");
      }

      setIsSubscribed(true);
    } catch (err: any) {
      console.error("Push enable error:", err);
      setErrorMessage(err?.message || "通知の設定中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubscribed && permission === "granted") {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50/60 p-3.5 shadow-2xs text-left">
        <div className="flex items-center gap-2 text-emerald-900">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          </div>
          <div>
            <span className="font-mincho text-xs font-bold block">通知は有効です</span>
            <span className="font-maru text-[10px] text-emerald-800/70">仲間からの応援通知を受信できます</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-3.5 shadow-2xs text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mincho text-xs font-bold text-ink block">
                仲間からの応援通知を受け取る
              </span>
              <span className="font-maru text-[10px] text-ink/50">
                {!isStandalone
                  ? "ホーム画面に追加すると通知を有効化できます"
                  : "未受検時の応援メッセージを通知でお知らせ"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnableNotification}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 font-maru text-xs font-bold text-paper shadow-2xs transition active:scale-95 hover:bg-ink/90 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <span>{isLoading ? "設定中…" : "有効にする"}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-1.5 rounded-xl border border-akashiito-border bg-akashiito/10 p-2.5 text-akashiito font-maru text-[11px]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-line bg-paper p-5 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-akashiito">
                <PlusSquare className="h-5 w-5" />
                <h3 className="font-mincho text-base font-bold text-ink">
                  ホーム画面に追加が必要です
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/70 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-line/60">
              iPhoneでは、アプリを<strong>ホーム画面に追加して起動した場合のみ</strong>、仲間からの応援通知を受け取ることができます。
            </p>

            <div className="space-y-2 rounded-2xl bg-white/80 p-3.5 border border-line/60 font-maru text-xs text-ink/80">
              <p className="font-bold flex items-center gap-1 text-ink">
                <span>手順:</span>
              </p>
              <p className="leading-relaxed">
                1. Safari下部の共有ボタン <Share className="inline h-3.5 w-3.5 mx-0.5 text-ink/70 -mt-0.5" /> をタップ
              </p>
              <p className="leading-relaxed">
                2. メニューから<strong>「ホーム画面に追加」</strong>を選択
              </p>
              <p className="leading-relaxed">
                3. ホーム画面にできたアイコンから起動して「通知を有効にする」をタップ
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
