import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import './styles.css';

/* ================================================================ */
/* CONSTANTS                                                         */
/* ================================================================ */
const GITHUB_REPO = 'augustinekoh/EcoStride_Latest';
const CONTACT_EMAIL = 'ecostride0@gmail.com';

// Correct ratios from the actual app code:
// Coins: 17 per km
// CO₂: 0.17 kg per km
// Tree: 1 tree per 5.88 km
const COINS_PER_KM = 17;
const CO2_PER_KM = 0.17; // 0.17 kg CO₂ saved per km
const KM_PER_TREE = 5.88;

// Predicted/target stats (static, forward-looking framing)
const PREDICTED_STATS = [
  { value: '50,000+', label: 'Projected Users', note: 'TARGET BY 2027', imgSrc: '/icons/stat_users_icon_1787910800110.jpg' },
  { value: '200,000+', label: 'km Carbon Journey', note: 'PROJECTED TOTAL', imgSrc: '/icons/stat_map_icon_1787910872691.jpg' },
  { value: '10,000+', label: 'Trees to be Planted', note: 'COMMUNITY GOAL', imgSrc: '/icons/stat_tree_icon_1787910884307.jpg' },
  { value: '5+', label: 'Partner Cities', note: 'EXPANSION TARGET', imgSrc: '/icons/stat_city_icon_1787910897846.jpg' },
];

/* ================================================================ */
/* SCROLL RESTORATION                                                */
/* ================================================================ */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* ================================================================ */
/* SVG ICONS                                                         */
/* ================================================================ */
function Icon({ name, size = 20, className = '' }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    className,
  };
  const paths = {
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    arrowDown: <path d="M12 5v14m-7-7 7 7 7-7" />,
    check: <path d="m5 12 4 4L19 6" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></>,
    phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M10 5h4" /><path d="M11 18h2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.7-4 2.5-6 5.5-6s4.8 2 5.5 6" /><path d="M14.5 14.2c2.9.1 4.9 1.8 5.6 5.8" /></>,
    building: <><path d="M4 21h16" /><path d="M6 21V7h12v14" /><path d="M9 10h1M14 10h1M9 13h1M14 13h1M9 16h1M14 16h1" /><path d="M8 4h8v3H8z" /></>,
    tree: <><path d="M12 21V10" /><path d="M8 14c-2.5 0-4-1.3-4-3.3 0-1.7 1.2-3 3.1-3.2C7.6 5 9.2 3 11.5 3c2.8 0 4.6 2.2 4.6 4.6 2 .2 3.4 1.5 3.4 3.4 0 2.1-1.7 3.5-4.2 3.5" /><path d="M4 18h12" /></>,
    shield: <><path d="M12 3 20 6v5c0 5.2-3.3 8.5-8 10-4.7-1.5-8-4.8-8-10V6Z" /><path d="m8.5 12 2.3 2.3 4.7-4.8" /></>,
    menu: <><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>,
    externalLink: <><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15,3 21,3 21,9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
    android: <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.996-3.4572c.1574-.2725.0642-.6196-.2083-.777-.2725-.1574-.6196-.0642-.777.2083l-2.0234 3.5046C15.2893 8.3582 13.6873 8 12 8s-3.2893.3582-4.8698.8004L5.1068 5.2959c-.1574-.2725-.5045-.3657-.777-.2083-.2725.1574-.3657.5045-.2083.777l1.996 3.4572C2.716 11.2052.4 15.193.4 19.8h23.2c0-4.607-2.316-8.5948-5.7185-10.4786" />,
    send: <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
    github: <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.7C6.73 19.91 6.14 18 6.14 18c-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0112 6.8c.85.004 1.71.11 2.51.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.38.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.02 10.02 0 0022 12c0-5.52-4.48-10-10-10z" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

/* ================================================================ */
/* AMBIENT ORBS (fixed background)                                  */
/* ================================================================ */
function AmbientOrbs() {
  return (
    <>
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />
    </>
  );
}

/* ================================================================ */
/* REVEAL COMPONENT                                                  */
/* ================================================================ */
function Reveal({ children, className = '', style = {}, delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          el.classList.add('visible');
        }, delay);
        obs.unobserve(el);
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ================================================================ */
/* TOAST                                                             */
/* ================================================================ */
function Toast({ message, title, visible }) {
  return (
    <div className={`toast ${visible ? 'toast-show' : ''}`}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: '#059669', display: 'grid', placeItems: 'center',
        color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0
      }}>✓</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{message}</div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* HEADER                                                            */
/* ================================================================ */
function Header() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Features', path: '/features' },
    { label: 'Civic & Gov', path: '/government', badge: 'Gov' },
    { label: 'Architecture', path: '/architecture' },
    { label: 'Contact', path: '/contact' }
  ];

  return (
    <header className="site-header apple-glass-nav" style={{ transition: 'all 0.3s' }}>
      <div className="container" style={{ height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand */}
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/favicon.png" alt="EcoStride" style={{ width: 40, height: 40, borderRadius: 12, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>EcoStride</span>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }}>2026</span>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Walk • Earn • Impact</div>
          </div>
        </NavLink>

        {/* Desktop pill nav */}
        <nav className="apple-glass-pill" style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 999, alignItems: 'center' }}
          aria-label="Main navigation" id="desktop-nav"
        >
          {navItems.map(item => {
            const isPath = !!item.path;
            return isPath ? (
              <NavLink key={item.label} to={item.path}
                style={({ isActive }) => ({
                  padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#111827' : '#6B7280',
                  background: isActive ? '#fff' : 'transparent',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none'
                })}
              >
                {item.label}
                {item.badge && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', fontFamily: 'JetBrains Mono, monospace' }}>{item.badge}</span>}
                {item.label === 'Download' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />}
              </NavLink>
            ) : (
              <button key={item.label} onClick={item.action}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                  color: '#6B7280', background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#111827'}
                onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
              >
                {item.label}
                {item.badge && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', fontFamily: 'JetBrains Mono, monospace' }}>{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Right: Web app + Download CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} id="header-right">
          <a href="https://ecostride.cc" target="_blank" rel="noopener noreferrer"
            className="btn-glass"
            style={{ padding: '8px 16px', fontSize: 12 }}
          >
            <span>Web App</span>
            <Icon name="externalLink" size={13} />
          </a>
          <NavLink to="/download" className="btn-primary" style={{ padding: '9px 20px', fontSize: 12 }}>
            <Icon name="android" size={14} />
            <span>Download</span>
          </NavLink>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          id="hamburger-btn"
          aria-label="Toggle menu"
        >
          <Icon name={menuOpen ? 'x' : 'menu'} size={22} />
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {navItems.map(item => (
          item.path ? (
            <NavLink key={item.label} to={item.path} className="mobile-nav-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
              {item.label} {item.badge && `(${item.badge})`}
            </NavLink>
          ) : (
            <button key={item.label} className="mobile-nav-link" onClick={() => { item.action(); setMenuOpen(false); }}>
              {item.label}
            </button>
          )
        ))}
        {/* Mobile CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          <a href="https://ecostride.cc" target="_blank" rel="noopener noreferrer"
            className="btn-glass"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setMenuOpen(false)}
          >
            <span>Web App</span>
            <Icon name="externalLink" size={13} />
          </a>
          <NavLink to="/download" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setMenuOpen(false)}>
            <Icon name="android" size={15} /> Download
          </NavLink>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #desktop-nav { display: none !important; }
          #header-right { display: none !important; }
          #hamburger-btn { display: block !important; }
        }
      `}</style>
    </header>
  );
}

/* ================================================================ */
/* FOOTER                                                            */
/* ================================================================ */
function Footer() {
  const navigate = useNavigate();
  const scrollTo = (id) => {
    navigate('/');
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
  };
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid" style={{ marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontWeight: 800, color: '#111827', fontSize: 15 }}>EcoStride</span>
            </div>
            <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.7, maxWidth: 220 }}>
              Walk for the Planet.<br />Earn Rewards.<br />Build Greener Communities.
            </p>

          </div>
          <div>
            <h4>Product</h4>
            <NavLink to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</NavLink>
            <NavLink to="/features">Features</NavLink>
            <NavLink to="/download">Download APK</NavLink>
          </div>
          <div>
            <h4>Community</h4>
            <NavLink to="/government">Civic & Government</NavLink>
            <NavLink to="/government">City Events</NavLink>
            <NavLink to="/contact">Partner With Us</NavLink>
          </div>
          <div>
            <h4>Support</h4>
            <NavLink to="/contact">Contact Us</NavLink>
            <NavLink to="/architecture">Architecture</NavLink>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(16,185,129,0.1)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 10, color: '#9CA3AF' }}>
          <span>© 2026 EcoStride. All rights reserved.</span>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
            <Icon name="mail" size={11} /> {CONTACT_EMAIL}
          </a>
          <span>Made with <span style={{ color: '#10B981' }}>♥</span> for the Planet.</span>
        </div>
      </div>
    </footer>
  );
}

/* ================================================================ */
/* PHONE MOCKUP COMPONENT                                            */
/* ================================================================ */
function PhoneMockup() {
  return (
    <div className="phone-mockup-wrap">
      <div className="phone-outer titanium-frame">
        <div className="phone-screen">
          {/* Status bar */}
          <div className="phone-notch-bar">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>09:41</span>
            <div className="phone-island" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>
              <span>5G</span>
              <div style={{ width: 16, height: 9, border: '1px solid #9CA3AF', borderRadius: 3, padding: 1, display: 'flex' }}>
                <div style={{ flex: 1, background: '#10B981', borderRadius: 1 }} />
              </div>
            </div>
          </div>
          {/* App screenshot */}
          <img
            src="/app-screenshot.jpg"
            alt="EcoStride app map view showing GPS walk tracking"
            style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'cover' }}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* HOME PAGE                                                         */
/* ================================================================ */
function Home() {
  const navigate = useNavigate();
  return (
    <div>
      <HeroSection navigate={navigate} />

      {/* 1. 核心价值与玩法 (How it works) */}
      <CoreValueSection />

      {/* 2. 用真实数据震撼用户 (Social Proof) */}
      <StatsSection />

      {/* 3. 互动计算器 (Engagement) */}
      <CalculatorSection />

      {/* 4. 愿景与联合国目标 (Global Impact) */}
      <SdgSection />

      {/* 5. 结尾呼吁 (CTA) */}
      <HomeContactSection navigate={navigate} />
    </div>
  );
}

function FeaturesPage() {
  return (
    <div style={{ paddingTop: 68 }}>
      <BentoSection />
      <AiSection />
      <ScenariosSection />
    </div>
  );
}

function GovPage() {
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: 68 }}>
      <GovSection navigate={navigate} />
    </div>
  );
}

