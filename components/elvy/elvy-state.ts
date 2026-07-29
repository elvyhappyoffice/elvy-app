import type { ElvyAnimationState } from "./types";

type ResolveElvyStateOptions = {
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  isCelebrating?: boolean;
  isPointing?: boolean;
};

export function resolveElvyState({
  isSpeaking,
  isListening,
  isThinking,
  isCelebrating = false,
  isPointing = false,
}: ResolveElvyStateOptions): ElvyAnimationState {
  if (isCelebrating) {
    return "celebrating";
  }

  if (isPointing) {
    return "pointing";
  }

  if (isSpeaking) {
    return "speaking";
  }

  if (isListening) {
    return "listening";
  }

  if (isThinking) {
    return "thinking";
  }

  return "idle";
}