/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Low-poly 3D load model. Lazy chunk: three.js is only downloaded when the OS/OW panel shows it.
// Built in inches (the same layout as the 2D schematic) and scaled to feet for the camera. Renders on
// demand — after an orbit, a resize, a theme switch or a new load — never in a loop.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { LEGAL } from "./equipment";
import { cargoBox, dimLabels, excessParts, extentX, legalEnvelope, type Box, type VisualModel } from "./visual";

type Palette = {
  bg: THREE.Color;
  ground: THREE.Color;
  grid: THREE.Color;
  body: THREE.Color;
  chassis: THREE.Color;
  tire: THREE.Color;
  glass: THREE.Color;
  deck: THREE.Color;
  cargo: THREE.Color;
  cargoEdge: THREE.Color;
  excess: THREE.Color;
  legal: THREE.Color;
  human: THREE.Color;
};

function cssColor(el: HTMLElement, name: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const c = new THREE.Color();
  try {
    c.setStyle(/^#|^rgb\(/.test(raw) ? raw : fallback);
  } catch {
    c.setStyle(fallback);
  }
  return c;
}

function readPalette(el: HTMLElement, theme: "light" | "dark"): Palette {
  const bg = cssColor(el, "--bg", theme === "light" ? "#f4f4f5" : "#0d0d0f");
  const ink = cssColor(el, "--ink", theme === "light" ? "#0a0a0a" : "#f2f2f4");
  const accent = cssColor(el, "--accent", "#3a5bff");
  const danger = cssColor(el, "--osw-danger", theme === "light" ? "#c53030" : "#f07171");
  const ok = cssColor(el, "--osw-ok", theme === "light" ? "#1d7a55" : "#4fb38a");
  const dark = theme === "dark";
  return {
    bg,
    ground: bg.clone().lerp(ink, dark ? 0.05 : 0.04),
    grid: bg.clone().lerp(ink, dark ? 0.16 : 0.14),
    body: new THREE.Color(dark ? "#5d6270" : "#7b808c"),
    chassis: new THREE.Color(dark ? "#2a2c32" : "#3a3c42"),
    tire: new THREE.Color("#18191c"),
    glass: new THREE.Color(dark ? "#1b2236" : "#2c3550"),
    deck: new THREE.Color(dark ? "#6b6f78" : "#8b8f98"),
    cargo: accent.clone().lerp(new THREE.Color(dark ? "#1c2140" : "#ffffff"), dark ? 0.35 : 0.5),
    cargoEdge: accent.clone().lerp(ink, 0.25),
    excess: danger,
    legal: ok,
    human: new THREE.Color(dark ? "#9aa0ab" : "#6f7480"),
  };
}

type Mats = {
  /** TRUCKBOX on the cab doors; its canvas texture is disposed with it. */
  logo: THREE.MeshBasicMaterial;
  body: THREE.MeshStandardMaterial;
  chassis: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  cargo: THREE.MeshStandardMaterial;
  cargoEdge: THREE.LineBasicMaterial;
  excess: THREE.MeshStandardMaterial;
  excessEdge: THREE.LineBasicMaterial;
  legal: THREE.MeshBasicMaterial;
  legalEdge: THREE.LineBasicMaterial;
  human: THREE.MeshStandardMaterial;
};

/** TRUCKBOX in white on a transparent canvas wide enough for a door. */
function logoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const context = canvas.getContext("2d");
  if (context) {
    context.font = "700 84px 'Neue Haas Grotesk Display Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.fillText("TRUCKBOX", canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeMats(): Mats {
  // fog: false everywhere on the rig — only the ground and grid fade out at the horizon.
  const std = (o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, fog: false, ...o });
  return {
    logo: new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, fog: false }),
    body: std({ roughness: 0.45, metalness: 0.15 }),
    chassis: std(),
    tire: std({ roughness: 0.95 }),
    glass: std({ roughness: 0.2, metalness: 0.3 }),
    deck: std({ roughness: 0.85 }),
    cargo: std({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    cargoEdge: new THREE.LineBasicMaterial({ fog: false }),
    excess: std({ transparent: true, opacity: 0.4, roughness: 0.5, depthWrite: false }),
    excessEdge: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9, fog: false }),
    legal: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    legalEdge: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7, fog: false }),
    human: std({ roughness: 0.9 }),
  };
}

