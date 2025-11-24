import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { generateSunflowerPoints } from "./helpers/sunflowerDistribution";
import { spherePointToUV } from "./helpers/spherePointToUV";
import { latLonToXYZ } from "./helpers/latLonToXYZ";

import {
  GLOBE_RADIUS,
  DOT_COUNT,
  ARC_NODES,
  textureLoader,
  ARC_TEXTURE_PATHS,
  DOTS_FRAGMENT_SHADER,
  DOTS_VERTEX_SHADER,
  GLOBE_LAND_MAP,
  DISK_TEXTURE,
} from "@/components/Globe/constants";

/* STATE VARIABLES */
let dotsGeometry: THREE.BufferGeometry | null = null; // All globe points (Based on image: landmask)
let dotsMaterial: THREE.ShaderMaterial | null = null; // All globe points (Based on the defined shaders: material, size, etc)

// Wave Effect
let raycaster: THREE.Raycaster = new THREE.Raycaster();
let mouse: THREE.Vector2 = new THREE.Vector2();
let clickPosition: THREE.Vector3 | null = null;
let clickStartTime = 0;
let activationTime: number[] = []; // Depending on the distance between the pulse (click) each point will activate in an specific time to make the wave effect
let originalPositions: number[] = [];
let randomOffsets: number[] = [];
let rotationPaused = false;
let elevating = false;

// Arcs
let arcMaterials: THREE.MeshBasicMaterial[] | null = null;
let ARC_TEXTURES: THREE.Texture[] | null = null;
let DISC_TEXTURE: THREE.Texture | null = null;
let activeArcs: GlobeArc[] = [];
let arcIntervalId: ReturnType<typeof setTimeout> | null = null;
let discIntervalId: ReturnType<typeof setTimeout> | null = null;

let isPageVisible = true; // Used to solve creation of extra arcs when tab is inactive

/* FUNCTIONS */
function loadLandDots(globeGroup: THREE.Group) {
  const loader = new THREE.ImageLoader();

  loader.load(GLOBE_LAND_MAP, (image) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, image.width, image.height);
    const pixels = imgData.data; // Extract all image RGBA pixels (None = Ocean | Black = Land)

    const points = generateSunflowerPoints(DOT_COUNT, GLOBE_RADIUS);
    const vertices: number[] = [];
    originalPositions = [];
    randomOffsets = [];

    points.forEach((p) => {
      const uv = spherePointToUV(p, GLOBE_RADIUS);
      const x = Math.floor(uv.x * image.width);
      const y = Math.floor(uv.y * image.height);

      const idx = (y * image.width + x) * 4;
      const alpha = pixels[idx + 3]; // Check if it is land or ocean

      if (alpha > 0) {
        const elevated = p
          .clone()
          .normalize()
          .multiplyScalar(GLOBE_RADIUS + 2);

        vertices.push(elevated.x, elevated.y, elevated.z);
        originalPositions.push(elevated.x, elevated.y, elevated.z);
        randomOffsets.push(Math.random()); // wave effect variation
      }
    });

    dotsGeometry = new THREE.BufferGeometry();
    dotsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );

    dotsGeometry.setAttribute(
      "randomOffset",
      new THREE.Float32BufferAttribute(randomOffsets, 1)
    );

    dotsMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: DOTS_VERTEX_SHADER,
      fragmentShader: DOTS_FRAGMENT_SHADER,
      depthWrite: true,
      depthTest: true,
      transparent: true,
    });

    globeGroup.add(new THREE.Points(dotsGeometry, dotsMaterial));
  });
}

