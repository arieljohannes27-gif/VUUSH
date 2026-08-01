import type { ReactNode } from "react";

const DRIVER_URL =
  import.meta.env.VITE_DRIVER_URL ?? "https://vuush-7j3u.vercel.app";
const CUSTOMER_URL =
  import.meta.env.VITE_CUSTOMER_URL ?? "https://vuush-customer.vercel.app";
const ENTERPRISE_URL =
  import.meta.env.VITE_ENTERPRISE_URL ??
  "https://vuush-enterprise.vercel.app";
const DISPATCH_URL =
  import.meta.env.VITE_DISPATCH_URL ?? "https://vuush-dispatch.vercel.app";
const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ?? "https://vuush-admin.vercel.app";
const CAREERS_EMAIL =
  import.meta.env.VITE_CAREERS_EMAIL ?? "hello@vuush.app";
const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL ?? CAREERS_EMAIL;
const SITE_DOMAIN =
  import.meta.env.VITE_SITE_DOMAIN ?? "vuush.co.za";

function PhoneMock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "customer" | "driver";
  children: ReactNode;
}) {
  return (
    <div className={`device phone phone--${tone}`} aria-hidden="true">
      <div className="phone-bezel">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-status">
            <span>VUUSH</span>
            <span>{title}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function DeskMock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="device desk" aria-hidden="true">
      <div className="desk-chrome">
        <span className="desk-dots" />
        <span className="desk-title">{title}</span>
      </div>
      <div className="desk-screen">{children}</div>
    </div>
  );
}

