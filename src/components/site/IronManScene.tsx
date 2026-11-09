"use client";
import { themeColor } from "@/lib/theme";

import { useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { snapPhase, type Stone, STONE_VAR, STONES } from "@/lib/snap";
import { Precompile } from "./Precompile";

/*
 * "Iron Man Mark 85" by LLIypuk (https://sketchfab.com/LLIypuk), CC BY 4.0, simplified from ironman.glb
 * (2.2M → 146k triangles, meshopt). Units are metres: about 1.79 tall, feet at y = 0, facing +Z, arms down.
 */
export const IRONMAN_URL = "/models/ironman.glb";

/** Pointer state from the card (x, y in -1..1), hover, and when the last snap was clicked (seconds, 0 = never). */
export type SnapInput = { x: number; y: number; hover: boolean; snapAt: number };
type Input = React.RefObject<SnapInput>;

/** The model's stone materials, matched to stones by their emissive colours in the source file. */
const STONE_MATERIAL: Record<string, Stone> = { material_9: "space", material_7: "reality", material_8: "power", material_6: "mind", material_5: "time", material_10: "soul" };
/** Arc reactor and eye glass. */
const ARC_MATERIALS = new Set(["material_3", "material_4"]);

const seconds = () => performance.now() / 1000;
const energyOf = (input: SnapInput | null) => {
  if (!input || input.snapAt <= 0) return { charge: 0, storm: 0, flash: 0, energy: 0 };
  const p = snapPhase(seconds() - input.snapAt);
  return { ...p, energy: Math.max(p.charge, p.storm) };
};
const stoneColors = () => STONES.map((s) => new THREE.Color(themeColor(STONE_VAR[s])));

/** Soft round glow (white core fading out) used for stone halos and embers; tinted by the material colour. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.3, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type StonePart = { stone: Stone; mat: THREE.MeshStandardMaterial; center: THREE.Vector3; halo: THREE.Sprite };
type Rig = { stones: StonePart[]; gauntlet: THREE.Vector3; chest: THREE.Vector3; bounds: THREE.Box3; arc: THREE.MeshStandardMaterial[]; halos: THREE.SpriteMaterial[] };

/** Finds the stones and arc reactor in the model, makes them glow, and works out where the gauntlet and chest are. */
function useRig(scene: THREE.Group): Rig {
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const boxes = new Map<Stone, { mat: THREE.MeshStandardMaterial; box: THREE.Box3 }>();
    const arc: THREE.MeshStandardMaterial[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      const stone = STONE_MATERIAL[m.name];
      if (stone) {
        const box = new THREE.Box3().setFromObject(mesh);
        const hit = boxes.get(stone);
        if (hit) hit.box.union(box);
        else boxes.set(stone, { mat: m, box });
      } else if (ARC_MATERIALS.has(m.name) && !arc.includes(m)) {
        m.emissive.set(themeColor("--arc-reactor"));
        m.toneMapped = false;
        arc.push(m);
      }
    });
    const tex = glowTexture();
    const halos: THREE.SpriteMaterial[] = [];
    const stones: StonePart[] = [...boxes].map(([stone, { mat, box }]) => {
      const color = new THREE.Color(themeColor(STONE_VAR[stone]));
      mat.emissive.copy(color);
      mat.toneMapped = false;
      const sm = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
      halos.push(sm);
      return { stone, mat, center: box.getCenter(new THREE.Vector3()), halo: new THREE.Sprite(sm) };
    });
    const height = bounds.max.y - bounds.min.y;
    // Fallback if the stones aren't found: the right hand at hip height.
    const gauntlet = stones.length
      ? stones.reduce((sum, s) => sum.add(s.center), new THREE.Vector3()).divideScalar(stones.length)
      : new THREE.Vector3(bounds.max.x * 0.95, bounds.min.y + height * 0.52, bounds.max.z * 0.5);
    const chest = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y + height * 0.75, bounds.max.z - 0.04);
    return { stones, gauntlet, chest, bounds, arc, halos };
  }, [scene]);
}

