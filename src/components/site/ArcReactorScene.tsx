"use client";
import { themeColor } from "@/lib/theme";

import { Environment, Lightformer, useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Precompile } from "./Precompile";

/*
 * "ARC reactor Ironman" by fran.senes (https://sketchfab.com/franse_art), CC BY 4.0, simplified from
 * arc_reactor_ironman.glb (465k → 166k triangles, meshopt). The reactor stands on a silver stand on a wooden base.
 */
export const ARC_REACTOR_URL = "/models/arc-reactor.glb";

/** Pointer state from the card: x, y in -1..1, hover, drag yaw (rad) and when it was last clicked (seconds, 0 = never). */
export type ReactorInput = { x: number; y: number; hover: boolean; yaw: number; dragging: boolean; surgeAt: number };
type Input = React.RefObject<ReactorInput>;

/** The model's glowing parts: the blue ring and the core. */
const GLOW_MATERIAL = "Material";
/** Seconds a click's power surge takes to settle. */
const SURGE = 1.6;
/** The reactor (without its stand) is scaled to this diameter, and floats with its centre this high. */
const REACTOR_SIZE = 0.95;
const FLOAT_HEIGHT = 0.85;
/** The display stand and wooden base: hidden, so the reactor floats. */
const STAND_MATERIALS = new Set(["Metal_Plata_Base", "Madera"]);

const seconds = () => performance.now() / 1000;
const surgeOf = (p: ReactorInput | null) => {
  if (!p || p.surgeAt <= 0) return 0;
  const k = (seconds() - p.surgeAt) / SURGE;
  return k >= 0 && k < 1 ? (1 - k) * (1 - k) : 0;
};

/** Soft round glow (white core fading out) for the reactor halo and the dust; tinted by the material colour. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.2, "rgba(255,255,255,0.6)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** `core` and `facing` are in the root's own space; `height` is the top of the floating reactor. */
type Rig = { root: THREE.Group; core: THREE.Vector3; facing: THREE.Vector3; glow: THREE.MeshStandardMaterial[]; height: number };

/**
 * Hides the stand, centres the reactor on the root and scales it to REACTOR_SIZE, makes the ring and core glow.
 * Works on a copy: the loader caches the original, and moving that one twice (dev mode runs this twice) drifts it away.
 */
function useRig(source: THREE.Group): Rig {
  return useMemo(() => {
    const scene = source.clone(true);
    scene.rotation.y = Math.PI; // the source model faces -Z; turn its glowing face toward the camera
    const root = new THREE.Group();
    root.add(scene);
    scene.updateMatrixWorld(true);
    const all = new THREE.Box3();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (STAND_MATERIALS.has((mesh.material as THREE.Material).name)) mesh.visible = false;
      else all.union(new THREE.Box3().setFromObject(mesh));
    });
    const size = all.getSize(new THREE.Vector3());
    const scale = REACTOR_SIZE / Math.max(size.x, size.y);
    const mid = all.getCenter(new THREE.Vector3());
    scene.scale.setScalar(scale);
    scene.position.copy(mid).multiplyScalar(-scale);
    scene.updateMatrixWorld(true);
    const glow: THREE.MeshStandardMaterial[] = [];
    const core = new THREE.Box3();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.name !== GLOW_MATERIAL) return;
      core.union(new THREE.Box3().setFromObject(mesh));
      if (glow.includes(m)) return;
      m.emissive.set(themeColor("--reactor-glow"));
      m.color.set(themeColor("--arc-reactor"));
      m.toneMapped = false;
      glow.push(m);
    });
    const center = core.isEmpty() ? new THREE.Vector3() : core.getCenter(new THREE.Vector3());
    // after the turn above the ring faces +Z, toward the camera
    const facing = new THREE.Vector3(0, 0, 1);
    root.position.y = FLOAT_HEIGHT;
    return { root, core: center, facing, glow, height: FLOAT_HEIGHT + REACTOR_SIZE / 2 };
  }, [source]);
}

/** The floating reactor: it bobs and sways, ring and core pulse, brighten on hover, flare on a click; drag to turn it. */
function Reactor({ input, onRig }: { input: Input; onRig: (rig: Rig) => void }) {
  const { scene } = useGLTF(ARC_REACTOR_URL, false, true);
  const rig = useRig(scene);
  const turn = useRef(0);
  useEffect(() => onRig(rig), [rig, onRig]);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const p = input.current;
    const surge = surgeOf(p);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    for (const m of rig.glow) m.emissiveIntensity = 3.2 + pulse * 1.2 + (p?.hover ? 1.4 : 0) + surge * 9;
    // a slow showcase sway, plus wherever the visitor dragged it
    const want = Math.sin(t * 0.35) * 0.35 + (p?.yaw ?? 0);
    turn.current += (want - turn.current) * Math.min(1, dt * (p?.dragging ? 14 : 2.5));
    rig.root.rotation.y = turn.current;
    rig.root.rotation.z = Math.sin(t * 0.6) * 0.03;
    rig.root.position.y = FLOAT_HEIGHT + Math.sin(t * 1.1) * 0.035 + surge * 0.04;
  });
  return <primitive object={rig.root} />;
}

