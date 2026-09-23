import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const CONFIG = {
  kappaLimit: 2,
  bMin: -3,
  bMax: 3,
  kappaSteps: 180,
  bSteps: 150,
  surfaceOpacity: 0.30,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f2ed);
scene.fog = new THREE.Fog(0xf4f2ed, 12, 40);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector('#scene').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(5, 8, 7);
scene.add(keyLight);

const root = new THREE.Group();
scene.add(root);

const COLORS = {
  ink: 0x1b1b1b,
  surface: 0x6f7880,
  slice: 0xc0443c,
  projection: 0x2f67a3,
  eigen: 0x9a6b1f,
  negativeSlice: 0x4c5f78,
  zeroSlice: 0x252525,
  positiveSlice: 0x8a5530,
};

function makeLine(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.((obj) => {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose();
    });
  }
}

function kappaAt(index) {
  const t = THREE.MathUtils.lerp(-1, 1, index / CONFIG.kappaSteps);
  const signedDense = Math.sign(t) * Math.pow(Math.abs(t), 2.15);
  return CONFIG.kappaLimit * signedDense;
}

function admissibleBLimit(kappa) {
  if (kappa >= 0) return CONFIG.bMax;
  return Math.min(CONFIG.bMax, 1 / Math.sqrt(-kappa));
}

function makeSurfaceBranch(sign) {
  const positions = [];
  const indices = [];
  const rowSize = CONFIG.bSteps + 1;

  for (let i = 0; i <= CONFIG.kappaSteps; i += 1) {
    const kappa = kappaAt(i);
    const bLimit = admissibleBLimit(kappa);

    for (let j = 0; j <= CONFIG.bSteps; j += 1) {
      const u = THREE.MathUtils.lerp(-1, 1, j / CONFIG.bSteps);
      const b = u * bLimit;
      const radicand = Math.max(0, 1 + kappa * b * b);
      const a = sign * Math.sqrt(radicand);
      positions.push(a, b, kappa);
    }
  }

  for (let i = 0; i < CONFIG.kappaSteps; i += 1) {
    for (let j = 0; j < CONFIG.bSteps; j += 1) {
      const p00 = i * rowSize + j;
      const p01 = p00 + 1;
      const p10 = (i + 1) * rowSize + j;
      const p11 = p10 + 1;
      indices.push(p00, p10, p11, p00, p11, p01);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: COLORS.surface,
    transparent: true,
    opacity: CONFIG.surfaceOpacity,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}

const surfaceGroup = new THREE.Group();
root.add(surfaceGroup);

function rebuildSurface() {
  clearGroup(surfaceGroup);
  surfaceGroup.add(makeSurfaceBranch(1), makeSurfaceBranch(-1));
}

function sliceCurves(kappa, color = COLORS.slice, samples = 360) {
  const branches = [[], []];

  for (let j = 0; j <= samples; j += 1) {
    const b = THREE.MathUtils.lerp(CONFIG.bMin, CONFIG.bMax, j / samples);
    const radicand = 1 + kappa * b * b;
    if (radicand < 0) continue;

    const a = Math.sqrt(radicand);
    branches[0].push(new THREE.Vector3(a, b, kappa));
    branches[1].push(new THREE.Vector3(-a, b, kappa));
  }

  const group = new THREE.Group();
  for (const branch of branches) {
    if (branch.length > 1) group.add(makeLine(branch, color, 0.95));
  }
  return group;
}

const referenceSlices = new THREE.Group();
referenceSlices.add(sliceCurves(-1, COLORS.negativeSlice));
referenceSlices.add(sliceCurves(0, COLORS.zeroSlice));
referenceSlices.add(sliceCurves(1, COLORS.positiveSlice));
root.add(referenceSlices);

let currentSlice = sliceCurves(0);
root.add(currentSlice);

const axes = new THREE.Group();
root.add(axes);

let grid = null;

function sceneScale() {
  const aExtent = Math.sqrt(1 + CONFIG.kappaLimit * CONFIG.bMax * CONFIG.bMax);
  return Math.max(6, CONFIG.kappaLimit, aExtent);
}

function rebuildAxesAndGrid() {
  clearGroup(axes);

  const aExtent = Math.sqrt(1 + CONFIG.kappaLimit * CONFIG.bMax * CONFIG.bMax);
  const xExtent = Math.max(4.2, aExtent * 1.08);
  const zExtent = CONFIG.kappaLimit * 1.05;

  axes.add(makeLine(
    [new THREE.Vector3(-xExtent, 0, 0), new THREE.Vector3(xExtent, 0, 0)],
    COLORS.ink,
    0.62,
  ));
  axes.add(makeLine(
    [new THREE.Vector3(0, -3.7, 0), new THREE.Vector3(0, 3.7, 0)],
    COLORS.ink,
    0.40,
  ));
  axes.add(makeLine(
    [new THREE.Vector3(0, 0, -zExtent), new THREE.Vector3(0, 0, zExtent)],
    COLORS.ink,
    0.40,
  ));

  if (grid) {
    root.remove(grid);
    grid.geometry?.dispose();
    grid.material?.dispose();
  }

  const size = Math.max(8, xExtent * 2.1);
  grid = new THREE.GridHelper(size, 20, 0x777777, 0xbbbbbb);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -CONFIG.kappaLimit * 1.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  root.add(grid);
}

function fitCamera() {
  const scale = sceneScale();
  camera.position.set(scale * 1.30, scale * 0.95, scale * 1.40);
  controls.target.set(0, 0, 0);
  controls.minDistance = Math.max(2.5, scale * 0.12);
  controls.maxDistance = scale * 7;
  scene.fog.near = scale * 1.7;
  scene.fog.far = scale * 5.2;
  controls.update();
}

const probeMaterial = new THREE.MeshStandardMaterial({ color: COLORS.projection, roughness: 0.48 });
const probe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), probeMaterial);
root.add(probe);

