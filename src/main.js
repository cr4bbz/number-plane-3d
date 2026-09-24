import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  admissibleBLimit,
  coneCoupling,
  coneIntersectionPoint,
  normPoint,
  normValue,
  nullSliceKind,
  phaseName,
} from './math.js';
import './style.css';

const CONFIG = {
  kappaLimit: 2,
  bMin: -3,
  bMax: 3,
  kappaSteps: 180,
  bSteps: 150,
  surfaceOpacity: 0.28,
  coneHeight: 4.2,
  conePlaneH: 1,
};

const COLORS = {
  ink: 0x1b1b1b,
  surface: 0x727b83,
  slice: 0xc0443c,
  projection: 0x2f67a3,
  eigen: 0x9a6b1f,
  null: 0x72539a,
  negativeSlice: 0x4c5f78,
  zeroSlice: 0x252525,
  positiveSlice: 0x8a5530,
  cone: 0x6d7882,
  plane: 0xbe9b62,
  intersection: 0xbb3d36,
  probe: 0x2f67a3,
};

function setupRenderer(host, background = 0xf4f2ed) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.fog = new THREE.Fog(background, 12, 40);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(6, 8, 7);
  scene.add(key);
  return { host, scene, camera, renderer, controls };
}

const numberView = setupRenderer(document.querySelector('#numberScene'));
const coneView = setupRenderer(document.querySelector('#coneScene'), 0xf1f0eb);
const numberRoot = new THREE.Group();
const coneRoot = new THREE.Group();
numberView.scene.add(numberRoot);
coneView.scene.add(coneRoot);

function makeLine(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

function disposeObject(obj) {
  obj.traverse?.((node) => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
    else node.material?.dispose();
  });
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function kappaAt(index) {
  const t = THREE.MathUtils.lerp(-1, 1, index / CONFIG.kappaSteps);
  const signedDense = Math.sign(t) * Math.pow(Math.abs(t), 2.15);
  return CONFIG.kappaLimit * signedDense;
}

function makeSurfaceBranch(sign) {
  const positions = [];
  const indices = [];
  const rowSize = CONFIG.bSteps + 1;
  for (let i = 0; i <= CONFIG.kappaSteps; i += 1) {
    const kappa = kappaAt(i);
    const bLimit = admissibleBLimit(kappa, CONFIG.bMax);
    for (let j = 0; j <= CONFIG.bSteps; j += 1) {
      const u = THREE.MathUtils.lerp(-1, 1, j / CONFIG.bSteps);
      const b = u * bLimit;
      const point = normPoint(kappa, b, sign);
      positions.push(point.a, point.b, point.kappa);
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
numberRoot.add(surfaceGroup);

function rebuildSurface() {
  clearGroup(surfaceGroup);
  surfaceGroup.add(makeSurfaceBranch(1), makeSurfaceBranch(-1));
}

function sliceCurves(kappa, color = COLORS.slice, samples = 420) {
  const branches = [[], []];
  const bLimit = admissibleBLimit(kappa, CONFIG.bMax);
  for (let j = 0; j <= samples; j += 1) {
    const b = THREE.MathUtils.lerp(-bLimit, bLimit, j / samples);
    for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
      const sign = branchIndex === 0 ? 1 : -1;
      const point = normPoint(kappa, b, sign);
      if (point) branches[branchIndex].push(new THREE.Vector3(point.a, point.b, point.kappa));
    }
  }
  const group = new THREE.Group();
  for (const branch of branches) {
    if (branch.length > 1) group.add(makeLine(branch, color, 0.96));
  }
  return group;
}

const referenceSlices = new THREE.Group();
referenceSlices.add(sliceCurves(-1, COLORS.negativeSlice));
referenceSlices.add(sliceCurves(0, COLORS.zeroSlice));
referenceSlices.add(sliceCurves(1, COLORS.positiveSlice));
numberRoot.add(referenceSlices);

let currentSlice = sliceCurves(0);
numberRoot.add(currentSlice);

const numberAxes = new THREE.Group();
numberRoot.add(numberAxes);
let numberGrid = null;

function numberSceneScale() {
  const aExtent = Math.sqrt(1 + CONFIG.kappaLimit * CONFIG.bMax * CONFIG.bMax);
  return Math.max(6, CONFIG.kappaLimit, aExtent);
}

function rebuildNumberAxesAndGrid() {
  clearGroup(numberAxes);
  const aExtent = Math.sqrt(1 + CONFIG.kappaLimit * CONFIG.bMax * CONFIG.bMax);
  const xExtent = Math.max(4.2, aExtent * 1.08);
  const zExtent = CONFIG.kappaLimit * 1.05;
  numberAxes.add(makeLine([new THREE.Vector3(-xExtent, 0, 0), new THREE.Vector3(xExtent, 0, 0)], COLORS.ink, 0.62));
  numberAxes.add(makeLine([new THREE.Vector3(0, -3.7, 0), new THREE.Vector3(0, 3.7, 0)], COLORS.ink, 0.40));
  numberAxes.add(makeLine([new THREE.Vector3(0, 0, -zExtent), new THREE.Vector3(0, 0, zExtent)], COLORS.ink, 0.40));
  if (numberGrid) {
    numberRoot.remove(numberGrid);
    disposeObject(numberGrid);
  }
  const size = Math.max(8, xExtent * 2.1);
  numberGrid = new THREE.GridHelper(size, 20, 0x777777, 0xbbbbbb);
  numberGrid.rotation.x = Math.PI / 2;
  numberGrid.position.z = -CONFIG.kappaLimit * 1.01;
  numberGrid.material.transparent = true;
  numberGrid.material.opacity = 0.19;
  numberRoot.add(numberGrid);
}

const probeMaterial = new THREE.MeshStandardMaterial({ color: COLORS.projection, roughness: 0.48 });
const probe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), probeMaterial);
numberRoot.add(probe);
const projected = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshStandardMaterial({ color: COLORS.ink }));
numberRoot.add(projected);
let projectionLine = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.projection, 0.72);
numberRoot.add(projectionLine);
const eigenGroup = new THREE.Group();
numberRoot.add(eigenGroup);