export default function App() {
  const year = new Date().getFullYear();

  return (
    <div className="site">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="nav">
        <a className="lockup" href="#top" aria-label="VUUSH home">
          <span className="mark" aria-hidden="true" />
          <span className="word">VUUSH</span>
        </a>
        <nav aria-label="Primary">
          <a href="#ecosystem">Ecosystem</a>
          <a href="#platform">Platform</a>
          <a href="#about">Company</a>
        </nav>
      </header>

      <main id="main">
        {/* 1 — Hero: one composition */}
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="hero-brand">VUUSH</p>
            <h1>Intention becomes completion.</h1>
            <p className="hero-support">
              Africa’s mobility and logistics platform — built to give people
              and businesses their time back.
            </p>
            <div className="paths">
              <a className="path path-primary" href={CUSTOMER_URL}>
                Become a Customer
              </a>
              <a className="path" href={DRIVER_URL}>
                Drive with VUUSH
              </a>
              <a className="path" href={ENTERPRISE_URL}>
                Enterprise
              </a>
            </div>
          </div>
          <div className="hero-stage" aria-hidden="true">
            <div className="hero-atmosphere" />
            <div className="hero-orbit">
              <PhoneMock title="Send" tone="customer">
                <div className="ui-block">
                  <p className="ui-kicker">Cape Town</p>
                  <p className="ui-line">Pickup confirmed</p>
                  <div className="ui-bar" />
                  <p className="ui-quiet">On the way · live</p>
                </div>
              </PhoneMock>
              <DeskMock title="Dispatch">
                <div className="ui-desk-grid">
                  <div className="ui-rail" />
                  <div className="ui-canvas">
                    <span className="ui-chip">3 active</span>
                    <span className="ui-chip ui-chip-soft">Clear board</span>
                  </div>
                </div>
              </DeskMock>
            </div>
          </div>
        </section>

        {/* 2 — Thesis */}
        <section className="band thesis" id="philosophy">
          <p className="eyebrow">The point</p>
          <h2>
            We reduce the distance between what someone intends and what gets
            done.
          </h2>
          <p className="body">
            VUUSH is not a courier brand. It is an operating system for city
            movement — calm software that carries work to completion without
            wasting human attention.
          </p>
        </section>

        {/* 3 — Ecosystem narrative */}
        <section className="band ecosystem" id="ecosystem">
          <header className="band-head">
            <p className="eyebrow">Ecosystem</p>
            <h2>One platform. Four surfaces. One truth.</h2>
            <p className="body">
              Customer, Driver, Dispatch, and Admin share the same job spine —
              so status stays honest from request to done.
            </p>
          </header>

          <article className="showcase">
            <div className="showcase-copy">
              <p className="showcase-name">Customer</p>
              <h3>Send with clarity.</h3>
              <p>
                Book once. See progress without chasing. Completion arrives
                clean — so your day keeps moving.
              </p>
              <a className="text-link" href={CUSTOMER_URL}>
                Open Customer →
              </a>
            </div>
            <PhoneMock title="Customer" tone="customer">
              <div className="ui-block">
                <p className="ui-kicker">New send</p>
                <p className="ui-line">Sea Point → CBD</p>
                <div className="ui-steps">
                  <span className="on" />
                  <span className="on" />
                  <span />
                </div>
                <p className="ui-quiet">Driver assigned</p>
              </div>
            </PhoneMock>
          </article>

          <article className="showcase showcase-flip">
            <div className="showcase-copy">
              <p className="showcase-name">Driver</p>
              <h3>Earn with dignity.</h3>
              <p>
                Clear offers. Honest pay. Live guidance that respects your time
                on the road — not a noisy marketplace.
              </p>
              <a className="text-link" href={DRIVER_URL}>
                Open Driver →
              </a>
            </div>
            <PhoneMock title="Driver" tone="driver">
              <div className="ui-block ui-block-dark">
                <p className="ui-kicker">Offer</p>
                <p className="ui-line">R186 · 4.2 km</p>
                <div className="ui-ring" />
                <p className="ui-quiet">Accept · Decline</p>
              </div>
            </PhoneMock>
          </article>

          <article className="showcase">
            <div className="showcase-copy">
              <p className="showcase-name">Dispatch</p>
              <h3>Run the city with a quiet board.</h3>
              <p>
                Operators see what matters: open work, live jobs, and the next
                clean decision — without dashboard theatre.
              </p>
              <a className="text-link" href={DISPATCH_URL}>
                Open Dispatch →
              </a>
            </div>
            <DeskMock title="VUUSH Dispatch">
              <div className="ui-desk-grid">
                <div className="ui-rail">
                  <span />
                  <span />
                  <span className="hot" />
                </div>
                <div className="ui-canvas">
                  <div className="ui-map" />
                  <div className="ui-list">
                    <i />
                    <i />
                    <i className="dim" />
                  </div>
                </div>
              </div>
            </DeskMock>
          </article>

          <article className="showcase showcase-flip">
            <div className="showcase-copy">
              <p className="showcase-name">Admin</p>
              <h3>Govern the platform with precision.</h3>
              <p>
                Clear drivers. Price the city. Watch money and audit trails.
                Staff access stays locked behind roles and MFA.
              </p>
              <a className="text-link" href={ADMIN_URL}>
                Open Admin →
              </a>
            </div>
            <DeskMock title="VUUSH Admin">
              <div className="ui-desk-grid">
                <div className="ui-rail ui-rail-wide">
                  <span className="hot" />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="ui-canvas ui-canvas-finance">
                  <p className="ui-line">Finance</p>
                  <div className="ui-bars">
                    <b style={{ height: "62%" }} />
                    <b style={{ height: "40%" }} />
                    <b style={{ height: "78%" }} />
                    <b style={{ height: "52%" }} />
                  </div>
                </div>
              </div>
            </DeskMock>
          </article>
        </section>

        {/* 4 — Enterprise / API beat */}
        <section className="band continuum" id="products">
          <p className="eyebrow">Continuum</p>
          <h2>Organisations and builders, when ready.</h2>
          <div className="continuum-rows">
            <a className="continuum-row" href={ENTERPRISE_URL}>
              <span className="continuum-name">Enterprise</span>
              <span className="continuum-line">
                Ship as an organisation — sites, members, statements.
              </span>
            </a>
            <div className="continuum-row muted-row">
              <span className="continuum-name">API</span>
              <span className="continuum-line">
                Integrate when your systems are ready.
              </span>
            </div>
            <div className="continuum-row muted-row">
              <span className="continuum-name">AI</span>
              <span className="continuum-line">Future — precision over spectacle.</span>
            </div>
          </div>
        </section>

        {/* 5 — Trust / platform proof (honest, no fake scale) */}
        <section className="band platform" id="platform">
          <header className="band-head">
            <p className="eyebrow">Platform</p>
            <h2>Trust is operational, not decorative.</h2>
            <p className="body">
              We earn confidence through how the system behaves — every day, in
              one city first.
            </p>
          </header>
          <ul className="proof-list">
            <li>
              <strong>Cleared drivers</strong>
              <span>
                Identity, licence, insurance, and police clearance before city
                work.
              </span>
            </li>
            <li>
              <strong>Visible jobs</strong>
              <span>
                One shared status spine from request to proof of delivery.
              </span>
            </li>
            <li>
              <strong>Audit trail</strong>
              <span>
                Money, roles, and sensitive actions leave a record you can
                inspect.
              </span>
            </li>
            <li>
              <strong>Staff MFA</strong>
              <span>
                Dispatch and Admin require stronger sign-in than a password
                alone.
              </span>
            </li>
            <li id="coverage">
              <strong>Beachhead discipline</strong>
              <span>
                Cape Town, South Africa. We expand only when the city is ready.
              </span>
            </li>
            <li>
              <strong>Encrypted documents</strong>
              <span>
                Driver verification files move in transit for verification — not
                for sale.
              </span>
            </li>
          </ul>
        </section>

        {/* 6 — Company */}
        <section className="band about" id="about">
          <header className="band-head">
            <p className="eyebrow">Company</p>
            <h2>A technology company, first.</h2>
          </header>
          <dl className="about-list">
            <div>
              <dt>Mission</dt>
              <dd>Give people their time back by removing friction.</dd>
            </div>
            <div>
              <dt>Vision</dt>
              <dd>
                Intention becomes completion — across logistics, automation, and
                enterprise software for Africa.
              </dd>
            </div>
            <div>
              <dt>Leadership</dt>
              <dd>Ariel Johannes · Founder</dd>
            </div>
            <div>
              <dt>Story</dt>
              <dd>
                Progress is not rush. Progress is clean completion of what was
                intended.
              </dd>
            </div>
            <div>
              <dt>Careers</dt>
              <dd>
                <a
                  className="inline"
                  href={`mailto:${CAREERS_EMAIL}?subject=Careers`}
                >
                  {CAREERS_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt>Craft</dt>
              <dd>Precise systems. Honest status. Restraint over noise.</dd>
            </div>
          </dl>
        </section>

        <section className="band reference" id="trust">
          <p className="eyebrow">Support</p>
          <h2>For people who look closer.</h2>
          <p className="body">
            Questions about safety, coverage, or access:{" "}
            <a
              className="inline"
              href={`mailto:${CONTACT_EMAIL}?subject=Support`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="band reference" id="privacy">
          <p className="eyebrow">Privacy</p>
          <h2>We keep only what we need.</h2>
          <p className="body">
            VUUSH uses account, job, and location data to complete deliveries and
            run the platform. We do not sell personal data. Questions:{" "}
            <a
              className="inline"
              href={`mailto:${CONTACT_EMAIL}?subject=Privacy`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="band reference" id="terms">
          <p className="eyebrow">Terms</p>
          <h2>Clear use of VUUSH.</h2>
          <p className="body">
            Using Customer, Driver, or Enterprise means you agree to complete
            work honestly, follow local law, and respect people on every job.
            Formal contracts for organisations are issued through Enterprise.
            Questions:{" "}
            <a
              className="inline"
              href={`mailto:${CONTACT_EMAIL}?subject=Terms`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </main>

      <footer className="footer" aria-label="Company directory">
        <div className="footer-grid">
          <div className="footer-col">
            <p className="footer-heading">Products</p>
            <ul>
              <li>
                <a href={CUSTOMER_URL}>Customer</a>
              </li>
              <li>
                <a href={DRIVER_URL}>Driver</a>
              </li>
              <li>
                <a href={ENTERPRISE_URL}>Enterprise</a>
              </li>
              <li>
                <a href={DISPATCH_URL}>Dispatch</a>
              </li>
              <li>
                <a href={ADMIN_URL}>Admin</a>
              </li>
              <li>
                <span className="footer-muted">API · when ready</span>
              </li>
              <li>
                <span className="footer-muted">AI · future</span>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <p className="footer-heading">Company</p>
            <ul>
              <li>
                <a href="#about">About</a>
              </li>
              <li>
                <a href="#about">Leadership</a>
              </li>
              <li>
                <a href={`mailto:${CAREERS_EMAIL}?subject=Careers`}>Careers</a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Contact`}>Contact</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <p className="footer-heading">For serious customers</p>
            <ul>
              <li>
                <a href={ENTERPRISE_URL}>Enterprise portal</a>
              </li>
              <li>
                <a href="#platform">Safety &amp; trust</a>
              </li>
              <li>
                <a href="#coverage">Coverage</a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Support`}>Support</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <p className="footer-heading">Trust &amp; legal</p>
            <ul>
              <li>
                <a href="#privacy">Privacy</a>
              </li>
              <li>
                <a href="#terms">Terms of use</a>
              </li>
              <li>
                <a href={DRIVER_URL}>For drivers</a>
              </li>
              <li>
                <a href={ENTERPRISE_URL}>For businesses</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bar">
          <a className="lockup" href="#top">
            <span className="mark" aria-hidden="true" />
            <span className="word">VUUSH</span>
          </a>
          <p>
            © {year} VUUSH · South Africa · {SITE_DOMAIN}
          </p>
        </div>
      </footer>
    </div>
  );
}
