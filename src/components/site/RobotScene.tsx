import { themeColor } from "@/lib/theme";
"use client";

import { ContactShadows, useProgress } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { codePanel } from "./holoPanels";
import { Crate, GamingLaptop, HoloPanels, Motes, NeonFloor } from "./HoloProps";
import { type Drive, K2SO, KEYS } from "./K2SO";
import { Precompile } from "./Precompile";

/** Drag-to-orbit state: extra yaw/pitch (rad) on top of the home view, their velocities, and when the drag ended. */
export type Orbit = { yaw: number; pitch: number; vYaw: number; vPitch: number; dragging: boolean; releasedAt: number };
export type RobotInput = { x: number; y: number; hover: boolean; waveAt: number; orbit: Orbit };
type Input = React.RefObject<RobotInput>;

// Where the head looks while typing: the upper half of the laptop screen (lid hinged ~0.3 past the keys, tilted back),
// so the head stays up and the eyes show instead of staring down at the keys.
const SCREEN = new THREE.Vector3(KEYS.x, KEYS.y + 0.4, KEYS.z + 0.45);

// The camera orbits TARGET; HOME is the normal view it glides back to.
const TARGET = new THREE.Vector3(0, 1.42, 0.15);
const HOME = new THREE.Vector3(1.45, 2.15, 6.6);
const RADIUS = HOME.distanceTo(TARGET);
const HOME_AZ = Math.atan2(HOME.x - TARGET.x, HOME.z - TARGET.z);
const HOME_EL = Math.asin((HOME.y - TARGET.y) / RADIUS);
const RETURN_AFTER = 2.5; // seconds after letting go before the view glides home
const PITCH_MIN = -0.2; // keeps the camera above the floor
const PITCH_MAX = 0.55;

/** Turns pointer input into the droid's drive (look point, typing vs attention, wave) and moves the camera: a gentle sway, or an orbit while you drag, with momentum and a glide back home. */
function Director({ input, drive, heat }: { input: Input; drive: React.RefObject<Drive>; heat: React.RefObject<number> }) {
  const attention = useRef(0);
  useFrame((state, dt) => {
    const p = input.current;
    const d = drive.current;
    if (!p || !d) return;
    const t = state.clock.elapsedTime;
    d.t = t;
    const since = performance.now() / 1000 - p.waveAt;
    d.wave = p.waveAt > 0 && since < 2 ? since / 2 : -1;
    attention.current += ((p.hover || d.wave >= 0 ? 1 : 0) - attention.current) * Math.min(1, dt * 3);
    d.typing = 1 - attention.current;
    heat.current = 0.35 + attention.current * 0.65;
    // the cursor, projected to a plane in front of the droid
    const cursor = new THREE.Vector3(p.x * 2.6, 2.3 + p.y * 1.4, 4);
    d.look.copy(SCREEN).lerp(cursor, attention.current * 0.9);
    d.look.x += Math.sin(t * 0.5) * 0.08 * d.typing; // glancing along the screen
    // camera: orbit while dragging; afterwards drift on momentum, then glide back to the home view
    const o = p.orbit;
    if (!o.dragging) {
      o.yaw += o.vYaw * dt;
      o.pitch += o.vPitch * dt;
      const friction = Math.exp(-dt * 3.5);
      o.vYaw *= friction;
      o.vPitch *= friction;
      if (performance.now() / 1000 - o.releasedAt > RETURN_AFTER) {
        o.yaw = Math.atan2(Math.sin(o.yaw), Math.cos(o.yaw)); // the short way round
        const k = Math.min(1, dt * 2.4);
        o.yaw -= o.yaw * k;
        o.pitch -= o.pitch * k;
        o.vYaw *= 1 - k;
        o.vPitch *= 1 - k;
      }
    }
    o.pitch = THREE.MathUtils.clamp(o.pitch, PITCH_MIN, PITCH_MAX);
    const sway = o.dragging ? 0 : 1;
    const az = HOME_AZ + o.yaw + (p.x * 0.07 + Math.sin(t * 0.2) * 0.03) * sway;
    const el = HOME_EL + o.pitch + p.y * 0.03 * sway;
    const want = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(RADIUS).add(TARGET);
    const cam = state.camera;
    cam.position.lerp(want, Math.min(1, dt * (o.dragging ? 12 : 4)));
    cam.lookAt(TARGET);
  });
  return null;
}

export default function RobotScene({ input, active }: { input: Input; active: boolean }) {
  const drive = useRef<Drive>({ look: SCREEN.clone(), typing: 1, wave: -1, t: 0 });
  const heat = useRef(0.35);
  const screen = useMemo(codePanel, []);
  const { progress, active: loading } = useProgress();
  return (
    <>
    <Canvas camera={{ position: [HOME.x, HOME.y, HOME.z], fov: 30 }} dpr={[1, 1.5]} frameloop={active ? "always" : "never"} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.25} />
      <hemisphereLight args={[themeColor("--holo-sky"), themeColor("--robot-ground"), 0.5]} />
      <directionalLight position={[2, 5, 6]} intensity={1.4} />
      <directionalLight position={[-4, 3, -3]} intensity={2.2} color={themeColor("--accent")} />
      <directionalLight position={[4, 2, -3]} intensity={2.6} color={themeColor("--holo-cyan")} />
      <Crate />
      <GamingLaptop screen={screen.tex} />
      <HoloPanels heat={heat} screen={screen} />
      <NeonFloor />
      <Motes />
      <Suspense fallback={null}>
        <K2SO drive={drive} />
        {/* Mounts with the model, drawn once: the seated droid's feet and crate barely move, and re-rendering the
            whole scene plus two blur passes every frame was a large share of this card's cost. */}
        <ContactShadows position={[0, 0, 0]} opacity={0.6} scale={8} blur={2.4} far={3} frames={1} />
        <Precompile />
      </Suspense>
      <Director input={input} drive={drive} heat={heat} />
    </Canvas>
    {loading || progress < 100 ? <span className="robot-boot" aria-hidden="true">BOOTING K-2SO… {Math.round(progress)}%</span> : null}
    </>
  );
}
