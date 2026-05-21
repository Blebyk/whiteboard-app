import Link from 'next/link';

const GRID_LINE = '#c8d0dc';
const INK = '#1a1a2e';
const PRIMARY = '#4f46e5';
const SUCCESS_CTA = '#28a745';
const BLUE_LEGACY = '#007bff';
const FG3 = '#555555';

// ────────────────────────────── Sticky-note backdrop
// Statically positioned via SVG so they never get clipped by parent layout.
function HeroStickyIllustration() {
  const stickies = [
    // ── left cluster (top to bottom)
    { x: 50,  y: 60,  w: 60, h: 60, color: '#fff2a8', r: -8 },
    { x: 130, y: 110, w: 64, h: 60, color: '#fcb4b4', r: -3 },
    { x: 28,  y: 158, w: 66, h: 66, color: '#fdd9a3', r: 6 },
    { x: 110, y: 218, w: 76, h: 74, color: '#f9b6e6', r: 7 },
    { x: 36,  y: 282, w: 70, h: 68, color: '#a0e7b3', r: -6 },
    { x: 140, y: 336, w: 82, h: 78, color: '#fbb775', r: -10 },
    { x: 50,  y: 412, w: 68, h: 62, color: '#fbe4a0', r: 4 },
    // ── right cluster
    { x: 870, y: 64,  w: 60, h: 56, color: '#fff2a8', r: 6 },
    { x: 780, y: 110, w: 64, h: 60, color: '#a0e7b3', r: -4 },
    { x: 916, y: 156, w: 70, h: 68, color: '#cdb4fc', r: 5 },
    { x: 790, y: 196, w: 76, h: 72, color: '#fcb4b4', r: -6 },
    { x: 900, y: 256, w: 70, h: 66, color: '#f9b6e6', r: 3 },
    { x: 786, y: 304, w: 80, h: 74, color: '#a3d4ff', r: -5 },
    { x: 910, y: 366, w: 68, h: 64, color: '#fdd9a3', r: 8 },
    { x: 800, y: 420, w: 74, h: 64, color: '#fff2a8', r: -4 },
  ];

  return (
    <svg
      viewBox="0 0 1024 500"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {stickies.map((s, i) => (
        <g key={i} transform={`rotate(${s.r} ${s.x + s.w / 2} ${s.y + s.h / 2})`}>
          <rect x={s.x + 1.5} y={s.y + 2.5} width={s.w} height={s.h} fill="rgba(0,0,0,0.06)" />
          <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={s.color} />
          <path d={`M ${s.x + s.w} ${s.y + s.h - 8} L ${s.x + s.w - 8} ${s.y + s.h} Z`} fill="rgba(0,0,0,0.08)" />
        </g>
      ))}
    </svg>
  );
}

// ────────────────────────────── Icon set (Lucide-style)
function Icon({ name, size = 32, color = PRIMARY }: { name: string; size?: number; color?: string }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'notebook':
      return (
        <svg {...common}>
          <path d="M2 6h4" /><path d="M2 10h4" /><path d="M2 14h4" /><path d="M2 18h4" />
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <path d="M16 2v20" />
        </svg>
      );
    case 'penLine':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case 'bulb':
      return (
        <svg {...common}>
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" /><path d="M10 22h4" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 1 0 4 17h13.5Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    default: return null;
  }
}

// ────────────────────────────── Header
function MarketingHeader() {
  return (
    <header style={{
      backgroundColor: 'transparent',
      padding: '22px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
      zIndex: 3,
    }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <span style={{ fontSize: 20, color: INK, fontWeight: 800, letterSpacing: '-0.01em' }}>
          Whiteboard
        </span>
      </Link>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/login">
          <button style={{
            padding: '8px 18px', background: PRIMARY, color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Войти</button>
        </Link>
        <Link href="/register">
          <button style={{
            padding: '8px 18px', background: SUCCESS_CTA, color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Регистрация</button>
        </Link>
      </div>
    </header>
  );
}

// ────────────────────────────── Hero
function Hero() {
  return (
    <section style={{
      position: 'relative',
      padding: '12px 40px 16px',
      textAlign: 'center',
    }}>
      <div style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: 760,
        margin: '0 auto',
      }}>
        <h1 style={{
          fontSize: 52,
          color: INK,
          margin: '0 0 16px',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
        }}>
          Создавайте и делитесь досками
        </h1>
        <p style={{
          fontSize: 16,
          color: FG3,
          maxWidth: 460,
          margin: '0 auto 24px',
          lineHeight: 1.55,
        }}>
          Совместная работа стала проще. Добавляйте заметки, чтобы команда
          синхронизировалась по всем задачам.
        </p>
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '12px 26px',
            background: BLUE_LEGACY,
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.25)',
          }}>Начать работу</button>
        </Link>
      </div>
    </section>
  );
}

// ────────────────────────────── Feature card
interface FeatureCardProps {
  icons: { name: string; size?: number }[];
  title: string;
  description: string;
}

function FeatureCard({ icons, title, description }: FeatureCardProps) {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      padding: '32px 28px 28px',
      borderRadius: 14,
      boxShadow: '0 8px 28px rgba(20, 24, 60, 0.08), 0 2px 6px rgba(20, 24, 60, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: PRIMARY }}>
        {icons.map((ic, i) => (
          <Icon key={i} name={ic.name} size={ic.size || 34} />
        ))}
      </div>
      <div>
        <h3 style={{
          fontSize: 19, color: INK,
          margin: '0 0 10px', fontWeight: 700,
          letterSpacing: '-0.01em',
        }}>{title}</h3>
        <p style={{
          fontSize: 13.5, color: FG3,
          lineHeight: 1.55, margin: 0,
        }}>{description}</p>
      </div>
    </div>
  );
}

// ────────────────────────────── Features grid
function Features() {
  return (
    <section style={{
      position: 'relative',
      padding: '0 40px',
      zIndex: 4,
    }}>
      <div style={{
        maxWidth: 1040,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 22,
      }}>
        <FeatureCard
          icons={[{ name: 'notebook' }, { name: 'penLine', size: 28 }]}
          title="Создание заметок"
          description="Добавляйте текстовые заметки, списки дел и важные мысли. Организуйте информацию визуально на виртуальной доске."
        />
        <FeatureCard
          icons={[{ name: 'bulb' }, { name: 'users' }]}
          title="Организация идей"
          description="Группируйте связанные заметки, создавайте категории и структурируйте свои мысли логично."
        />
        <FeatureCard
          icons={[{ name: 'cloud', size: 36 }, { name: 'search', size: 30 }]}
          title="Быстрый доступ"
          description="Все ваши заметки в одном месте. Быстро находите нужную информацию и редактируйте на ходу."
        />
      </div>
    </section>
  );
}

// ────────────────────────────── Page
export default function MainPage() {
  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      // Grid pattern across the WHOLE page, with the gradient layered on top
      backgroundImage:
        `linear-gradient(180deg,
           rgba(255,255,255,0.85) 0%,
           rgba(255,255,255,0.6) 40%,
           rgba(238,240,250,0.85) 80%,
           rgba(216,221,240,0.95) 100%),
         linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px),
         linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`,
      backgroundSize: '100% 100%, 32px 32px, 32px 32px',
      backgroundPosition: '0 0, -1px -1px, -1px -1px',
    }}>
      {/* Stickies live behind everything, full-page */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}>
        <HeroStickyIllustration />
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <MarketingHeader />
      </div>

      <div style={{
        position: 'relative',
        zIndex: 2,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <Hero />
        <Features />
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
}