function rebuildEigenDirections(kappa) {
  clearGroup(eigenGroup);
  if (kappa <= 0) return;
  const slope = 1 / Math.sqrt(kappa);
  const aExtent = Math.min(Math.sqrt(1 + CONFIG.kappaLimit * CONFIG.bMax * CONFIG.bMax), CONFIG.bMax / slope);
  for (const sign of [-1, 1]) {
    eigenGroup.add(makeLine([
      new THREE.Vector3(-aExtent, sign * slope * -aExtent, kappa),
      new THREE.Vector3(aExtent, sign * slope * aExtent, kappa),
    ], COLORS.eigen, 0.9));
  }
}

const nullSurfaceGroup = new THREE.Group();
const nullSliceGroup = new THREE.Group();
numberRoot.add(nullSurfaceGroup, nullSliceGroup);

function makeNullSurfaceBranch(sign) {
  const positions = [];
  const indices = [];
  const kSteps = 110;
  const bSteps = 90;
  const row = bSteps + 1;
  for (let i = 0; i <= kSteps; i += 1) {
    const t = i / kSteps;
    const kappa = CONFIG.kappaLimit * t * t;
    const rootKappa = Math.sqrt(kappa);
    for (let j = 0; j <= bSteps; j += 1) {
      const b = THREE.MathUtils.lerp(CONFIG.bMin, CONFIG.bMax, j / bSteps);
      positions.push(sign * rootKappa * b, b, kappa);
    }
  }
  for (let i = 0; i < kSteps; i += 1) {
    for (let j = 0; j < bSteps; j += 1) {
      const p00 = i * row + j;
      const p01 = p00 + 1;
      const p10 = (i + 1) * row + j;
      const p11 = p10 + 1;
      indices.push(p00, p10, p11, p00, p11, p01);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: COLORS.null, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false }));
}