function ArchPage() {
  return (
    <div style={{ paddingTop: 68 }}>
      <ArchSection />
    </div>
  );
}

function HeroSection({ navigate }) {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-grid">
          {/* Left copy */}
          <Reveal style={{ position: 'relative', zIndex: 2 }}>
            <div className="hero-eyebrow">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'gpsPing 1.5s ease-in-out infinite' }} />
              Capacitor 8 Native · Cloudflare Edge · Geodesic Anti-Cheat
            </div>
            <h1 className="hero-h1">
              <span className="hero-headline">Walk for<br />the planet.</span><br />
              <span className="green-gradient-text">Earn real impact.</span>
            </h1>
            <p className="hero-sub">
              EcoStride converts your daily footsteps into verified carbon reduction and real-world rewards.
              Earn <strong>Eco Coins</strong>, plant virtual trees on the global map, redeem merchant vouchers,
              and resolve civic issues in real-time.
            </p>
            <div className="hero-cta-group">
              <button className="btn-primary" onClick={() => navigate('/download')}>
                <Icon name="android" size={17} />
                Download EcoStride APK
              </button>
              <button className="btn-glass" onClick={() => navigate('/features')}>
                Explore Features <Icon name="arrow" size={15} />
              </button>
            </div>
            {/* Mini stat bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
              marginTop: 36, paddingTop: 24, borderTop: '1px solid rgba(16,185,129,0.12)'
            }}>
              {[
                { val: '17', unit: 'Coins', sub: 'Per 1 km walked' },
                { val: '<35', unit: 'km/h', sub: 'Anti-cheat speed cap' },
                { val: '25+', unit: 'D1 Tables', sub: 'Edge DB schema' },
              ].map(s => (
                <div key={s.val}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 'clamp(18px, 4vw, 24px)', color: '#111827', whiteSpace: 'nowrap' }}>
                    {s.val} <span style={{ fontSize: 12, color: '#10B981', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{s.unit}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Right: Phone mockup */}
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

