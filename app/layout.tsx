import type { Metadata, Viewport } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const shipporiMincho = Shippori_Mincho({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-shippori",
  display: "swap",
});

const zenKakuGothic = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  display: "swap",
});

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#232A3B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "英単語グループ学習",
  description: "グループで日々の単語テストを継続する受験生向けアプリ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "単語道場",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${shipporiMincho.variable} ${zenKakuGothic.variable} ${zenMaruGothic.variable}`}
    >
      <head>
        {/* 初回描画前のチラつき (FOUC) を防止するインラインテーマ初期化スクリプト */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('tango_theme');
                if (theme === 'dark-purple') {
                  document.documentElement.setAttribute('data-theme', 'dark-purple');
                } else {
                  document.documentElement.setAttribute('data-theme', 'washi');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col items-center justify-start bg-paper antialiased">
        <ThemeProvider>
          <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl min-h-screen flex flex-col px-4 py-6 sm:px-6 md:px-8">
            {children}
          </div>
          <IOSInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
