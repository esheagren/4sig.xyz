import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Simplified phases: removed showOrb and scoreReveal for progressive score reveal
type AnimationPhaseName = 'idle' | 'fadeOut' | 'reveal';

interface AnimationContextType {
  animationPhase: AnimationPhaseName;
  triggerRevealAnimation: () => Promise<void>;
  isAnimating: boolean;
}

const AnimationContext = createContext<AnimationContextType | null>(null);

export function useAnimation() {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
}

// Phase durations in milliseconds (simplified for progressive reveal)
const PHASE_DURATIONS = {
  fadeOut: 300,
  reveal: 400,
};

// Helper to wait for a duration
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AnimationProviderProps {
  children: ReactNode;
}

export function AnimationProvider({ children }: AnimationProviderProps) {
  const [animationPhase, setAnimationPhase] = useState<AnimationPhaseName>('idle');

  const isAnimating = animationPhase !== 'idle';

  const triggerRevealAnimation = useCallback(async (): Promise<void> => {
    // Phase 1: Fade Out (300ms) - QuestionCard fades
    setAnimationPhase('fadeOut');
    await wait(PHASE_DURATIONS.fadeOut);

    // Phase 2: Reveal (400ms) - Results carousel appears, orb shows at top-right
    // Score starts at 0 and builds progressively as user scrolls through questions
    setAnimationPhase('reveal');
    await wait(PHASE_DURATIONS.reveal);

    // Return to idle
    setAnimationPhase('idle');

    // Total time: 300 + 400 = 700ms
  }, []);

  const value: AnimationContextType = {
    animationPhase,
    triggerRevealAnimation,
    isAnimating,
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
}