class GlobeArc {
  group: THREE.Group;
  startLL: [number, number];
  endLL: [number, number];
  geometry: THREE.TubeGeometry;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> | null;
  originDisc: THREE.Sprite | null;
  destDisc: THREE.Sprite | null;
  maxDraw: number;
  phase: "grow" | "fade" | "done";
  elapsed: number;
  growDuration: number;
  fadeDuration: number;
  constructor(
    globeGroup: THREE.Group,
    startLL: [number, number],
    endLL: [number, number],
    texIndex: number = 0
  ) {
    this.group = globeGroup;
    this.startLL = startLL;
    this.endLL = endLL;

    const start = latLonToXYZ(startLL[0], startLL[1], GLOBE_RADIUS); // transform  Lat/Lon from the startPoint & endPoint to XYZ (Globe coordinates)
    const end = latLonToXYZ(endLL[0], endLL[1], GLOBE_RADIUS);
    const distance = start.distanceTo(end);

    const heightRatio = Math.min(distance / (GLOBE_RADIUS * 2), 0.5); //Arch height proportional to the distance
    const arcHeight = GLOBE_RADIUS * (0.15 + heightRatio * 0.3);
    const midPoint = start
      .clone()
      .add(end)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(GLOBE_RADIUS + arcHeight);
    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);

    const tubularSegments = 128; // more segments = smoother curve
    const radius = 1;
    const radialSegments = 3;

    this.geometry = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      radialSegments,
      false
    );

    const baseMat =
      arcMaterials![Math.max(0, Math.min(texIndex, arcMaterials!.length - 1))];

    this.material = baseMat.clone();
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.depthTest = false;

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = true;

    const indexCount = this.geometry.index
      ? this.geometry.index.count
      : this.geometry.attributes.position.count;

    this.maxDraw = indexCount;
    this.geometry.setDrawRange(0, 0); // Invisible at the start
    this.group.add(this.mesh);

    const arcColor = this.getArcColor(texIndex);
    const discMatBase = new THREE.SpriteMaterial({
      map: DISC_TEXTURE,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      color: arcColor,
      opacity: 1,
    });

    this.originDisc = new THREE.Sprite(discMatBase.clone());
    this.originDisc.scale.set(12, 12, 1);
    this.originDisc.position.copy(
      start
        .clone()
        .normalize()
        .multiplyScalar(GLOBE_RADIUS + 2)
    );
    this.group.add(this.originDisc);

    this.destDisc = new THREE.Sprite(discMatBase.clone());
    this.destDisc.scale.set(12, 12, 1);
    this.destDisc.position.copy(
      end
        .clone()
        .normalize()
        .multiplyScalar(GLOBE_RADIUS + 2)
    );
    this.destDisc.visible = false;
    this.group.add(this.destDisc);

    this.phase = "grow"; // grow -> fade -> dissapear
    this.elapsed = 0;

    this.growDuration = 1;
    this.fadeDuration = 1.2;
  }

  getArcColor(texIndex: number) {
    const colors = [
      0xfdba74, // orange
      0x8b5cf6, // purple
      0xf87171, // cyan
      0xfde68a, // light yellow
    ];
    return colors[texIndex % colors.length];
  }

  update(delta: number) {
    this.elapsed += delta;

    if (this.phase === "grow") {
      const t = Math.min(this.elapsed / this.growDuration, 1.0);
      const eased = 1.0 - Math.pow(1.0 - t, 3.0);
      const count = Math.floor(this.maxDraw * eased);
      this.geometry.setDrawRange(0, count);

      if (t >= 1.0) {
        this.destDisc!.visible = true;
        this.elapsed = 0;
        this.phase = "fade";
      }
    } else if (this.phase === "fade") {
      const t = Math.min(this.elapsed / this.fadeDuration, 1.0);
      const startIdx = Math.floor(this.maxDraw * t);
      const count = Math.max(this.maxDraw - startIdx, 0);
      this.geometry.setDrawRange(startIdx, count);

      if (this.originDisc) {
        this.originDisc.material.opacity = 1.0 - t;
      }

      if (this.destDisc) {
        this.destDisc.material.opacity = 1.0 - Math.max(t - 0.5, 0.0) * 2.0;
      }

      if (t >= 1.0) {
        this.dispose();
        this.phase = "done";
      }
    }
  }

  dispose() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.geometry.dispose();
      this.mesh = null;
    }
    if (this.originDisc) {
      this.group.remove(this.originDisc);
      this.originDisc.material.dispose();
      this.originDisc = null;
    }
    if (this.destDisc) {
      this.group.remove(this.destDisc);
      this.destDisc.material.dispose();
      this.destDisc = null;
    }
  }

  get done() {
    return this.phase === "done";
  }
}