function rebuildNullSurface() {
  clearGroup(nullSurfaceGroup);
  nullSurfaceGroup.add(makeNullSurfaceBranch(1), makeNullSurfaceBranch(-1));
  nullSurfaceGroup.visible = document.querySelector('#nullToggle').checked;
}

function rebuildNullSlice(kappa) {
  clearGroup(nullSliceGroup);
  const kind = nullSliceKind(kappa);
  if (kind === 'origin') {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 12), new THREE.MeshStandardMaterial({ color: COLORS.null }));
    marker.position.set(0, 0, kappa);
    nullSliceGroup.add(marker);
  } else if (kind === 'one-line') {
    nullSliceGroup.add(makeLine([new THREE.Vector3(0, CONFIG.bMin, kappa), new THREE.Vector3(0, CONFIG.bMax, kappa)], COLORS.null, 0.96));
  } else {
    const rootKappa = Math.sqrt(kappa);
    for (const sign of [-1, 1]) {
      nullSliceGroup.add(makeLine([
        new THREE.Vector3(sign * rootKappa * CONFIG.bMin, CONFIG.bMin, kappa),
        new THREE.Vector3(sign * rootKappa * CONFIG.bMax, CONFIG.bMax, kappa),
      ], COLORS.null, 0.96));
    }
  }
  nullSliceGroup.visible = document.querySelector('#nullToggle').checked;
}

function makeDoubleConeGeometry(height = CONFIG.coneHeight, radialSteps = 72, axialSteps = 38) {
  const positions = [];
  const indices = [];
  const row = radialSteps + 1;
  for (const nappeSign of [-1, 1]) {
    const offset = positions.length / 3;
    for (let i = 0; i <= axialSteps; i += 1) {
      const z = nappeSign * height * (i / axialSteps);
      const radius = Math.abs(z);
      for (let j = 0; j <= radialSteps; j += 1) {
        const theta = (j / radialSteps) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), radius * Math.sin(theta), z);
      }
    }
    for (let i = 0; i < axialSteps; i += 1) {
      for (let j = 0; j < radialSteps; j += 1) {
        const p00 = offset + i * row + j;
        const p01 = p00 + 1;
        const p10 = offset + (i + 1) * row + j;
        const p11 = p10 + 1;
        indices.push(p00, p10, p11, p00, p11, p01);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const coneMesh = new THREE.Mesh(makeDoubleConeGeometry(), new THREE.MeshPhysicalMaterial({ color: COLORS.cone, transparent: true, opacity: 0.18, roughness: 0.82, side: THREE.DoubleSide, depthWrite: false }));
coneRoot.add(coneMesh);
const coneAxes = new THREE.Group();
coneAxes.add(makeLine([new THREE.Vector3(-5, 0, 0), new THREE.Vector3(5, 0, 0)], COLORS.ink, 0.34));
coneAxes.add(makeLine([new THREE.Vector3(0, -5, 0), new THREE.Vector3(0, 5, 0)], COLORS.ink, 0.34));
coneAxes.add(makeLine([new THREE.Vector3(0, 0, -5), new THREE.Vector3(0, 0, 5)], COLORS.ink, 0.52));
coneRoot.add(coneAxes);
const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), new THREE.MeshBasicMaterial({ color: COLORS.plane, transparent: true, opacity: 0.23, side: THREE.DoubleSide, depthWrite: false }));
coneRoot.add(planeMesh);
const intersectionGroup = new THREE.Group();
coneRoot.add(intersectionGroup);
const coneProbe = new THREE.Mesh(new THREE.SphereGeometry(0.095, 22, 16), new THREE.MeshStandardMaterial({ color: COLORS.probe, roughness: 0.4 }));
coneRoot.add(coneProbe);