/** The suit, its glowing stones (pulsing, flaring through the charge and the storm) and the arc reactor. */
function Suit({ input, onRig }: { input: Input; onRig: (rig: Rig) => void }) {
  const { scene } = useGLTF(IRONMAN_URL, false, true);
  const rig = useRig(scene);
  useEffect(() => onRig(rig), [rig, onRig]);
  useEffect(() => () => { for (const m of rig.halos) { m.map?.dispose(); m.dispose(); } }, [rig]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = input.current;
    const { charge, storm, energy } = energyOf(p);
    const hover = p?.hover ? 1 : 0;
    rig.stones.forEach((s, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.1);
      s.mat.emissiveIntensity = 2.2 + pulse * 1.4 + hover * 1.2 + charge * 9 + storm * 6;
      s.halo.position.copy(s.center);
      s.halo.position.z += 0.02;
      s.halo.scale.setScalar(0.09 + pulse * 0.025 + hover * 0.03 + energy * 0.16);
      (s.halo.material as THREE.SpriteMaterial).opacity = 0.55 + pulse * 0.25 + energy * 0.2;
    });
    for (const m of rig.arc) m.emissiveIntensity = 2.5 + Math.sin(t * 3) * 0.3 + storm * 3;
  });
  return (
    <>
      <primitive object={scene} />
      {rig.stones.map((s) => <primitive key={s.stone} object={s.halo} />)}
    </>
  );
}

const BOLTS = 18;
const SEGMENTS = 14;
const tmp = new THREE.Vector3();
const randomDir = () => new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();

/** A jagged path from `a` to `b`: the straight line plus random offsets that are largest mid-way. */
function boltPath(a: THREE.Vector3, b: THREE.Vector3, amp: number) {
  const pts: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const k = i / SEGMENTS;
    tmp.lerpVectors(a, b, k).addScaledVector(randomDir(), amp * Math.sin(Math.PI * k) * (0.4 + Math.random() * 0.6));
    pts.push(tmp.x, tmp.y, tmp.z);
  }
  return pts;
}

/**
 * Lightning in the stone colours: small crackles around the gauntlet at rest (more on hover), then through the charge
 * and the storm bolts crawl over the armour and burst outward.
 */
function Lightning({ input, rig }: { input: Input; rig: Rig }) {
  const size = useThree((s) => s.size);
  const colors = useMemo(stoneColors, []);
  const pool = useMemo(() => {
    const group = new THREE.Group();
    const bolts = Array.from({ length: BOLTS }, () => {
      const geometry = new MeshLineGeometry();
      const material = new MeshLineMaterial({ color: new THREE.Color(), lineWidth: 0.01, resolution: new THREE.Vector2(1, 1), opacity: 0, sizeAttenuation: 1 });
      material.transparent = true;
      material.blending = THREE.AdditiveBlending;
      material.depthWrite = false;
      material.toneMapped = false;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      group.add(mesh);
      return { mesh, geometry, material, life: 0, ttl: 1 };
    });
    return { group, bolts };
  }, []);
  useEffect(() => { for (const b of pool.bolts) b.material.resolution.set(size.width, size.height); }, [pool, size]);
  useEffect(() => () => { for (const b of pool.bolts) { b.geometry.dispose(); b.material.dispose(); } }, [pool]);

  useFrame((_, dt) => {
    const p = input.current;
    const { energy } = energyOf(p);
    const rate = 1.5 + (p?.hover ? 6 : 0) + energy * 70; // new bolts per second
    let budget = rate * Math.min(dt, 0.05);
    const { bounds, gauntlet } = rig;
    for (const b of pool.bolts) {
      if (b.life > 0) {
        b.life -= dt;
        b.material.opacity = Math.max(0, b.life / b.ttl) * (0.7 + Math.random() * 0.3);
        if (b.life <= 0) b.mesh.visible = false;
        continue;
      }
      if (budget <= 0 || Math.random() > budget) continue;
      budget -= 1;
      const big = energy > 0.05;
      const start = gauntlet.clone().addScaledVector(randomDir(), 0.03);
      let end: THREE.Vector3;
      if (!big) end = gauntlet.clone().addScaledVector(randomDir(), 0.1 + Math.random() * 0.14);
      else if (Math.random() < 0.55) {
        // crawl over the armour: a point on the front of the suit, mostly up the arm and chest
        end = new THREE.Vector3(
          THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random()),
          THREE.MathUtils.lerp(bounds.min.y + 0.35, bounds.max.y - 0.05, Math.random()),
          bounds.max.z * (0.6 + Math.random() * 0.4),
        );
      } else end = gauntlet.clone().addScaledVector(randomDir(), 0.4 + energy * 1.4);
      b.geometry.setPoints(boltPath(start, end, big ? 0.09 : 0.03), (k: number) => 1 - k * 0.75);
      b.material.color.copy(colors[Math.floor(Math.random() * colors.length)]);
      b.material.lineWidth = big ? 0.02 : 0.009;
      b.ttl = big ? 0.1 + Math.random() * 0.14 : 0.07 + Math.random() * 0.08;
      b.life = b.ttl;
      b.mesh.visible = true;
    }
  });
  return <primitive object={pool.group} />;
}