function createArcInternal(
  globeGroup: THREE.Group,
  startLL: [number, number],
  endLL: [number, number],
  textureIndex: number = 0
) {
  const arc = new GlobeArc(globeGroup, startLL, endLL, textureIndex);
  activeArcs.push(arc);
}

function getClickPosition(
  e: PointerEvent,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  ocean: THREE.Mesh
) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(ocean);

  if (hit.length) clickPosition = hit[0].point.clone();
}

function runWaveElevation(time: number) {
  if (!dotsGeometry) return;

  const pos = dotsGeometry.attributes.position as THREE.BufferAttribute;
  const count = pos.count;

  const elapsed = time - clickStartTime;

  for (let i = 0; i < count; i++) {
    const ox = originalPositions[i * 3 + 0];
    const oy = originalPositions[i * 3 + 1];
    const oz = originalPositions[i * 3 + 2];

    if (elapsed < activationTime[i]) continue;

    const base = new THREE.Vector3(ox, oy, oz);
    const normal = base.clone().normalize();

    let localT = (elapsed - activationTime[i]) * 0.8;
    localT = Math.min(localT, 1.0);
    localT = 1.0 - Math.pow(1.0 - localT, 4.0);
    const elevation = 22 * localT;

    const noise =
      Math.sin(time * 1.6 + randomOffsets[i] * 8.0) * (7.0 * localT); // Wave effect
    const finalPos = normal.multiplyScalar(GLOBE_RADIUS + elevation + noise);

    pos.setXYZ(i, finalPos.x, finalPos.y, finalPos.z);
  }

  pos.needsUpdate = true;
}

function returnToOriginalPositions() {
  if (!dotsGeometry) return;

  const pos = dotsGeometry.attributes.position as THREE.BufferAttribute;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const ox = originalPositions[i * 3 + 0];
    const oy = originalPositions[i * 3 + 1];
    const oz = originalPositions[i * 3 + 2];

    x = THREE.MathUtils.lerp(x, ox, 0.15);
    y = THREE.MathUtils.lerp(y, oy, 0.15);
    z = THREE.MathUtils.lerp(z, oz, 0.15);

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
}

