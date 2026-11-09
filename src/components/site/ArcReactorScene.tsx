"use client";

import {
	Environment,
	Lightformer,
	MeshReflectorMaterial,
	useGLTF,
	useProgress,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { discharge } from "@/lib/lightning";
import { reactorPower } from "@/lib/reactor";
import { themeColor } from "@/lib/theme";
import { Precompile } from "./Precompile";

/*
 * "ARC reactor Ironman" by fran.senes (https://sketchfab.com/franse_art), CC BY 4.0, simplified from
 * arc_reactor_ironman.glb (465k → 120k triangles, meshopt, WebP textures; the wooden base removed). Shown on its silver
 * post in a glass display case.
 */
export const ARC_REACTOR_URL = "/models/arc-reactor.glb";

/**
 * Pointer state from the card: x, y in -1..1, hover, drag yaw (rad), whether it's powered `on`, and when power last
 * changed (seconds; 0 = never, so the scene boots it the first time it shows).
 */
export type ReactorInput = {
	x: number;
	y: number;
	hover: boolean;
	yaw: number;
	dragging: boolean;
	on: boolean;
	changedAt: number;
};
type Input = React.RefObject<ReactorInput>;

/** The model's glowing parts: the blue ring and the core. */
const GLOW_MATERIAL = "Material";
/** The model's own stub of a post: hidden, the stand below replaces it. */
const STAND_MATERIAL = "Metal_Plata_Base";
/** The engraved disc around the coils ("Proof that Tony Stark has a heart"). */
const DISC_MATERIAL = "Metal_Disco";
/** The reactor's ring is scaled to this diameter. */
const REACTOR_SIZE = 0.8;
/** The stepped metal plinth the case stands on: its top, where the stand's foot sits. */
const PLINTH_TOP = 0.105;
/** The stand: how high it lifts the disc above the plinth, its column's radius and its round foot's. */
const LIFT = 0.42;
const COLUMN_RADIUS = 0.045;
const FOOT_RADIUS = 0.15;
/** Glass case: width and depth, and how far its lid clears the top of the reactor. */
const CASE_W = 1.45;
const CASE_D = 1.05;
const CASE_HEADROOM = 0.2;
/** Emissive intensity of the ring and core at full power. */
const FULL_GLOW = 3.5;

const seconds = () => performance.now() / 1000;
const powerOf = (p: ReactorInput | null) =>
	reactorPower(
		p?.on ?? true,
		p && p.changedAt > 0 ? seconds() - p.changedAt : Number.NaN,
	);

/** A canvas texture drawn by `draw` on a size×size square. */
function canvasTexture(
	size: number,
	draw: (g: CanvasRenderingContext2D, s: number) => void,
) {
	const c = document.createElement("canvas");
	c.width = c.height = size;
	draw(c.getContext("2d") as CanvasRenderingContext2D, size);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}
/** Soft round glow, white core fading out; tinted by the material colour. */
const glowTexture = () =>
	canvasTexture(128, (g, s) => {
		const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
		r.addColorStop(0, "rgba(255,255,255,1)");
		r.addColorStop(0.2, "rgba(255,255,255,0.6)");
		r.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = r;
		g.fillRect(0, 0, s, s);
	});
/** Redraws per second of the ignition lightning: each redraw is a new pattern, so it crackles. */
const ZAP_FPS = 22;
/** Half-size of the lightning drawing, in reactor radii: the bolts reach about this far out. */
const ZAP_REACH = 1.9;

/** The ignition discharge: a canvas the lightning is redrawn into while it lasts, on a glowing sprite. */
function zapCanvas() {
	const tex = canvasTexture(512, () => {});
	const c = tex.image as HTMLCanvasElement;
	const g = c.getContext("2d") as CanvasRenderingContext2D;
	const glow = themeColor("--reactor-glow");
	const core = themeColor("--arc-reactor");
	/** Draw one crackle: `reach` and `ring` in the drawing's unit disc, `alpha` its brightness. */
	const draw = (reach: number, ring: number, alpha: number) => {
		const S = c.width;
		const px = (x: number) => S / 2 + (x * S) / 2;
		const py = (y: number) => S / 2 - (y * S) / 2;
		g.clearRect(0, 0, S, S);
		g.globalCompositeOperation = "lighter";
		g.globalAlpha = alpha;
		g.lineCap = "round";
		g.lineJoin = "round";
		for (const { pts, width } of discharge(reach, ring, Math.random)) {
			g.beginPath();
			g.moveTo(px(pts[0][0]), py(pts[0][1]));
			for (const [x, y] of pts) g.lineTo(px(x), py(y));
			// a wide blue glow, then the white-hot core of the arc on top
			g.strokeStyle = glow;
			g.shadowColor = glow;
			g.shadowBlur = S * 0.018;
			g.lineWidth = width * S * 0.008;
			g.stroke();
			g.shadowBlur = 0;
			g.strokeStyle = core;
			g.lineWidth = width * S * 0.004;
			g.stroke();
		}
		tex.needsUpdate = true;
	};
	return { tex, draw };
}
/** A comet arc on a ring (bright head, fading tail), for the light that sweeps around the coils. */
const cometTexture = () =>
	canvasTexture(256, (g, s) => {
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

/** `core`, `facing`, `radius` and `top` (highest point of the reactor) are in the root's own space. */
type Rig = {
	root: THREE.Group;
	core: THREE.Vector3;
	facing: THREE.Vector3;
	radius: number;
	top: number;
	glow: THREE.MeshStandardMaterial[];
};

/**
 * Scales the reactor so its ring is REACTOR_SIZE across, stands its post on the plinth, centred on the root (so turning
 * the root spins it on the spot), and finds the glowing ring and core.
 * Works on a copy: the loader caches the original, and moving that one twice (dev mode runs this twice) drifts it away.
 */
function useRig(source: THREE.Group): Rig {
	return useMemo(() => {
		const scene = source.clone(true);
		scene.rotation.y = Math.PI; // the source model faces -Z; turn its glowing face toward the camera
		const root = new THREE.Group();
		root.add(scene);
		scene.updateMatrixWorld(true);
		const reactor = new THREE.Box3();
		scene.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (!mesh.isMesh) return;
			if ((mesh.material as THREE.Material).name === STAND_MATERIAL)
				mesh.visible = false;
			else reactor.union(new THREE.Box3().setFromObject(mesh));
		});
		const size = reactor.getSize(new THREE.Vector3());
		const scale = REACTOR_SIZE / Math.max(size.x, size.y);
		const mid = reactor.getCenter(new THREE.Vector3());
		scene.scale.setScalar(scale);
		const base = PLINTH_TOP + LIFT; // the bottom of the disc
		scene.position.set(
			-mid.x * scale,
			base - reactor.min.y * scale,
			-mid.z * scale,
		);
		scene.updateMatrixWorld(true);
		root.add(...stand(base, base + (size.y * scale) / 2, size.z * scale));
		const glow: THREE.MeshStandardMaterial[] = [];
		const core = new THREE.Box3();
		scene.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			const m = mesh.material as THREE.MeshStandardMaterial;
			m.envMapIntensity = 1;
			if (m.name === STAND_MATERIAL || m.name === DISC_MATERIAL)
				brushedSteel(m);
			if (m.name !== GLOW_MATERIAL) return;
			core.union(new THREE.Box3().setFromObject(mesh));
			if (glow.includes(m)) return;
			m.emissive.set(themeColor("--reactor-glow"));
			m.color.set(themeColor("--arc-reactor"));
			glow.push(m);
		});
		const ring = core.isEmpty()
			? new THREE.Vector3(0.5, 0.5, 0.1)
			: core.getSize(new THREE.Vector3());
		return {
			root,
			core: core.isEmpty()
				? new THREE.Vector3()
				: core.getCenter(new THREE.Vector3()),
			facing: new THREE.Vector3(0, 0, 1),
			radius: Math.max(ring.x, ring.y) / 2,
			top: base + size.y * scale,
			glow,
		};
	}, [source]);
}

