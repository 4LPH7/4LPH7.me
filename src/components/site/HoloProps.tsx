"use client";
import { themeColor } from "@/lib/theme";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type Panel, radarPanel, rainPanel, terminalPanel } from "./holoPanels";
import { KEYS } from "./K2SO";

/** Props for the K-2SO scene, in the model's units: crate seat, gaming laptop, hologram panels, neon floor, motes. */

const neon = (color: string) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

/** ROG-style "eye" emblem, white with a cool glow, for the laptop lid. */
function rogLogo() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = themeColor("--holo-white");
    g.shadowColor = themeColor("--holo-sky");
    g.shadowBlur = 16;
    g.translate(256, 128);
    // upper blade sweeping up to a sharp point on the right
    g.beginPath();
    g.moveTo(-150, 20);
    g.quadraticCurveTo(-60, -80, 70, -60);
    g.lineTo(152, -30);
    g.quadraticCurveTo(40, -42, -40, -8);
    g.closePath();
    g.fill();
    // lower blade
    g.beginPath();
    g.moveTo(-122, 42);
    g.quadraticCurveTo(-10, 80, 132, 22);
    g.quadraticCurveTo(10, 52, -60, 32);
    g.closePath();
    g.fill();
    // iris: a slanted diamond
    g.beginPath();
    g.moveTo(-6, -24);
    g.lineTo(40, -6);
    g.lineTo(10, 24);
    g.lineTo(-36, 6);
    g.closePath();
    g.fill();
    tex.needsUpdate = true;
  };
  draw();
  return tex;
}
const LEDS = Array.from({ length: 8 }, (_, n) => ({ id: `led-${n}`, n, at: [-0.38 + (n % 4) * 0.08, -0.25 - Math.floor(n / 4) * 0.08, 0.412] as [number, number, number] }));

/** Dark metal crate the droid sits on: neon edges and blinking server LEDs. */
export function Crate() {
  const leds = useRef<THREE.Mesh[]>([]);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: themeColor("--holo-metal"), metalness: 0.7, roughness: 0.38 }), []);
  const edge = useMemo(() => neon(themeColor("--holo-cyan")), []); // made once: an inline neon() leaked new materials on every re-render
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    leds.current.forEach((m, i) => {
      const on = Math.sin(t * (2 + (i % 3)) + i * 1.7) > 0.2;
      (m.material as THREE.MeshBasicMaterial).color.set(on ? (i % 4 === 0 ? themeColor("--holo-white") : themeColor("--holo-cyan")) : themeColor("--holo-dim"));
    });
  });
  return (
    <group position={[0, 0.5, -0.14]}>
      <mesh material={metal} castShadow receiveShadow><boxGeometry args={[1.1, 1, 0.82]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.55 * s, 0, 0.41]} material={edge}><boxGeometry args={[0.012, 1, 0.012]} /></mesh>
      ))}
      <mesh position={[0, 0.5, 0.41]} material={edge}><boxGeometry args={[1.1, 0.012, 0.012]} /></mesh>
      {LEDS.map((led) => (
        <mesh key={led.id} ref={(m) => { if (m) leds.current[led.n] = m; }} position={led.at}>
          <boxGeometry args={[0.035, 0.02, 0.005]} />
          <meshBasicMaterial color={themeColor("--holo-cyan")} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const KEYBOARD_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const KEYBOARD_FRAG = `
uniform float uTime; varying vec2 vUv;
void main() {
  vec2 grid = vec2(15.0, 5.0);
  vec2 cell = fract(vUv * grid);
  float key = step(0.12, cell.x) * step(cell.x, 0.88) * step(0.16, cell.y) * step(cell.y, 0.84);
  vec2 id = floor(vUv * grid);
  float press = step(0.93, fract(sin(dot(id, vec2(12.9898, 78.233)) + floor(uTime * 9.0)) * 43758.5453));
  vec3 rgb = vec3(0.35, 0.85, 1.0) * (0.45 + 0.2 * sin(vUv.x * 6.0 - uTime * 1.6)) + vec3(0.9) * press;
  gl_FragColor = vec4(mix(vec3(0.02), rgb, key), 1.0);
}`;

/** Gaming laptop on the droid's lap: RGB keys, RGB-lit lid with a glowing logo, live code facing the droid. */
export function GamingLaptop({ screen }: { screen: THREE.Texture }) {
  const keys = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: KEYBOARD_VERT, fragmentShader: KEYBOARD_FRAG, toneMapped: false }), []);
  const rgb = useMemo(() => new THREE.MeshBasicMaterial({ color: themeColor("--holo-cyan"), toneMapped: false }), []);
  const logo = useMemo(() => new THREE.MeshBasicMaterial({ map: rogLogo(), transparent: true, depthWrite: false, toneMapped: false }), []);
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: themeColor("--holo-shell"), metalness: 0.8, roughness: 0.3 }), []);
  useFrame(({ clock }) => {
    keys.uniforms.uTime.value = clock.elapsedTime;
    rgb.color.setHSL(0.53, 0.85, 0.48 + Math.sin(clock.elapsedTime * 1.8) * 0.08);
    logo.color.setScalar(0.85 + Math.sin(clock.elapsedTime * 1.8) * 0.15);
  });
  const top = KEYS.y;
  return (
    <group position={[KEYS.x, top, KEYS.z + 0.04]} scale={0.85}>
      <mesh material={shell} position={[0, -0.022, 0]} castShadow><boxGeometry args={[1.02, 0.045, 0.64]} /></mesh>
      <mesh material={keys} position={[0, 0.0015, -0.05]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.9, 0.3]} /></mesh>
      <mesh material={rgb} position={[0, -0.022, 0.322]}><boxGeometry args={[1.02, 0.008, 0.004]} /></mesh>
      {/* lid: hinged at the far edge, screen faces the droid, logo faces you */}
      <group position={[0, 0, 0.31]} rotation-x={0.36}>
        <mesh material={shell} position={[0, 0.31, 0]}><boxGeometry args={[1.02, 0.62, 0.028]} /></mesh>
        <mesh position={[0, 0.31, -0.0145]} rotation-y={Math.PI}><planeGeometry args={[0.94, 0.54]} /><meshBasicMaterial map={screen} toneMapped={false} /></mesh>
        <mesh material={rgb} position={[0, 0.615, 0.015]}><boxGeometry args={[1.02, 0.01, 0.004]} /></mesh>
        <mesh position={[0, 0.32, 0.0147]} material={logo}><planeGeometry args={[0.46, 0.23]} /></mesh>
        <pointLight position={[0, 0.3, -0.5]} color={themeColor("--holo-teal")} intensity={2.2} distance={3} decay={1.6} />
      </group>
    </group>
  );
}

