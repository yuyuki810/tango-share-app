import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "英単語グループ学習",
  description: "少人数グループで日々の単語テストを継続する受験生向けアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${shipporiMincho.variable} ${zenKakuGothic.variable} ${zenMaruGothic.variable}`}
    >
      <body className="flex min-h-screen flex-col items-center justify-start bg-paper">
        <div className="w-full max-w-md min-h-screen flex flex-col px-4 py-6 sm:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}