/** Brushed stainless steel: the stand's look, like the display's metal. */
function brushedSteel(m: THREE.MeshStandardMaterial) {
	m.color.set(themeColor("--showcase-metal"));
	m.metalness = 1;
	m.roughness = 0.3;
	m.envMapIntensity = 1.3;
	return m;
}

/**
 * The base stand: a round steel foot on the plinth and a column that rises behind the disc into its centre, with a
 * collar just under the disc's rim. `base` is the disc's bottom, `centre` its centre height, `depth` its thickness.
 */
function stand(base: number, centre: number, depth: number) {
	const steel = brushedSteel(new THREE.MeshStandardMaterial());
	const z = -depth * 0.25; // just behind the middle of the disc, so the column disappears behind it
	const part = (geo: THREE.BufferGeometry, y: number) => {
		const m = new THREE.Mesh(geo, steel);
		m.position.set(0, y, z);
		m.castShadow = true;
		m.receiveShadow = true;
		return m;
	};
	const column = centre - PLINTH_TOP;
	return [
		part(
			new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, column, 48),
			PLINTH_TOP + column / 2,
		),
		part(
			new THREE.CylinderGeometry(
				COLUMN_RADIUS * 1.35,
				COLUMN_RADIUS * 1.35,
				0.05,
				48,
			),
			base - 0.01,
		),
		part(
			new THREE.CylinderGeometry(FOOT_RADIUS * 0.8, FOOT_RADIUS, 0.035, 64),
			PLINTH_TOP + 0.0175,
		),
	];
}

