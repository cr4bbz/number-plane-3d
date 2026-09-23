import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const CONFIG = {
  kappaMin: -2,
  kappaMax: 2,
  bMin: -3,
  bMax: 3,
  kappaSteps: 118,
  bSteps: 150,
  surfaceOpacity: 0.30,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f2ed);
scene.fog = new THREE.Fog(0xf4f2ed, 12, 26);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(7.8, 5.7, 8.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector('#scene').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.target.set(0, 0, 0);
controls.minDistance = 4.5;
controls.maxDistance = 24;

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

function makeSurfaceBranch(sign) {
  const positions = [];
  const indices = [];
  const rowSize = CONFIG.bSteps + 1;

  for (let i = 0; i <= CONFIG.kappaSteps; i += 1) {
    const kappa = THREE.MathUtils.lerp(CONFIG.kappaMin, CONFIG.kappaMax, i / CONFIG.kappaSteps);
    for (let j = 0; j <= CONFIG.bSteps; j += 1) {
      const b = THREE.MathUtils.lerp(CONFIG.bMin, CONFIG.bMax, j / CONFIG.bSteps);
      const radicand = 1 + kappa * b * b;
      const a = radicand >= 0 ? sign * Math.sqrt(radicand) : Number.NaN;
      positions.push(a, b, kappa);
    }
  }

  const valid = (idx) => Number.isFinite(positions[idx * 3]);
  for (let i = 0; i < CONFIG.kappaSteps; i += 1) {
    for (let j = 0; j < CONFIG.bSteps; j += 1) {
      const p00 = i * rowSize + j;
      const p01 = p00 + 1;
      const p10 = (i + 1) * rowSize + j;
      const p11 = p10 + 1;

      if (valid(p00) && valid(p10) && valid(p11)) indices.push(p00, p10, p11);
      if (valid(p00) && valid(p11) && valid(p01)) indices.push(p00, p11, p01);
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
surfaceGroup.add(makeSurfaceBranch(1), makeSurfaceBranch(-1));
root.add(surfaceGroup);

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
  const g = new THREE.Group();
  for (const branch of branches) {
    if (branch.length > 1) g.add(makeLine(branch, color, 0.95));
  }
  return g;
}

const referenceSlices = new THREE.Group();
referenceSlices.add(sliceCurves(-1, COLORS.negativeSlice));
referenceSlices.add(sliceCurves(0, COLORS.zeroSlice));
referenceSlices.add(sliceCurves(1, COLORS.positiveSlice));
root.add(referenceSlices);

let currentSlice = sliceCurves(0);
root.add(currentSlice);

const axes = new THREE.Group();
axes.add(makeLine([new THREE.Vector3(-4.2, 0, 0), new THREE.Vector3(4.2, 0, 0)], COLORS.ink, 0.62));
axes.add(makeLine([new THREE.Vector3(0, -3.7, 0), new THREE.Vector3(0, 3.7, 0)], COLORS.ink, 0.40));
axes.add(makeLine([new THREE.Vector3(0, 0, -2.5), new THREE.Vector3(0, 0, 2.5)], COLORS.ink, 0.40));
root.add(axes);

const grid = new THREE.GridHelper(8, 16, 0x777777, 0xbbbbbb);
grid.rotation.x = Math.PI / 2;
grid.position.z = -2.02;
grid.material.transparent = true;
grid.material.opacity = 0.22;
root.add(grid);

const probeMaterial = new THREE.MeshStandardMaterial({ color: COLORS.projection, roughness: 0.48 });
const probe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), probeMaterial);
root.add(probe);

const projected = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshStandardMaterial({ color: COLORS.ink }));
root.add(projected);

let projectionLine = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.projection, 0.7);
root.add(projectionLine);

const eigenGroup = new THREE.Group();
root.add(eigenGroup);

const kappaInput = document.querySelector('#kappa');
const bInput = document.querySelector('#bProbe');
const kappaValue = document.querySelector('#kappaValue');
const bValue = document.querySelector('#bValue');
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
  while (eigenGroup.children.length) {
    const child = eigenGroup.children.pop();
    child.geometry?.dispose();
    child.material?.dispose();
  }
  if (kappa <= 0) return;

  const slope = 1 / Math.sqrt(kappa);
  const aExtent = Math.min(3.2, 3 / slope);
  for (const s of [-1, 1]) {
    const points = [
      new THREE.Vector3(-aExtent, s * slope * -aExtent, kappa),
      new THREE.Vector3(aExtent, s * slope * aExtent, kappa),
    ];
    eigenGroup.add(makeLine(points, COLORS.eigen, 0.9));
  }
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

kappaInput.addEventListener('input', updateKappa);
bInput.addEventListener('input', updateProbe);

document.querySelectorAll('.branch').forEach((button) => {
  button.addEventListener('click', () => {
    branchSign = Number(button.dataset.branch);
    document.querySelectorAll('.branch').forEach((b) => b.classList.toggle('is-active', b === button));
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

document.querySelector('#resetCamera').addEventListener('click', () => {
  camera.position.set(7.8, 5.7, 8.5);
  controls.target.set(0, 0, 0);
  controls.update();
});

let previousTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  if (playing) {
    let kappa = Number(kappaInput.value) + playDirection * dt * 0.65;
    if (kappa >= CONFIG.kappaMax) {
      kappa = CONFIG.kappaMax;
      playDirection = -1;
    } else if (kappa <= CONFIG.kappaMin) {
      kappa = CONFIG.kappaMin;
      playDirection = 1;
    }
    kappaInput.value = kappa.toFixed(2);
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

updateKappa();
requestAnimationFrame(animate);
