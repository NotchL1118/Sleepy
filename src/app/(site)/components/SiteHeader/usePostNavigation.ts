"use client";

import { useRef, useState } from "react";
import type { PostKind, PostNavigationGroup } from "@/lib/posts/types";
import { loadPostNavigation } from "@/server/posts/actions";

export type NavigationResource = {
  groups?: readonly PostNavigationGroup[];
  error?: boolean;
};

const REUSE_TIME = 5 * 60 * 1000;

export function usePostNavigation() {
  const [resources, setResources] = useState<Partial<Record<PostKind, NavigationResource>>>({});
  const requests = useRef<Partial<Record<PostKind, Promise<void>>>>({});
  const loadedAt = useRef<Partial<Record<PostKind, number>>>({});

  function load(kind: PostKind) {
    if (requests.current[kind] || Date.now() - (loadedAt.current[kind] ?? 0) < REUSE_TIME) return;

    setResources((current) => ({ ...current, [kind]: {} }));
    requests.current[kind] = loadPostNavigation(kind)
      .then((groups) => {
        loadedAt.current[kind] = Date.now();
        setResources((current) => ({ ...current, [kind]: { groups } }));
      })
      .catch(() => {
        setResources((current) => ({ ...current, [kind]: { error: true } }));
      })
      .finally(() => { delete requests.current[kind]; });
  }

  return { resources, load };
}
