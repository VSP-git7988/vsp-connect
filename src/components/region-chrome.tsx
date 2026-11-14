"use client";
import { usePathname } from "next/navigation";
export function RegionChrome({
  children,
  us,
}: {
  children: React.ReactNode;
  us?: React.ReactNode;
}) {
  const path = usePathname();
  return <>{path === "/us" || path.startsWith("/us/") ? us : children}</>;
}
