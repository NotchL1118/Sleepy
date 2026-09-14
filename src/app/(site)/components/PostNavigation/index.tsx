"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { PostGroup, PostKind } from "@/lib/posts/types";

type NavigationLocation = {
  pathname: string;
  kind: PostKind;
  group: PostGroup;
};

const LocationContext = createContext<NavigationLocation | null>(null);
const SetLocationContext = createContext<Dispatch<SetStateAction<NavigationLocation | null>>>(() => {});

export function PostNavigationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<NavigationLocation | null>(null);

  return (
    <SetLocationContext value={setLocation}>
      <LocationContext value={location}>{children}</LocationContext>
    </SetLocationContext>
  );
}

export function usePostNavigationLocation(pathname: string) {
  const location = useContext(LocationContext);
  return location?.pathname === pathname ? location : null;
}

// Publish only metadata already loaded by the page; no eager menu query.
export function PostNavigationLocation({ pathname, kind, group }: NavigationLocation) {
  const setLocation = useContext(SetLocationContext);
  const { name, slug } = group;

  useEffect(() => {
    const location = { pathname, kind, group: { name, slug } };
    setLocation(location);
    return () => setLocation((current) => current === location ? null : current);
  }, [pathname, kind, name, slug, setLocation]);

  return null;
}
