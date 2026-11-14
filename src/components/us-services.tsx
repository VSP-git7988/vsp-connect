import {
  Cpu,
  Layers3,
  Sparkles,
  Plug,
  MessagesSquare,
  Code2,
  BriefcaseBusiness,
  Smartphone,
  BrainCircuit,
  Globe,
} from "lucide-react";
import { usServiceDescriptions } from "@/lib/us-content";
const icons = {
  "Full-stack web applications": Code2,
  "AI products": Cpu,
  "AI features inside client products": Plug,
  "Mobile apps": Smartphone,
  "Business and marketing websites": Globe,
  "Intelligence System": BrainCircuit,
  "AI Solutions": Cpu,
  "Product Development": Layers3,
  "Intelligent Automation": Sparkles,
  "AI Integration": Plug,
  "AI Consulting": MessagesSquare,
  "Custom Software Development": Code2,
};
export function USServices({ services }: { services: string[] }) {
  return (
    <section className="us-services" aria-labelledby="us-services-heading">
      <div className="eyebrow">SERVICES</div>
      <h2 id="us-services-heading">How I can help</h2>
      <div className="us-services-grid">
        {services.map((service) => {
          const [name, ...description] = service
            .split("|")
            .map((part) => part.trim());
          const Icon = icons[name as keyof typeof icons] ?? BriefcaseBusiness;
          const summary =
            description.join(" | ") ||
            usServiceDescriptions[name] ||
            (name === "Intelligence System"
              ? ""
              : "Tailored to your goals, from idea to delivery.");
          return (
            <article className="us-service-card" key={service}>
              <span className="us-service-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <div>
                <h3>{name}</h3>
                {summary && <p>{summary}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
