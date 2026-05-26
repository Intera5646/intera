// INTERA — Logo + icons (cream/mocha aesthetic)
// The brand logo: an arched window/doorway frame in gold, a serif "I" centered
// inside, with "INTERA / Интера" beneath in a pill-shaped sub-label.

function LogoMark({ size = 64, gold = '#B89A6B', goldD = '#8E7449', ink = '#1A1614', sub = true, withRu = true }) {
  // Frame proportions
  const w = size;
  const aspectArch = 1.32;       // arch h / w
  const arch_h = size * aspectArch;
  const total_h = arch_h + (sub ? size * 0.42 : 0);

  return (
    <svg width={w} height={total_h} viewBox={`0 0 100 ${100 * (total_h / w)}`} fill="none">
      <defs>
        <linearGradient id="lmg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={gold} />
          <stop offset="100%" stopColor={goldD} />
        </linearGradient>
      </defs>

      {/* Arch outline */}
      <path
        d="M 14 132 L 14 50 A 36 36 0 0 1 86 50 L 86 132 Z"
        fill="none" stroke="url(#lmg)" strokeWidth="1.6"
      />
      {/* Inner second-line on right side (mimics the partial inner arch in ref) */}
      <path
        d="M 64 132 L 64 50 A 22 22 0 0 0 56 32"
        fill="none" stroke="url(#lmg)" strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Tiny vertical pillars on the left (stairs/columns hint) */}
      {[0,1,2,3,4].map(i => (
        <line key={i}
          x1={22 + i * 3.4} y1={132 - 4}
          x2={22 + i * 3.4} y2={132 - 22}
          stroke="url(#lmg)" strokeWidth="0.9" />
      ))}
      {/* Floor plate */}
      <path d="M 18 132 L 82 132 L 76 124 L 24 124 Z"
        fill="url(#lmg)" opacity="0.5" />

      {/* Serif "I" centered */}
      <text x="50" y="118"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', 'Playfair Display', Georgia, serif"
        fontWeight="500"
        fontSize="78"
        fill={ink}
        letterSpacing="0"
      >I</text>

      {sub && (
        <g>
          {/* Pill */}
          <rect x="18" y="142" width="64" height="18" rx="9"
            fill="none" stroke="url(#lmg)" strokeWidth="1" />
          <text x="50" y="155"
            textAnchor="middle"
            fontFamily="'Cormorant Garamond', serif"
            fontWeight="500"
            fontSize="9.5"
            fill={goldD}
            letterSpacing="2"
          >INTERA</text>
          {withRu && (
            <text x="50" y="170.5"
              textAnchor="middle"
              fontFamily="'Cormorant Garamond', serif"
              fontWeight="500"
              fontSize="6.4"
              fill={goldD}
              letterSpacing="1.6"
            >ИНТЕРА</text>
          )}
        </g>
      )}
    </svg>
  );
}

// Just the wordmark used in headers (no arch)
function WordmarkOnly({ size = 22, ink = 'var(--ink)', sub = true }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
      <div className="wordmark" style={{ fontSize: size, color: ink }}>INTERA</div>
      {sub && (
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: size * 0.42,
          color: 'var(--gold-d)',
          letterSpacing: '0.18em',
          marginTop: 2,
        }}>Интера</div>
      )}
    </div>
  );
}

// Small inline icons (lucide-ish)
const Ic = ({ d, size = 22, color = 'currentColor', sw = 1.6, fill = 'none', children, vb = 24 }) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={color}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