/* ================================================================ */
/* CORE VALUE PROPOSITION                                            */
/* ================================================================ */
function CoreValueSection() {
  return (
    <section className="section">
      <div className="container core-value-container">
        <Reveal className="apple-glass core-value-card">
          {/* Ambient Glow */}
          <div className="core-value-glow-top" />
          <div className="core-value-glow-bottom" />

          <h2 className="core-value-h2">
            "We don't replace driving, <br />we <span className="green-gradient-text" style={{ fontSize: '1.05em' }}>reward better choices</span> for short trips."
          </h2>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================ */
/* SDG SECTION                                                       */
/* ================================================================ */
function SdgSection() {
  const sdgs = [
    {
      img: '/3_SDG_MakeEveryDayCount_Gifs_GDU.gif',
      title: 'SDG 03: Good Health',
      desc: 'Transforms short trips into preventive health routines, reducing sedentary risks.'
    },
    {
      img: '/9_SDG_MakeEveryDayCount_Gifs_GDU.gif',
      title: 'SDG 09: Infrastructure',
      desc: 'Crowdsourced civic inspection spots urban damage early via community reporting.'
    },
    {
      img: '/11_SDG_MakeEveryDayCount_Gifs_GDU.gif',
      title: 'SDG 11: Sustainable Cities',
      desc: 'Reduces micro-mobility congestion and builds resilient neighborhood connections.'
    },
    {
      img: '/13_SDG_MakeEveryDayCount_Gifs_GDU.gif',
      title: 'SDG 13: Climate Action',
      desc: 'Short walking offsets direct vehicle emissions, tracking Scope 3 GHG footprints.'
    }
  ];

  return (
    <section className="section">
      <div className="container">
        <Reveal style={{ textAlign: 'center', marginBottom: 48, maxWidth: 700, margin: '0 auto' }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 12 }}>United Nations Goals</div>
          <h2 className="section-h2" style={{ fontSize: 36 }}>4 Core SDG Outcomes</h2>
          <p style={{ color: '#6B7280', fontSize: 15, lineHeight: 1.6 }}>Every footstep taken in EcoStride maps directly to measurable global sustainability targets.</p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {sdgs.map((sdg, i) => (
            <Reveal key={sdg.title} delay={i * 100} className="apple-glass" style={{ padding: 24, borderRadius: 24, textAlign: 'center', transition: 'transform 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <img src={sdg.img} alt={sdg.title} style={{ width: 140, height: 140, objectFit: 'contain', margin: '0 auto 20px', display: 'block' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8, letterSpacing: '-0.02em' }}>{sdg.title}</h4>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{sdg.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================ */
/* AI SECTION                                                        */
/* ================================================================ */
function AiSection() {
  return (
    <section className="section">
      <div className="container">
        <Reveal style={{ textAlign: 'center', marginBottom: 48, maxWidth: 700, margin: '0 auto' }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 12, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>AI for ESG & SDG</div>
          <h2 className="section-h2" style={{ fontSize: 36 }}>Dual-Core AI Intelligence</h2>
          <p style={{ color: '#6B7280', fontSize: 15, lineHeight: 1.6 }}>Harnessing state-of-the-art multimodal AI for intelligent civic governance and automated corporate carbon accounting.</p>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {/* Civic AI */}
          <Reveal className="bento-card" style={{ padding: 40, borderRadius: 32, background: 'linear-gradient(145deg, #ffffff, #f8fafc)', border: '1px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <img src="/icons/ai_civic_icon_1787910727374.jpg" alt="Civic AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.03em' }}>Gemini Civic Inspection</h3>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              Citizens simply snap a photo. Our Gemini Vision model automatically detects <strong>Potholes</strong>, <strong>Broken Streetlights</strong>, <strong>Missing Drains</strong>, and <strong>Fallen Trees</strong>. It generates instant safety risk ratings and syncs seconds later to municipal dashboards.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: 999 }}>Auto-Classification</span>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 999 }}>Risk Scoring</span>
            </div>
          </Reveal>

          {/* Corporate AI */}
          <Reveal delay={100} className="bento-card" style={{ padding: 40, borderRadius: 32, background: 'linear-gradient(145deg, #ffffff, #f0fdf4)', border: '1px solid #dcfce7' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <img src="/icons/ai_ghg_icon_1787910742724.jpg" alt="GHG AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', marginBottom: 12, letterSpacing: '-0.03em' }}>AI Powered GHG Report</h3>
            <p style={{ fontSize: 14, color: '#065f46', lineHeight: 1.6, marginBottom: 20 }}>
              Automatically calculates and structures <strong>GHG Protocol Scope 3</strong> carbon emissions for corporate ESG disclosures. Seamlessly quantifies carbon offset from employee commute habits and short-trip gamification.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: 999 }}>Scope 3 Compliant</span>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 999 }}>ESG Disclosures</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ */
/* SCENARIOS & MERCHANT SECTION                                      */
/* ================================================================ */
function ScenariosSection() {
  return (
    <section className="section" style={{ background: '#F8FAFC', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 40 }}>

          <Reveal style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 12, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>The Local Economy</div>
            <h2 className="section-h2" style={{ fontSize: 32 }}>Merchants as "Energy Stations"</h2>
            <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
              <strong>Pay-per-Foot-Traffic:</strong> We bid farewell to expensive, low-conversion Google and Facebook ads. Local cafes and restaurants only pay a micro-commission when a citizen physically walks into their store and redeems a voucher. Pure foot-traffic, zero wasted ad spend.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {/* Scenario 1 */}
            <Reveal className="bento-card" style={{ padding: 32, borderRadius: 24, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <img src="/icons/scenario_commute_icon_1787910757407.jpg" alt="Commute" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: 16, color: '#111827' }}>Alex's Mall Trip</strong>
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Short-Trip Commute</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
                Drives to the mall, but sees his target restaurant is 800m away in heavy traffic. EcoStride alerts him: walk the 800m to unlock a 15% dinner voucher.
              </p>
              <div style={{ padding: 12, borderRadius: 12, background: '#ecfdf5', color: '#065f46', fontSize: 12, fontWeight: 600 }}>
                Result: Alex saves parking fees & time, reduces tailpipe emissions, and the restaurant gains a guaranteed customer.
              </div>
            </Reveal>

            {/* Scenario 2 */}
            <Reveal delay={100} className="bento-card" style={{ padding: 32, borderRadius: 24, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <img src="/icons/scenario_health_icon_1787910771231.jpg" alt="Health" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: 16, color: '#111827' }}>Sarah's Weekend</strong>
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Morning Health</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
                Wants to grab brunch but lacks the motivation to exercise. She opens EcoStride and jogs 2km to the cafe to unlock a 20% discount and a weekend fitness badge.
              </p>
              <div style={{ padding: 12, borderRadius: 12, background: '#eff6ff', color: '#1e40af', fontSize: 12, fontWeight: 600 }}>
                Result: Sarah builds a healthy routine, earns rewards, and local cafes increase weekend foot traffic.
              </div>
            </Reveal>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ── Bento Feature Cards ── */
const BENTO_CARDS = [
  {
    icon: '/icons/bento_tracking.jpg', label: 'bg-eco', borderColor: '#d1fae5',
    iconBg: '#ecfdf5', iconBorder: '#a7f3d0',
    h3: '1. Native Mobile & Geodesic Tracking',
    p: 'Capacitor 8 Android Foreground Service powered by @capgo/background-geolocation. Resilient walk tracking even under heavy RAM pressure or locked screen.',
    features: [
      { title: 'Anti-Cheat Jitter Filtering', desc: 'Rejects GPS readings with accuracy > 50m to prevent indoor bounce.' },
      { title: 'Speed & Velocity Limits', desc: 'Enforces strict walking ceiling (<35 km/h) and flags unnatural leaps (>150m).' },
      { title: 'Fail-Safe Cloud Sync', desc: 'Tracking persists offline until cloud backend confirms walk storage.' },
    ],
    footer: ['Turf.js Haversine', '17 Coins / 1 km'],
    footerColor: '#065f46',
  },
  {
    icon: '/icons/bento_map.jpg', label: 'bg-teal', borderColor: '#99f6e4',
    iconBg: '#f0fdfa', iconBorder: '#99f6e4',
    h3: '2. Map Exploration & Economy',
    p: 'WebGL 2D/3D map powered by Mapbox GL JS (react-map-gl) fused with a sustainable carbon economy.',
    features: [
      { title: 'Draggable Mini-Map (PiP)', desc: 'Floating Picture-in-Picture map preserves context while chatting or shopping.' },
      { title: 'Virtual Tree Planting', desc: 'Spend coins to anchor permanent trees on global map coordinates.' },
      { title: 'Geo Signposts', desc: 'Pin location-based messages, emojis and photos to the map to share everyday moments and foster neighbourhood connections.' },
    ],
    footer: ['Mapbox GL JS', 'Global Green Grid'],
    footerColor: '#0f766e',
  },
  {
    icon: '/icons/bento_social.jpg', label: 'bg-indigo', borderColor: '#c7d2fe',
    iconBg: '#eef2ff', iconBorder: '#c7d2fe',
    h3: '3. Social & Guild Ecosystem',
    p: 'Stateful WebSocket messaging via Cloudflare Durable Objects (CommunityChatRoom) delivering instant edge broadcast.',
    features: [
      { title: 'Capybara Friends Graph', desc: 'Unique Player ID pairing with dynamic carbon & distance leaderboards.' },
      { title: 'Message Editing & Deletion', desc: 'Full long-press context menu for revisions, deletions, and zoomable R2 images.' },
      { title: 'Rich Card Sharing', desc: 'Share signposts and civic reports directly into guild chat streams.' },
    ],
    footer: ['Durable Objects', 'Cloudflare R2 Bucket'],
    footerColor: '#4338ca',
  },
  {
    icon: '/icons/bento_merchant.jpg', label: 'bg-amber', borderColor: '#fde68a',
    iconBg: '#fffbeb', iconBorder: '#fde68a',
    h3: '4. Merchant & Voucher System',
    p: 'Online-to-offline merchant commerce with hardware camera QR validation and automated consumer protection protocol.',
    features: [
      { title: 'Hardware Camera QR Scanner', desc: 'Native camera validation via @yudiel/react-qr-scanner for instant redemption.' },
      { title: 'Consumer Auto-Refunds', desc: 'Instant coin refund if a merchant modifies or removes active vouchers.' },
      { title: 'Multi-Store Switcher', desc: 'Manage multiple branches, track sales ledgers, and adjust inventory.' },
    ],
    footer: ['Offline-to-Online', 'Zero Risk Guarantee'],
    footerColor: '#92400e',
  },
  {
    icon: '/icons/bento_civic.jpg', label: 'bg-sky', borderColor: '#bae6fd',
    iconBg: '#f0f9ff', iconBorder: '#bae6fd',
    h3: '5. Civic Issues & City Events',
    p: 'Direct civic co-governance connecting citizens with municipal authorities, combined with city-wide environmental events.',
    features: [
      { title: 'Geo-Tagged Hazard Reports', desc: 'Report illegal trash dumping or broken facilities with photographic proof.' },
      { title: '1v1 Authority Resolution', desc: 'Dedicated IssueConversationDO rooms for rapid citizen-official case resolution.' },
      { title: 'City Events & Badge Engine', desc: 'Participate in cleanups, upload photo proofs, and receive exclusive badges.' },
    ],
    footer: ['Async Badge Engine', 'Heatmap Analytics'],
    footerColor: '#0369a1',
  },
  {
    icon: '/icons/bento_ux.jpg', label: 'bg-emerald', borderColor: '#6ee7b7',
    iconBg: '#ecfdf5', iconBorder: '#6ee7b7',
    h3: '6. Global UI & Native Mobile UX',
    p: 'Flagship Android native experience with hardware back-button interception, notch safe-area, and dynamic startup flows.',
    features: [
      { title: 'Hardware Back Button Guard', desc: 'Intelligent NativeBridge.tsx handles modal dismissals gracefully.' },
      { title: 'Pull-To-Refresh Gestures', desc: 'Smooth capacitive pull-down refresh for Mailbox & Leaderboards.' },
      { title: 'Active Walk Session Bypass', desc: 'Skips startup animations if background walk tracking is already running.' },
    ],
    footer: ['Capacitor Safe Area', 'Theme Variable Engine'],
    footerColor: '#065f46',
  },
];

function BentoSection() {
  const ref = useRef(null);

  useEffect(() => {
    // Mouse glow on bento cards
    const cards = document.querySelectorAll('.bento-card');
    const handlers = [];
    cards.forEach(card => {
      const fn = (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      };
      card.addEventListener('mousemove', fn);
      handlers.push({ card, fn });
    });
    return () => handlers.forEach(({ card, fn }) => card.removeEventListener('mousemove', fn));
  }, []);

  return (
    <section className="section" id="features" style={{ borderTop: '1px solid rgba(16,185,129,0.08)' }}>
      <div className="container">
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="section-tag" style={{ marginBottom: 16, display: 'inline-flex' }}>Feature Architecture & Subsystems</div>
          <h2 className="section-h2" style={{ marginBottom: 12 }}>Designed for Uncompromised Precision</h2>
          <p className="section-p" style={{ margin: '0 auto' }}>
            Every layer—from hardware sensor telemetry to Cloudflare serverless edge WebSockets—is engineered for reliability, security, and sustainability.
          </p>
        </Reveal>

        <div className="bento-grid" ref={ref}>
          {BENTO_CARDS.map((card, i) => (
            <BentoCard key={i} card={card} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoCard({ card, delay }) {
  return (
    <Reveal className="bento-card" delay={delay} style={{ borderRadius: 28 }}>
      <div className="bento-icon" style={{ background: card.iconBg, border: `1px solid ${card.iconBorder}`, overflow: 'hidden', padding: 0 }}>
        <img src={card.icon} alt={card.h3} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
      </div>
      <h3 className="bento-h3">{card.h3}</h3>
      <p className="bento-p">{card.p}</p>
      {card.features.map((f, j) => (
        <div className="bento-feature" key={j}>
          <strong>{f.title}</strong>
          <span>{f.desc}</span>
        </div>
      ))}
      <div className="bento-footer" style={{ color: card.footerColor }}>
        <span>{card.footer[0]}</span>
        <span>{card.footer[1]}</span>
      </div>
    </Reveal>
  );
}

/* ── Stats Section ── */
function StatsSection() {
  return (
    <section className="section-sm">
      <div className="container">
        <Reveal style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 12 }}>Community Goals & Projections</div>
          <h2 className="section-h2" style={{ fontSize: 28 }}>Building Towards a Greener Future</h2>
        </Reveal>
        <div className="stats-grid">
          {PREDICTED_STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 100} className="stat-card apple-glass">
              <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <img src={s.imgSrc} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="stat-val">{s.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-note">* {s.note}</div>
            </Reveal>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#9CA3AF', marginTop: 16, fontFamily: 'JetBrains Mono, monospace' }}>
          * Projected targets — actual numbers growing with our community
        </p>
      </div>
    </section>
  );
}

/* ── Government Section ── */
function GovSection({ navigate }) {
  const pillars = [
    { imgSrc: '/icons/gov_eyes_icon_1787910939381.jpg', color: '#dbeafe', border: '#bfdbfe', textColor: '#1e40af', title: 'Crowdsourced Urban Eyes', desc: 'Turn thousands of daily walkers into active environmental monitors. Receive verified, geo-tagged reports with high-resolution photographic proof.', footer: 'Instant GPS & Photo Verification' },
    { imgSrc: '/icons/gov_chat_icon_1787910951588.jpg', color: '#d1fae5', border: '#a7f3d0', textColor: '#065f46', title: '1-on-1 Direct Resolution', desc: 'Bridge the gap between officials and citizens. Dedicated IssueConversationDO WebSocket rooms for rapid case resolution with full transparency.', footer: 'Real-Time Case Chat & Tracking' },
    { imgSrc: '/icons/gov_heatmap_icon_1787910991278.jpg', color: '#e0e7ff', border: '#c7d2fe', textColor: '#3730a3', title: 'Geospatial Hazard Heatmaps', desc: 'Access analytical dashboards. Visualize regional hazard clusters, pedestrian density, and carbon offsets to optimize urban resource allocation.', footer: 'Data-Driven City Management' },
    { imgSrc: '/icons/gov_event_icon_1787911013310.jpg', color: '#fef3c7', border: '#fde68a', textColor: '#92400e', title: 'Co-Hosted City Events', desc: 'Launch district-wide cleanups, eco-marathons, or tree planting drives. Automatic proof review and commemorative badges reward civic participation.', footer: 'Automated EXIF Proof & Badge Engine' },
  ];

  return (
    <section className="section" id="government" style={{ borderTop: '1px solid rgba(16,185,129,0.08)' }}>
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 48px' }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 16, background: 'rgba(219,234,254,0.8)', color: '#1e40af', border: '1px solid rgba(147,197,253,0.4)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6' }} />
            Civic Co-Governance & Municipal Partnerships
          </div>
          <h2 className="section-h2" style={{ marginBottom: 14 }}>Partner with EcoStride to Build Smarter, Cleaner Communities</h2>
          <p className="section-p" style={{ margin: '0 auto' }}>
            We invite <strong>City Councils, Municipal Authorities, Environmental NGOs, and Public Agencies</strong> to collaborate with us.
            Empower citizens to be the eyes and hands of your city while mobilizing verified green action.
          </p>
        </Reveal>

        <div className="gov-pillars" style={{ marginBottom: 32 }}>
          {pillars.map((p, i) => (
            <GovPillarCard key={i} pillar={p} delay={i * 80} />
          ))}
        </div>

        {/* Partnership banner */}
        <Reveal className="gov-banner apple-glass">
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'rgba(186,230,253,0.3)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center' }} className="gov-banner-inner">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(219,234,254,0.8)', color: '#1e40af', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, border: '1px solid rgba(147,197,253,0.5)', marginBottom: 16 }}>
                Fast-Track Institutional Onboarding
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.03em' }}>
                Deploy Regional Authority Portals with Zero Setup Friction
              </h3>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, maxWidth: 520, margin: '0 0 24px' }}>
                Authorized municipal teams receive pre-configured Role-Based Access Control (RBAC), direct notification dispatching, and secure jurisdiction management. No complex software procurement required.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Government%20%26%20Municipal%20Partnership%20Inquiry`}
                  className="btn-sky" style={{ fontSize: 12 }}>
                  <Icon name="mail" size={14} />
                  Request Authority Access
                </a>
                <button className="btn-glass" style={{ fontSize: 12 }} onClick={() => navigate('/contact')}>
                  Full Partnership Form <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>

            <div className="gov-checklist" style={{ minWidth: 260 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0c4a6e', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(186,230,253,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏛️ Authority Management Suite</span>
                <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#10B981' }}>RBAC Tier 1</span>
              </div>
              {[
                'Jurisdiction boundary filtering',
                'Direct 1v1 citizen resolution chat',
                'Batch review for event photo proofs',
                'District carbon reduction metrics',
                'Automated badge award engine',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <style>{`.gov-banner-inner { grid-template-columns: 1fr auto; } @media(max-width:900px){.gov-banner-inner{grid-template-columns:1fr!important}}`}</style>
        </Reveal>
      </div>
    </section>
  );
}

function GovPillarCard({ pillar, delay }) {
  return (
    <Reveal className="gov-pillar-card bento-card" delay={delay}>
      <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 14 }}>
        <img src={pillar.imgSrc} alt={pillar.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{pillar.title}</h4>
      <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.65, margin: '0 0 14px' }}>{pillar.desc}</p>
      <div style={{ paddingTop: 10, borderTop: `1px solid ${pillar.border}`, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: pillar.textColor }}>
        {pillar.footer}
      </div>
    </Reveal>
  );
}

/* ── Impact Calculator ── */
function CalculatorSection() {
  const [km, setKm] = useState(5);

  // Math calculated based on daily input * 30 days
  const monthlyKm = km * 30;
  const monthlyCoins = Math.round(monthlyKm * COINS_PER_KM);
  const monthlyCo2 = (monthlyKm * CO2_PER_KM).toFixed(1);
  const virtualTrees = Math.floor(monthlyKm / KM_PER_TREE);

  return (
    <section className="section-sm" id="calculator">
      <div className="container">
        <Reveal className="calc-wrap apple-glass" style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'rgba(52,211,153,0.15)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 720, position: 'relative' }}>
            <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 14, fontSize: 10 }}>Impact Simulator</div>
            <h3 style={{ fontSize: 30, fontWeight: 800, color: '#111827', letterSpacing: '-0.04em', margin: '0 0 10px' }}>
              In 1 month, your daily walk achieves:
            </h3>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, margin: '0 0 28px' }}>
              Adjust the slider to discover how your daily walking habit translates into monthly carbon reduction, Eco Coins, and virtual trees.
            </p>

            {/* Slider */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>Daily</span> Distance Walked:
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 22, color: '#059669',
                  background: 'rgba(255,255,255,0.9)', padding: '4px 16px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.2)'
                }}>{km.toFixed(1)} km</span>
              </div>
              <input
                type="range" min="0.5" max="25" step="0.5"
                value={km} onChange={e => setKm(parseFloat(e.target.value))}
                className="calc-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF', marginTop: 6 }}>
                <span>0.5 km (Stroll)</span><span>10 km (Commuter)</span><span>25 km (Marathoner)</span>
              </div>
            </div>

            {/* Output cards */}
            <div className="calc-output-grid">
              <div className="calc-card">
                <div className="calc-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Monthly</span> Eco Coins ({COINS_PER_KM}/km)
                </div>
                <div className="calc-val" style={{ color: '#059669' }}>{monthlyCoins.toLocaleString()} 🪙</div>
                <div className="calc-note">≈ {Math.floor(monthlyCoins / 200)}–{Math.floor(monthlyCoins / 100)} Store Vouchers</div>
              </div>
              <div className="calc-card">
                <div className="calc-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Monthly</span> CO₂ Offset
                </div>
                <div className="calc-val" style={{ color: '#0f766e' }}>{monthlyCo2} kg</div>
                <div className="calc-note">Based on {CO2_PER_KM * 1000}g CO₂ saved per km</div>
              </div>
              <div className="calc-card">
                <div className="calc-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Monthly</span> Virtual Trees
                </div>
                <div className="calc-val" style={{ color: '#0f766e' }}>{virtualTrees} 🌲</div>
                <div className="calc-note">1 tree successfully planted every {KM_PER_TREE}km</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Architecture Section ── */
function ArchSection() {
  return (
    <section className="section" id="architecture" style={{ borderTop: '1px solid rgba(16,185,129,0.08)' }}>
      <div className="container">
        <Reveal style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 48px' }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 16 }}>System Architecture & Engineering</div>
          <h2 className="section-h2" style={{ marginBottom: 12 }}>Modern Serverless Edge Engineering</h2>
          <p className="section-p" style={{ margin: '0 auto' }}>
            High-concurrency, low-latency hybrid stack combining React 18, Capacitor 8 native bridges, and Cloudflare Workers with 25+ relational D1 SQLite tables.
          </p>
        </Reveal>

        <div className="arch-grid" style={{ marginBottom: 20 }}>
          {/* Frontend */}
          <Reveal className="arch-card apple-glass">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid rgba(16,185,129,0.08)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: '#dbeafe', border: '1px solid #bfdbfe', display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, color: '#1d4ed8' }}>FE</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Frontend Hybrid App</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF' }}>ecostride-app (React 18 + TS + Capacitor 8)</div>
                </div>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', padding: '3px 8px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>Client Edge</span>
            </div>
            {[
              { title: 'Zustand Modular State Stores:', body: 'Domain-modularized stores (useUserStore, useMapStore) persisted via Capacitor Preferences to eliminate session loss.' },
              { title: 'Capacitor 8 Native Plugins:', body: 'Foreground sticky service for walk tracking, FCM push notification listeners, and hardware camera QR scanner.' },
              { title: 'Mapbox GL JS + Turf.js:', body: 'WebGL rendering wrapped in React ErrorBoundaries with client-side Haversine geodesic displacement math.' },
            ].map(item => (
              <div className="arch-item" key={item.title}>
                <div className="arch-dot" />
                <div>
                  <strong style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>{item.title}</strong>
                  <p style={{ margin: 0, fontSize: 11, color: '#6B7280', lineHeight: 1.55 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </Reveal>

          {/* Backend */}
          <Reveal className="arch-card apple-glass" delay={150}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid rgba(16,185,129,0.08)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: '#d1fae5', border: '1px solid #a7f3d0', display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, color: '#065f46' }}>BE</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Serverless Edge Backend</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF' }}>ecostride-backend (Workers + Hono + D1 + DO)</div>
                </div>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Global Edge</span>
            </div>
            {[
              { title: 'Cloudflare D1 Relational DB (25+ Tables):', body: 'Stores users, activity histories, vouchers, signposts, friends, municipal reports, and city event badge logs.' },
              { title: 'Cloudflare Durable Objects (Stateful WebSockets):', body: 'CommunityChatRoom (Guild broadcasts, edits, deletes) + IssueConversationDO (1v1 official resolution).' },
              { title: 'FCM Push Gateway (HTTP v1 RSA256):', body: 'Signed JWT token dispatching with priority matrix, 5-min cooldown, and foreground notification suppression.' },
            ].map(item => (
              <div className="arch-item" key={item.title}>
                <div className="arch-dot" />
                <div>
                  <strong style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>{item.title}</strong>
                  <p style={{ margin: 0, fontSize: 11, color: '#6B7280', lineHeight: 1.55 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>

        {/* D1 Schema matrix */}
        <Reveal className="apple-glass" style={{ borderRadius: 24, padding: 28 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 20px' }}>
            <span>📊</span> Core Domain Database Models (Cloudflare D1 Schema)
          </h4>
          <div className="schema-grid">
            {[
              { label: 'Users & Auth', color: '#065f46', items: ['users (coins, distance, trees)', 'activity_history (daily GPS)', 'user_devices (FCM tokens)', 'user_notification_preferences'] },
              { label: 'Map & Economy', color: '#0f766e', items: ['trees (planted map trees)', 'signposts (geo messages)', 'merchants & point_store', 'purchases (voucher QR ledger)'] },
              { label: 'Social & Guilds', color: '#4338ca', items: ['guilds (communities & roles)', 'chat_messages (edits & deletes)', 'friends (Capybara friend graph)', 'mail (in-app notifications)'] },
              { label: 'Civic & Events', color: '#0369a1', items: ['infrastructure_reports (hazards)', 'issue_messages (1v1 cases)', 'city_events (marathons)', 'city_event_badges (proofs)'] },
            ].map(s => (
              <div key={s.label} className="schema-card">
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11, color: s.color, marginBottom: 10 }}>{s.label}</div>
                {s.items.map(item => (
                  <div key={item} style={{ fontSize: 10, color: '#6B7280', marginBottom: 5, fontFamily: 'JetBrains Mono, monospace' }}>
                    • <code style={{ background: 'rgba(16,185,129,0.05)', padding: '1px 4px', borderRadius: 4 }}>{item.split(' (')[0]}</code>
                    {item.includes('(') && <span style={{ color: '#9CA3AF' }}> ({item.split('(')[1].replace(')', '')})</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Home Contact blurb ── */
function HomeContactSection({ navigate }) {
  return (
    <section className="section-sm home-contact-section">
      <div className="container">
        <Reveal className="apple-glass home-contact-card">
          <div className="home-contact-glow" />
          <div style={{ position: 'relative' }}>
            <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 16 }}>Get in Touch</div>
            <h2 className="section-h2" style={{ marginBottom: 14 }}>Let's Build a Greener Future Together</h2>
            <p className="section-p" style={{ margin: '0 auto 28px', maxWidth: 540 }}>
              Have questions, partnership requests, or feedback? Reach out to our team directly.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => navigate('/contact')}>
                <Icon name="mail" size={16} /> Contact Us
              </button>
              <a href={`mailto:${CONTACT_EMAIL}`} className="btn-glass">
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================ */
/* DOWNLOAD PAGE                                                     */
/* ================================================================ */
function Download() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });
  const qrRef = useRef(null);
  const qrInstanceRef = useRef(null);

  const showToast = useCallback((title, message) => {
    setToast({ visible: true, title, message });
    setTimeout(() => setToast(v => ({ ...v, visible: false })), 3500);
  }, []);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const parsed = data
          .filter(r => !r.draft)
          .map(r => {
            const apkAsset = r.assets?.find(a => a.name.endsWith('.apk'));
            return {
              id: r.id,
              version: r.tag_name,
              name: r.name || r.tag_name,
              date: r.published_at ? new Date(r.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown',
              isLatest: false,
              isPrerelease: r.prerelease,
              downloadUrl: apkAsset?.browser_download_url || null,
              size: apkAsset ? (apkAsset.size / (1024 * 1024)).toFixed(1) + ' MB' : 'N/A',
              changelog: r.body ? r.body.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*')).slice(0, 5).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean) : ['No changelog provided'],
              sha256: (() => {
                const m = (r.body || '').match(/sha256[:\s]+([a-f0-9]{64})/i);
                return m ? m[1] : null;
              })(),
            };
          });
        if (parsed.length > 0) parsed[0].isLatest = true;
        setReleases(parsed);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Generate QR code when latest release changes
  useEffect(() => {
    const latest = releases[0];
    if (!latest?.downloadUrl || !qrRef.current || typeof window.QRCode === 'undefined') return;
    qrRef.current.innerHTML = '';
    try {
      new window.QRCode(qrRef.current, {
        text: latest.downloadUrl,
        width: 120, height: 120,
        colorDark: '#047857', colorLight: '#FFFFFF',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } catch (_) { }
  }, [releases]);

  const latest = releases[0];
  const filtered = releases.filter(r => {
    if (filter === 'stable') return !r.isPrerelease;
    if (filter === 'beta') return r.isPrerelease;
    return true;
  });

  return (
    <main style={{ paddingTop: 96, paddingBottom: 80 }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 48px' }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 16 }}>Official Distribution Hub</div>
          <h1 style={{ fontSize: 'clamp(36px,5vw,60px)', fontWeight: 800, letterSpacing: '-0.045em', color: '#111827', margin: '0 0 14px' }}>
            Download EcoStride for Android
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7 }}>
            Direct APK downloads from GitHub Releases. Built for Android 8.0+ with native background geolocation.
          </p>
        </div>

        {loading && (
          <div style={{ maxWidth: 860, margin: '0 auto 32px' }}>
            <div style={{ borderRadius: 36, padding: 48, border: '1px solid rgba(16,185,129,0.12)', background: 'rgba(255,255,255,0.5)' }}>
              <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '50%', marginBottom: 24 }} />
              <div className="skeleton" style={{ height: 52, width: '100%', borderRadius: 999 }} />
            </div>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(255,255,255,0.6)', borderRadius: 28, border: '1px solid rgba(16,185,129,0.12)', maxWidth: 480, margin: '0 auto 32px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Could not fetch releases</h3>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>Please check back later or visit our GitHub releases page directly.</p>
            <a href={`https://github.com/${GITHUB_REPO}/releases`} target="_blank" rel="noopener noreferrer" className="btn-glass">
              <Icon name="github" size={14} /> View on GitHub
            </a>
          </div>
        )}

        {!loading && !error && releases.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(255,255,255,0.6)', borderRadius: 28, border: '1px solid rgba(16,185,129,0.12)', maxWidth: 480, margin: '0 auto 32px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>No releases published yet</h3>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>The first stable release is on its way. Stay tuned!</p>
          </div>
        )}

        {/* Latest release hero card */}
        {!loading && latest && (
          <Reveal className="dl-hero-card apple-glass" style={{ maxWidth: 980, margin: '0 auto 40px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, background: 'rgba(52,211,153,0.2)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }} className="dl-hero-inner">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span className="pill-latest">★ LATEST STABLE</span>
                  <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#111827' }}>EcoStride {latest.version}</span>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF', background: 'rgba(255,255,255,0.8)', padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.12)' }}>
                    {latest.date}
                  </span>
                </div>

                {/* Specs */}
                <div className="dl-spec-grid" style={{ marginBottom: 24 }}>
                  <div className="dl-spec"><div className="dl-spec-label">File Size</div><div className="dl-spec-val">{latest.size}</div></div>
                  <div className="dl-spec"><div className="dl-spec-label">Min OS</div><div className="dl-spec-val">Android 8.0+</div></div>
                  <div className="dl-spec"><div className="dl-spec-label">Architecture</div><div className="dl-spec-val">arm64-v8a</div></div>
                  <div className="dl-spec"><div className="dl-spec-label">Type</div><div className="dl-spec-val" style={{ color: '#059669' }}>Signed APK</div></div>
                </div>

                {/* Changelog */}
                <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#059669', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 10px' }}>What's New:</h4>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {latest.changelog.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 13, color: '#374151' }}>
                      <span style={{ color: '#10B981', fontWeight: 700, marginTop: 1 }}>●</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* SHA256 */}
                {latest.sha256 && (
                  <details style={{ marginTop: 16 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 11, color: '#6B7280', fontFamily: 'JetBrains Mono, monospace', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="info" size={12} /> Show SHA-256 Checksum
                    </summary>
                    <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.9)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <code style={{ fontSize: 10, color: '#374151', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace' }}>{latest.sha256}</code>
                      <button onClick={() => { navigator.clipboard.writeText(latest.sha256); showToast('Copied', 'SHA-256 hash copied.'); }}
                        style={{ fontSize: 10, padding: '4px 10px', borderRadius: 8, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', cursor: 'pointer', flexShrink: 0 }}>
                        Copy
                      </button>
                    </div>
                  </details>
                )}
              </div>

              {/* QR + Download */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '32px 24px', background: 'rgba(255,255,255,0.8)', borderRadius: 24, border: '1px solid rgba(16,185,129,0.1)', minWidth: 200 }}>
                {latest.downloadUrl ? (
                  <a href={latest.downloadUrl}
                    className="btn-primary"
                    style={{ width: '100%', padding: '14px', textAlign: 'center', justifyContent: 'center' }}
                    onClick={() => showToast('Download Started', `EcoStride ${latest.version}.apk is downloading.`)}
                  >
                    <Icon name="download" size={16} />
                    Download {latest.size !== 'N/A' ? `(${latest.size})` : 'APK'}
                  </a>
                ) : (
                  <a href={`https://github.com/${GITHUB_REPO}/releases/tag/${latest.version}`} target="_blank" rel="noopener noreferrer"
                    className="btn-primary" style={{ width: '100%', textAlign: 'center', justifyContent: 'center' }}>
                    <Icon name="github" size={16} /> View on GitHub
                  </a>
                )}

                {/* QR Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div ref={qrRef} style={{ padding: 10, background: '#fff', borderRadius: 16, border: '1px solid rgba(16,185,129,0.15)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF', textAlign: 'center' }}>Scan to install on Android</span>
                </div>

                <button onClick={() => setShowInstallModal(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#059669', fontWeight: 600, textDecoration: 'underline' }}>
                  📖 How to install .apk?
                </button>
              </div>
            </div>
            <style>{`.dl-hero-inner { grid-template-columns: 1fr auto; } @media(max-width:800px){.dl-hero-inner{grid-template-columns:1fr!important}}`}</style>
          </Reveal>
        )}

        {/* Release history */}
        {!loading && releases.length > 0 && (
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Release Archive</h3>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>Filter builds by channel</p>
              </div>
              <div className="apple-glass-pill" style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 999 }}>
                {['all', 'stable', 'beta'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: filter === f ? 700 : 500, cursor: 'pointer', border: 'none', background: filter === f ? '#fff' : 'transparent', color: filter === f ? '#111827' : '#6B7280', boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(rel => (
                <div key={rel.id} className="release-card apple-glass">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 15, color: '#111827' }}>{rel.version}</span>
                      <span className={rel.isPrerelease ? 'pill-beta' : 'pill-stable'}>{rel.isPrerelease ? 'BETA' : 'STABLE'}</span>
                      {rel.isLatest && <span className="pill-latest">LATEST</span>}
                      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#9CA3AF' }}>· {rel.date} · {rel.size}</span>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {rel.changelog.slice(0, 3).map((item, i) => (
                        <li key={i} style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#10B981', fontSize: 9 }}>▹</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {rel.downloadUrl ? (
                      <a href={rel.downloadUrl}
                        className="btn-glass"
                        style={{ fontSize: 12, padding: '10px 18px' }}
                        onClick={() => showToast('Downloading', `${rel.version}.apk`)}
                      >
                        <Icon name="download" size={14} /> Download
                      </a>
                    ) : (
                      <a href={`https://github.com/${GITHUB_REPO}/releases/tag/${rel.version}`} target="_blank" rel="noopener noreferrer"
                        className="btn-glass" style={{ fontSize: 12, padding: '10px 18px' }}>
                        <Icon name="github" size={14} /> GitHub
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', fontSize: 13 }}>No {filter} releases found.</div>
              )}
            </div>

            {/* GitHub link */}
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <a href={`https://github.com/${GITHUB_REPO}/releases`} target="_blank" rel="noopener noreferrer" className="btn-glass" style={{ fontSize: 12 }}>
                <Icon name="github" size={14} /> View all releases on GitHub <Icon name="externalLink" size={12} />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Install modal */}
      {showInstallModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowInstallModal(false); }}>
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #f0f0f0', marginBottom: 20 }}>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                📱 Android APK Installation Guide
              </h4>
              <button onClick={() => setShowInstallModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Download the APK file using the button above, or scan the QR code with your Android camera.',
                'When your browser warns "File might be harmful", tap Download anyway to proceed.',
                'Open the file from your notifications or Downloads folder. If prompted, enable "Allow from this source" in Settings.',
                'Grant Location (Allow all the time) and Physical Activity permissions to enable background walk tracking.',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: 12, background: '#f0fdf4', borderRadius: 14, border: '1px solid rgba(16,185,129,0.12)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#059669', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{step}</p>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 20, borderTop: '1px solid #f0f0f0', marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ padding: '10px 24px', fontSize: 13 }} onClick={() => setShowInstallModal(false)}>
                Got it ✓
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast visible={toast.visible} title={toast.title} message={toast.message} />
    </main>
  );
}

/* ================================================================ */
/* CONTACT PAGE                                                      */
/* ================================================================ */
function Contact() {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

  const copyEmail = () => {
    navigator.clipboard.writeText(CONTACT_EMAIL).then(() => {
      setCopied(true);
      setToast({ visible: true, title: 'Email Copied', message: `${CONTACT_EMAIL} copied to clipboard.` });
      setTimeout(() => { setCopied(false); setToast(v => ({ ...v, visible: false })); }, 3000);
    });
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const org = fd.get('Organization');
    const orgType = fd.get('Organization Type');
    const nationality = fd.get('Nationality');
    const state = fd.get('State');
    const city = fd.get('City');
    const rep = fd.get('Representative');
    const email = fd.get('Email');
    const interest = fd.get('Partnership Interest');

    const subject = `Government & Municipal Partnership Inquiry - ${org}`;
    const body = `Hello EcoStride Team,

We are interested in partnering with EcoStride for civic co-governance and community environmental initiatives. Please find our details below.

${interest}

---
[Key Info]
Organization: ${org}
Organization Type: ${orgType}
Nationality: ${nationality}
Location: ${city}, ${state}
Representative: ${rep}
Official Email: ${email}
`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <main style={{ paddingTop: 96, paddingBottom: 80 }}>
      <div className="container">
        {/* Header */}
        <Reveal style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto 56px' }}>
          <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 16 }}>Get in Touch</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,58px)', fontWeight: 800, letterSpacing: '-0.045em', color: '#111827', margin: '0 0 14px' }}>
            Let's Build Greener Communities, Together.
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, margin: 0 }}>
            Whether you have a question, feedback, or a city initiative in mind — we'd love to hear from you.
          </p>
        </Reveal>

        <div className="contact-grid">
          {/* Left: General contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Reveal className="apple-glass" style={{ borderRadius: 28, padding: 32 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #34d399, #059669)', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
                <Icon name="mail" size={24} className="" style={{ color: '#fff' }} />
              </div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: '#059669', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>Official Inbox</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.03em', color: '#111827', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace' }}>
                {CONTACT_EMAIL}
              </h2>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7, margin: '0 0 20px' }}>
                Direct channel for general inquiries, bug reports, merchant collaboration, and municipal authority integrations. We typically respond within 24 hours.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid rgba(16,185,129,0.1)' }}>
                <a href={`mailto:${CONTACT_EMAIL}?subject=EcoStride%20Inquiry`} className="btn-primary" style={{ padding: '10px 20px', fontSize: 12 }}>
                  <Icon name="send" size={14} /> Send Email
                </a>
                <button onClick={copyEmail} className="btn-glass" style={{ padding: '10px 18px', fontSize: 12 }}>
                  <Icon name="copy" size={14} /> {copied ? 'Copied!' : 'Copy Email'}
                </button>
              </div>
            </Reveal>

            {/* Priority channels */}
            <Reveal className="apple-glass" style={{ borderRadius: 28, padding: 28 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                🧭 Priority Collaboration Channels
              </h4>
              {[
                { emoji: '🏛️', bg: '#f0f9ff', border: '#bae6fd', title: 'Municipal Authorities & NGOs', desc: 'Deploy civic dashboards, resolve citizen-reported hazards, and co-host city cleanups.' },
                { emoji: '🏪', bg: '#fffbeb', border: '#fde68a', title: 'Merchant & Store Onboarding', desc: 'Join the EcoStride point store. Issue green vouchers and gain eco-conscious foot traffic.' },
                { emoji: '💡', bg: '#eef2ff', border: '#c7d2fe', title: 'Developer & Community Feedback', desc: 'Found a bug or have feature suggestions? Connect with our engineering team directly.' },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(16,185,129,0.08)', marginBottom: 10, cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(16,185,129,0.08)'}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: item.bg, border: `1px solid ${item.border}`, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>{item.emoji}</div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12, color: '#111827', marginBottom: 2 }}>{item.title}</strong>
                    <p style={{ margin: 0, fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>

          {/* Right: Partnership form */}
          <Reveal className="apple-glass" style={{ borderRadius: 28, padding: 36 }}>
            <div style={{ marginBottom: 24 }}>
              <div className="section-tag" style={{ display: 'inline-flex', marginBottom: 14, background: 'rgba(219,234,254,0.8)', color: '#1e40af', border: '1px solid rgba(147,197,253,0.4)' }}>
                City & Organization Partnerships
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: '#111827', margin: '0 0 10px' }}>
                Partner with EcoStride
              </h2>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7, margin: 0 }}>
                Tell us who you are, which city you represent, and how you'd like to contribute to building a greener, smarter community.
              </p>
            </div>

            <form onSubmit={handleContactSubmit}>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Organization Name
                  <input className="form-input" name="Organization" required placeholder="Your organization" />
                </label>
                <label className="form-label">
                  Organization Type
                  <select className="form-input" name="Organization Type" defaultValue="">
                    <option value="" disabled>Select type</option>
                    <option>Government / City Council</option>
                    <option>Local Authority / Municipality</option>
                    <option>NGO / Environmental Organization</option>
                    <option>Public Agency</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Nationality / Country
                  <input className="form-input" name="Nationality" required placeholder="e.g. Malaysia" />
                </label>
                <label className="form-label">
                  State / Region
                  <input className="form-input" name="State" required placeholder="e.g. Sarawak" />
                </label>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <label className="form-label">
                  City / Municipality (Responsible Area)
                  <input className="form-input" name="City" required placeholder="e.g. Kuching" />
                </label>
                <label className="form-label">
                  Representative Name
                  <input className="form-input" name="Representative" required placeholder="Your full name" />
                </label>
              </div>

              <label className="form-label" style={{ marginBottom: 14 }}>
                Official Email Address
                <input className="form-input" name="Email" required type="email" placeholder="official@gov.email" />
              </label>

              <label className="form-label" style={{ marginBottom: 14 }}>
                How would you like to work with EcoStride?
                <textarea className="form-input" name="Partnership Interest" rows={5}
                  placeholder="Describe your city's initiatives, environmental goals, or how you'd like to co-host events and resolve civic issues together." style={{ resize: 'vertical' }} />
              </label>

              {/* Important notice */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(240,249,255,0.8)', borderRadius: 14, border: '1px solid rgba(186,230,253,0.6)', marginBottom: 18 }}>
                <Icon name="info" size={16} style={{ color: '#0284c7', flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 11, color: '#0369a1', lineHeight: 1.6 }}>
                  <strong>Important:</strong> The official email address you provide above will be used to send your EcoStride partner onboarding invitation and platform access link. Please ensure it is a valid, monitored email.
                </p>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center' }}>
                Send Partnership Request <Icon name="arrow" size={16} />
              </button>
            </form>
          </Reveal>
        </div>
      </div>
      <Toast visible={toast.visible} title={toast.title} message={toast.message} />
    </main>
  );
}

/* ================================================================ */
/* APP ROOT                                                          */
/* ================================================================ */
function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AmbientOrbs />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/government" element={<GovPage />} />
        <Route path="/architecture" element={<ArchPage />} />
        <Route path="/download" element={<Download />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
