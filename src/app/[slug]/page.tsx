import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2 } from "lucide-react";
import { getProfile, getProfiles, getCompany, profileUrl } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { ProfileActions } from "@/components/profile-actions";
import { Reveal } from "@/components/reveal";
import { safeWebUrl } from "@/lib/contact";
import { AIAssistant } from "@/components/ai-assistant";
import { getAIContext } from "@/lib/ai/data";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProfile(slug);
  return {
    title: p?.display_name ?? "Profile not found",
    description: p?.headline,
  };
}
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "vsp-innovations") redirect("/");
  const p = await getProfile(slug);
  if (!p) notFound();
  const [company, profiles, ai] = await Promise.all([
    getCompany(p.company_id),
    getProfiles(),
    getAIContext(p),
  ]);
  return (
    <main id="main" className="profile-main">
      <Link href="/" className="back-link">
        <ArrowLeft size={15} /> Our people
      </Link>
      <Reveal className="identity-panel">
        <div className="identity-banner">
          <span>VSP INNOVATIONS</span>
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
              companyWebsite={company.website}
            />
          )}
          <ProfileActions profile={p} url={profileUrl(p.slug)} />
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
          <Link className="text-link" href="/">
            Meet VSP Innovations <ArrowUpRight size={16} />
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
      <section className="other-founders">
        <div className="eyebrow">MORE MINDS. SHARED VISION.</div>
        {profiles
          .filter((x) => x.id !== p.id && x.company_id === p.company_id)
          .map((x) => (
            <Link key={x.id} href={`/${x.slug}`}>
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
    </main>
  );
}
