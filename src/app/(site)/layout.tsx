import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFrame } from "./components/SiteLoading";
import { getViewer } from "@/server/auth";
import { PostNavigationProvider } from "./components/PostNavigation";

function HeaderFallback() {
  return (
    <div
      aria-hidden="true"
      className="min-h-[var(--site-header-height)]"
    />
  );
}

async function ViewerHeader() {
  await connection();
  const viewer = await getViewer();

  return (
    <Suspense fallback={<HeaderFallback />}>
      <SiteHeader viewer={viewer} />
    </Suspense>
  );
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <PostNavigationProvider>
      <SiteFrame
        header={
          <Suspense fallback={<HeaderFallback />}>
            <ViewerHeader />
          </Suspense>
        }
      >
        {children}
      </SiteFrame>
    </PostNavigationProvider>
  );
}
