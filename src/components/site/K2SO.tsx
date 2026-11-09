import { themeColor } from "@/lib/theme";
"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { Followers, RestPose, aim, point, pos, reach, shift, turn } from "./k2soRig";

/*
 * K-2SO droid by Oscar Creativo (https://sketchfab.com/oscar_creativo), CC BY 4.0, optimised from robot.glb.
 * Units are the model's own (about 3.15 tall standing, facing +Z); the scene is built around that.
 */
export const K2SO_URL = "/models/k2so.glb";

export type Drive = {
  /** World point the head looks at. */
  look: THREE.Vector3;
  /** 0..1: typing (1) vs sitting back to look at you (0). */
  typing: number;
  /** 0..1 progress of a wave with the right hand, or -1 when not waving. */
  wave: number;
  t: number;
};

export const SEAT_DROP = 0.74; // how far the hips drop from standing to sitting
export const KEYS = new THREE.Vector3(0, 1.27, 0.62); // centre of the laptop keyboard
const FINGERS = ["Thumb", "Index", "Mid", "Ring", "Pinky"] as const;

const X = new THREE.Vector3(1, 0, 0);
const axisTurn = (axis: THREE.Vector3, angle: number) => new THREE.Quaternion().setFromAxisAngle(axis, angle);

/** Soft round glow (white core, cyan halo) for the eye sprites. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(125,249,255,0.9)");
  r.addColorStop(1, "rgba(34,211,238,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function useRig(scene: THREE.Group) {
  return useMemo(() => {
    const find = (prefix: string) => {
      let hit: THREE.Object3D | undefined;
      scene.traverse((o) => { if (!hit && new RegExp(`^${prefix}_\\d+$`).test(o.name)) hit = o; });
      if (!hit) throw new Error(`K-2SO rig: no bone ${prefix}`);
      return hit;
    };
    const side = (s: "l" | "r") => ({
      thigh: find(`${s}_thigh`), knee: find(`${s}_knee`), ankle: find(`${s}_ankle`), ball: find(`${s}_ball`),
      clav: find(`${s}_clav`), shoulder: find(`${s}_shoulder`), elbow: find(`${s}_elbow`), wrist: find(`${s}_wrist`),
      fingers: FINGERS.map((f) => ["A", "B", "C", "CEnd"].map((k) => find(`${s}_fin${f}${k}`))),
      sign: s === "l" ? 1 : -1,
    });
    scene.updateMatrixWorld(true);
    const rig = {
      hip: find("hip"), spineB: find("spineB"), spineD: find("spineD"), neckA: find("neckA"), head: find("head"),
      eyes: [find("l_eye"), find("r_eye")], l: side("l"), r: side("r"),
      rest: new RestPose(scene), follow: new Followers(),
    };
    // Pistons ride partly with the limb they join (see Followers).
    scene.traverse((o) => {
      const m = /^([lr])_(hip|shoulder)Piston_[A-P]_\d+$/.exec(o.name);
      if (!m) return;
      const s = rig[m[1] as "l" | "r"];
      rig.follow.add(o, m[2] === "hip" ? s.thigh : s.shoulder, m[2] === "hip" ? 0.7 : 0.6);
    });
    const glow: { m: THREE.MeshStandardMaterial; base: number }[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // skinned bounds don't follow the pose
      mesh.castShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.emissiveMap && !glow.some((g) => g.m === m)) {
        m.emissive.set(themeColor("--k2so-emissive")); // cyberpunk cyan instead of white
        glow.push({ m, base: Math.max(1, m.emissiveIntensity) });
      }
    });
    // Eye glows: sprites kept just in front of each eye bone so the eyes read clearly at card size.
    const eyeMat = new THREE.SpriteMaterial({ map: glowTexture(), color: themeColor("--k2so-eye"), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const eyeGlow = [new THREE.Sprite(eyeMat), new THREE.Sprite(eyeMat)];
    return { ...rig, glow, eyeMat, eyeGlow };
  }, [scene]);
}

/** The droid, posed every frame: seated, leaning in to type while watching the screen; it can look up at you and wave. */
export function K2SO({ drive }: { drive: React.RefObject<Drive> }) {
  const { scene } = useGLTF(K2SO_URL, false, true);
  const rig = useRig(scene);

  useFrame(() => {
    const d = drive.current;
    if (!d) return;
    const { l, r } = rig;
    const t = d.t;
    rig.rest.reset(scene);

    // Sit: drop the hips onto the seat (with a slow breath), plant the feet.
    shift(rig.hip, new THREE.Vector3(0, -SEAT_DROP + Math.sin(t * 1.4) * 0.006, 0.02));
    for (const s of [l, r]) {
      const foot = new THREE.Vector3(0.3 * s.sign, 0.21, 0.82);
      reach(s.thigh, s.knee, s.ankle, foot, new THREE.Vector3(0.45 * s.sign, 1.6, 2.4));
      point(s.ankle, s.ball, new THREE.Vector3(0.05 * s.sign, -0.18, 1));
    }

    // Hunch over the laptop; straighten a little when looking up.
    const hunch = 0.04 + 0.06 * d.typing;
    turn(rig.spineB, axisTurn(X, hunch));
    turn(rig.spineD, axisTurn(X, hunch * 0.8));

    // Head: toward the look point (screen or cursor), split between neck and head.
    const eyes = pos(rig.eyes[0]).add(pos(rig.eyes[1])).multiplyScalar(0.5);
    const fwd = eyes.clone().sub(pos(rig.head));
    const want = d.look.clone().sub(pos(rig.head));
    aim(rig.neckA, fwd, want, 0.3);
    const fwd2 = pos(rig.eyes[0]).add(pos(rig.eyes[1])).multiplyScalar(0.5).sub(pos(rig.head));
    aim(rig.head, fwd2, want, 0.9);

    // Arms: hands on the keys, tapping; the right one waves when asked.
    for (const s of [l, r]) {
      const k = s.sign;
      const phase = t * 11 + (k > 0 ? 0 : 1.7);
      const tap = Math.max(0, Math.sin(phase)) * 0.025 * d.typing;
      const drift = Math.sin(t * 1.3 + k) * 0.03 * d.typing;
      const resting = new THREE.Vector3(0.17 * k + drift, KEYS.y + 0.1 + tap, KEYS.z - 0.2);
      // looking up: hands slide back toward the lap edge
      resting.lerp(new THREE.Vector3(0.22 * k, KEYS.y + 0.06, KEYS.z - 0.32), 1 - d.typing);
      let target = resting;
      if (k < 0 && d.wave >= 0) {
        const up = Math.sin(Math.min(1, d.wave * 3) * Math.PI * 0.5) * (1 - Math.max(0, d.wave - 0.8) * 5);
        const raised = new THREE.Vector3(-0.95 + Math.sin(t * 12) * 0.14, 2.5, 0.55); // low enough that the elbow bends
        target = resting.clone().lerp(raised, up);
      }
      reach(s.shoulder, s.elbow, s.wrist, target, new THREE.Vector3(1.4 * k, 1.1, -0.6));
      const waving = k < 0 && d.wave >= 0;
      const handDir = waving ? new THREE.Vector3(-0.2, 1, 0.15) : new THREE.Vector3(-0.08 * k, -0.42, 1);
      point(s.wrist, s.fingers[2][0], handDir);

      // Fingers: curl toward the keys and tap in turn (open while waving).
      const down = waving ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, -1, 0);
      s.fingers.forEach((chain, f) => {
        const base = f === 0 ? 0.25 : 0.32;
        const press = waving ? 0 : Math.max(0, Math.sin(phase * 0.5 + f * 1.3)) * 0.35 * d.typing;
        for (let j = 0; j < 3; j++) {
          const curl = (base + press) * (j + 1) * (waving ? 0.2 : 1);
          const dir = handDir.clone().normalize().multiplyScalar(Math.cos(curl)).addScaledVector(down, Math.sin(curl));
          point(chain[j], chain[j + 1], dir);
        }
      });
    }

    rig.follow.apply();

    // Eyes and lights: a scan flicker every few seconds, brighter when it looks at you.
    const flicker = Math.sin(t * 0.9) > 0.985 ? 0.25 : 1;
    for (const g of rig.glow) g.m.emissiveIntensity = g.base * (2.2 + (1 - d.typing) * 1.2) * flicker;
    const face = pos(rig.eyes[0]).add(pos(rig.eyes[1])).multiplyScalar(0.5).sub(pos(rig.head)).normalize();
    rig.eyeGlow.forEach((sprite, i) => {
      sprite.position.copy(pos(rig.eyes[i])).addScaledVector(face, 0.05);
      sprite.scale.setScalar(0.075 + (1 - d.typing) * 0.02); // the eyes are ~0.13 apart; keep the glows separate
    });
    rig.eyeMat.opacity = (0.85 + (1 - d.typing) * 0.15) * flicker;
  });

  return (
    <>
      <primitive object={scene} />
      {rig.eyeGlow.map((sprite, i) => <primitive key={i === 0 ? "eye-l" : "eye-r"} object={sprite} />)}
    </>
  );
}
