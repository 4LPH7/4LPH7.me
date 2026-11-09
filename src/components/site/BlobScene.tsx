"use client";
import { themeColor } from "@/lib/theme";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Precompile } from "./Precompile";

type Pointer = React.RefObject<{ x: number; y: number; on: boolean }>;

// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT).
const NOISE = /* glsl */ `
vec4 vPermute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 vTaylor(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = vPermute(vPermute(vPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = vTaylor(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// Symbiote surface: a slow writhing body, plus ridged-noise tendrils that grow and stretch toward the pointer.
const VENOM = /* glsl */ `
uniform float uTime;
uniform vec3 uDir;
uniform float uReach;
uniform float uFury;
${NOISE}
vec3 venom(vec3 n) {
  float t = uTime;
  float body = snoise(n * 1.2 + vec3(0.0, t * 0.35, t * 0.2)) * 0.14
             + snoise(n * 2.0 - vec3(t * 0.5, 0.0, t * 0.3)) * 0.025;
  float toward = max(dot(n, uDir), 0.0);
  // Peaks of the noise, sharpened: isolated spikes rather than a web of ridges.
  float peak = max(snoise(n * 2.3 + vec3(t * 0.6, -t * 0.45, t * 0.3)), 0.0);
  float spikes = pow(peak, 3.0);
  float tendril = spikes * (0.04 + 0.9 * uReach * smoothstep(0.3, 1.0, toward) + 0.3 * uFury);
  float lean = 0.14 * uReach * pow(toward, 2.0);
  float breathe = 0.03 * sin(t * 1.7);
  return n * (1.0 + body + tendril + lean + breathe);
}
`;

function Symbiote({ pointer }: { pointer: Pointer }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDir: { value: new THREE.Vector3(0, 0, 1) }, uReach: { value: 0 }, uFury: { value: 0 } }),
    []
  );
  const scratch = useMemo(() => ({ dir: new THREE.Vector3(), inv: new THREE.Quaternion(), last: { x: 0, y: 0 } }), []);

  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: themeColor("--scene-blob"),
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      sheen: 0,
      sheenColor: new THREE.Color(themeColor("--scene-sheen")),
      sheenRoughness: 0.35,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VENOM}`)
        .replace(
          "#include <beginnormal_vertex>",
          /* glsl */ `
          vec3 sn = normalize(position);
          vec3 tg = normalize(abs(sn.y) < 0.99 ? cross(sn, vec3(0.0, 1.0, 0.0)) : cross(sn, vec3(1.0, 0.0, 0.0)));
          vec3 bt = cross(sn, tg);
          vec3 p0 = venom(sn);
          vec3 p1 = venom(normalize(sn + tg * 0.01));
          vec3 p2 = venom(normalize(sn + bt * 0.01));
          vec3 objectNormal = normalize(cross(p1 - p0, p2 - p0));`
        )
        .replace("#include <begin_vertex>", "vec3 transformed = p0;");
      // Blue-violet rim, like light catching the edge of wet black skin.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        /* glsl */ `
        float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
        outgoingLight += vec3(0.2, 0.22, 0.6) * rim * 0.22;
        #include <opaque_fragment>`
      );
    };
    m.customProgramCacheKey = () => "venom-symbiote";
    return m;
  }, [uniforms]);

  useFrame((state, delta) => {
    const m = mesh.current;
    const p = pointer.current;
    if (!m || !p) return;
    const t = state.clock.elapsedTime;
    const k = Math.min(1, delta * 2.5);
    uniforms.uTime.value = t;

    // Pointer speed makes it lash out; it calms down over about a second.
    const speed = Math.hypot(p.x - scratch.last.x, p.y - scratch.last.y) / Math.max(delta, 1e-3);
    scratch.last.x = p.x;
    scratch.last.y = p.y;
    const fury = p.on ? Math.min(1, speed * 0.25) : 0;
    uniforms.uFury.value += (fury - uniforms.uFury.value) * Math.min(1, delta * (fury > uniforms.uFury.value ? 8 : 1.2));
    uniforms.uReach.value += ((p.on ? 1 : 0) - uniforms.uReach.value) * k;

    // Slow, uneasy roll; it turns a little toward the pointer without facing it fully.
    m.rotation.x += ((p.on ? -p.y * 0.35 : Math.sin(t * 0.21) * 0.25) - m.rotation.x) * k * 0.5;
    m.rotation.y += ((p.on ? p.x * 0.45 : t * 0.12) - m.rotation.y) * k * 0.5;
    m.rotation.z = Math.sin(t * 0.17) * 0.15;
    m.position.x += ((p.on ? p.x * 0.12 : 0) - m.position.x) * k;
    m.position.y += ((p.on ? p.y * 0.12 : 0) - m.position.y) * k;

    // Tendrils reach toward the pointer, expressed in the mesh's own space; idle, they wander.
    const target = p.on ? scratch.dir.set(p.x, p.y, 0.7) : scratch.dir.set(Math.sin(t * 0.4), Math.cos(t * 0.31), 0.5);
    target.normalize().applyQuaternion(scratch.inv.copy(m.quaternion).invert());
    uniforms.uDir.value.lerp(target, k).normalize();
  });

  return (
    <mesh ref={mesh} scale={0.68} material={material}>
      <icosahedronGeometry args={[1, 96]} />
    </mesh>
  );
}

export default function BlobScene({ pointer, active }: { pointer: Pointer; active: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 40 }} dpr={[1, 1.5]} frameloop={active ? "always" : "never"} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.15} />
      <directionalLight position={[-2, 3, 4]} intensity={1.6} color={themeColor("--paper")} />
      <pointLight position={[2.5, -1.5, 2]} intensity={1.2} color={themeColor("--scene-indigo")} />
      {/* Built locally (no HDR download): soft light panels that give the wet, oily streaks. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 3, 2]} scale={[6, 1, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-3, 0, 2]} rotation-y={Math.PI / 3} scale={[1, 5, 1]} />
        <Lightformer form="ring" intensity={1.2} color={themeColor("--scene-lightformer")} position={[3, -1, 1]} scale={2} />
      </Environment>
      <Symbiote pointer={pointer} />
      <Precompile />
    </Canvas>
  );
}