/** The reactor on its post: glows with the power level, turns slowly on the spot; drag to turn it. Starts switched off. */
function Reactor({
	input,
	onRig,
}: {
	input: Input;
	onRig: (rig: Rig) => void;
}) {
	const { scene } = useGLTF(ARC_REACTOR_URL, false, true);
	const rig = useRig(scene);
	const turn = useRef(0);
	useEffect(() => onRig(rig), [rig, onRig]);
	useFrame((state, dt) => {
		const t = state.clock.elapsedTime;
		const p = input.current;
		const { level, flash } = powerOf(p);
		const hum = 1 + Math.sin(t * 1.6) * 0.06 * level;
		for (const m of rig.glow)
			m.emissiveIntensity =
				FULL_GLOW * level * hum + (p?.hover ? 0.5 * level : 0) + flash * 2;
		const want = Math.sin(t * 0.3) * 0.12 + (p?.yaw ?? 0);
		turn.current +=
			(want - turn.current) * Math.min(1, dt * (p?.dragging ? 14 : 2.5));
		rig.root.rotation.y = turn.current;
	});
	return <primitive object={rig.root} />;
}

/**
 * Light inside the reactor: a point light in the core that lights the copper coils, soft halos, and through a boot the
 * sweep of light around the coils and the crackling electric discharge at ignition.
 */
