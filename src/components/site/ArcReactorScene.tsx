"use client";
import { themeColor } from "@/lib/theme";

import { Environment, Lightformer, MeshReflectorMaterial, useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { reactorPower } from "@/lib/reactor";
import { Precompile } from "./Precompile";

/*
 * "ARC reactor Ironman" by fran.senes (https://sketchfab.com/franse_art), CC BY 4.0, simplified from
 * arc_reactor_ironman.glb (465k → 166k triangles, meshopt). Shown floating, with its display stand hidden.
 */
export const ARC_REACTOR_URL = "/models/arc-reactor.glb";

/**
 * Pointer state from the card: x, y in -1..1, hover, drag yaw (rad), whether it's powered `on`, and when power last
 * changed (seconds; 0 = never, so the scene boots it the first time it shows).
 */
export type ReactorInput = { x: number; y: number; hover: boolean; yaw: number; dragging: boolean; on: boolean; changedAt: number };
type Input = React.RefObject<ReactorInput>;

/** The model's glowing parts: the blue ring and the core. */
const GLOW_MATERIAL = "Material";
/** The display stand and wooden base: hidden, so the reactor floats. */
const STAND_MATERIALS = new Set(["Metal_Plata_Base", "Madera"]);
/** The reactor is scaled to this diameter, and floats with its centre this high. */
const REACTOR_SIZE = 0.95;
const FLOAT_HEIGHT = 0.85;
/** Emissive intensity of the ring and core at full power. */
const FULL_GLOW = 3.5;

const seconds = () => performance.now() / 1000;
const powerOf = (p: ReactorInput | null) => reactorPower(p?.on ?? true, p && p.changedAt > 0 ? seconds() - p.changedAt : Number.NaN);

/** A canvas texture drawn by `draw` on a size×size square. */
function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d") as CanvasRenderingContext2D, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/** Soft round glow, white core fading out; tinted by the material colour. */
const glowTexture = () => canvasTexture(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.2, "rgba(255,255,255,0.6)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
});
/** A thin glowing ring, for the ignition shockwave. */
const ringTexture = () => canvasTexture(256, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s / 2);
  r.addColorStop(0, "rgba(255,255,255,0)");
  r.addColorStop(0.55, "rgba(255,255,255,1)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
});
/** A comet arc on a ring (bright head, fading tail), for the light that sweeps around the coils. */
const cometTexture = () => canvasTexture(256, (g, s) => {
  const c = g.createConicGradient(0, s / 2, s / 2);
  c.addColorStop(0, "rgba(255,255,255,1)");
  c.addColorStop(0.25, "rgba(255,255,255,0)");
  c.addColorStop(1, "rgba(255,255,255,0)");
  g.strokeStyle = c;
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
  g.stroke();
});

/** `core`, `facing` and `radius` are in the root's own space. */
type Rig = { root: THREE.Group; core: THREE.Vector3; facing: THREE.Vector3; radius: number; glow: THREE.MeshStandardMaterial[] };

/**
 * Hides the stand, centres the reactor on the root and scales it to REACTOR_SIZE, and finds the glowing ring and core.
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
    scene.scale.setScalar(scale);
    scene.position.copy(all.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
    scene.updateMatrixWorld(true);
    const glow: THREE.MeshStandardMaterial[] = [];
    const core = new THREE.Box3();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.envMapIntensity = 1;
      if (m.name !== GLOW_MATERIAL) return;
      core.union(new THREE.Box3().setFromObject(mesh));
      if (glow.includes(m)) return;
      m.emissive.set(themeColor("--reactor-glow"));
      m.color.set(themeColor("--arc-reactor"));
      glow.push(m);
    });
    const ring = core.isEmpty() ? new THREE.Vector3(0.5, 0.5, 0.1) : core.getSize(new THREE.Vector3());
    root.position.y = FLOAT_HEIGHT;
    return { root, core: core.isEmpty() ? new THREE.Vector3() : core.getCenter(new THREE.Vector3()), facing: new THREE.Vector3(0, 0, 1), radius: Math.max(ring.x, ring.y) / 2, glow };
  }, [source]);
}

/** The floating reactor: bobs and sways, glows with the power level; drag to turn it. Boots itself the first time. */
function Reactor({ input, onRig }: { input: Input; onRig: (rig: Rig) => void }) {
  const { scene } = useGLTF(ARC_REACTOR_URL, false, true);
  const rig = useRig(scene);
  const turn = useRef(0);
  useEffect(() => onRig(rig), [rig, onRig]);
  useEffect(() => {
    const p = input.current;
    if (p && p.changedAt === 0) p.changedAt = seconds(); // first view: play the boot
  }, [input]);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const p = input.current;
    const { level, flash } = powerOf(p);
    const hum = 1 + Math.sin(t * 1.6) * 0.06 * level;
    for (const m of rig.glow) m.emissiveIntensity = FULL_GLOW * level * hum + (p?.hover ? 0.5 * level : 0) + flash * 2;
    const want = Math.sin(t * 0.35) * 0.35 + (p?.yaw ?? 0);
    turn.current += (want - turn.current) * Math.min(1, dt * (p?.dragging ? 14 : 2.5));
    rig.root.rotation.y = turn.current;
    rig.root.rotation.z = Math.sin(t * 0.6) * 0.03;
    rig.root.position.y = FLOAT_HEIGHT + Math.sin(t * 1.1) * 0.035 + flash * 0.02;
  });
  return <primitive object={rig.root} />;
}

