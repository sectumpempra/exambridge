import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "ExamBridge 教师扩科助手",
    description: "面向国际学校教师的跨考试局扩科教研平台：查分数线、对比考纲、预测等级并生成刷题规划。",
    applicationName: "ExamBridge",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/icons/icon-192x192.png",
      apple: "/icons/icon-192x192.png",
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: origin,
      siteName: "ExamBridge",
      title: "ExamBridge 教师扩科助手",
      description: "覆盖 CAIE、Edexcel、AQA、OCR 与 WJEC/Eduqas 的跨考试局教研平台。",
      images: [{ url: `${origin}/og.jpg`, width: 1200, height: 630, alt: "ExamBridge 教师扩科助手" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ExamBridge 教师扩科助手",
      description: "查分数线、对比考纲、预测等级并生成刷题规划。",
      images: [`${origin}/og.jpg`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