function CoreGlow({ input, rig }: { input: Input; rig: Rig }) {
	const light = useRef<THREE.PointLight>(null);
	const spill = useRef<THREE.PointLight>(null);
	const zap = useMemo(zapCanvas, []);
	const parts = useMemo(() => {
		const color = themeColor("--reactor-glow");
		const sprite = (map: THREE.Texture) =>
			new THREE.Sprite(
				new THREE.SpriteMaterial({
					map,
					color,
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					transparent: true,
					toneMapped: false,
				}),
			);
		const glow = glowTexture();
		return {
			halo: sprite(glow),
			wide: sprite(glow),
			comet: sprite(cometTexture()),
			zap: new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: zap.tex,
					color: new THREE.Color(1, 1, 1).multiplyScalar(1.8), // above the bloom threshold, so the arcs glow
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					transparent: true,
					toneMapped: false,
				}),
			),
		};
	}, [zap]);
	const lastZap = useRef(-1);
	useEffect(
		() => () => {
			for (const s of Object.values(parts)) {
				const m = s.material as THREE.SpriteMaterial;
				m.map?.dispose();
				m.dispose();
			}
		},
		[parts],
	);
	useFrame((state) => {
		const t = state.clock.elapsedTime;
		const p = input.current;
		const { level, flash, sweep, shock } = powerOf(p);
		const hover = p?.hover ? 1 : 0;
		rig.root.updateMatrixWorld();
		const at = rig.core.clone().applyMatrix4(rig.root.matrixWorld);
		const out = rig.facing.clone().transformDirection(rig.root.matrixWorld);
		const r = rig.radius;
		// The ignition discharge crackles out from the core and fades; each redraw is a new pattern.
		const zapping = shock >= 0 ? (1 - shock) ** 1.5 : 0;
		const crackle = zapping > 0 ? 0.55 + Math.random() * 0.45 : 0;
		const now = seconds(); // not the R3F clock: it resets to 0 when the card scrolls back into view
		if (zapping > 0 && now - lastZap.current >= 1 / ZAP_FPS) {
			lastZap.current = now;
			zap.draw(0.55 + 0.45 * shock, 1 / ZAP_REACH, crackle);
		}
		if (light.current) {
			light.current.position.copy(at).addScaledVector(out, 0.3); // far enough out that the coils right by the core do not blow out
			light.current.intensity =
				0.3 * level +
				hover * 0.1 * level +
				flash * 0.8 +
				zapping * crackle * 1.5;
		}
		if (spill.current) {
			// in front of and below the ring: washes the post, the plinth and the glass blue, like the case's own light
			spill.current.position.copy(at).addScaledVector(out, 1.0);
			spill.current.position.y = PLINTH_TOP + 0.4;
			spill.current.intensity =
				0.7 * level + flash * 1 + zapping * crackle * 0.6;
		}
		const pulse = 1 + Math.sin(t * 1.6) * 0.05;
		const place = (
			s: THREE.Sprite,
			ahead: number,
			scale: number,
			opacity: number,
		) => {
			s.position.copy(at).addScaledVector(out, ahead);
			s.scale.setScalar(scale);
			(s.material as THREE.SpriteMaterial).opacity = Math.max(0, opacity);
			s.visible = opacity > 0.005;
		};
		place(
			parts.halo,
			0.05,
			r * 0.9 * pulse * (1 + flash * 0.5),
			0.22 * level + flash * 0.25,
		);
		place(
			parts.wide,
			0.07,
			r * 3 * pulse * (1 + flash),
			0.08 * level + flash * 0.12,
		);
		place(
			parts.comet,
			0.06,
			r * 2.1,
			sweep >= 0 ? Math.sin(Math.PI * sweep) : 0,
		);
		(parts.comet.material as THREE.SpriteMaterial).rotation =
			-sweep * Math.PI * 4; // two turns
		place(parts.zap, 0.08, r * ZAP_REACH * 2, zapping);
	});
	return (
		<>
			<pointLight
				ref={light}
				color={themeColor("--reactor-glow")}
				distance={1.4}
				decay={2}
			/>
			<pointLight
				ref={spill}
				color={themeColor("--reactor-glow")}
				distance={1.8}
				decay={2}
			/>
			<primitive object={parts.halo} />
			<primitive object={parts.wide} />
			<primitive object={parts.comet} />
			<primitive object={parts.zap} />
		</>
	);
}

const PLANE_VERT =
	"varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const BACKDROP_FRAG = `