function buildIntersectionSegments(coupling) {
  clearGroup(intersectionGroup);
  if (!coupling.available) return;
  const yMin = -CONFIG.coneHeight;
  const yMax = CONFIG.coneHeight;
  const samples = 900;
  for (const branchSign of [-1, 1]) {
    let currentSegment = [];
    const flush = () => {
      if (currentSegment.length > 1) intersectionGroup.add(makeLine(currentSegment, COLORS.intersection, 0.98));
      currentSegment = [];
    };
    for (let i = 0; i <= samples; i += 1) {
      const y = THREE.MathUtils.lerp(yMin, yMax, i / samples);
      const p = coneIntersectionPoint(y, branchSign, coupling, CONFIG.conePlaneH);
      const valid = p && Math.abs(p.z) <= CONFIG.coneHeight + 1e-6;
      if (valid) currentSegment.push(new THREE.Vector3(p.x, p.y, p.z));
      else flush();
    }
    flush();
  }
}

function updateConeGeometry(coupling, b, branchSign) {
  const notice = document.querySelector('#coneUnavailable');
  notice.hidden = coupling.available;
  if (!coupling.available) {
    planeMesh.visible = false;
    intersectionGroup.visible = false;
    coneProbe.visible = false;
    clearGroup(intersectionGroup);
    return;
  }
  planeMesh.rotation.set(coupling.alpha, 0, 0);
  planeMesh.position.set(0, 0, CONFIG.conePlaneH);
  planeMesh.visible = document.querySelector('#planeToggle').checked;
  buildIntersectionSegments(coupling);
  intersectionGroup.visible = document.querySelector('#intersectionToggle').checked;
  const probePoint = coneIntersectionPoint(b, branchSign, coupling, CONFIG.conePlaneH);
  const visibleProbe = probePoint && Math.abs(probePoint.z) <= CONFIG.coneHeight + 1e-6;
  coneProbe.visible = Boolean(visibleProbe) && document.querySelector('#coneProbeToggle').checked;
  if (visibleProbe) coneProbe.position.set(probePoint.x, probePoint.y, probePoint.z);
}

const kappaRange = document.querySelector('#kappaRange');
const kappaInput = document.querySelector('#kappa');
const bInput = document.querySelector('#bProbe');
const coneModeInput = document.querySelector('#coneMode');
const kappaValue = document.querySelector('#kappaValue');
const bValue = document.querySelector('#bValue');
const kappaTickMin = document.querySelector('#kappaTickMin');
const kappaTickMax = document.querySelector('#kappaTickMax');
const phaseEl = document.querySelector('#phase');
const pointReadout = document.querySelector('#pointReadout');
const normReadout = document.querySelector('#normReadout');
const nullReadout = document.querySelector('#nullReadout');
const coneReadout = document.querySelector('#coneReadout');
const conicReadout = document.querySelector('#conicReadout');
const mappingReadout = document.querySelector('#mappingReadout');
const probeMapReadout = document.querySelector('#probeMapReadout');
const playButton = document.querySelector('#playKappa');

let branchSign = 1;
let playing = false;
let playDirection = 1;

function updateProbeScale() {
  const markerScale = Math.max(1, numberSceneScale() / 8);
  probe.scale.setScalar(markerScale);
  projected.scale.setScalar(markerScale);
}

function replaceCurrentSlice(kappa) {
  numberRoot.remove(currentSlice);
  disposeObject(currentSlice);
  currentSlice = sliceCurves(kappa);
  currentSlice.visible = document.querySelector('#sliceToggle').checked;
  numberRoot.add(currentSlice);
}

function safeProbeState(kappa) {
  let b = Number(bInput.value);
  let point = normPoint(kappa, b, branchSign);
  if (!point) {
    const bMax = admissibleBLimit(kappa, CONFIG.bMax) * 0.999;
    b = Math.sign(b || 1) * Math.min(Math.abs(b), bMax);
    bInput.value = b.toFixed(2);
    point = normPoint(kappa, b, branchSign);
  }
  return { b, point };
}