/**
 * Light inside the reactor: a point light in the core that lights the copper coils, soft halos, and through a boot the
 * sweep of light around the coils and the ignition shockwave.
 */
function CoreGlow({ input, rig }: { input: Input; rig: Rig }) {
  const light = useRef<THREE.PointLight>(null);
  const parts = useMemo(() => {
    const color = themeColor("--reactor-glow");
    const sprite = (map: THREE.Texture) => new THREE.Sprite(new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    const glow = glowTexture();
    return { halo: sprite(glow), wide: sprite(glow), comet: sprite(cometTexture()), shock: sprite(ringTexture()) };
  }, []);
  useEffect(() => () => {
    for (const s of Object.values(parts)) {
      const m = s.material as THREE.SpriteMaterial;
      m.map?.dispose();
      m.dispose();
    }
  }, [parts]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = input.current;
    const { level, flash, sweep, shock } = powerOf(p);
    const hover = p?.hover ? 1 : 0;
    rig.root.updateMatrixWorld();
    const at = rig.core.clone().applyMatrix4(rig.root.matrixWorld);
    const out = rig.facing.clone().transformDirection(rig.root.matrixWorld);
    const r = rig.radius;
    if (light.current) {
      light.current.position.copy(at).addScaledVector(out, 0.3); // far enough out that the coils right by the core do not blow out
      light.current.intensity = 0.3 * level + hover * 0.1 * level + flash * 0.8;
    }
    const pulse = 1 + Math.sin(t * 1.6) * 0.05;
    const place = (s: THREE.Sprite, ahead: number, scale: number, opacity: number) => {
      s.position.copy(at).addScaledVector(out, ahead);
      s.scale.setScalar(scale);
      (s.material as THREE.SpriteMaterial).opacity = Math.max(0, opacity);
      s.visible = opacity > 0.005;
    };
    place(parts.halo, 0.05, r * 0.9 * pulse * (1 + flash * 0.5), 0.22 * level + flash * 0.25);
    place(parts.wide, 0.07, r * 3 * pulse * (1 + flash), 0.08 * level + flash * 0.12);
    place(parts.comet, 0.06, r * 2.1, sweep >= 0 ? Math.sin(Math.PI * sweep) : 0);
    (parts.comet.material as THREE.SpriteMaterial).rotation = -sweep * Math.PI * 4; // two turns
    place(parts.shock, 0.04, r * (1.6 + shock * 7), shock >= 0 ? (1 - shock) * 0.9 : 0);
  });
  return (
    <>
      <pointLight ref={light} color={themeColor("--reactor-glow")} distance={1.4} decay={2} />
      <primitive object={parts.halo} />
      <primitive object={parts.wide} />
      <primitive object={parts.comet} />
      <primitive object={parts.shock} />
    </>
  );
}