const projected = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 20, 14),
  new THREE.MeshStandardMaterial({ color: COLORS.ink }),
);
root.add(projected);

let projectionLine = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.projection, 0.7);
root.add(projectionLine);

const eigenGroup = new THREE.Group();
root.add(eigenGroup);

const kappaRange = document.querySelector('#kappaRange');
const kappaInput = document.querySelector('#kappa');
const bInput = document.querySelector('#bProbe');
const kappaValue = document.querySelector('#kappaValue');
const bValue = document.querySelector('#bValue');
const kappaTickMin = document.querySelector('#kappaTickMin');
const kappaTickMax = document.querySelector('#kappaTickMax');
const phaseEl = document.querySelector('#phase');
const pointReadout = document.querySelector('#pointReadout');
const projectionReadout = document.querySelector('#projectionReadout');
const invariantReadout = document.querySelector('#invariantReadout');
const playButton = document.querySelector('#playKappa');

let branchSign = 1;
let playing = false;
let playDirection = 1;

function phaseName(kappa) {
  if (kappa < -1e-6) return 'elliptisch';
  if (kappa > 1e-6) return 'hyperbolisch';
  return 'parabolisch';
}

function replaceCurrentSlice(kappa) {
  root.remove(currentSlice);
  currentSlice.traverse((obj) => {
    obj.geometry?.dispose();
    obj.material?.dispose();
  });

  currentSlice = sliceCurves(kappa);
  currentSlice.visible = document.querySelector('#sliceToggle').checked;
  root.add(currentSlice);
}

function rebuildEigenDirections(kappa) {
  clearGroup(eigenGroup);
  if (kappa <= 0) return;

  const slope = 1 / Math.sqrt(kappa);
  const aExtent = Math.min(
    Math.sqrt(1 + CONFIG.kappaLimit * CONFIG.bMax * CONFIG.bMax),
    CONFIG.bMax / slope,
  );

  for (const sign of [-1, 1]) {
    const points = [
      new THREE.Vector3(-aExtent, sign * slope * -aExtent, kappa),
      new THREE.Vector3(aExtent, sign * slope * aExtent, kappa),
    ];
    eigenGroup.add(makeLine(points, COLORS.eigen, 0.9));
  }
}

function updateProbeScale() {
  const markerScale = Math.max(1, sceneScale() / 8);
  probe.scale.setScalar(markerScale);
  projected.scale.setScalar(markerScale);
}