function updateResearchReadouts(kappa, b, point, coupling) {
  kappaValue.value = kappa.toFixed(2);
  bValue.value = b.toFixed(2);
  phaseEl.textContent = phaseName(kappa);
  pointReadout.textContent = `z = ${point.a.toFixed(3)} ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(3)}ε`;
  normReadout.textContent = `Nκ(z) = ${normValue(point.a, point.b, kappa).toFixed(6)}`;
  const nullKind = nullSliceKind(kappa);
  nullReadout.textContent = nullKind === 'origin' ? 'nur triviale reelle Nullstelle' : nullKind === 'one-line' ? 'eine kritische Nullrichtung' : 'zwei Nullrichtungen = Eigenrichtungen';
  if (!coupling.available) {
    coneReadout.textContent = 'keine reelle exakte Ebene';
    conicReadout.textContent = 'Standardkegel: Definitionsgrenze κ = −1';
    mappingReadout.textContent = 'κcone = ∅';
    probeMapReadout.textContent = 'normierter Modus verfügbar';
    return;
  }
  const alphaDeg = THREE.MathUtils.radToDeg(coupling.alpha);
  coneReadout.textContent = `m = ${coupling.m.toFixed(3)} · α = ${alphaDeg.toFixed(2)}°`;
  conicReadout.textContent = `${coupling.conic} · e = ${coupling.eccentricity.toFixed(3)}`;
  mappingReadout.textContent = `${coupling.exact ? 'κcone' : 'κ̂'} = ${coupling.kappa.toFixed(4)}`;
  const conePoint = coneIntersectionPoint(b, branchSign, coupling, CONFIG.conePlaneH);
  probeMapReadout.textContent = conePoint && Math.abs(conePoint.z) <= CONFIG.coneHeight ? `b = ${b.toFixed(2)} trifft beide Modelle` : `b = ${b.toFixed(2)} liegt außerhalb des sichtbaren Kegelausschnitts`;
}

function updateAll() {
  const kappa = Number(kappaInput.value);
  const { b, point } = safeProbeState(kappa);
  const coupling = coneCoupling(kappa, coneModeInput.value);
  replaceCurrentSlice(kappa);
  rebuildEigenDirections(kappa);
  rebuildNullSlice(kappa);
  probe.position.set(point.a, point.b, point.kappa);
  projected.position.set(point.a, 0, 0);
  numberRoot.remove(projectionLine);
  disposeObject(projectionLine);
  projectionLine = makeLine([new THREE.Vector3(point.a, point.b, point.kappa), new THREE.Vector3(point.a, 0, 0)], COLORS.projection, 0.72);
  projectionLine.visible = document.querySelector('#projectionToggle').checked;
  numberRoot.add(projectionLine);
  updateConeGeometry(coupling, b, branchSign);
  updateResearchReadouts(kappa, b, point, coupling);
}

function fitNumberCamera() {
  const scale = numberSceneScale();
  numberView.camera.position.set(scale * 1.30, scale * 0.95, scale * 1.40);
  numberView.controls.target.set(0, 0, 0);
  numberView.controls.minDistance = Math.max(2.5, scale * 0.12);
  numberView.controls.maxDistance = scale * 7;
  numberView.scene.fog.near = scale * 1.7;
  numberView.scene.fog.far = scale * 5.2;
  numberView.controls.update();
}

function fitConeCamera() {
  coneView.camera.position.set(7.2, 5.3, 7.0);
  coneView.controls.target.set(0, 0, 0);
  coneView.controls.minDistance = 3.2;
  coneView.controls.maxDistance = 25;
  coneView.scene.fog.near = 10;
  coneView.scene.fog.far = 24;
  coneView.controls.update();
}

