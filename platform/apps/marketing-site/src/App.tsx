const DRIVER_URL =
  import.meta.env.VITE_DRIVER_URL ?? "https://vuush-7j3u.vercel.app";
const CUSTOMER_URL =
  import.meta.env.VITE_CUSTOMER_URL ?? "https://vuush-customer.vercel.app";
const ENTERPRISE_URL =
  import.meta.env.VITE_ENTERPRISE_URL ??
  "https://vuush-enterprise.vercel.app";
const CAREERS_EMAIL =
  import.meta.env.VITE_CAREERS_EMAIL ?? "hello@vuush.app";
const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL ?? CAREERS_EMAIL;
const SITE_DOMAIN =
  import.meta.env.VITE_SITE_DOMAIN ?? "vuush.co.za";

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
          <a href="#products">Products</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <p className="hero-brand">VUUSH</p>
          <h1>
            Technology that gives people and businesses their time back.
          </h1>
          <p className="hero-support">
            We close the gap between intention and completion.
          </p>
          <div className="paths">
            <a className="path" href={CUSTOMER_URL}>
              Become a Customer
            </a>
            <a className="path" href={DRIVER_URL}>
              Drive with VUUSH
            </a>
            <a className="path" href={ENTERPRISE_URL}>
              Enterprise Solutions
            </a>
          </div>
        </section>

        <section className="section" id="philosophy">
          <p className="eyebrow">The Point</p>
          <h2>
            VUUSH exists to reduce the time between intention and completion.
          </h2>
          <p className="body">
            When something becomes real, we carry it to done — with calm
            precision, and without wasting human attention.
          </p>
        </section>

        <section className="section" id="products">
          <p className="eyebrow">Products</p>
          <h2>One ecosystem.</h2>
          <ul className="product-list">
            <li>
              <a className="product-row" href={CUSTOMER_URL}>
                <span className="product-name">Customer</span>
                <span className="product-line">Send with clarity.</span>
              </a>
            </li>
            <li>
              <a className="product-row" href={DRIVER_URL}>
                <span className="product-name">Driver</span>
                <span className="product-line">Earn with dignity.</span>
              </a>
            </li>
            <li>
              <a className="product-row" href={ENTERPRISE_URL}>
                <span className="product-name">Enterprise</span>
                <span className="product-line">Ship as an organisation.</span>
              </a>
            </li>
            <li>
              <div className="product-row">
                <span className="product-name">API</span>
                <span className="product-line">Integrate when you are ready.</span>
              </div>
            </li>
            <li>
              <div className="product-row">
                <span className="product-name">AI</span>
                <span className="product-line">Future</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="section" id="about">
          <p className="eyebrow">About VUUSH</p>
          <h2>A technology company, first.</h2>
          <dl className="about-list">
            <div>
              <dt>Mission</dt>
              <dd>Give people their time back by removing friction.</dd>
            </div>
            <div>
              <dt>Vision</dt>
              <dd>
                Intention becomes completion — across logistics, automation, and
                enterprise software.
              </dd>
            </div>
            <div>
              <dt>Leadership</dt>
              <dd>Ariel Johannes · Founder</dd>
            </div>
            <div>
              <dt>Company story</dt>
              <dd>
                Built on first principles: progress is not rush. Progress is
                clean completion of what was intended.
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
              <dt>Technology</dt>
              <dd>
                Precise systems. Honest status. Craft over noise.
              </dd>
            </div>
          </dl>
        </section>

        <section className="section reference" id="trust">
          <p className="eyebrow">Trust</p>
          <h2>For people who look closer.</h2>
          <dl className="about-list">
            <div>
              <dt>Safety</dt>
              <dd>
                Drivers are cleared before city work. Jobs stay visible. Money
                moves with an audit trail.
              </dd>
            </div>
            <div id="coverage">
              <dt>Coverage</dt>
              <dd>
                Beachhead city: Cape Town, South Africa. We expand only when
                the city is ready.
              </dd>
            </div>
            <div>
              <dt>Support</dt>
              <dd>
                Need help?{" "}
                <a
                  className="inline"
                  href={`mailto:${CONTACT_EMAIL}?subject=Support`}
                >
                  {CONTACT_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="section reference" id="privacy">
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

        <section className="section reference" id="terms">
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
                <a href="#trust">Safety &amp; trust</a>
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
