'use client';

import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(Boolean(mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

export function useResponsiveMotionScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setScale(0.58);
        return;
      }
      if (w < 1024) {
        setScale(0.78);
        return;
      }
      setScale(1);
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  return scale;
}

/* ═══════════════════════════════════════════════════════════════
   1. ScrollReveal — IntersectionObserver-powered reveal
   ═══════════════════════════════════════════════════════════════ */
interface ScrollRevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number; // ms
  duration?: number; // ms
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number; // px
  scale?: number; // e.g. 0.95
  once?: boolean;
  threshold?: number;
  style?: CSSProperties;
}

export function ScrollReveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  duration = 700,
  direction = 'up',
  distance = 40,
  scale,
  once = true,
  threshold = 0.15,
  style,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once, threshold]);

  const translate = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
    none: 'translate(0)',
  }[direction];

  const hiddenTransform = `${translate}${scale ? ` scale(${scale})` : ''}`;

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: reducedMotion
          ? undefined
          : visible
            ? 'translate(0) scale(1)'
            : hiddenTransform,
        transition: reducedMotion
          ? `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`
          : `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: reducedMotion ? 'opacity' : 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. StaggerChildren — delays each child sequentially
   ═══════════════════════════════════════════════════════════════ */
interface StaggerChildrenProps {
  children: ReactNode[];
  className?: string;
  stagger?: number; // ms between each child
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  duration?: number;
  baseDelay?: number;
  once?: boolean;
  threshold?: number;
}

export function StaggerChildren({
  children,
  className = '',
  stagger = 100,
  direction = 'up',
  distance = 30,
  duration = 600,
  baseDelay = 0,
  once = true,
  threshold = 0.1,
}: StaggerChildrenProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          delay={baseDelay + i * stagger}
          direction={direction}
          distance={distance}
          duration={duration}
          once={once}
          threshold={threshold}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. AnimatedCounter — counts up to target on scroll
   ═══════════════════════════════════════════════════════════════ */
interface AnimatedCounterProps {
  target: number;
  duration?: number; // ms
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
}

export function AnimatedCounter({
  target,
  duration = 2000,
  prefix = '',
  suffix = '',
  className = '',
  decimals = 0,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
      {suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. Parallax — smooth parallax on scroll
   ═══════════════════════════════════════════════════════════════ */
interface ParallaxProps {
  children: ReactNode;
  speed?: number; // -1 to 1, negative = opposite direction
  className?: string;
  style?: CSSProperties;
}

export function Parallax({
  children,
  speed = 0.3,
  className = '',
  style,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const motionScale = useResponsiveMotionScale();
  const effectiveSpeed = speed * motionScale;

  useEffect(() => {
    if (reducedMotion) {
      setOffset(0);
      return;
    }
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const windowH = window.innerHeight;
            const center = rect.top + rect.height / 2 - windowH / 2;
            setOffset(center * effectiveSpeed * -1);
          }
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [effectiveSpeed, reducedMotion]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transform: reducedMotion ? undefined : `translateY(${offset}px)`,
        willChange: reducedMotion ? undefined : 'transform',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. FloatingParticles — ambient background orbs
   ═══════════════════════════════════════════════════════════════ */
interface FloatingParticlesProps {
  count?: number;
  className?: string;
  colors?: string[];
}

export function FloatingParticles({
  count = 6,
  className = '',
  colors = ['bg-primary-400/20', 'bg-cyan-400/20', 'bg-sky-300/15'],
}: FloatingParticlesProps) {
  const reducedMotion = usePrefersReducedMotion();
  const motionScale = useResponsiveMotionScale();
  const fixed = (n: number, digits: number) => Number(n.toFixed(digits));
  const px = (n: number) => `${fixed(n, 3)}px`;
  const pct = (n: number) => `${fixed(n, 4)}%`;
  const sec = (n: number) => `${fixed(n, 4)}s`;

  const seed = (i: number) => {
    const x = Math.sin(i * 9301 + 49297) * 49297;
    return x - Math.floor(x);
  };
  const responsiveCount = Math.max(3, Math.round(count * motionScale));
  const sizeScale = 0.72 + motionScale * 0.28;
  const durationScale = 1 + (1 - motionScale) * 0.22;
  const particles = useMemo(
    () =>
      Array.from({ length: responsiveCount }, (_, i) => ({
        id: i,
        size: px((60 + seed(i) * 200) * sizeScale),
        x: pct(seed(i + 100) * 100),
        y: pct(seed(i + 200) * 100),
        duration: sec((15 + seed(i + 300) * 20) * durationScale),
        delay: sec(seed(i + 400) * -20),
        color: colors[i % colors.length],
      })),
    [responsiveCount, sizeScale, durationScale, colors]
  );

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {particles.map(p => (
        <div
          key={p.id}
          className={`absolute rounded-full blur-3xl ${p.color}`}
          style={{
            width: p.size,
            height: p.size,
            left: p.x,
            top: p.y,
            animationName: reducedMotion ? undefined : 'floatParticle',
            animationDuration: reducedMotion ? undefined : p.duration,
            animationTimingFunction: reducedMotion ? undefined : 'ease-in-out',
            animationDelay: reducedMotion ? undefined : p.delay,
            animationIterationCount: reducedMotion ? undefined : 'infinite',
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. MagneticButton — subtle magnetic pull on hover
   ═══════════════════════════════════════════════════════════════ */
interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: 'div' | 'button';
}

export function MagneticButton({
  children,
  className = '',
  strength = 0.3,
  as: Tag = 'div',
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [hoverCapable, setHoverCapable] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setHoverCapable(Boolean(mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reducedMotion || !hoverCapable) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      el.style.transform = `translate(${x}px, ${y}px)`;
    },
    [strength, reducedMotion, hoverCapable]
  );

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = 'translate(0, 0)';
  }, []);

  return (
    <Tag
      ref={ref as any}
      className={`transition-transform duration-300 ease-out ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. GradientBlob — animated gradient blob
   ═══════════════════════════════════════════════════════════════ */
