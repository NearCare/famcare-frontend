import Image from "next/image";
import Link from "next/link";

export type SeoFeature = {
  title: string;
  body: string;
};

export type SeoStep = {
  title: string;
  body: string;
};

export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoPageContent = {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  visual: "dashboard" | "whatsapp" | "care";
  stats: Array<{ value: string; label: string }>;
  problemTitle: string;
  problemBody: string;
  steps: SeoStep[];
  features: SeoFeature[];
  proofTitle: string;
  proofBody: string;
  faqs: SeoFaq[];
  related: Array<{ href: string; label: string; body: string }>;
};

const visualCopy = {
  dashboard: {
    image: "/screenshots/dashboard.png",
    alt: "FamCare parent medicine dashboard with dose status",
  },
  whatsapp: {
    image: "/whats_app_circle.webp",
    alt: "WhatsApp medicine reminders for parents",
  },
  care: {
    image: "/family_walking.webp",
    alt: "Family caregiver support for elderly parents",
  },
};

const navItems = [
  { href: "/medicine-reminders-for-parents", label: "For parents" },
  { href: "/whatsapp-medicine-reminders", label: "WhatsApp reminders" },
  { href: "/elderly-parent-care-app", label: "Elder care" },
];

function Brand() {
  return (
    <Link href="/" className="seo-brand" aria-label="FamCare home">
      <span className="seo-brand-mark">♥</span>
      <span>Fam<span>Care</span></span>
    </Link>
  );
}

function HeroVisual({ type }: { type: SeoPageContent["visual"] }) {
  const copy = visualCopy[type];

  return (
    <div className={`seo-visual seo-visual-${type}`}>
      <div className="seo-visual-header">
        <span>Today</span>
        <strong>Family care status</strong>
      </div>
      <div className="seo-phone-card">
        {type === "whatsapp" ? (
          <div className="seo-chat">
            <p className="seo-chat-msg">Time for Telma 40mg after lunch.</p>
            <p className="seo-chat-reply">Taken</p>
            <p className="seo-chat-msg">Marked as taken. Family updated.</p>
          </div>
        ) : (
          <Image src={copy.image} alt={copy.alt} width={520} height={420} className="seo-visual-img" priority />
        )}
      </div>
      <div className="seo-dose-stack" aria-label="Example medicine status">
        <div><span className="seo-dot green" /> 08:00 AM Metformin <strong>Taken</strong></div>
        <div><span className="seo-dot orange" /> 01:00 PM Telma <strong>Due</strong></div>
        <div><span className="seo-dot blue" /> 08:00 PM Thyroid <strong>Upcoming</strong></div>
      </div>
    </div>
  );
}

function JsonLd({ content, canonical }: { content: SeoPageContent; canonical: string }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: `${content.title} ${content.highlight}`,
        description: content.description,
        isPartOf: {
          "@type": "WebSite",
          name: "FamCare",
          url: "https://famcarehealth.com",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: content.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function SeoLandingPage({
  content,
  canonical,
}: {
  content: SeoPageContent;
  canonical: string;
}) {
  const activePath = new URL(canonical).pathname;

  return (
    <main className="seo-page">
      <JsonLd content={content} canonical={canonical} />

      <nav className="seo-nav">
        <Brand />
        <div className="seo-nav-links">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={activePath === item.href ? "active" : undefined}
              aria-current={activePath === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link href="/login" className="seo-nav-cta">Get started</Link>
      </nav>

      <section className="seo-hero">
        <div className="seo-hero-copy">
          <p className="seo-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}<span>{content.highlight}</span></h1>
          <p className="seo-lede">{content.description}</p>
          <div className="seo-actions">
            <Link href="/login" className="seo-primary">{content.primaryCta}</Link>
            <Link href="#how-it-works" className="seo-secondary">{content.secondaryCta}</Link>
          </div>
          <div className="seo-stat-row">
            {content.stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <HeroVisual type={content.visual} />
      </section>

      <section className="seo-problem">
        <div>
          <p className="seo-section-kicker">The daily worry</p>
          <h2>{content.problemTitle}</h2>
        </div>
        <p>{content.problemBody}</p>
      </section>

      <section id="how-it-works" className="seo-band">
        <div className="seo-section-head">
          <p className="seo-section-kicker">How it works</p>
          <h2>A care loop your family can repeat every day</h2>
        </div>
        <div className="seo-step-grid">
          {content.steps.map((step, index) => (
            <article key={step.title} className="seo-step">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-feature-section">
        <div className="seo-section-head">
          <p className="seo-section-kicker">What FamCare helps with</p>
          <h2>{content.proofTitle}</h2>
          <p>{content.proofBody}</p>
        </div>
        <div className="seo-feature-grid">
          {content.features.map((feature) => (
            <article key={feature.title} className="seo-feature">
              <span aria-hidden="true">✓</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-faq">
        <div className="seo-faq-head">
          <img src="/family-whatsapp.webp" alt="" aria-hidden="true" />
          <div className="seo-section-head">
            <p className="seo-section-kicker">Questions families ask</p>
            <h2>Common questions</h2>
          </div>
        </div>
        <div className="seo-faq-list">
          {content.faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-related">
        <div>
          <p className="seo-section-kicker">Related guides</p>
          <h2>Explore more ways to use FamCare</h2>
        </div>
        <div className="seo-related-grid">
          {content.related.map((item) => (
            <Link key={item.href} href={item.href}>
              <strong>{item.label}</strong>
              <span>{item.body}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="seo-final-cta">
        <h2>Start with one parent and one medicine.</h2>
        <p>Add a medicine schedule, send reminders, and let the family know when doses are confirmed.</p>
        <Link href="/login">Set up FamCare</Link>
      </section>
    </main>
  );
}
