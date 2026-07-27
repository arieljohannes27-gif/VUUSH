const DRIVER_URL =
  import.meta.env.VITE_DRIVER_URL ?? "https://vuush-7j3u.vercel.app";
const CUSTOMER_URL =
  import.meta.env.VITE_CUSTOMER_URL ?? "https://vuush-customer.vercel.app";
const ENTERPRISE_URL =
  import.meta.env.VITE_ENTERPRISE_URL ?? "http://localhost:5182";

export default function App() {
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
                <a className="inline" href="mailto:hello@vuush.app?subject=Careers">
                  hello@vuush.app
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
      </main>

      <footer className="footer">
        <a className="lockup" href="#top">
          <span className="mark" aria-hidden="true" />
          <span className="word">VUUSH</span>
        </a>
        <p>© {new Date().getFullYear()} VUUSH</p>
      </footer>
    </div>
  );
}