/** One floating hologram: additive light, bobbing, redrawn about 12 times a second. */
function Holo({ panel, size, heat, ...rest }: { panel: Panel; size: [number, number]; heat: React.RefObject<number> } & React.ComponentProps<"group">) {
  const acc = useRef(0);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current < 0.08) return;
    acc.current = 0;
    panel.draw(clock.elapsedTime, heat.current ?? 0);
  });
  return (
    <group {...rest}>
      <Float speed={1.4} rotationIntensity={0.18} floatIntensity={0.5}>
        <mesh>
          <planeGeometry args={size} />
          <meshBasicMaterial map={panel.tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </Float>
    </group>
  );
}

/** The ring of panels: terminal, code hologram, radar and glyph rain. `heat` brightens them (typing / attention). */
export function HoloPanels({ heat, screen }: { heat: React.RefObject<number>; screen: Panel }) {
  const panels = useMemo(() => ({ term: terminalPanel(), radar: radarPanel(), rain: rainPanel() }), []);
  return (
    <>
      <Holo panel={panels.term} size={[1.3, 0.91]} heat={heat} position={[-1.95, 2.35, 0.3]} rotation-y={0.55} />
      <Holo panel={screen} size={[1.15, 0.86]} heat={heat} position={[1.1, 2.72, -0.95]} rotation-y={-0.3} />
      <Holo panel={panels.radar} size={[0.7, 0.7]} heat={heat} position={[1.7, 1.75, 0.3]} rotation-y={-0.5} />
      <Holo panel={panels.rain} size={[0.62, 1.08]} heat={heat} position={[-1.45, 1.05, -0.95]} rotation-y={0.3} />
    </>
  );
}

const FLOOR_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main() {
  vec2 p = (vUv - 0.5) * 14.0;
  vec2 g = abs(fract(p * 2.0) - 0.5) / fwidth(p * 2.0);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float fade = smoothstep(6.5, 0.5, length(p));
  float pulse = 0.6 + 0.4 * sin(length(p) * 3.0 - uTime * 2.0);
  vec3 col = vec3(0.13, 0.75, 0.9);
  float glow = smoothstep(2.2, 0.0, length(p)) * 0.25;
  gl_FragColor = vec4(col * (line * 0.4 * pulse + glow), (line * 0.4 + glow) * fade);
}`;

/** Neon grid floor that fades out, with a glow under the droid. */
export function NeonFloor() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: KEYBOARD_VERT, fragmentShader: FLOOR_FRAG, transparent: true, depthWrite: false, toneMapped: false }), []);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
  return <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}><planeGeometry args={[14, 14]} /></mesh>;
}

/** Slowly rising data motes. */
export function Motes({ count = 90 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    const cyan = new THREE.Color(themeColor("--holo-cyan")), white = new THREE.Color(themeColor("--holo-glow"));
    for (let i = 0; i < count; i++) {
      p.set([(Math.random() - 0.5) * 5, Math.random() * 3.6, (Math.random() - 0.5) * 3 - 0.4], i * 3);
      (i % 3 ? cyan : white).toArray(c, i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) { let y = a.getY(i) + dt * (0.12 + (i % 5) * 0.03); if (y > 3.6) y = 0; a.setY(i, y); }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.035} vertexColors transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </points>
  );
}
