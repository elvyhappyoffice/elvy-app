"use client";

import { useEffect, useState, type CSSProperties } from "react";
import ElvyTorso, {
  type MouthState,
} from "@/components/elvy/studio/ElvyTorso";
import type { ElvyAnimationState } from "./types";

type ElvyAvatarProps = {
  state: ElvyAnimationState;
  keyboardOpen: boolean;
  speechMouth?: MouthState;
  src?: string;
  alt?: string;
};

export default function ElvyAvatar({
  state,
  speechMouth = "closed-smile",
  alt = "Elvy",
}: ElvyAvatarProps) {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let closeTimer: number | undefined;
    const blinkTimer = window.setInterval(() => {
      setIsBlinking(true);
      closeTimer = window.setTimeout(() => setIsBlinking(false), 120);
    }, 3200);

    return () => {
      window.clearInterval(blinkTimer);
      if (closeTimer) window.clearTimeout(closeTimer);
    };
  }, []);

  const frameStyle: CSSProperties = {
    width: "min(29vw, 125px)",
    height: "min(53.5vw, 230px)",
    right: "min(5.8vw, 25px)",
    top: "min(34vw, 146px)",
    transformOrigin: "50% 50%",
  };

  const imageStyle: CSSProperties = {
    width: "100%",
    height: "auto",
    left: "50%",
    top: "25%",
    transform: "translateX(-50%) scale(0.96)",
    transformOrigin: "50% 0%",
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-live="polite">
      <div
        className={`elvy-frame elvy-frame--${state}`}
        style={frameStyle}
        data-elvy-state={state}
      >
        <div
          role="img"
          aria-label={alt}
          className="elvy-avatar-rig"
          style={imageStyle}
        >
          <ElvyTorso
            animationState="neutral"
            eyelidState={isBlinking ? "closed" : "open"}
            eyebrowState={state === "speaking" ? "raised" : "neutral"}
            mouthState={
              state === "speaking" ? speechMouth : "closed-smile"
            }
            leftShoulderAngle={-9}
            rightShoulderAngle={7}
          />
        </div>
      </div>

      <style jsx>{`
        .elvy-frame {
          position: absolute;
          z-index: 2;
          overflow: hidden;
          will-change: transform, filter;
          filter: none;
        }

        .elvy-avatar-rig {
          position: absolute;
          display: block;
          user-select: none;
        }

        .elvy-avatar-rig :global([data-component="elvy-rig"]) {
          width: 100%;
        }

        .elvy-shadow {
          position: absolute;
          z-index: 1;
          border-radius: 9999px;
          background: rgba(35, 20, 10, 0.23);
          filter: blur(4px);
          transform: translateX(2%) scaleX(1);
          transform-origin: center;
          will-change: transform, opacity;
        }

        .elvy-frame--idle {
          animation: elvyIdle 4s ease-in-out infinite;
        }

        .elvy-frame--listening {
          animation: elvyListening 1.8s ease-in-out infinite;
        }

        .elvy-frame--thinking {
          animation: elvyThinking 2.2s ease-in-out infinite;
        }

        .elvy-frame--speaking {
          animation: none;
        }

        .elvy-frame--celebrating {
          animation: elvyCelebrate 0.72s ease-out 2;
        }

        .elvy-frame--pointing {
          animation: elvyPointing 1.6s ease-in-out infinite;
        }

        .elvy-shadow--idle {
          animation: shadowIdle 4s ease-in-out infinite;
        }

        .elvy-shadow--listening,
        .elvy-shadow--thinking {
          transform: translateX(2%) scaleX(0.98);
        }

        .elvy-shadow--pointing {
          transform: translateX(-4%) scaleX(1.02);
        }

        .elvy-shadow--speaking {
          animation: shadowSpeaking 0.9s ease-in-out infinite;
        }

        .elvy-shadow--celebrating {
          animation: shadowCelebrate 0.72s ease-out 2;
        }

        @keyframes elvyIdle {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.008, 1.012) rotate(0.25deg); }
        }

        @keyframes elvyListening {
          0%, 100% { transform: rotate(-0.7deg) scale(1); }
          50% { transform: rotate(-1.4deg) scale(1.012); }
        }

        @keyframes elvyThinking {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(1.2deg) scale(0.997, 1.008); }
        }

        @keyframes elvySpeaking {
          0%, 100% { transform: rotate(-0.25deg) scale(1); }
          50% { transform: rotate(0.35deg) scale(1.012, 1.006); }
        }

        @keyframes elvyCelebrate {
          0% { transform: scale(1) rotate(0deg); }
          35% { transform: scale(1.035, 0.98) rotate(-1deg); }
          65% { transform: scale(0.99, 1.035) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        @keyframes elvyPointing {
          0%, 100% { transform: translateX(0) rotate(0deg) scale(1); }
          50% { transform: translateX(-3%) rotate(-1deg) scale(1.008); }
        }

        @keyframes shadowIdle {
          0%, 100% { transform: translateX(2%) scaleX(1); opacity: 0.9; }
          50% { transform: translateX(2%) scaleX(1.025); opacity: 0.82; }
        }

        @keyframes shadowSpeaking {
          0%, 100% { transform: translateX(2%) scaleX(1); opacity: 0.9; }
          50% { transform: translateX(2%) scaleX(1.04); opacity: 0.8; }
        }

        @keyframes shadowCelebrate {
          0%, 100% { transform: translateX(2%) scaleX(1); opacity: 0.9; }
          50% { transform: translateX(2%) scaleX(1.1); opacity: 0.72; }
        }

        @media (prefers-reduced-motion: reduce) {
          .elvy-frame,
          .elvy-shadow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