const PLANE_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
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
const BACKDROP_FRAG = `
varying vec2 vUv;
uniform vec3 uWall, uFloor, uSpot, uGlow;
uniform float uLevel;
void main() {
  // a studio sweep: dark at the edges, lit where the spot falls, a little blue from the reactor
  float spot = smoothstep(0.75, 0.0, distance(vUv * vec2(1.6, 1.0), vec2(0.8, 0.62)));
  float glow = smoothstep(0.5, 0.0, distance(vUv * vec2(1.6, 1.0), vec2(0.8, 0.42)));
  vec3 col = mix(uFloor, uWall, smoothstep(0.0, 0.8, vUv.y));
  col += uSpot * spot * 0.12 + uGlow * glow * 0.08 * uLevel;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** The display spot from above (real light and shadow), its soft beam, dust in the light, and the studio backdrop. */
function Studio({ input }: { input: Input }) {
  const spot = useRef<THREE.SpotLight>(null);
  const top = FLOAT_HEIGHT + 2.2;
  const beam = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(themeColor("--showcase-spot")) }, uOpacity: { value: 0.06 } },
  }), []);
  const backdrop = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT,
    fragmentShader: BACKDROP_FRAG,
    depthWrite: false,
    uniforms: {
      uWall: { value: new THREE.Color(themeColor("--showcase-wall")) },
      uFloor: { value: new THREE.Color(themeColor("--showcase-floor")) },
      uSpot: { value: new THREE.Color(themeColor("--showcase-spot")) },
      uGlow: { value: new THREE.Color(themeColor("--reactor-glow")) },
      uLevel: { value: 1 },
    },
  }), []);
  const dust = useMemo(() => {
    const n = 180;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.8;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 2.6;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.01, map: glowTexture(), color: themeColor("--showcase-spot"), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return new THREE.Points(geo, mat);
  }, []);
  useEffect(() => () => {
    beam.dispose();
    backdrop.dispose();
    dust.geometry.dispose();
    const m = dust.material as THREE.PointsMaterial;
    m.map?.dispose();
    m.dispose();
  }, [beam, backdrop, dust]);
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
      if (arr[i + 1] < 0) arr[i + 1] = 2.6;
    }
    attr.needsUpdate = true;
    backdrop.uniforms.uLevel.value = powerOf(input.current).level;
  });
  return (
    <>
      <spotLight ref={spot} position={[0, top, -0.35]} angle={0.38} penumbra={0.8} intensity={8} distance={top + 3} decay={1.6} color={themeColor("--showcase-spot")} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-radius={6} />
      <mesh position={[0, top - 1.3, 0.1]} material={beam}>
        <cylinderGeometry args={[0.05, 1.0, 2.6, 48, 1, true]} />
      </mesh>
      <primitive object={dust} />
      <mesh position={[0, 1.4, -2.2]} material={backdrop}>
        <planeGeometry args={[9, 5]} />
      </mesh>
      {/* Glossy dark floor: catches the spot's pool of light, the shadow, and a blurred reflection of the glow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 9]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[400, 120]}
          mixBlur={1}
          mixStrength={1.1}
          mirror={0.35}
          roughness={1}
          metalness={0.15}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color={themeColor("--showcase-floor")}
        />
      </mesh>
    </>
  );
}

/** Bloom: the glowing core and ring spill light like a real light source, harder at the ignition flash. */
function Bloom({ input }: { input: Input }) {
  const { gl, scene, camera, size } = useThree();
  const fx = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.3, 1.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, bloom };
  }, [gl, scene, camera]);
  useEffect(() => {
    fx.composer.setPixelRatio(gl.getPixelRatio());
    fx.composer.setSize(size.width, size.height);
  }, [fx, gl, size]);
  useEffect(() => () => fx.composer.dispose(), [fx]);
  useFrame((_, dt) => {
    const { level, flash } = powerOf(input.current);
    fx.bloom.strength = 0.15 + 0.35 * Math.min(level, 1.4) + flash * 0.4;
    fx.composer.render(dt);
  }, 1);
  return null;
}

/** Camera: a three-quarter showcase view that follows the cursor a little and kicks at the ignition. */
function Director({ input }: { input: Input }) {
  const look = useMemo(() => new THREE.Vector3(0, FLOAT_HEIGHT - 0.28, 0), []);
  useFrame((state, dt) => {
    const p = input.current;
    const { flash } = powerOf(p);
    const kick = flash * flash * 0.02;
    const want = new THREE.Vector3(
      0.5 + (p?.x ?? 0) * 0.3 + (Math.random() - 0.5) * kick,
      FLOAT_HEIGHT + 0.2 + (p?.y ?? 0) * 0.15 + (Math.random() - 0.5) * kick,
      3.7 - flash * 0.15,
    );
    state.camera.position.lerp(want, Math.min(1, dt * 3));
    state.camera.lookAt(look);
  });
  return null;
}

export default function ArcReactorScene({ input, active }: { input: Input; active: boolean }) {
  const [rig, setRig] = useState<Rig | null>(null);
  const { progress, active: loading } = useProgress();
  return (
    <>
      <Canvas shadows camera={{ position: [0.5, 1.05, 3.7], fov: 30 }} dpr={[1, 2]} frameloop={active ? "always" : "never"} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <color attach="background" args={[themeColor("--showcase-floor")]} />
        <ambientLight intensity={0.05} />
        {/* Studio reflections for the copper, silver and gold (built locally: no download). */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={1.5} color={themeColor("--showcase-spot")} position={[0, 4, 0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[3, 3, 1]} />
          <Lightformer form="ring" intensity={1.2} color={themeColor("--showcase-spot")} position={[2.5, 1.5, 2.5]} scale={1.2} target={[0, 0.8, 0]} />
          <Lightformer form="rect" intensity={0.7} color={themeColor("--reactor-deep")} position={[-3, 1, 1]} rotation={[0, Math.PI / 2, 0]} scale={[2, 3, 1]} />
          <Lightformer form="rect" intensity={0.4} color={themeColor("--showcase-spot")} position={[3, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[2, 3, 1]} />
        </Environment>
        <Studio input={input} />
        <Suspense fallback={null}>
          <Reactor input={input} onRig={setRig} />
          {rig ? <CoreGlow input={input} rig={rig} /> : null}
          <Precompile />
        </Suspense>
        <Director input={input} />
        <Bloom input={input} />
      </Canvas>
      {loading || progress < 100 ? <span className="reactor-boot" aria-hidden="true">POWERING UP… {Math.round(progress)}%</span> : null}
    </>
  );
}
