"use client";

import type { CSSProperties } from "react";
import styles from "./ElvyTorso.module.css";

export type EyeDirection = "neutral" | "left" | "right" | "up" | "down";
export type EyelidState = "open" | "half" | "closed";
export type EyebrowState = "neutral" | "raised" | "lowered" | "concerned";
export type MouthState =
  | "neutral"
  | "smile"
  | "closed-smile"
  | "open"
  | "wide-open"
  | "a-e"
  | "o"
  | "u"
  | "m-b-p"
  | "laugh";
export type HandState =
  | "relaxed"
  | "open"
  | "pointing"
  | "waving"
  | "fist"
  | "clapping";
export type AnimationState = "neutral" | "idle" | "speaking" | "listening";

export type ElvyTorsoProps = {
  className?: string;
  eyeDirection?: EyeDirection;
  eyelidState?: EyelidState;
  eyebrowState?: EyebrowState;
  mouthState?: MouthState;
  leftHand?: HandState;
  rightHand?: HandState;
  animationState?: AnimationState;
  leftShoulderAngle?: number;
  rightShoulderAngle?: number;
};

const ROOT = "/elvy/studio";

function part(src: string, className: string, alt = "") {
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={`${styles.part} ${className}`}
    />
  );
}

type JointStyle = CSSProperties & { "--joint-angle": string };

function jointStyle(angle: number, limit = 25): JointStyle {
  const safeAngle = Math.max(-limit, Math.min(limit, angle));
  return { "--joint-angle": `${safeAngle}deg` };
}

export default function ElvyTorso({
  className = "",
  eyeDirection = "neutral",
  eyelidState = "open",
  eyebrowState = "neutral",
  mouthState = "smile",
  leftHand: _leftHand = "relaxed",
  rightHand: _rightHand = "relaxed",
  animationState = "neutral",
  leftShoulderAngle = 0,
  rightShoulderAngle = 0,
}: ElvyTorsoProps) {
  const gaze = eyeDirection === "neutral" ? "neutral" : `look-${eyeDirection}`;

  return (
    <div className={`${styles.root} ${className}`} data-component="elvy-rig" data-animation-state={animationState}>
      {part(`${ROOT}/rig/body/legs/left/leg-left-upper.png`, styles.leftLeg)}
      {part(`${ROOT}/rig/body/legs/left/leg-left-lower.png`, styles.leftLeg)}
      {part(`${ROOT}/rig/body/legs/left/shoe-left.png`, styles.leftShoe)}
      {part(`${ROOT}/rig/body/legs/right/leg-right-upper.png`, styles.rightLeg)}
      {part(`${ROOT}/rig/body/legs/right/leg-right-lower.png`, styles.rightLeg)}
      {part(`${ROOT}/rig/body/legs/right/shoe-right.png`, styles.rightShoe)}
      <div className={`${styles.jointLayer} ${styles.leftShoulder}`} data-anchor="left-shoulder" style={jointStyle(leftShoulderAngle, 11)}>
        {part(`${ROOT}/rig/body/arms/left/arm-left-upper.png`, styles.upperArm)}
        <div className={`${styles.jointLayer} ${styles.leftElbow}`} data-anchor="left-elbow" style={jointStyle(0)}>
          {part(`${ROOT}/rig/body/arms/left/arm-left-forearm.png`, styles.forearm)}
          <div className={`${styles.jointLayer} ${styles.leftWrist}`} data-anchor="left-wrist" style={jointStyle(0)}>
            {part(`${ROOT}/rig/body/arms/left/hand-left-relaxed.png`, styles.hand)}
          </div>
        </div>
      </div>
      <div className={`${styles.jointLayer} ${styles.rightShoulder}`} data-anchor="right-shoulder" style={jointStyle(rightShoulderAngle, 11)}>
        {part(`${ROOT}/rig/body/arms/right/arm-right-upper.png`, styles.upperArm)}
        <div className={`${styles.jointLayer} ${styles.rightElbow}`} data-anchor="right-elbow" style={jointStyle(0)}>
          {part(`${ROOT}/rig/body/arms/right/arm-right-forearm.png`, styles.forearm)}
          <div className={`${styles.jointLayer} ${styles.rightWrist}`} data-anchor="right-wrist" style={jointStyle(0)}>
            {part(`${ROOT}/rig/body/arms/right/hand-right-relaxed.png`, styles.hand)}
          </div>
        </div>
      </div>
      {part(`${ROOT}/rig/elvy-central-base.png`, styles.central, "Elvy")}

      {/* Face layer: all anchors are measured from the canonical central canvas. */}
      {part(`${ROOT}/rig/face/eye-left-${gaze}.png`, styles.leftEye)}
      {part(`${ROOT}/rig/face/eye-right-${gaze}.png`, styles.rightEye)}
      {eyelidState !== "open" &&
        part(`${ROOT}/rig/face/eyelid-left-${eyelidState}.png`, styles.leftEyelid)}
      {eyelidState !== "open" &&
        part(`${ROOT}/rig/face/eyelid-right-${eyelidState}.png`, styles.rightEyelid)}
      {part(`${ROOT}/rig/face/eyebrow-left-${eyebrowState}.png`, styles.leftEyebrow)}
      {part(`${ROOT}/rig/face/eyebrow-right-${eyebrowState}.png`, styles.rightEyebrow)}
      {part(`${ROOT}/rig/face/mouth-${mouthState}.png`, styles.mouth)}
    </div>
  );
}
