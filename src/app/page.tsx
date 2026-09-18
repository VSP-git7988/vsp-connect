import Link from "next/link";
import { ArrowUpRight, Cpu, Layers3, Sparkles, ScanLine } from "lucide-react";
import { getProfiles } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { Mark } from "@/components/brand";
import { Reveal } from "@/components/reveal";
export const dynamic = "force-dynamic";

export default async function Home() {
  const profiles = await getProfiles();
  return (
    <main id="main">
      <section className="home-hero">
        <Reveal className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> PEOPLE. POSSIBILITIES. PROGRESS.
          </div>
          <h1>
            Great things start
            <br />
            with a <em>connection.</em>
          </h1>
          <p>
            Meet the minds behind VSP Innovations.
            <br />
            Building intelligent products. Creating what’s next.
          </p>
          <a className="button primary" href="#people">
            Meet our founders <ArrowUpRight size={17} />
          </a>
          <div className="hero-caption">
            <span className="tiny-line" /> A new way to stay connected.
          </div>
        </Reveal>
        <Reveal className="hero-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-card">
            <div className="card-top">
              <Mark />
              <span>VSP INNOVATIONS</span>
              <ScanLine size={22} />
            </div>
            <div className="card-symbol">
              vsp<span>✳</span>
            </div>
            <div className="card-bottom">
              <div>
                Ideas into intelligence.
                <small>AI SOLUTIONS & PRODUCT DEVELOPMENT</small>
              </div>
              <span className="contactless">)))</span>
            </div>
          </div>
          <div className="art-caption">
            <span className="status-dot" /> ONE CONNECTION. ENDLESS
            POSSIBILITIES.
          </div>
        </Reveal>
      </section>
      <section id="people" className="people-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE PEOPLE BEHIND THE POSSIBILITIES</div>
            <h2>
              {profiles.length === 2
                ? "Two minds. One vision."
                : "Many minds. One vision."}
            </h2>
          </div>
          <span className="section-aside">
            Built on curiosity. Driven by purpose.
          </span>
        </div>
        <div className="founder-grid">
          {profiles.map((p, i) => (
            <Link
              key={p.id}
              href={`/${p.slug}`}
              className={`founder-card founder-${i % 2}`}
            >
              <div className="founder-top">
                <Avatar profile={p} />
                <span className="profile-arrow">
                  <ArrowUpRight size={21} />
                </span>
              </div>
              <h3>{p.display_name}</h3>
              <div className="role">
                {p.title} <span> / </span> VSP Innovations
              </div>
              <p>{p.headline}</p>
              <div className="founder-bottom">
                <span>
                  <span className="status-dot" /> Let’s connect
                </span>
                <span>
                  View profile <ArrowUpRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        {!profiles.length && (
          <p>No public profiles yet. Please check back soon.</p>
        )}
      </section>
      <section className="company-strip">
        <div className="company-intro">
          <span className="eyebrow">THIS IS VSP INNOVATIONS</span>
          <h2>Intelligence, with intention.</h2>
          <p>
            We bring technology and ambition together to create AI solutions and
            products that make a difference.
          </p>
        </div>
        <div className="capabilities">
          <div>
            <Cpu />
            <span>
              AI Solutions<small>Intelligence that works for you.</small>
            </span>
          </div>
          <div>
            <Layers3 />
            <span>
              Product Development<small>From possibility to product.</small>
            </span>
          </div>
          <div>
            <Sparkles />
            <span>
              Intelligent Automation<small>Less friction. More forward.</small>
            </span>
          </div>
        </div>
      </section>
      <div className="connection-note">
        <ScanLine size={18} />
        <span>A tap. A scan. A real connection.</span>
        <span className="muted">No app needed.</span>
      </div>
    </main>
  );
}