function updateKappaRange() {
  CONFIG.kappaLimit = Number(kappaRange.value);
  kappaInput.min = String(-CONFIG.kappaLimit);
  kappaInput.max = String(CONFIG.kappaLimit);
  kappaInput.step = CONFIG.kappaLimit <= 10 ? '0.01' : '0.05';
  kappaInput.value = String(THREE.MathUtils.clamp(Number(kappaInput.value), -CONFIG.kappaLimit, CONFIG.kappaLimit));
  kappaTickMin.textContent = `−${CONFIG.kappaLimit}`;
  kappaTickMax.textContent = `+${CONFIG.kappaLimit}`;
  rebuildSurface();
  rebuildNullSurface();
  rebuildNumberAxesAndGrid();
  updateProbeScale();
  updateAll();
  fitNumberCamera();
}

kappaRange.addEventListener('change', updateKappaRange);
kappaInput.addEventListener('input', updateAll);
bInput.addEventListener('input', updateAll);
coneModeInput.addEventListener('change', updateAll);
document.querySelectorAll('.branch').forEach((button) => {
  button.addEventListener('click', () => {
    branchSign = Number(button.dataset.branch);
    document.querySelectorAll('.branch').forEach((item) => item.classList.toggle('is-active', item === button));
    updateAll();
  });
});
document.querySelector('#surfaceToggle').addEventListener('change', (event) => { surfaceGroup.visible = event.target.checked; });
document.querySelector('#sliceToggle').addEventListener('change', (event) => { currentSlice.visible = event.target.checked; referenceSlices.visible = event.target.checked; });
document.querySelector('#projectionToggle').addEventListener('change', (event) => { projectionLine.visible = event.target.checked; projected.visible = event.target.checked; });
document.querySelector('#eigenToggle').addEventListener('change', (event) => { eigenGroup.visible = event.target.checked; });
document.querySelector('#nullToggle').addEventListener('change', (event) => { nullSurfaceGroup.visible = event.target.checked; nullSliceGroup.visible = event.target.checked; });
document.querySelector('#coneToggle').addEventListener('change', (event) => { coneMesh.visible = event.target.checked; });
document.querySelector('#planeToggle').addEventListener('change', () => updateAll());
document.querySelector('#intersectionToggle').addEventListener('change', () => updateAll());
document.querySelector('#coneProbeToggle').addEventListener('change', () => updateAll());
playButton.addEventListener('click', () => { playing = !playing; playButton.textContent = playing ? 'Animation stoppen' : 'κ animieren'; });
document.querySelector('#resetCameras').addEventListener('click', () => { fitNumberCamera(); fitConeCamera(); });

function resizeView(view) {
  const width = Math.max(1, view.host.clientWidth);
  const height = Math.max(1, view.host.clientHeight);
  const canvas = view.renderer.domElement;
  const ratio = view.renderer.getPixelRatio();
  const needResize = canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio);
  if (needResize) {
    view.renderer.setSize(width, height, false);
    view.camera.aspect = width / height;
    view.camera.updateProjectionMatrix();
  }
}

let previousTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  if (playing) {
    const speed = CONFIG.kappaLimit * 0.32;
    let kappa = Number(kappaInput.value) + playDirection * dt * speed;
    if (kappa >= CONFIG.kappaLimit) { kappa = CONFIG.kappaLimit; playDirection = -1; }
    else if (kappa <= -CONFIG.kappaLimit) { kappa = -CONFIG.kappaLimit; playDirection = 1; }
    kappaInput.value = kappa.toFixed(CONFIG.kappaLimit <= 10 ? 2 : 1);
    updateAll();
  }
  resizeView(numberView);
  resizeView(coneView);
  numberView.controls.update();
  coneView.controls.update();
  numberView.renderer.render(numberView.scene, numberView.camera);
  coneView.renderer.render(coneView.scene, coneView.camera);
}

rebuildSurface();
rebuildNullSurface();
rebuildNumberAxesAndGrid();
nullSurfaceGroup.visible = false;
nullSliceGroup.visible = false;
updateProbeScale();
updateAll();
fitNumberCamera();
fitConeCamera();
requestAnimationFrame(animate);
