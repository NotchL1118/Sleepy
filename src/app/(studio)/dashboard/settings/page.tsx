import type { Metadata } from "next";
import { readAiConfiguration } from "@/server/ai/queries";
import { AiSettings } from "./components/AiSettings";

export const metadata: Metadata = { title: "站点设置" };
export const instant = false;
export const maxDuration = 80;

export default async function SettingsPage() {
  const configuration = await readAiConfiguration();

  return (
    <>
      <header>
        <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          站点
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          站点设置
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
          管理 AI 连接与文章生成偏好。
        </p>
      </header>

      {configuration.ok ? (
        <AiSettings configuration={configuration.value} />
      ) : <p role="alert" className="mt-9 text-sm">AI 设置暂时无法读取，请刷新页面重试。</p>}
    </>
  );
}
