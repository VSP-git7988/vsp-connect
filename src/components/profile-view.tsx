import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2 } from "lucide-react";
import { getCompany, getRegionProfile, getRegionProfiles } from "@/lib/data";
import { regionPath, regionUrl } from "@/lib/regions";
import type { Region } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { ProfileActions } from "@/components/profile-actions";
import { Reveal } from "@/components/reveal";
import { safeWebUrl } from "@/lib/contact";
import { AIAssistant } from "@/components/ai-assistant";
import { getAIContext } from "@/lib/ai/data";
import { accentStyle } from "@/lib/accents";
// A profile as listed in one region: /[slug] for the default region,
// /[code]/[slug] for the others.
export async function ProfileView({
  region,
  slug,
}: {
  region: Region;
  slug: string;
}) {
  if (slug === "vsp-innovations") redirect(regionPath(region.code));
  const p = await getRegionProfile(slug, region.code);
  if (!p) notFound();
  const [company, profiles, ai] = await Promise.all([
    getCompany(p.company_id),
    getRegionProfiles(region.code),
    getAIContext(p),
  ]);
  // Hidden in a region where this is the only founder listed.
  const others = profiles.filter(
    (x) => x.id !== p.id && x.company_id === p.company_id,
  );
  return (
    <main id="main" className="profile-main" style={accentStyle(p)}>
      <Link href={regionPath(region.code)} className="back-link">
        <ArrowLeft size={15} /> Our people
      </Link>
      <Reveal className="identity-panel">
        <div className="identity-banner">
          <span>{company.name.toUpperCase()}</span>
          <span>
            DIGITAL IDENTITY <span className="status-dot" />
          </span>
        </div>
        <div className="identity-content">
          <Avatar profile={p} large />
          <div className="identity-heading">
            <span className="eyebrow">IDEAS. INTELLIGENCE. IMPACT.</span>
            <h1>{p.display_name}</h1>
            <p className="role">
              {p.title} <span> / </span> {company.name}
            </p>
            <h2>{p.headline}</h2>
          </div>
          {ai.enabled && (
            <AIAssistant
              profile={p}
              context={ai}
              companyName={company.name}
              companyWebsite={company.website}
            />
          )}
          <ProfileActions profile={p} url={regionUrl(region.code, p.slug)} />
        </div>
      </Reveal>
      <div className="profile-details">
        <section>
          <div className="eyebrow">A LITTLE ABOUT ME</div>
          <h2>Driven by what’s possible.</h2>
          <p>{p.bio}</p>
          <div className="expertise">
            {p.expertise.map((x) => (
              <span key={x.name}>{x.name}</span>
            ))}
          </div>
          {p.social_links
            .filter((x) => safeWebUrl(x.url))
            .map((x) => (
              <a
                className="text-link"
                href={x.url}
                key={x.platform + x.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {x.label} <ArrowUpRight size={15} />
              </a>
            ))}
        </section>
        <section className="profile-company">
          <Building2 size={23} />
          <div className="eyebrow">BUILDING AT</div>
          <h2>{company.name}</h2>
          <h3>AI Solutions & Product Development</h3>
          <p>{company.description}</p>
          <Link className="text-link" href={regionPath(region.code)}>
            Meet {company.name} <ArrowUpRight size={16} />
          </Link>
          {safeWebUrl(company.website) && (
            <a
              className="text-link"
              href={company.website!}
              target="_blank"
              rel="noopener noreferrer"
            >
              Company website <ArrowUpRight size={16} />
            </a>
          )}
        </section>
      </div>
      {others.length > 0 && (
        <section className="other-founders">
          <div className="eyebrow">MORE MINDS. SHARED VISION.</div>
          {others.map((x) => (
            <Link key={x.id} href={regionPath(region.code, x.slug)}>
              <Avatar profile={x} />
              <div>
                <small>
                  Meet{" "}
                  {profiles.length === 2 ? "the other founder" : "the team"}
                </small>
                <h3>{x.display_name}</h3>
                <p>
                  {x.title}, {company.name}
                </p>
              </div>
              <ArrowUpRight size={22} />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
