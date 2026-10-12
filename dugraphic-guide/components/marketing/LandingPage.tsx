"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Reveal — scroll-triggered entrance. "fade" for text blocks, "line"  */
/* for hairlines that draw themselves in from the left.                */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  className,
  delayMs = 0,
  variant = "fade",
}: {
  children?: React.ReactNode;
  className?: string;
  delayMs?: number;
  variant?: "fade" | "line";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cx(
        variant === "fade"
          ? cx("transition-all duration-700 ease-out", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5")
          : cx("transition-transform duration-[900ms] ease-out origin-left", visible ? "scale-x-100" : "scale-x-0"),
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MagneticButton — CTA that leans toward the cursor within its bounds */
/* ------------------------------------------------------------------ */

function MagneticButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function handleMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setOffset({ x: x * 0.25, y: y * 0.35 });
  }

  function handleLeave() {
    setOffset({ x: 0, y: 0 });
  }

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className={cx("inline-flex items-center transition-transform duration-200 ease-out", className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* UnderlineLink — small text link with a draw-in underline on hover   */
/* ------------------------------------------------------------------ */

function UnderlineLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group relative inline-block"
    >
      {children}
      <span className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </a>
  );
}

/* ------------------------------------------------------------------ */

const CAPABILITIES = [
  {
    label: "Quotes",
    ko: "견적서",
    desc: "리뉴얼 · 신규 · 연장 · 디자인 네 가지 유형을 단가·부가세·수량 기준으로 자동 계산해 문서로 만듭니다.",
  },
  {
    label: "Intake",
    ko: "클라이언트 인테이크",
    desc: "외부 문의 폼으로 들어온 업체 정보와 답변이 담당자 확인 없이 바로 데이터베이스에 쌓입니다.",
  },
  {
    label: "Databases",
    ko: "체크리스트 & 데이터베이스",
    desc: "진행 상태, 업종, 답변 이력을 표로 정리하고 필요한 순서대로 다시 배열합니다.",
  },
  {
    label: "Workspace",
    ko: "워크스페이스",
    desc: "자유롭게 쓰는 문서와 페이지로, 회의록부터 내부 가이드까지 팀의 기록을 남깁니다.",
  },
];

const WORKFLOW = [
  { n: "01", ko: "문의 접수" },
  { n: "02", ko: "체크리스트 작성" },
  { n: "03", ko: "견적서 발행" },
  { n: "04", ko: "발송 · 계약" },
];

export default function LandingPage() {
  return (
    <div className="wp-scope bg-[var(--wp-paper)] text-[var(--wp-ink)] selection:bg-[var(--wp-accent)] selection:text-white">
      {/* -------------------------------------------------- header -- */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo.png" alt="DU" className="h-6 w-auto md:h-7" />
        <UnderlineLink href="/login">
          <span className="font-mono text-xs uppercase tracking-[0.18em]">로그인</span>
        </UnderlineLink>
      </header>

      {/* ---------------------------------------------------- hero -- */}
      <section className="relative overflow-hidden px-6 pb-24 pt-10 md:px-12 md:pb-36 md:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 hidden overflow-hidden opacity-[0.09] md:block"
          style={{ width: 460, height: 224 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.png" alt="" style={{ width: 880, maxWidth: "none" }} />
        </div>

        <div className="relative grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-9 lg:col-span-8">
            <p className="hero-in font-mono text-xs uppercase tracking-[0.22em] text-[var(--wp-muted)]">
              Dugraphic Guide — Studio OS
            </p>

            <h1
              className="hero-in mt-6 text-[13vw] leading-[0.98] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.5rem]"
              style={{ fontFamily: "var(--font-display)", animationDelay: "90ms" }}
            >
              The work
              <br />
              they see.
              <br />
              <span className="text-[var(--wp-muted)]">The system</span>
              <br />
              they don&apos;t.
            </h1>

            <p
              className="hero-in mt-8 max-w-md text-[15px] leading-relaxed text-[var(--wp-muted)]"
              style={{ animationDelay: "220ms" }}
            >
              견적서, 클라이언트 인테이크, 체크리스트, 문서 — DU 스튜디오가 매일 쓰는 운영 시스템입니다.
              클라이언트에게 보이지 않는 곳에서, 작업을 설계합니다.
            </p>

            <div className="hero-in mt-10 flex items-center gap-6" style={{ animationDelay: "320ms" }}>
              <MagneticButton
                href="/login"
                className="rounded-full bg-[var(--wp-ink)] px-7 py-3 text-sm font-medium text-[var(--wp-paper)] hover:bg-[var(--wp-accent)]"
              >
                로그인하기
                <span className="ml-2">→</span>
              </MagneticButton>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--wp-muted)]">
                팀 전용
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- capabilities -- */}
      <section className="border-t border-[var(--wp-line)] px-6 py-20 md:px-12 md:py-28">
        <Reveal variant="fade">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--wp-muted)]">
            What it runs
          </p>
        </Reveal>

        <div className="mt-10">
          {CAPABILITIES.map((item, i) => (
            <Reveal key={item.label} delayMs={i * 90} variant="fade">
              <div className="group grid grid-cols-1 gap-3 border-t border-[var(--wp-line)] py-8 md:grid-cols-12 md:items-baseline md:gap-6">
                <span
                  className="md:col-span-4 lg:col-span-3 text-3xl md:text-4xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {item.label}
                </span>
                <span className="md:col-span-3 lg:col-span-2 text-sm font-medium text-[var(--wp-ink)]">
                  {item.ko}
                </span>
                <p className="md:col-span-5 lg:col-span-6 max-w-md text-sm leading-relaxed text-[var(--wp-muted)] transition-colors duration-300 group-hover:text-[var(--wp-ink)]">
                  {item.desc}
                </p>
              </div>
            </Reveal>
          ))}
          <Reveal variant="line" className="h-px w-full bg-[var(--wp-line)]" />
        </div>
      </section>

      {/* -------------------------------------------------- workflow -- */}
      <section className="border-t border-[var(--wp-line)] px-6 py-20 md:px-12 md:py-28">
        <Reveal variant="fade">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--wp-muted)]">
            문의부터 발송까지
          </p>
        </Reveal>

        <div className="mt-14 flex flex-col md:flex-row md:items-start">
          {WORKFLOW.map((step, i) => (
            <div key={step.n} className="flex flex-1 items-start gap-4 md:flex-col md:gap-0">
              <Reveal delayMs={i * 120} className="md:mb-6">
                <span className="font-mono text-sm text-[var(--wp-muted)]">{step.n}</span>
              </Reveal>
              <div className="flex flex-1 items-center gap-4 md:w-full">
                <Reveal delayMs={i * 120 + 60}>
                  <span className="text-lg font-medium">{step.ko}</span>
                </Reveal>
                {i < WORKFLOW.length - 1 && (
                  <Reveal
                    variant="line"
                    delayMs={i * 120 + 140}
                    className="hidden h-px flex-1 bg-[var(--wp-line)] md:mt-3 md:block"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- statement -- */}
      <section className="overflow-hidden border-t border-[var(--wp-line)] bg-[var(--wp-ink)] py-20 text-[var(--wp-paper)] md:py-28">
        <div className="marquee-track flex w-max whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="px-6 text-5xl md:text-7xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Designed Unseen
                  <span className="mx-6 inline-block h-3 w-3 rounded-full bg-[var(--wp-accent)] align-middle" />
                </span>
              ))}
            </div>
          ))}
        </div>

        <Reveal className="mt-16 px-6 md:px-12">
          <p className="max-w-lg text-sm leading-relaxed text-white/60">
            보이는 결과물 뒤에, 보이지 않게 설계된 시스템이 있습니다. Dugraphic Guide는 그 시스템을
            운영하는 도구입니다.
          </p>
        </Reveal>
      </section>

      {/* ---------------------------------------------------- footer -- */}
      <footer className="flex flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center md:px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo.png" alt="DU" className="h-5 w-auto opacity-70" />
        <div className="flex items-center gap-8 font-mono text-xs uppercase tracking-[0.14em] text-[var(--wp-muted)]">
          <UnderlineLink href="/login">로그인</UnderlineLink>
          <UnderlineLink href="http://pf.kakao.com/_zxlVJn" external>
            문의
          </UnderlineLink>
          <span>© {new Date().getFullYear()} DU</span>
        </div>
      </footer>
    </div>
  );
}
