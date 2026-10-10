import Image from "next/image";
import type { Profile } from "@/lib/types";
import { profileApiPath } from "@/lib/regions";
// The profile's real QR code, served by /api/profiles/[slug]/qr.
export function ProfileQr({
  profile,
  size = 256,
  className,
}: {
  profile: Pick<Profile, "slug" | "display_name" | "region_code">;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      unoptimized
      className={className}
      src={profileApiPath(profile.slug, "qr", profile.region_code)}
      alt={`QR code linking to ${profile.display_name}'s profile`}
      width={size}
      height={size}
    />
  );
}
