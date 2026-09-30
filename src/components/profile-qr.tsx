import Image from "next/image";
import type { Profile } from "@/lib/types";
// The profile's real QR code, served by /api/profiles/[slug]/qr.
export function ProfileQr({
  profile,
  size = 256,
  className,
}: {
  profile: Pick<Profile, "slug" | "display_name">;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      unoptimized
      className={className}
      src={`/api/profiles/${profile.slug}/qr`}
      alt={`QR code linking to ${profile.display_name}'s profile`}
      width={size}
      height={size}
    />
  );
}