varying vec2 vUv;
uniform vec3 uWall, uFloor, uGlow;
uniform float uLevel;
void main() {
  // a dark room: a little lighter behind the case, a little blue from the reactor
  float back = smoothstep(0.75, 0.0, distance(vUv * vec2(1.6, 1.0), vec2(0.8, 0.5)));
  vec3 col = mix(uFloor, uWall, smoothstep(0.1, 0.9, vUv.y) * 0.5 + back * 0.3);
  col += uGlow * back * back * 0.03 * uLevel;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * The display: a brushed-metal plinth with a glass case on it (thin panes that catch reflections, brighter edges like
 * real glass), a soft light from above, a dark room behind and a glossy table that reflects the glow.
 */
function Showcase({ input, rig }: { input: Input; rig: Rig | null }) {
	const top = rig ? rig.top + CASE_HEADROOM : 1.4;
	const h = top - PLINTH_TOP;
	const mats = useMemo(() => {
		const glassColor = themeColor("--showcase-glass");
		const metal = themeColor("--showcase-metal");
		return {
			glass: new THREE.MeshPhysicalMaterial({
				color: glassColor,
				metalness: 0,
				roughness: 0.04,
				transparent: true,
				opacity: 0.1,
				envMapIntensity: 2.2,
				side: THREE.DoubleSide,
				depthWrite: false,
			}),
			edge: new THREE.MeshStandardMaterial({
				color: glassColor,
				emissive: glassColor,
				emissiveIntensity: 0.06,
				metalness: 0,
				roughness: 0.1,
				transparent: true,
				opacity: 0.4,
			}),
			plinth: new THREE.MeshStandardMaterial({
				color: metal,
				metalness: 0.9,
				roughness: 0.34,
				envMapIntensity: 1.4,
			}),
			plate: new THREE.MeshStandardMaterial({
				color: metal,
				metalness: 0.6,
				roughness: 0.5,
			}),
			backdrop: new THREE.ShaderMaterial({
				vertexShader: PLANE_VERT,
				fragmentShader: BACKDROP_FRAG,
				depthWrite: false,
				uniforms: {
					uWall: { value: new THREE.Color(themeColor("--showcase-wall")) },
					uFloor: { value: new THREE.Color(themeColor("--showcase-floor")) },
					uGlow: { value: new THREE.Color(themeColor("--reactor-glow")) },
					uLevel: { value: 0 },
				},
			}),
		};
	}, []);
	useEffect(
		() => () => {
			for (const m of Object.values(mats)) m.dispose();
		},
		[mats],
	);
	useFrame(() => {
		mats.backdrop.uniforms.uLevel.value = powerOf(input.current).level;
	});
	const e = 0.008; // glass edge thickness
	const hw = CASE_W / 2;
	const hd = CASE_D / 2;
	const midY = PLINTH_TOP + h / 2;
	const pillars: [number, number][] = [
		[-hw, -hd],
		[hw, -hd],
		[-hw, hd],
		[hw, hd],
	];
	return (
		<>
			<spotLight
				position={[0, top + 2, -0.5]}
				angle={0.5}
				penumbra={0.9}
				intensity={5}
				distance={top + 4}
				decay={1.6}
				color={themeColor("--showcase-spot")}
				castShadow
				shadow-mapSize={[1024, 1024]}
				shadow-bias={-0.0003}
				shadow-radius={6}
			/>
			{/* plinth: a wide brushed-metal slab, a step the glass sits in, and a matte plate inside */}
			<mesh
				position={[0, 0.03, 0]}
				material={mats.plinth}
				castShadow
				receiveShadow
			>
				<boxGeometry args={[CASE_W + 0.2, 0.06, CASE_D + 0.2]} />
			</mesh>
			<mesh
				position={[0, 0.08, 0]}
				material={mats.plinth}
				castShadow
				receiveShadow
			>
				<boxGeometry args={[CASE_W + 0.06, 0.04, CASE_D + 0.06]} />
			</mesh>
			<mesh
				position={[0, PLINTH_TOP - 0.0125, 0]}
				material={mats.plate}
				receiveShadow
			>
				<boxGeometry args={[CASE_W - 0.02, 0.005, CASE_D - 0.02]} />
			</mesh>
			{/* glass: four walls and a lid */}
			<mesh position={[0, midY, -hd]} material={mats.glass}>
				<planeGeometry args={[CASE_W, h]} />
			</mesh>
			<mesh position={[0, midY, hd]} material={mats.glass}>
				<planeGeometry args={[CASE_W, h]} />
			</mesh>
			<mesh
				position={[-hw, midY, 0]}
				rotation={[0, Math.PI / 2, 0]}
				material={mats.glass}
			>
				<planeGeometry args={[CASE_D, h]} />
			</mesh>
			<mesh
				position={[hw, midY, 0]}
				rotation={[0, Math.PI / 2, 0]}
				material={mats.glass}
			>
				<planeGeometry args={[CASE_D, h]} />
			</mesh>
			<mesh
				position={[0, top, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				material={mats.glass}
			>
				<planeGeometry args={[CASE_W, CASE_D]} />
			</mesh>
			{/* glass edges: where a pane is seen edge-on it looks thick and green-blue */}
			{pillars.map(([x, z]) => (
				<mesh key={`p${x}${z}`} position={[x, midY, z]} material={mats.edge}>
					<boxGeometry args={[e, h, e]} />
				</mesh>
			))}
			{[top, PLINTH_TOP + e / 2].flatMap((y) => [
				<mesh key={`f${y}`} position={[0, y, hd]} material={mats.edge}>
					<boxGeometry args={[CASE_W, e, e]} />
				</mesh>,
				<mesh key={`b${y}`} position={[0, y, -hd]} material={mats.edge}>
					<boxGeometry args={[CASE_W, e, e]} />
				</mesh>,
				<mesh key={`l${y}`} position={[-hw, y, 0]} material={mats.edge}>
					<boxGeometry args={[e, e, CASE_D]} />
				</mesh>,
				<mesh key={`r${y}`} position={[hw, y, 0]} material={mats.edge}>
					<boxGeometry args={[e, e, CASE_D]} />
				</mesh>,
			])}
			<mesh position={[0, 1.4, -2.4]} material={mats.backdrop}>
				<planeGeometry args={[10, 5]} />
			</mesh>
			{/* glossy dark table: reflects the case and the glow */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
				<planeGeometry args={[10, 10]} />
				<MeshReflectorMaterial
					resolution={512}
					blur={[300, 100]}
					mixBlur={1}
					mixStrength={1.2}
					mirror={0.4}
					roughness={1}
					metalness={0.2}
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
		const target = new THREE.WebGLRenderTarget(1, 1, {
			type: THREE.HalfFloatType,
			samples: 4,
		});
		const composer = new EffectComposer(gl, target);
		composer.addPass(new RenderPass(scene, camera));
		const bloom = new UnrealBloomPass(
			new THREE.Vector2(256, 256),
			0.5,
			0.3,
			1.2,
		);
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

/** Camera: a front-on view of the case, slightly above, that follows the cursor a little and kicks at the ignition. */
function Director({ input, rig }: { input: Input; rig: Rig | null }) {
	const look = useMemo(() => new THREE.Vector3(), []);
	const want = useMemo(() => new THREE.Vector3(), []);
	useFrame((state, dt) => {
		const p = input.current;
		const { flash } = powerOf(p);
		const kick = flash * flash * 0.02;
		const mid = ((rig ? rig.top + CASE_HEADROOM : 1.4) + PLINTH_TOP) / 2;
		look.set(0, mid - 0.04, 0);
		want.set(
			(p?.x ?? 0) * 0.35 + (Math.random() - 0.5) * kick,
			mid + 0.3 + (p?.y ?? 0) * 0.15 + (Math.random() - 0.5) * kick,
			3.9 - flash * 0.12,
		);
		state.camera.position.lerp(want, Math.min(1, dt * 3));
		state.camera.lookAt(look);
	});
	return null;
}

export default function ArcReactorScene({
	input,
	active,
}: {
	input: Input;
	active: boolean;
}) {
	const [rig, setRig] = useState<Rig | null>(null);
	const { progress, active: loading } = useProgress();
	return (
		<>
			<Canvas
				shadows
				camera={{ position: [0, 1, 3.9], fov: 30 }}
				dpr={[1, 2]}
				frameloop={active ? "always" : "never"}
				gl={{
					antialias: false,
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 0.95,
				}}
			>
				<color attach="background" args={[themeColor("--showcase-floor")]} />
				<ambientLight intensity={0.05} />
				{/* Studio reflections for the copper, silver and gold (built locally: no download). */}
				<Environment resolution={256} frames={1}>
					{/* behind the camera and up behind the case: what the plinth's faces and the steel reflect */}
					<Lightformer
						form="rect"
						intensity={0.6}
						color={themeColor("--showcase-spot")}
						position={[0, 1.5, 6]}
						scale={[6, 2, 1]}
						target={[0, 0.6, 0]}
					/>
					<Lightformer
						form="rect"
						intensity={0.8}
						color={themeColor("--showcase-spot")}
						position={[0, 3, -3]}
						scale={[5, 2, 1]}
						target={[0, 0, 0]}
					/>
					<Lightformer
						form="rect"
						intensity={1.5}
						color={themeColor("--showcase-spot")}
						position={[0, 4, 0.5]}
						rotation={[Math.PI / 2, 0, 0]}
						scale={[3, 3, 1]}
					/>
					<Lightformer
						form="ring"
						intensity={1.2}
						color={themeColor("--showcase-spot")}
						position={[2.5, 1.5, 2.5]}
						scale={1.2}
						target={[0, 0.8, 0]}
					/>
					<Lightformer
						form="rect"
						intensity={0.7}
						color={themeColor("--reactor-deep")}
						position={[-3, 1, 1]}
						rotation={[0, Math.PI / 2, 0]}
						scale={[2, 3, 1]}
					/>
					<Lightformer
						form="rect"
						intensity={0.9}
						color={themeColor("--reactor-deep")}
						position={[3, 1, -2]}
						rotation={[0, -Math.PI / 2, 0]}
						scale={[2, 3, 1]}
					/>
				</Environment>
				<Showcase input={input} rig={rig} />
				<Suspense fallback={null}>
					<Reactor input={input} onRig={setRig} />
					{rig ? <CoreGlow input={input} rig={rig} /> : null}
					<Precompile />
				</Suspense>
				<Director input={input} rig={rig} />
				<Bloom input={input} />
			</Canvas>
			{loading || progress < 100 ? (
				<span className="reactor-boot" aria-hidden="true">
					LOADING… {Math.round(progress)}%
				</span>
			) : null}
		</>
	);
}
