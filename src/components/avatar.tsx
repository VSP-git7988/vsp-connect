import Image from "next/image";
import type { Profile } from "@/lib/types";
import { accentStyle } from "@/lib/accents";

type PortraitProfile = Pick<
  Profile,
  "display_name" | "first_name" | "last_name" | "profile_image"
>;

// Rendered sizes per spot, mirrored from globals.css (.avatar, .avatar-large,
// .hero-monogram). `size` is the largest diameter, used as the intrinsic
// width/height so the box is reserved before the image loads; `sizes` lets the
// optimizer serve a 1x/2x file for each breakpoint instead of the original.
export const PORTRAIT_SIZES = {
  card: { size: 62, sizes: "62px" },
  large: { size: 100, sizes: "(max-width: 640px) 85px, 100px" },
  hero: { size: 68, sizes: "(max-width: 767.98px) 68px, 48px" },
} as const;

// The founder's photo, cropped square and centred to fill its circular frame.
// Callers render the monogram instead when profile_image is null.
export function Portrait({
  profile,
  spot,
  preload = false,
}: {
  profile: PortraitProfile;
  spot: keyof typeof PORTRAIT_SIZES;
  preload?: boolean;
}) {
  const src = profile.profile_image!;
  const { size, sizes } = PORTRAIT_SIZES[spot];
  return (
    <Image
      className="portrait"
      src={src}
      alt={profile.display_name}
      width={size}
      height={size}
      sizes={sizes}
      preload={preload}
      // Files in public/ go through the optimizer; remote https portraits are
      // served directly rather than via an open image proxy.
      unoptimized={!src.startsWith("/")}
    />
  );
}

export function Avatar({
  profile,
  large = false,
}: {
  profile: Profile;
  large?: boolean;
}) {
  return (
    <div
      className={`avatar ${large ? "avatar-large" : ""}`}
      style={accentStyle(profile)}
    >
      {profile.profile_image ? (
        // The profile page's main avatar is above the fold.
        <Portrait
          profile={profile}
          spot={large ? "large" : "card"}
          preload={large}
        />
      ) : (
        <span aria-label={`${profile.display_name}, portrait not yet provided`}>
          {profile.first_name[0]}
          {profile.last_name[0]}
        </span>
      )}
    </div>
  );
}