function applyPalette(m: Mats, p: Palette) {
  m.body.color.copy(p.body);
  m.chassis.color.copy(p.chassis);
  m.tire.color.copy(p.tire);
  m.glass.color.copy(p.glass);
  m.deck.color.copy(p.deck);
  m.cargo.color.copy(p.cargo);
  m.cargoEdge.color.copy(p.cargoEdge);
  m.excess.color.copy(p.excess);
  m.excess.emissive.copy(p.excess).multiplyScalar(0.25);
  m.excessEdge.color.copy(p.excess);
  m.legal.color.copy(p.legal);
  m.legalEdge.color.copy(p.legal);
  m.human.color.copy(p.human);
}

// --- geometry helpers (inches) -----------------------------------------------------------------

function box(g: THREE.Group, b: Box, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(Math.max(0.1, b.x1 - b.x0), Math.max(0.1, b.y1 - b.y0), Math.max(0.1, b.z1 - b.z0));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  g.add(mesh);
  return mesh;
}

function b(x0: number, x1: number, y0: number, y1: number, zHalf: number, zc = 0): Box {
  return { x0, x1, y0, y1, z0: zc - zHalf, z1: zc + zHalf };
}

function wheel(g: THREE.Group, x: number, z: number, r: number, w: number, mats: Mats) {
  const geo = new THREE.CylinderGeometry(r, r, w, 18);
  geo.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(geo, mats.tire);
  tire.position.set(x, r, z);
  g.add(tire);
  const hubGeo = new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.6, 12);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, mats.deck);
  hub.position.set(x, r, z);
  g.add(hub);
}

function edges(g: THREE.Group, mesh: THREE.Mesh, mat: THREE.LineBasicMaterial) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat);
  e.position.copy(mesh.position);
  g.add(e);
}

function buildTractor(g: THREE.Group, T: number, mats: Mats) {
  box(g, b(18, T + 40, 28, 42, 18), mats.chassis);
  box(g, b(-5, 5, 16, 34, 47), mats.chassis);
  box(g, b(0, 56, 36, 70, 40), mats.body);
  box(g, b(4, 54, 70, 76, 36), mats.body);
  box(g, b(56, 124, 36, 140, 48), mats.body);
  box(g, b(55, 57.5, 100, 130, 42), mats.glass);
  box(g, b(70, 112, 100, 128, 0.8, 48.4), mats.glass);
  box(g, b(70, 112, 100, 128, 0.8, -48.4), mats.glass);
  // TRUCKBOX on both doors, under the side windows; the far side is turned so it reads from there.
  for (const side of [1, -1]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(58, 12.7), mats.logo);
    door.position.set(90, 84, side * 48.3);
    if (side < 0) door.rotation.y = Math.PI;
    g.add(door);
  }
  const sleeperEnd = Math.max(130, Math.min(176, T - 40));
  box(g, b(124, sleeperEnd, 42, 132, 48), mats.body);
  box(g, b(T - 12, T + 36, 42, 48, 30), mats.chassis);
  for (const z of [-44, 44]) {
    const tank = new THREE.CylinderGeometry(11, 11, 46, 16);
    tank.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(tank, mats.deck);
    m.position.set(96, 30, z);
    g.add(m);
    const stack = new THREE.CylinderGeometry(2.6, 2.6, 92, 10);
    const s = new THREE.Mesh(stack, mats.chassis);
    s.position.set(128, 104, z > 0 ? 46 : -46);
    g.add(s);
  }
  wheel(g, 34, 40, 20, 11, mats);
  wheel(g, 34, -40, 20, 11, mats);
  for (const x of [T - 10, T + 42]) {
    for (const z of [43, 31, -31, -43]) wheel(g, x, z, 20, 10, mats);
  }
}