/** The glow inside the reactor: a light in the core that lights the copper coils, and two soft halos in front of it. */
function CoreGlow({ input, rig }: { input: Input; rig: Rig }) {
  const light = useRef<THREE.PointLight>(null);
  const tex = useMemo(glowTexture, []);
  const halos = useMemo(() => [0.95, 2.2].map((base) => {
    const m = new THREE.SpriteMaterial({ map: tex, color: themeColor("--reactor-glow"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.userData.base = base;
    return s;
  }), [tex]);
  useEffect(() => () => {
    tex.dispose();
    for (const h of halos) (h.material as THREE.SpriteMaterial).dispose();
  }, [tex, halos]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = input.current;
    const surge = surgeOf(p);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    const hover = p?.hover ? 1 : 0;
    // follow the reactor as it floats and turns
    rig.root.updateMatrixWorld();
    const at = rig.core.clone().applyMatrix4(rig.root.matrixWorld);
    const out = rig.facing.clone().transformDirection(rig.root.matrixWorld);
    if (light.current) {
      light.current.position.copy(at).addScaledVector(out, 0.02);
      light.current.intensity = 1.6 + pulse * 0.6 + hover * 0.8 + surge * 8;
    }
    halos.forEach((h, i) => {
      h.position.copy(at).addScaledVector(out, 0.06 + i * 0.02);
      h.scale.setScalar(REACTOR_SIZE * 0.3 * h.userData.base * (1 + pulse * 0.06 + hover * 0.08 + surge * 0.6));
      (h.material as THREE.SpriteMaterial).opacity = (i === 0 ? 0.55 : 0.16) + pulse * 0.08 + hover * 0.1 + surge * 0.4;
    });
  });
  return (
    <>
      <pointLight ref={light} color={themeColor("--reactor-glow")} distance={1.2} decay={2} />
      {halos.map((h, i) => <primitive key={i === 0 ? "halo-core" : "halo-wide"} object={h} />)}
    </>
  );
}

const BEAM_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const BEAM_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  // brightest at the lamp, fading down the cone and toward its edges
  float down = smoothstep(0.0, 1.0, vUv.y);
  float edge = sin(vUv.x * 3.14159265);
  gl_FragColor = vec4(uColor, uOpacity * down * edge * edge);
  #include <colorspace_fragment>
}`;

/** The display spot from above: a real spotlight with shadows, a soft visible beam, and dust drifting in it. */
function Showcase({ input, rig }: { input: Input; rig: Rig | null }) {
  const spot = useRef<THREE.SpotLight>(null);
  const top = (rig?.height ?? 1.2) + 1.7;
  const beam = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(themeColor("--showcase-spot")) }, uOpacity: { value: 0.16 } },
  }), []);
  const dust = useMemo(() => {
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.75;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 2.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.012, map: glowTexture(), color: themeColor("--showcase-spot"), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return new THREE.Points(geo, mat);
  }, []);
  useEffect(() => () => {
    beam.dispose();
    dust.geometry.dispose();
    const m = dust.material as THREE.PointsMaterial;
    m.map?.dispose();
    m.dispose();
  }, [beam, dust]);
  useEffect(() => {
    const s = spot.current;
    if (!s) return;
    s.target.position.set(0, 0, 0);
    s.target.updateMatrixWorld();
  }, []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const attr = dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * 0.03;
      arr[i] += Math.sin(t * 0.4 + i) * dt * 0.01;
      if (arr[i + 1] < 0) arr[i + 1] = 2.4;
    }
    attr.needsUpdate = true;
    beam.uniforms.uOpacity.value = 0.14 + surgeOf(input.current) * 0.08;
  });
  return (
    <>
      <spotLight ref={spot} position={[0, top, 0.25]} angle={0.42} penumbra={0.75} intensity={38} distance={top + 3} decay={1.6} color={themeColor("--showcase-spot")} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <mesh position={[0, top - 1.2, 0.1]} material={beam}>
        <cylinderGeometry args={[0.06, 0.95, 2.4, 40, 1, true]} />
      </mesh>
      <primitive object={dust} />
    </>
  );
}

/** Camera: a three-quarter showcase view that follows the cursor a little. */
function Director({ input, rig }: { input: Input; rig: Rig | null }) {
  const look = useRef(new THREE.Vector3(0, 0.6, 0));
  useFrame((state, dt) => {
    if (!rig) return;
    const p = input.current;
    look.current.lerp(new THREE.Vector3(0, FLOAT_HEIGHT - 0.28, 0), Math.min(1, dt * 3));
    const want = new THREE.Vector3(0.5 + (p?.x ?? 0) * 0.3, FLOAT_HEIGHT + 0.2 + (p?.y ?? 0) * 0.15, 3.7);
    state.camera.position.lerp(want, Math.min(1, dt * 3));
    state.camera.lookAt(look.current);
  });
  return null;
}

export default function ArcReactorScene({ input, active }: { input: Input; active: boolean }) {
  const [rig, setRig] = useState<Rig | null>(null);
  const { progress, active: loading } = useProgress();
  return (
    <>
      <Canvas shadows camera={{ position: [0.7, 1, 3.1], fov: 30 }} dpr={[1, 1.5]} frameloop={active ? "always" : "never"} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.08} />
        {/* Studio reflections for the copper, silver and gold (built locally: no download). */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} color={themeColor("--showcase-spot")} position={[0, 4, 0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[3, 3, 1]} />
          <Lightformer form="rect" intensity={0.6} color={themeColor("--reactor-deep")} position={[-3, 1, 1]} rotation={[0, Math.PI / 2, 0]} scale={[2, 3, 1]} />
          <Lightformer form="rect" intensity={0.4} color={themeColor("--showcase-spot")} position={[3, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[2, 3, 1]} />
        </Environment>
        <Showcase input={input} rig={rig} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <shadowMaterial opacity={0.55} />
        </mesh>
        <Suspense fallback={null}>
          <Reactor input={input} onRig={setRig} />
          {rig ? <CoreGlow input={input} rig={rig} /> : null}
          <Precompile />
        </Suspense>
        <Director input={input} rig={rig} />
      </Canvas>
      {loading || progress < 100 ? <span className="reactor-boot" aria-hidden="true">POWERING UP… {Math.round(progress)}%</span> : null}
    </>
  );
}