/* MAIN BUILDER */
export function buildGlobe(container: HTMLElement) {
  const scene = new THREE.Scene();

  if (!ARC_TEXTURES) {
    ARC_TEXTURES = ARC_TEXTURE_PATHS.map((p) => textureLoader.load(p));
    DISC_TEXTURE = textureLoader.load(DISK_TEXTURE);
    arcMaterials = ARC_TEXTURES.map(
      (tex) =>
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
        })
    );
  }

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    4000
  );
  camera.position.set(0, 0, 1800);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const globeGroup = new THREE.Group(); // main Globe
  scene.add(globeGroup);
  globeGroup.rotation.y = 0.26;
  globeGroup.rotation.x = 0.35;

  const controls = new OrbitControls(camera, renderer.domElement); // Rotation CONFIG
  controls.enableDamping = true;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.rotateSpeed = 0.35;
  controls.mouseButtons.RIGHT = null;
  controls.mouseButtons.MIDDLE = null;

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const dLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dLight.position.set(6, 4, 10);
  scene.add(dLight);

  // OCEAN
  const ocean = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 50, 50),
    new THREE.MeshPhongMaterial({
      color: 0x002244,
      transparent: true,
      opacity: 0.95,
      shininess: 35,
    })
  );
  globeGroup.add(ocean);

  // LAND
  loadLandDots(globeGroup);

  // Issue: check visibility of the arch to avoid rendering when the tab is inactive
  function handleVisibilityChange() {
    if (document.hidden) {
      isPageVisible = false;
      if (arcIntervalId) {
        clearTimeout(arcIntervalId);
        arcIntervalId = null;
      }
      if (discIntervalId) {
        clearTimeout(discIntervalId);
        discIntervalId = null;
      }
    } else {
      isPageVisible = true;
      scheduleNextArc();
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);

  function scheduleNextArc() {
    if (!globeGroup || !isPageVisible) return;

    const minDelay = 300;
    const maxDelay = 3000;
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;

    arcIntervalId = setTimeout(() => {
      if (!isPageVisible) return;

      const originIndex = Math.floor(Math.random() * ARC_NODES.length);
      let destIndex = Math.floor(Math.random() * ARC_NODES.length);

      while (destIndex === originIndex) {
        destIndex = Math.floor(Math.random() * ARC_NODES.length);
      }

      const origin = ARC_NODES[originIndex].coords;
      const dest = ARC_NODES[destIndex].coords;
      const texIndex = Math.floor(Math.random() * ARC_TEXTURES!.length);
      createArcInternal(globeGroup, origin, dest, texIndex);

      // Probability of 30% to create a consecutive arch (More dinamic)
      if (Math.random() < 0.3) {
        const originIndex2 = Math.floor(Math.random() * ARC_NODES.length);
        let destIndex2 = Math.floor(Math.random() * ARC_NODES.length);

        while (destIndex2 === originIndex2) {
          destIndex2 = Math.floor(Math.random() * ARC_NODES.length);
        }

        const origin2 = ARC_NODES[originIndex2].coords;
        const dest2 = ARC_NODES[destIndex2].coords;
        const texIndex2 = Math.floor(Math.random() * ARC_TEXTURES!.length);

        createArcInternal(globeGroup, origin2, dest2, texIndex2);
      }
      scheduleNextArc();
    }, delay);
  }
  scheduleNextArc();

  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!dotsGeometry) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const clickMouse = new THREE.Vector2();
    clickMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    clickMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const clickRaycaster = new THREE.Raycaster();
    clickRaycaster.setFromCamera(clickMouse, camera);
    const oceanHit = clickRaycaster.intersectObject(ocean);

    if (oceanHit.length > 0) {
      const point = oceanHit[0].point;
      const lat = Math.asin(point.y / GLOBE_RADIUS) * (180 / Math.PI);
      const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);

      // console.log(`Coordinates: [${lat.toFixed(4)}, ${lon.toFixed(4)}] | XYZ: [${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}]`);
    }

    rotationPaused = true;
    elevating = true;

    getClickPosition(e, renderer, camera, ocean);
    clickStartTime = performance.now() * 0.001;

    const pos = dotsGeometry.attributes.position;
    activationTime = [];

    for (let i = 0; i < pos.count; i++) {
      const ox = originalPositions[i * 3 + 0];
      const oy = originalPositions[i * 3 + 1];
      const oz = originalPositions[i * 3 + 2];

      const p = new THREE.Vector3(ox, oy, oz);
      const dist = p.distanceTo(clickPosition!);
      activationTime[i] = dist * 0.002 + randomOffsets[i] * 0.05;
    }
  });

  renderer.domElement.addEventListener("pointerup", () => {
    elevating = false;
    rotationPaused = false;
    clickPosition = null;
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    elevating = false;
    rotationPaused = false;
    clickPosition = null;
  });

  // ANIMATION LOOP
  let frameId: number;
  let lastTime = performance.now() * 0.001;

  function animate() {
    frameId = requestAnimationFrame(animate);

    const now = performance.now() * 0.001;
    const delta = now - lastTime;
    lastTime = now;

    const time = now;

    if (!rotationPaused) {
      globeGroup.rotation.y += 0.001;
    }

    if (dotsGeometry) {
      if (elevating && clickPosition) {
        runWaveElevation(time);
      } else {
        returnToOriginalPositions();
      }

      if (dotsMaterial) dotsMaterial.uniforms.uTime.value = time;
    }

    if (activeArcs.length) {
      activeArcs.forEach((arc) => arc.update(delta));
      activeArcs = activeArcs.filter((arc) => !arc.done);
    }

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function handleResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener("resize", handleResize);

  return {
    cleanup() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (arcIntervalId) {
        clearTimeout(arcIntervalId);
        arcIntervalId = null;
      }
      if (discIntervalId) {
        clearTimeout(discIntervalId);
        discIntervalId = null;
      }
      activeArcs.forEach((arc) => arc.dispose());
      activeArcs = [];

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
