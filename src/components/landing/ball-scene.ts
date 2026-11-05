/**
 * The cricket ball, in WebGL.
 *
 * Three.js is imported here and nowhere else, and this module is only ever
 * reached through a dynamic import, so the page reads before any of it arrives.
 * Leather, seam and stamp are painted to canvases rather than shipped as images:
 * no asset to load, and the bump and shine maps come from the same drawing.
 *
 * Each scene owns a canvas it creates and removes. A canvas whose WebGL context
 * has died can never get a working one back, so one must never be reused: doing
 * that is what showed a broken-image box in place of the ball.
 */

export interface BallScene {
  /** Radians. Renders once; nothing draws unless something moved. */
  spin: (x: number, y: number, z?: number) => void;
  resize: () => void;
  /** Whether the graphics context has died behind our back. */
  lost: () => boolean;
  dispose: () => void;
}

type Layer = "colour" | "bump" | "shine";

/** Deterministic, so the ball is the same ball on every visit. */
function randomFrom(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function paint(size: number, layer: Layer): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size / 2;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("No 2D canvas.");
  const w = canvas.width;
  const h = canvas.height;
  const mid = h / 2;

  // Shine: bright is rough. One half is kept polished and one is worn dull,
  // the way bowlers really work a ball.
  c.fillStyle = layer === "colour" ? "#9e1610" : layer === "bump" ? "#808080" : "#4a4a4a";
  c.fillRect(0, 0, w, h);

  if (layer === "shine") {
    const wear = c.createLinearGradient(w * 0.3, 0, w * 0.7, 0);
    wear.addColorStop(0, "rgba(190,190,190,0)");
    wear.addColorStop(1, "rgba(190,190,190,1)");
    c.fillStyle = wear;
    c.fillRect(w * 0.3, 0, w * 0.7, h);
  }

  const rand = randomFrom(7);
  for (let i = 0; i < 30000; i++) {
    const light = rand() > 0.5;
    c.fillStyle =
      layer === "colour"
        ? light ? "rgba(190,50,36,0.06)" : "rgba(44,3,3,0.08)"
        : light ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    c.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 2);
  }

  // Scuffs on the worn half, from a few overs of landing on a hard pitch.
  const scuff = randomFrom(31);
  c.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const x = w * (0.55 + scuff() * 0.43);
    const y = h * (0.12 + scuff() * 0.76);
    if (Math.abs(y - mid) < h * 0.09) continue;
    c.strokeStyle =
      layer === "colour" ? `rgba(226,150,120,${0.1 + scuff() * 0.18})`
      : layer === "bump" ? "rgba(40,40,40,0.5)"
      : "rgba(255,255,255,0.8)";
    c.lineWidth = 1 + scuff() * 2.4;
    const a = scuff() * Math.PI;
    const l = 8 + scuff() * 34;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }

  // The seam: a raised band with stitches in rows along both sides of it.
  c.fillStyle = layer === "colour" ? "#7c1510" : layer === "bump" ? "#e4e4e4" : "#303030";
  c.fillRect(0, mid - h * 0.03, w, h * 0.06);

  const stitch = (y: number, tilt: number, alpha: number) => {
    c.strokeStyle = layer === "shine" ? "rgba(235,235,235,0.9)"
      : layer === "bump" ? `rgba(255,255,255,${alpha})`
      : `rgba(244,233,212,${alpha})`;
    c.lineWidth = h * 0.0062;
    const step = w / 170;
    for (let x = 0; x < w + step; x += step) {
      c.beginPath();
      c.moveTo(x, y - h * 0.0075);
      c.lineTo(x + step * tilt, y + h * 0.0075);
      c.stroke();
    }
  };
  // Six rows, as on a real ball: the middle pair strongest.
  stitch(mid - h * 0.021, 0.6, 0.98);
  stitch(mid + h * 0.021, -0.6, 0.98);
  stitch(mid - h * 0.046, 0.5, 0.72);
  stitch(mid + h * 0.046, -0.5, 0.72);
  stitch(mid - h * 0.074, 0.4, 0.3);
  stitch(mid + h * 0.074, -0.4, 0.3);

  // The maker's stamp in gold foil, on the polished side.
  const stamp = (cx: number, cy: number) => {
    c.save();
    c.translate(cx, cy);
    // The texture is squashed at this latitude, so stretch to read as round.
    c.scale(1.5, 1);
    c.textAlign = "center";
    c.textBaseline = "middle";
    const ink = layer === "colour" ? "#efc15a" : layer === "bump" ? "#c4c4c4" : "#1c1c1c";
    c.fillStyle = ink;
    c.strokeStyle = ink;
    c.lineWidth = h * 0.003;
    c.font = `800 ${h * 0.05}px Arial, sans-serif`;
    c.fillText("CRICKIT", 0, 0);
    c.font = `700 ${h * 0.017}px Arial, sans-serif`;
    c.fillText("BOWL IT · CALL IT · KEEP IT", 0, h * 0.043);
    c.beginPath();
    c.arc(0, h * 0.005, h * 0.085, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  };
  stamp(w * 0.2, h * 0.27);
  stamp(w * 0.2, h * 0.73);

  return canvas;
}

export async function createBall(
  host: HTMLElement,
  onLost: () => void,
): Promise<BallScene> {
  const THREE = await import("three");
  const { RoomEnvironment } = await import(
    "three/examples/jsm/environments/RoomEnvironment.js"
  );

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:pan-y";
  host.appendChild(canvas);

  const lostListener = (event: Event) => {
    // Without this the browser will not offer the context back, and paints a
    // broken-image box where the canvas was.
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lostListener);

  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    canvas.remove();
    throw err;
  }
  // Past 1.5 a phone is paying for pixels nobody can see on a moving ball.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  camera.position.z = 4.5;

  // A soft room to reflect, which is what makes lacquer read as lacquer.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.09).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.22;

  const map = new THREE.CanvasTexture(paint(2048, "colour"));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const bumpMap = new THREE.CanvasTexture(paint(1024, "bump"));
  const roughnessMap = new THREE.CanvasTexture(paint(1024, "shine"));
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const material = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 1.5,
    roughnessMap,
    roughness: 1,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  });

  const ball = new THREE.Mesh(geometry, material);
  // Tilted off the axis, the way a seam bowler holds it.
  const grip = new THREE.Group();
  grip.rotation.z = 0.5;
  grip.add(ball);
  scene.add(grip);

  const key = new THREE.DirectionalLight(0xfff4e2, 1.9);
  key.position.set(-2.5, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc98a, 1.1);
  rim.position.set(3, -1.5, -2);
  scene.add(rim);

  const draw = () => {
    if (!renderer.getContext().isContextLost()) renderer.render(scene, camera);
  };

  const resize = () => {
    const box = host.getBoundingClientRect();
    if (!box.width) return;
    // The layout size, untouched by any scale the page has on it right now.
    const size = host.offsetWidth || box.width;
    renderer.setSize(size, host.offsetHeight || box.height, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    draw();
  };
  resize();

  return {
    spin(x, y, z = 0) {
      ball.rotation.set(x, y, 0);
      grip.rotation.z = 0.5 + z;
      draw();
    },
    resize,
    lost: () => renderer.getContext().isContextLost(),
    dispose() {
      canvas.removeEventListener("webglcontextlost", lostListener);
      geometry.dispose();
      material.dispose();
      map.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