interface GradientBlobProps {
  className?: string;
  colors?: [string, string, string];
  size?: number;
}

export function GradientBlob({
  className = '',
  colors = ['#1E40AF', '#0891b2', '#0f766e'],
  size = 500,
}: GradientBlobProps) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-30 pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${colors[0]}, ${colors[1]} 50%, ${colors[2]} 100%)`,
        animation:
          'morphBlob 20s ease-in-out infinite, rotateBlob 30s linear infinite',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. TextReveal — character-by-character text reveal
   ═══════════════════════════════════════════════════════════════ */
interface TextRevealProps {
  text: string;
  className?: string;
  charDelay?: number; // ms per character
  startDelay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function TextReveal({
  text,
  className = '',
  charDelay = 30,
  startDelay = 0,
  as: Tag = 'span',
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag ref={ref as any} className={className} aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 0.4s ease ${startDelay + i * charDelay}ms, transform 0.4s ease ${startDelay + i * charDelay}ms`,
            whiteSpace: char === ' ' ? 'pre' : undefined,
          }}
        >
          {char}
        </span>
      ))}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════
   9. SmoothMarquee — infinite scroll marquee
   ═══════════════════════════════════════════════════════════════ */
interface SmoothMarqueeProps {
  children: ReactNode;
  speed?: number; // seconds for one loop
  className?: string;
  pauseOnHover?: boolean;
}