function buildTrailer(g: THREE.Group, m: VisualModel, mats: Mats) {
  const { layout } = m;
  layout.segments.forEach((s, i) => {
    const narrow = s.kind === "neck" ? 40 : 51;
    box(g, b(s.x0, s.x1, s.topIn - 10, s.topIn, narrow), mats.deck);
    if (s.kind !== "deck" || i === 0) {
      // side rails under the low sections read better than a floating plank
      box(g, b(s.x0, s.x1, s.topIn - 16, s.topIn - 10, narrow - 6), mats.chassis);
    }
    if (i > 0) {
      const prev = layout.segments[i - 1];
      if (Math.abs(prev.topIn - s.topIn) >= 1) {
        const lo = Math.min(prev.topIn, s.topIn) - 10;
        const hi = Math.max(prev.topIn, s.topIn);
        box(g, b(s.x0 - 4, s.x0 + 4, lo, hi, Math.min(narrow, prev.kind === "neck" ? 40 : 51)), mats.deck);
      }
    }
  });
  const lastTop = layout.segments[layout.segments.length - 1]?.topIn ?? 48;
  const r = Math.max(13, Math.min(17, (lastTop - 12) / 2));
  for (const x of layout.trailerAxlesX) {
    for (const z of [43, 31, -31, -43]) wheel(g, x, z, r, 10, mats);
  }
}

function buildHuman(g: THREE.Group, x: number, z: number, mats: Mats) {
  box(g, b(x - 4, x + 4, 0, 33, 3.4, z - 4.2), mats.human);
  box(g, b(x - 4, x + 4, 0, 33, 3.4, z + 4.2), mats.human);
  box(g, b(x - 5, x + 5, 33, 58, 8.5, z), mats.human);
  box(g, b(x - 2.6, x + 2.6, 34, 57, 2.4, z - 11.2), mats.human);
  box(g, b(x - 2.6, x + 2.6, 34, 57, 2.4, z + 11.2), mats.human);
  const head = new THREE.Mesh(new THREE.SphereGeometry(5.4, 14, 10), mats.human);
  head.position.set(x, 64.6, z);
  g.add(head);
}