function updateProbe() {
  const kappa = Number(kappaInput.value);
  let b = Number(bInput.value);
  let radicand = 1 + kappa * b * b;

  if (radicand < 0) {
    const bMax = kappa < 0 ? 1 / Math.sqrt(-kappa) : CONFIG.bMax;
    b = Math.sign(b || 1) * Math.min(Math.abs(b), bMax * 0.999);
    bInput.value = b.toFixed(2);
    radicand = Math.max(0, 1 + kappa * b * b);
  }

  const a = branchSign * Math.sqrt(radicand);
  probe.position.set(a, b, kappa);
  projected.position.set(a, 0, 0);

  root.remove(projectionLine);
  projectionLine.geometry.dispose();
  projectionLine.material.dispose();
  projectionLine = makeLine(
    [new THREE.Vector3(a, b, kappa), new THREE.Vector3(a, 0, 0)],
    COLORS.projection,
    0.72,
  );
  projectionLine.visible = document.querySelector('#projectionToggle').checked;
  root.add(projectionLine);

  kappaValue.value = `κ = ${kappa.toFixed(2)}`;
  bValue.value = `b = ${b.toFixed(2)}`;
  phaseEl.textContent = phaseName(kappa);
  pointReadout.textContent = `z = ${a.toFixed(3)} ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(3)}ε`;
  projectionReadout.textContent = `π(z) = ${a.toFixed(3)}`;
  invariantReadout.textContent = `ε² = κ = ${kappa.toFixed(2)}`;
}

function updateKappa() {
  const kappa = Number(kappaInput.value);
  replaceCurrentSlice(kappa);
  rebuildEigenDirections(kappa);
  updateProbe();
}

function updateKappaRange() {
  CONFIG.kappaLimit = Number(kappaRange.value);

  kappaInput.min = String(-CONFIG.kappaLimit);
  kappaInput.max = String(CONFIG.kappaLimit);
  kappaInput.step = CONFIG.kappaLimit <= 10 ? '0.01' : '0.05';

  const current = THREE.MathUtils.clamp(
    Number(kappaInput.value),
    -CONFIG.kappaLimit,
    CONFIG.kappaLimit,
  );
  kappaInput.value = String(current);

  kappaTickMin.textContent = `−${CONFIG.kappaLimit}`;
  kappaTickMax.textContent = `+${CONFIG.kappaLimit}`;

  rebuildSurface();
  rebuildAxesAndGrid();
  updateProbeScale();
  updateKappa();
  fitCamera();
}

kappaRange.addEventListener('change', updateKappaRange);
kappaInput.addEventListener('input', updateKappa);
bInput.addEventListener('input', updateProbe);

document.querySelectorAll('.branch').forEach((button) => {
  button.addEventListener('click', () => {
    branchSign = Number(button.dataset.branch);
    document.querySelectorAll('.branch').forEach((item) => {
      item.classList.toggle('is-active', item === button);
    });
    updateProbe();
  });
});

document.querySelector('#surfaceToggle').addEventListener('change', (event) => {
  surfaceGroup.visible = event.target.checked;
});
document.querySelector('#sliceToggle').addEventListener('change', (event) => {
  currentSlice.visible = event.target.checked;
  referenceSlices.visible = event.target.checked;
});
document.querySelector('#projectionToggle').addEventListener('change', (event) => {
  projectionLine.visible = event.target.checked;
  projected.visible = event.target.checked;
});
document.querySelector('#eigenToggle').addEventListener('change', (event) => {
  eigenGroup.visible = event.target.checked;
});

playButton.addEventListener('click', () => {
  playing = !playing;
  playButton.textContent = playing ? 'Animation stoppen' : 'κ animieren';
});

document.querySelector('#resetCamera').addEventListener('click', fitCamera);

let previousTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  if (playing) {
    const speed = CONFIG.kappaLimit * 0.32;
    let kappa = Number(kappaInput.value) + playDirection * dt * speed;

    if (kappa >= CONFIG.kappaLimit) {
      kappa = CONFIG.kappaLimit;
      playDirection = -1;
    } else if (kappa <= -CONFIG.kappaLimit) {
      kappa = -CONFIG.kappaLimit;
      playDirection = 1;
    }

    kappaInput.value = kappa.toFixed(CONFIG.kappaLimit <= 10 ? 2 : 1);
    updateKappa();
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

rebuildSurface();
rebuildAxesAndGrid();
updateProbeScale();
updateKappa();
fitCamera();
requestAnimationFrame(animate);
