"use client";

import { useRef, useState } from "react";

const slides = [
  { web: "/web1.jpeg", mobile: "/mob1.jpeg", alt: "FamCare onboarding feature slide 1" },
  { web: "/web2.jpeg", mobile: "/mob2.jpeg", alt: "FamCare onboarding feature slide 2" },
  { web: "/web3.jpeg", mobile: "/mob3.jpeg", alt: "FamCare onboarding feature slide 3" },
];

export default function FeatureIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerStartX = useRef<number | null>(null);
  const swiped = useRef(false);

  function goNext() {
    if (index >= slides.length - 1) {
      onDone();
      return;
    }
    setIndex((current) => current + 1);
  }

  function goPrevious() {
    setIndex((current) => Math.max(0, current - 1));
  }

  function handleDirectionalClick(clientX: number) {
    const card = cardRef.current;
    if (!card) {
      goNext();
      return;
    }
    const rect = card.getBoundingClientRect();
    const clickedRightHalf = clientX >= rect.left + rect.width / 2;
    if (clickedRightHalf) goNext();
    else goPrevious();
  }

  function handlePointerUp(clientX: number) {
    if (pointerStartX.current == null) return;
    const delta = clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(delta) < 36) {
      swiped.current = false;
      return;
    }

    swiped.current = true;
    if (delta < 0) goNext();
    else goPrevious();
    window.setTimeout(() => {
      swiped.current = false;
    }, 0);
  }

  return (
    <div className="feature-intro-screen" aria-label="FamCare quick guide">
      <div
        ref={cardRef}
        className="feature-intro-card"
        role="button"
        tabIndex={0}
        aria-label={index === slides.length - 1 ? "Finish quick guide" : "Next quick guide slide"}
        onClick={(event) => {
          if (!swiped.current) handleDirectionalClick(event.clientX);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goNext();
          }
          if (event.key === "ArrowRight") goNext();
          if (event.key === "ArrowLeft") goPrevious();
          if (event.key === "Escape") onDone();
        }}
        onPointerDown={(event) => {
          pointerStartX.current = event.clientX;
        }}
        onPointerUp={(event) => handlePointerUp(event.clientX)}
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
      >
        <button
          type="button"
          className="feature-intro-skip"
          onClick={(event) => {
            event.stopPropagation();
            onDone();
          }}
        >
          Skip
        </button>
        <button
          type="button"
          className="feature-intro-arrow left"
          aria-label="Previous slide"
          onClick={(event) => {
            event.stopPropagation();
            goPrevious();
          }}
          disabled={index === 0}
        >
          ‹
        </button>
        <button
          type="button"
          className="feature-intro-arrow right"
          aria-label={index === slides.length - 1 ? "Finish quick guide" : "Next slide"}
          onClick={(event) => {
            event.stopPropagation();
            goNext();
          }}
        >
          ›
        </button>

        <div
          className="feature-intro-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide) => (
            <picture className="feature-intro-slide" key={slide.web} style={{ flex: "0 0 100%" }}>
              <source media="(max-width: 720px)" srcSet={slide.mobile} />
              <img src={slide.web} alt={slide.alt} draggable={false} style={{ width: "100%", height: "100%" }} />
            </picture>
          ))}
        </div>

        <div className="feature-intro-ui" aria-hidden="true">
          <div className="feature-intro-dots">
            {slides.map((slide, dotIndex) => (
              <span key={slide.web} className={dotIndex === index ? "active" : ""} />
            ))}
          </div>
          <span className="feature-intro-hint">
            {index === slides.length - 1 ? "Tap to start" : "Tap to continue"}
          </span>
        </div>
      </div>
    </div>
  );
}