export function SmoothMarquee({
  children,
  speed = 30,
  className = '',
  pauseOnHover = true,
}: SmoothMarqueeProps) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        maskImage:
          'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
      }}
    >
      <div
        className={`flex gap-8 w-max ${pauseOnHover ? 'hover:[animation-play-state:paused]' : ''}`}
        style={{ animation: `marquee ${speed}s linear infinite` }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   10. GlowCard — card with animated border glow on hover
   ═══════════════════════════════════════════════════════════════ */
interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowCard({
  children,
  className = '',
  glowColor = 'rgba(30, 64, 175, 0.15)',
}: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--glow-x', `${x}px`);
    el.style.setProperty('--glow-y', `${y}px`);
  }, []);

  return (
    <div
      ref={ref}
      className={`relative group ${className}`}
      onMouseMove={handleMouseMove}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${glowColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11. useScrollProgress — 0-1 scroll progress hook
   ═══════════════════════════════════════════════════════════════ */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? window.scrollY / h : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return progress;
}

/* ═══════════════════════════════════════════════════════════════
   12. ScrollProgressBar — thin top progress indicator
   ═══════════════════════════════════════════════════════════════ */
export function ScrollProgressBar() {
  const progress = useScrollProgress();
  return (
    <div
      className="fixed top-0 left-0 h-[3px] z-[100] gradient-primary"
      style={{
        width: `${progress * 100}%`,
        transition: 'width 0.1s linear',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   13. useElementScrollProgress — 0-1 progress for an element
   ═══════════════════════════════════════════════════════════════ */
export function useElementScrollProgress(offset = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const wh = window.innerHeight;
            const raw = 1 - (rect.top - offset) / (wh + rect.height);
            setProgress(Math.max(0, Math.min(1, raw)));
          }
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);

  return { ref, progress };
}

interface ScrollLightSweepProps {
  className?: string;
  intensity?: number;
}

export function ScrollLightSweep({
  className = '',
  intensity = 0.35,
}: ScrollLightSweepProps) {
  const { ref, progress } = useElementScrollProgress(120);
  const reducedMotion = usePrefersReducedMotion();
  const motionScale = useResponsiveMotionScale();

  const p = Math.max(0, Math.min(1, progress));
  const x = -30 + p * 160;
  const responsiveIntensity = intensity * (0.72 + motionScale * 0.28);
  const o = reducedMotion
    ? 0
    : responsiveIntensity * Math.max(0, Math.min(1, (p - 0.05) / 0.55));

  return (
    <div ref={ref} className={className} aria-hidden="true">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: o,
          mixBlendMode: 'soft-light',
          willChange: reducedMotion ? undefined : 'transform, opacity',
        }}
      >
        <div
          className="absolute -inset-y-1/2 -left-1/2 w-[140%]"
          style={{
            height: '200%',
            background:
              'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.42) 50%, transparent 62%)',
            transform: reducedMotion
              ? undefined
              : `translateX(${x}%) rotate(6deg)`,
            transition: reducedMotion
              ? undefined
              : 'transform 120ms linear, opacity 180ms ease',
            filter: 'blur(0.4px)',
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   14. AnimatedSVGPath — draws a path on scroll
   ═══════════════════════════════════════════════════════════════ */
interface AnimatedSVGPathProps {
  d: string;
  stroke?: string;
  strokeWidth?: number;
  progress: number;
  className?: string;
  duration?: number;
}

export function AnimatedSVGPath({
  d,
  stroke = 'currentColor',
  strokeWidth = 2,
  progress,
  className = '',
  duration = 0.3,
}: AnimatedSVGPathProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, [d]);

  return (
    <path
      ref={pathRef}
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      className={className}
      style={{
        strokeDasharray: length,
        strokeDashoffset: length * (1 - progress),
        transition: `stroke-dashoffset ${duration}s ease-out`,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   15. OrbitingNodes — elements orbiting around a center
   ═══════════════════════════════════════════════════════════════ */
interface OrbitingNodesProps {
  count: number;
  radius: number;
  duration?: number;
  nodeSize?: number;
  nodeClassName?: string;
  className?: string;
  reverse?: boolean;
  renderNode?: (index: number) => ReactNode;
}

export function OrbitingNodes({
  count,
  radius,
  duration = 20,
  nodeSize = 12,
  nodeClassName = 'bg-primary-400/60 rounded-full',
  className = '',
  reverse = false,
  renderNode,
}: OrbitingNodesProps) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{
        animation: reducedMotion
          ? undefined
          : `rotateBlob ${duration}s linear infinite${reverse ? ' reverse' : ''}`,
        willChange: reducedMotion ? undefined : 'transform',
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        return (
          <div
            key={i}
            className={`absolute ${nodeClassName}`}
            style={{
              width: `${nodeSize}px`,
              height: `${nodeSize}px`,
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px))`,
              animation: reducedMotion
                ? undefined
                : `rotateBlob ${duration}s linear infinite${reverse ? '' : ' reverse'}`,
              willChange: reducedMotion ? undefined : 'transform',
            }}
          >
            {renderNode ? renderNode(i) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   16. TypewriterEffect — types out text on scroll
   ═══════════════════════════════════════════════════════════════ */
interface TypewriterEffectProps {
  text: string;
  progress: number;
  className?: string;
  cursorClassName?: string;
  showCursor?: boolean;
}

export function TypewriterEffect({
  text,
  progress,
  className = '',
  cursorClassName = 'text-primary-500',
  showCursor = true,
}: TypewriterEffectProps) {
  const visibleCount = Math.floor(progress * text.length);
  const visible = text.slice(0, visibleCount);
  return (
    <span className={className}>
      {visible}
      {showCursor && progress < 1 && (
        <span
          className={`inline-block w-[2px] h-[1em] ml-px align-middle animate-pulse ${cursorClassName}`}
          style={{ backgroundColor: 'currentColor' }}
        />
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   17. ProgressiveReveal — clips content based on scroll progress
   ═══════════════════════════════════════════════════════════════ */
interface ProgressiveRevealProps {
  children: ReactNode;
  progress: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export function ProgressiveReveal({
  children,
  progress,
  direction = 'left',
  className = '',
}: ProgressiveRevealProps) {
  const p = Math.max(0, Math.min(1, progress)) * 100;
  const clipMap = {
    left: `inset(0 ${100 - p}% 0 0)`,
    right: `inset(0 0 0 ${100 - p}%)`,
    top: `inset(0 0 ${100 - p}% 0)`,
    bottom: `inset(${100 - p}% 0 0 0)`,
  };
  return (
    <div
      className={className}
      style={{
        clipPath: clipMap[direction],
        transition: 'clip-path 0.15s ease-out',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   18. WaveDivider — SVG section separator
   ═══════════════════════════════════════════════════════════════ */
interface WaveDividerProps {
  flip?: boolean;
  className?: string;
  fillClassName?: string;
}

export function WaveDivider({
  flip = false,
  className = '',
  fillClassName = 'fill-white',
}: WaveDividerProps) {
  return (
    <div
      className={`w-full overflow-hidden leading-[0] ${flip ? 'rotate-180' : ''} ${className}`}
    >
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className="w-full h-[50px] sm:h-[70px] lg:h-[80px]"
      >
        <path
          d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z"
          className={fillClassName}
        />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   19. PulseRing — expanding ring animation
   ═══════════════════════════════════════════════════════════════ */
interface PulseRingProps {
  className?: string;
  color?: string;
  count?: number;
  size?: number;
}

export function PulseRing({
  className = '',
  color = 'rgba(30,64,175,0.15)',
  count = 3,
  size = 80,
}: PulseRingProps) {
  const motionScale = useResponsiveMotionScale();
  const tempo = motionScale < 0.65 ? 0.9 : motionScale < 0.9 ? 0.96 : 1.06;
  const duration = (2.5 * tempo).toFixed(2);
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            border: `2px solid ${color}`,
            animation: `pulse-ring ${duration}s ease-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   20. FloatingElement — single element that floats
   ═══════════════════════════════════════════════════════════════ */
interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
  delay?: number;
}

export function FloatingElement({
  children,
  className = '',
  amplitude = 15,
  duration = 6,
  delay = 0,
}: FloatingElementProps) {
  const reducedMotion = usePrefersReducedMotion();
  const motionScale = useResponsiveMotionScale();
  const tempo = motionScale < 0.65 ? 0.9 : motionScale < 0.9 ? 0.96 : 1.06;
  const durationSeconds = (duration * tempo).toFixed(2);
  return (
    <div
      className={`${className}`}
      style={{
        animation: reducedMotion
          ? undefined
          : `floatElement ${durationSeconds}s ease-in-out ${delay}s infinite`,
        ['--float-amplitude' as string]: `${amplitude}px`,
        willChange: reducedMotion ? undefined : 'transform',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   21. ScrollScale — scales element based on scroll progress
   Starts small, scales to full size as element enters viewport
   ═══════════════════════════════════════════════════════════════ */
interface ScrollScaleProps {
  children: ReactNode;
  className?: string;
  startScale?: number;
  endScale?: number;
  startOpacity?: number;
  endOpacity?: number;
  offsetPx?: number;
}

export function ScrollScale({
  children,
  className = '',
  startScale = 0.85,
  endScale = 1,
  startOpacity = 0.4,
  endOpacity = 1,
  offsetPx = 100,
}: ScrollScaleProps) {
  const { ref, progress } = useElementScrollProgress(offsetPx);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(Boolean(mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const p = Math.max(0, Math.min(1, progress));
  const eased = 1 - Math.pow(1 - p, 3);
  const scale = reducedMotion
    ? endScale
    : startScale + (endScale - startScale) * eased;
  const opacity = reducedMotion
    ? endOpacity
    : startOpacity + (endOpacity - startOpacity) * eased;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: reducedMotion ? undefined : `scale(${scale})`,
        opacity,
        willChange: reducedMotion ? undefined : 'transform, opacity',
        transition: reducedMotion
          ? undefined
          : 'transform 60ms linear, opacity 60ms linear',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   22. TextRevealByWord — reveals text word-by-word on scroll
   Subsumio-style: each word fades in sequentially as section enters
   ═══════════════════════════════════════════════════════════════ */
interface TextRevealByWordProps {
  text: string;
  className?: string;
  wordClassName?: string;
  tag?: 'p' | 'h1' | 'h2' | 'h3' | 'span';
  staggerMs?: number;
}

export function TextRevealByWord({
  text,
  className = '',
  wordClassName = '',
  tag: Tag = 'p',
  staggerMs = 40,
}: TextRevealByWordProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const words = text.split(/\s+/);

  return (
    <Tag ref={ref as never} className={className}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className={`inline-block ${wordClassName}`}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 400ms cubic-bezier(0.16,1,0.3,1) ${i * staggerMs}ms, transform 400ms cubic-bezier(0.16,1,0.3,1) ${i * staggerMs}ms`,
            willChange: 'opacity, transform',
          }}
        >
          {word}
          {i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════
   23. ScrollTransform — arbitrary continuous scroll-driven CSS
   Provides a 0→1 progress value and applies custom transforms
   ═══════════════════════════════════════════════════════════════ */
interface ScrollTransformProps {
  children: ReactNode;
  className?: string;
  offsetPx?: number;
  style?: (progress: number) => CSSProperties;
}

export function ScrollTransform({
  children,
  className = '',
  offsetPx = 80,
  style: styleFn,
}: ScrollTransformProps) {
  const { ref, progress } = useElementScrollProgress(offsetPx);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(Boolean(mq.matches));
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const p = Math.max(0, Math.min(1, progress));
  const computed = reducedMotion ? {} : (styleFn?.(p) ?? {});

  return (
    <div ref={ref} className={className} style={computed}>
      {children}
    </div>
  );
}
