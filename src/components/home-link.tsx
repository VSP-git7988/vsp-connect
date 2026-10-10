"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_REGION, ROUTED_REGIONS, regionPath } from "@/lib/regions";
// Links to the landing page of the region being viewed: /us/... goes to /us,
// everything else to /.
export function HomeLink(
  props: Omit<React.ComponentProps<typeof Link>, "href">,
) {
  const first = usePathname().split("/")[1];
  const region = ROUTED_REGIONS.includes(first) ? first : DEFAULT_REGION;
  return <Link href={regionPath(region)} {...props} />;
}