const IconBack    = (p) => <Ic {...p} d="M15 18l-6-6 6-6" />;
const IconBell    = (p) => <Ic {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></Ic>;
const IconMenu    = (p) => <Ic {...p}><path d="M4 7h16M4 12h12M4 17h16"/></Ic>;
const IconPlus    = (p) => <Ic {...p}><path d="M12 5v14M5 12h14"/></Ic>;
const IconHome    = (p) => <Ic {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></Ic>;
const IconGrid    = (p) => <Ic {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></Ic>;
const IconHeart   = (p) => <Ic {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></Ic>;
const IconUser    = (p) => <Ic {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Ic>;
const IconChev    = (p) => <Ic {...p} d="M9 6l6 6-6 6"/>;
const IconCheck   = (p) => <Ic {...p} d="M4 12.5l5 5L20 6.5" />;
const IconMore    = (p) => <Ic {...p}><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></Ic>;
const IconEye     = (p) => <Ic {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Ic>;
const IconCloud   = (p) => <Ic {...p}><path d="M7 18a4 4 0 0 1 .6-7.97A6 6 0 0 1 18.5 11.5 3.5 3.5 0 0 1 18 18H7z"/><path d="M12 13v-4M9 12l3-3 3 3"/></Ic>;
const IconFile    = (p) => <Ic {...p}><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></Ic>;
const IconRefresh = (p) => <Ic {...p}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></Ic>;
const IconBookmark= (p) => <Ic {...p}><path d="M6 3h12v18l-6-4-6 4z"/></Ic>;
const IconSliders = (p) => <Ic {...p}><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/></Ic>;
const IconShield  = (p) => <Ic {...p}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/></Ic>;
const IconBell2   = (p) => <Ic {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/></Ic>;
const IconCrown   = (p) => <Ic {...p}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></Ic>;
const IconInfo    = (p) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></Ic>;
const IconLogout  = (p) => <Ic {...p}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h12"/></Ic>;
const IconLayers  = (p) => <Ic {...p}><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></Ic>;
const IconKitchen = (p) => <Ic {...p}><path d="M5 3h14v18H5z"/><path d="M5 9h14M9 14v4M14 14v4"/></Ic>;
const IconSofa    = (p) => <Ic {...p}><path d="M3 13v4h18v-4"/><path d="M5 13v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M5 17v2M19 17v2"/></Ic>;
const IconBed     = (p) => <Ic {...p}><path d="M3 18v-7h18v7"/><path d="M3 14h18M7 11V8h5v3"/><path d="M3 18v2M21 18v2"/></Ic>;
const IconBath    = (p) => <Ic {...p}><path d="M3 11h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M5 11V6a2 2 0 0 1 4 0"/><path d="M7 19v2M17 19v2"/></Ic>;
const IconStudio  = (p) => <Ic {...p}><rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M3 13h18M11 17v3M8 20h8"/></Ic>;
const IconDots4   = (p) => <Ic {...p}><circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/><circle cx="6" cy="18" r="1.5" fill="currentColor"/><circle cx="18" cy="18" r="1.5" fill="currentColor"/></Ic>;
const IconHouse   = (p) => <Ic {...p}><path d="M3 21V10l9-7 9 7v11"/><path d="M9 21v-7h6v7"/></Ic>;
const IconApt     = (p) => <Ic {...p}><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></Ic>;
const IconBranch  = (p) => <Ic {...p}><path d="M12 4v16M6 8c0-2 6-2 6-2M6 14c0 2 6 2 6 2M18 10c0-2-6-2-6-2"/></Ic>;
const IconCog     = (p) => <Ic {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2 2M17.8 17.8l2 2M2 12h3M19 12h3M4.2 19.8l2-2M17.8 6.2l2-2"/></Ic>;
const IconMail    = (p) => <Ic {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Ic>;
const IconCoin    = (p) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M9 9h4.5a2 2 0 0 1 0 4H10v3"/></Ic>;
const IconLock    = (p) => <Ic {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Ic>;

Object.assign(window, {
  LogoMark, WordmarkOnly,
  IconBack, IconBell, IconMenu, IconPlus, IconHome, IconGrid, IconHeart, IconUser,
  IconChev, IconCheck, IconMore, IconEye, IconCloud, IconFile, IconRefresh,
  IconBookmark, IconSliders, IconShield, IconBell2, IconCrown, IconInfo, IconLogout,
  IconLayers, IconKitchen, IconSofa, IconBed, IconBath, IconStudio, IconDots4,
  IconHouse, IconApt, IconBranch, IconCog, IconMail, IconCoin, IconLock,
});