const EMBERS = 420;

/** Drifting embers and ash, faster and denser through the storm. */
function Embers({ input }: { input: Input }) {
  const { points, speed } = useMemo(() => {
    const pos = new Float32Array(EMBERS * 3);
    const speed = new Float32Array(EMBERS);
    for (let i = 0; i < EMBERS; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 3.2;
      pos[i * 3 + 1] = Math.random() * 3.6;
      pos[i * 3 + 2] = -3 + Math.random() * 3.6;
      speed[i] = 0.12 + Math.random() * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.035, map: glowTexture(), color: themeColor("--ember"), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { points: new THREE.Points(geo, mat), speed };
  }, []);
  useEffect(() => () => {
    points.geometry.dispose();
    const m = points.material as THREE.PointsMaterial;
    m.map?.dispose();
    m.dispose();
  }, [points]);
  useFrame((state, dt) => {
    const { energy } = energyOf(input.current);
    const attr = points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    const boost = 1 + energy * 4;
    for (let i = 0; i < EMBERS; i++) {
      arr[i * 3 + 1] += speed[i] * dt * boost;
      arr[i * 3] += Math.sin(t * 0.7 + i) * 0.06 * dt * boost;
      if (arr[i * 3 + 1] > 3.6) arr[i * 3 + 1] = 0;
    }
    attr.needsUpdate = true;
    (points.material as THREE.PointsMaterial).size = 0.035 + energy * 0.025;
  });
  return <primitive object={points} />;
}

const SKY_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_FRAG = `
varying vec2 vUv;
uniform float uTime, uFlash, uStorm;
uniform vec3 uSky, uHaze, uSmoke, uEmber, uTint;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec2 uv = vUv;
  float smoke = fbm(uv * vec2(3.0, 2.0) + vec2(uTime * 0.025, uTime * 0.012));
  float wisps = fbm(uv * vec2(7.0, 4.0) - vec2(uTime * 0.04, 0.0));
  // the burning haze low and left, like the battlefield sky behind him
  float glow = smoothstep(0.9, 0.0, distance(uv * vec2(1.2, 1.0), vec2(0.42, 0.36)));
  vec3 col = mix(uSky, uHaze, glow * 0.95);
  col = mix(col, uSmoke * 0.7, smoothstep(0.4, 0.8, smoke) * 0.85);
  col += uEmber * pow(glow, 2.5) * 0.7 * wisps;
  col *= mix(1.0, 0.45, smoothstep(0.55, 1.0, uv.y));
  col *= 1.0 - 0.55 * smoothstep(0.35, 0.75, distance(uv, vec2(0.5)));
  col = mix(col, uTint, uStorm * 0.3 * wisps);
  col += vec3(uFlash);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Smoky, burning battlefield sky on a far plane, tinted by the stones through the storm and lit by the flash. */
function Sky({ input }: { input: Input }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uStorm: { value: 0 },
      uSky: { value: new THREE.Color(themeColor("--snap-sky")) },
      uHaze: { value: new THREE.Color(themeColor("--snap-haze")) },
      uSmoke: { value: new THREE.Color(themeColor("--snap-smoke")) },
      uEmber: { value: new THREE.Color(themeColor("--ember")) },
      uTint: { value: new THREE.Color(themeColor(STONE_VAR.power)) },
    },
  }), []);
  const tints = useMemo(stoneColors, []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    const { storm, flash } = energyOf(input.current);
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uStorm.value = storm;
    u.uFlash.value = flash * 0.9;
    if (storm > 0) (u.uTint.value as THREE.Color).copy(tints[Math.floor(state.clock.elapsedTime * 8) % tints.length]);
  });
  return (
    <mesh position={[0, 1.6, -5]} material={material}>
      <planeGeometry args={[16, 9]} />
    </mesh>
  );
}

/** Scorched ground with a few broken rocks. */
function Ground() {
  const rocks = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + 0.4;
    const r = 1.6 + (i % 3) * 0.9;
    return { key: `rock-${i}`, pos: [Math.cos(a) * r, 0.05, Math.sin(a) * r - 1.2] as [number, number, number], s: 0.18 + (i % 4) * 0.12, rot: i * 1.3 };
  }), []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color={themeColor("--snap-ground")} roughness={1} />
      </mesh>
      {rocks.map((r) => (
        <mesh key={r.key} position={r.pos} rotation={[r.rot, r.rot * 0.7, 0]} scale={r.s}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={themeColor("--snap-smoke")} roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}

/** Lights: warm fire from behind, a stone-coloured glow at the gauntlet that blooms through the snap, the flash. */
function Lights({ input, rig }: { input: Input; rig: Rig | null }) {
  const gauntletLight = useRef<THREE.PointLight>(null);
  const fire = useRef<THREE.PointLight>(null);
  const flash = useRef<THREE.AmbientLight>(null);
  const colors = useMemo(stoneColors, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { energy, flash: f } = energyOf(input.current);
    if (gauntletLight.current && rig) {
      gauntletLight.current.position.copy(rig.gauntlet);
      gauntletLight.current.position.z += 0.15;
      gauntletLight.current.intensity = 0.6 + Math.sin(t * 3) * 0.15 + energy * 9;
      gauntletLight.current.color.copy(colors[Math.floor(t * (2 + energy * 10)) % colors.length]);
    }
    if (fire.current) fire.current.intensity = 6 + Math.sin(t * 9) * 0.8 + Math.sin(t * 23) * 0.5;
    if (flash.current) flash.current.intensity = 0.35 + f * 4;
  });
  const chest: [number, number, number] = rig ? [rig.chest.x, rig.chest.y, rig.chest.z + 0.25] : [0, 1.35, 0.4];
  return (
    <>
      <ambientLight ref={flash} intensity={0.35} />
      <hemisphereLight args={[themeColor("--snap-haze"), themeColor("--snap-ground"), 0.6]} />
      <directionalLight position={[-3, 3.5, -2.5]} intensity={3.2} color={themeColor("--ember")} />
      <directionalLight position={[2, 2.5, 3.5]} intensity={0.7} color={themeColor("--ember-hot")} />
      <pointLight ref={fire} position={[-1.8, 0.4, -1.6]} distance={6} color={themeColor(STONE_VAR.soul)} />
      <pointLight ref={gauntletLight} distance={0.7} decay={2} />
      <pointLight position={chest} distance={0.9} intensity={1.6} color={themeColor("--arc-reactor")} />
    </>
  );
}

/** Frames his upper body and the gauntlet, follows the cursor a little, pushes in on the charge, shakes at the snap. */
function Director({ input, rig }: { input: Input; rig: Rig | null }) {
  const target = useRef(new THREE.Vector3(0, 1.2, 0));
  useFrame((state, dt) => {
    if (!rig) return;
    const p = input.current;
    const { charge, storm, energy } = energyOf(p);
    const side = Math.sign(rig.gauntlet.x) || 1;
    const look = rig.chest.clone().lerp(rig.gauntlet, 0.2 + charge * 0.35);
    target.current.lerp(look, Math.min(1, dt * 3));
    const want = new THREE.Vector3(side * 0.5 + (p?.x ?? 0) * 0.25, look.y + 0.06 + (p?.y ?? 0) * 0.1, look.z + 2.05 - energy * 0.4);
    const shake = storm * storm * 0.035;
    want.x += (Math.random() * 2 - 1) * shake;
    want.y += (Math.random() * 2 - 1) * shake;
    state.camera.position.lerp(want, Math.min(1, dt * 4));
    state.camera.lookAt(target.current);
  });
  return null;
}

export default function IronManScene({ input, active }: { input: Input; active: boolean }) {
  const [rig, setRig] = useState<Rig | null>(null);
  const { progress, active: loading } = useProgress();
  return (
    <>
      <Canvas camera={{ position: [-0.5, 1.3, 2.2], fov: 32 }} dpr={[1, 1.5]} frameloop={active ? "always" : "never"} gl={{ antialias: true }}>
        <fog attach="fog" args={[themeColor("--snap-smoke"), 4.5, 12]} />
        <Sky input={input} />
        <Ground />
        <Embers input={input} />
        <Lights input={input} rig={rig} />
        <Suspense fallback={null}>
          <Suit input={input} onRig={setRig} />
          {rig ? <Lightning input={input} rig={rig} /> : null}
          <Precompile />
        </Suspense>
        <Director input={input} rig={rig} />
      </Canvas>
      {loading || progress < 100 ? <span className="ironman-boot" aria-hidden="true">CHARGING SUIT… {Math.round(progress)}%</span> : null}
    </>
  );
}