function buildModel(m: VisualModel, mats: Mats): { group: THREE.Group; anchors: Record<"w" | "h" | "l", THREE.Vector3> } {
  const g = new THREE.Group();
  const T = m.layout.tractorLengthIn;
  buildTractor(g, T, mats);
  buildTrailer(g, m, mats);

  const env = legalEnvelope(m);
  const envMesh = box(g, env, mats.legal);
  envMesh.renderOrder = 2;
  edges(g, envMesh, mats.legalEdge);

  const cargo = cargoBox(m);
  if (cargo) {
    const c = box(g, cargo, mats.cargo);
    edges(g, c, mats.cargoEdge);
    for (const part of excessParts(cargo, env)) {
      const e = 0.5;
      const mesh = box(g, { x0: part.x0 - e, x1: part.x1 + e, y0: part.y0 - e, y1: part.y1 + e, z0: part.z0 - e, z1: part.z1 + e }, mats.excess);
      mesh.renderOrder = 3;
      edges(g, mesh, mats.excessEdge);
    }
  }
  buildHuman(g, 22, (cargo ? Math.max(cargo.z1, 51) : 51) + 46, mats);

  const x1 = extentX(m);
  const top = cargo ? cargo.y1 : LEGAL.heightIn;
  const zNear = cargo ? Math.max(cargo.z1, 51) : 51;
  // Width across the top front edge of the load, height up its front near edge, length along the
  // ground on the near side — the faces a front-left view actually shows.
  const fx = cargo ? cargo.x0 : m.layout.trailerStartIn;
  const anchors = {
    w: new THREE.Vector3(fx, top + 9, 0),
    h: new THREE.Vector3(fx - 4, top * 0.5, zNear + 2),
    l: new THREE.Vector3(x1 / 2, 0, zNear + 34),
  };
  g.scale.setScalar(1 / 12);
  for (const v of Object.values(anchors)) v.multiplyScalar(1 / 12);
  return { group: g, anchors };
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

// --- engine ------------------------------------------------------------------------------------

type Engine = {
  setModel: (m: VisualModel) => void;
  setTheme: (theme: "light" | "dark") => void;
  resetView: () => void;
  /** factor < 1 moves the camera in, > 1 out. */
  zoomBy: (factor: number) => void;
  dispose: () => void;
};

/** One click of the + / − buttons. */
const ZOOM_STEP = 0.8;

/** Ground and grid size (feet, after the model's 1/12 scale) and the grid's cell. */
const GROUND_SIZE_FT = 2400;
const GRID_CELL_FT = 10;

type LabelEls = Record<"w" | "h" | "l", HTMLDivElement | null>;

function createEngine(host: HTMLDivElement, labels: LabelEls): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const w0 = Math.max(1, host.clientWidth);
  const h0 = Math.max(1, host.clientHeight);
  renderer.setSize(w0, h0);
  renderer.domElement.setAttribute("aria-label", "3D model of the truck, trailer and load. Drag to orbit.");
  renderer.domElement.title = "Drag to rotate · scroll or + / − to zoom · right-drag to move";
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.tabIndex = 0;
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, w0 / h0, 0.5, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  // Slower than the defaults: a quick flick of the mouse shouldn't spin the rig around.
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.6;
  controls.panSpeed = 0.6;
  controls.minDistance = 8;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.listenToKeyEvents(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a90, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-30, 60, 45);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(60, 25, -50);
  scene.add(fill);

  // Ground and grid are the same square and far bigger than the farthest zoom; fog in the
  // background colour fades both out, so neither a corner nor a round edge is ever seen.
  const groundMat = new THREE.MeshBasicMaterial();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE_FT, GROUND_SIZE_FT), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);
  let grid = new THREE.GridHelper(GROUND_SIZE_FT, GROUND_SIZE_FT / GRID_CELL_FT);
  scene.add(grid);
  const fog = new THREE.Fog(0xffffff, 100, 300);
  scene.fog = fog;

  const mats = makeMats();
  let current: { group: THREE.Group; anchors: Record<"w" | "h" | "l", THREE.Vector3> } | null = null;
  let model: VisualModel | null = null;
  let framedFor = "";
  let labelState: ReturnType<typeof dimLabels> = [];
  const tmp = new THREE.Vector3();

  const placeLabels = () => {
    if (!current) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    for (const l of labelState) {
      const el = labels[l.key];
      if (!el) continue;
      tmp.copy(current.anchors[l.key]).project(camera);
      const visible = !l.missing && tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      el.style.display = visible ? "block" : "none";
      if (!visible) continue;
      const x = Math.min(w - 8, Math.max(8, ((tmp.x + 1) / 2) * w));
      const y = Math.min(h - 12, Math.max(12, ((1 - tmp.y) / 2) * h));
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.textContent = l.text;
      el.className = "osw-3d-label" + (l.over ? " is-over" : "");
    }
  };

  const render = () => {
    // The horizon fades relative to how far out the camera is, so zooming never reaches an edge.
    const cameraDistance = camera.position.distanceTo(controls.target);
    fog.near = cameraDistance * 1.2;
    fog.far = cameraDistance * 2.8;
    renderer.render(scene, camera);
    placeLabels();
  };
  controls.addEventListener("change", render);

  const frame = () => {
    if (!model || !current) return;
    // Fit the whole rig + load (not the ground) for this canvas's aspect, from the front-left.
    const bounds = new THREE.Box3().setFromObject(current.group);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = (sphere.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.6;
    const target = sphere.center.clone();
    target.y = Math.min(target.y, (Math.max(LEGAL.heightIn, cargoBox(model)?.y1 ?? 0) / 12) * 0.42);
    const dir = new THREE.Vector3(-0.5, 0.34, 0.8).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    controls.target.copy(target);
    controls.update();
  };

  const setTheme = (t: "light" | "dark") => {
    const p = readPalette(host, t);
    scene.background = p.bg;
    fog.color.copy(p.bg);
    groundMat.color.copy(p.ground);
    scene.remove(grid);
    grid.geometry.dispose();
    (grid.material as THREE.Material).dispose();
    grid = new THREE.GridHelper(GROUND_SIZE_FT, GROUND_SIZE_FT / GRID_CELL_FT, p.grid, p.grid);
    scene.add(grid);
    applyPalette(mats, p);
    render();
  };

  const setModel = (m: VisualModel) => {
    model = m;
    if (current) {
      scene.remove(current.group);
      disposeTree(current.group);
    }
    current = buildModel(m, mats);
    scene.add(current.group);
    labelState = dimLabels(m);
    // Re-frame only when the rig changes, not on every keystroke in a dimension field.
    const sig = `${m.rig.id}|${Math.round(extentX(m) / 120)}`;
    if (sig !== framedFor) {
      framedFor = sig;
      frame();
    }
    render();
  };

  let lastAspect = camera.aspect;
  const ro = new ResizeObserver(() => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // A big change in shape (layout switch, phone rotation) re-frames; a few pixels don't.
    if (Math.abs(camera.aspect - lastAspect) / lastAspect > 0.25) frame();
    lastAspect = camera.aspect;
    render();
  });
  ro.observe(host);

  return {
    setModel,
    setTheme,
    resetView: () => {
      frame();
      render();
    },
    zoomBy: (factor: number) => {
      const offset = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.setLength(distance));
      controls.update();
      render();
    },
    dispose: () => {
      ro.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      if (current) disposeTree(current.group);
      disposeTree(scene);
      mats.logo.map?.dispose();
      Object.values(mats).forEach((mat) => mat.dispose());
      groundMat.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function LoadModel3D({
  model,
  theme,
  onFallback,
}: {
  model: VisualModel;
  theme: "light" | "dark";
  onFallback?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const wRef = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLDivElement>(null);
  const lRef = useRef<HTMLDivElement>(null);
  const [supported] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);

  // Created once; the two effects below (same commit, declared after) hand it the model and theme.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;
    let engine: Engine | null = null;
    try {
      engine = createEngine(host, { w: wRef.current, h: hRef.current, l: lRef.current });
      engineRef.current = engine;
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, [supported]);

  useEffect(() => {
    engineRef.current?.setModel(model);
  }, [model]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  if (!supported || failed) {
    return (
      <div className="osw-visual">
        <div className="osw-visual-empty">
          <span>3D needs WebGL, which this browser has turned off.</span>
          {onFallback && (
            <button type="button" className="osw-link" onClick={onFallback}>
              Show side &amp; rear views
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={hostRef} className="osw-visual">
      <div ref={wRef} className="osw-3d-label" style={{ display: "none" }} />
      <div ref={hRef} className="osw-3d-label" style={{ display: "none" }} />
      <div ref={lRef} className="osw-3d-label" style={{ display: "none" }} />
      <div className="osw-3d-tools">
        <button
          type="button"
          className="osw-icon-btn"
          aria-label="Reset view"
          title="Reset view"
          onClick={() => engineRef.current?.resetView()}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="osw-3d-zoom">
        <button
          type="button"
          className="osw-icon-btn"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => engineRef.current?.zoomBy(ZOOM_STEP)}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="osw-icon-btn"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => engineRef.current?.zoomBy(1 / ZOOM_STEP)}
        >
          <Minus size={14} />
        </button>
      </div>
    </div>
  );
}
