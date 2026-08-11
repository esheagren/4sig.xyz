import { useState, useEffect, useMemo, useRef } from 'react';

interface LoadingOrbProps {
  score?: number;
  showScore?: boolean;
  /** Small text shown in the orb center when no score is displayed (e.g. "2 / 3") */
  label?: string;
  onScoreClick?: () => void;
  isClickable?: boolean;
}

export function LoadingOrb({ score, showScore = false, label, onScoreClick, isClickable = true }: LoadingOrbProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const prevScoreRef = useRef<number | undefined>(undefined);

  // Trigger pulse animation when score changes (discrete jumps)
  useEffect(() => {
    if (score !== undefined && prevScoreRef.current !== undefined && score !== prevScoreRef.current) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 300);
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = score;
  }, [score]);

  // Generate dots in a spherical pattern - memoized to prevent regeneration
  const dots = useMemo(() => {
    const dotsArray = [];
    const radius = 50;

    // Create rings of dots at different latitudes
    const latitudes = [-60, -30, 0, 30, 60];
    const dotsPerRing = [6, 10, 12, 10, 6];

    let dotIndex = 0;
    latitudes.forEach((lat, ringIndex) => {
      const count = dotsPerRing[ringIndex];
      for (let i = 0; i < count; i++) {
        const lng = (360 / count) * i;
        const opacity = 0.4 + Math.random() * 0.4;
        dotsArray.push(
          <div
            key={dotIndex++}
            className="loading-orb-dot"
            style={{
              transform: `rotateY(${lng}deg) rotateX(${lat}deg) translateZ(${radius}px)`,
              opacity: opacity,
            }}
          />
        );
      }
    });

    // Add top and bottom poles
    dotsArray.push(
      <div
        key={dotIndex++}
        className="loading-orb-dot"
        style={{
          transform: `rotateX(90deg) translateZ(${radius}px)`,
          opacity: 0.7,
        }}
      />
    );
    dotsArray.push(
      <div
        key={dotIndex++}
        className="loading-orb-dot"
        style={{
          transform: `rotateX(-90deg) translateZ(${radius}px)`,
          opacity: 0.7,
        }}
      />
    );

    return dotsArray;
  }, []);

  return (
    <div className="loading-orb-container">
      <div className="loading-orb-scale-wrapper">
        <div className="loading-orb">
          {dots}
        </div>
        {showScore && (
          <div
            className={`loading-orb-score ${isPulsing ? 'pulsing' : ''} ${onScoreClick && isClickable ? 'clickable' : ''}`}
            onClick={onScoreClick && isClickable ? onScoreClick : undefined}
            role={onScoreClick ? 'button' : undefined}
            tabIndex={onScoreClick && isClickable ? 0 : undefined}
            onKeyDown={onScoreClick && isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onScoreClick(); } : undefined}
          >
            {(score ?? 0).toLocaleString()}
          </div>
        )}
        {!showScore && label && (
          <div className="loading-orb-label">{label}</div>
        )}
      </div>
    </div>
  );
}
