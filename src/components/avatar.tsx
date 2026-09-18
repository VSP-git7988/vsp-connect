import Image from "next/image";
import type { Profile } from "@/lib/types";
export function Avatar({
  profile,
  large = false,
}: {
  profile: Profile;
  large?: boolean;
}) {
  return (
    <div
      className={`avatar ${large ? "avatar-large" : ""} ${profile.slug === "kavya-kelam" ? "violet" : ""}`}
    >
      {profile.profile_image ? (
        <Image
          src={profile.profile_image}
          alt={profile.display_name}
          fill
          sizes={large ? "112px" : "64px"}
          unoptimized
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
