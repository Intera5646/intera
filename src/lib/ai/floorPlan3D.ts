import * as THREE from 'three';
import sharp from 'sharp';
import type { FloorPlanParseResult } from './floorPlanParser';

export type FloorPlan3DResult = {
  depthMapBuffer: Buffer;
  width: number;
  height: number;
};

export async function buildFloorPlan3D(
  plan: FloorPlanParseResult,
  ceilingHeightMm: number = 2700,
  size = 512
): Promise<FloorPlan3DResult> {
  const heightM = ceilingHeightMm / 1000;
  const scene = new THREE.Scene();
  const walls = normalizeWalls(plan.walls ?? []);
  const bounds = computeBounds(walls);
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minY + bounds.maxY) / 2);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.maxX - bounds.minX + 4, bounds.maxY - bounds.minY + 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  walls.forEach((wall) => {
    const dx = wall.x2 - wall.x1;
    const dz = wall.y2 - wall.y1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const geometry = new THREE.BoxGeometry(length, heightM, 0.1);
    const material = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((wall.x1 + wall.x2) / 2, heightM / 2, (wall.y1 + wall.y2) / 2);
    mesh.lookAt(new THREE.Vector3(wall.x2, heightM / 2, wall.y2));
    scene.add(mesh);
  });

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(center.x, heightM * 1.8 + 1.2, center.z + Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 1.4 + 1);
  camera.lookAt(new THREE.Vector3(center.x, 0, center.z));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const raycaster = new THREE.Raycaster();
  const depthBuffer = new Float32Array(size * size);
  let minDepth = Number.POSITIVE_INFINITY;
  let maxDepth = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = -(y / (size - 1)) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hits = raycaster.intersectObjects(scene.children, false);
      const distance = hits.length > 0 ? hits[0].distance : camera.far;
      depthBuffer[y * size + x] = distance;
      minDepth = Math.min(minDepth, distance);
      maxDepth = Math.max(maxDepth, distance);
    }
  }

  if (!Number.isFinite(minDepth) || maxDepth <= minDepth) {
    minDepth = 0.1;
    maxDepth = 10;
  }

  const pixelBuffer = Buffer.alloc(size * size);
  for (let i = 0; i < size * size; i++) {
    const depth = depthBuffer[i] || maxDepth;
    const normalized = Math.max(0, Math.min(1, (depth - minDepth) / (maxDepth - minDepth)));
    pixelBuffer[i] = Math.round((1 - normalized) * 255);
  }

  const depthMapBuffer = await sharp(pixelBuffer, {
    raw: { width: size, height: size, channels: 1 },
  })
    .png()
    .toBuffer();

  return { depthMapBuffer, width: size, height: size };
}

function normalizeWalls(walls: any[]): { x1: number; y1: number; x2: number; y2: number }[] {
  return walls.map((wall) => {
    if (Array.isArray(wall) && wall.length >= 4) {
      return { x1: Number(wall[0]), y1: Number(wall[1]), x2: Number(wall[2]), y2: Number(wall[3]) };
    }
    return {
      x1: Number(wall.x1 ?? wall.x ?? 0),
      y1: Number(wall.y1 ?? wall.y ?? 0),
      x2: Number(wall.x2 ?? wall.x2 ?? wall.x ?? 0),
      y2: Number(wall.y2 ?? wall.y2 ?? wall.y ?? 0),
    };
  });
}

function computeBounds(walls: { x1: number; y1: number; x2: number; y2: number }[]) {
  const xs = walls.flatMap((wall) => [wall.x1, wall.x2]);
  const ys = walls.flatMap((wall) => [wall.y1, wall.y2]);
  return {
    minX: Math.min(...xs, 0),
    maxX: Math.max(...xs, 4),
    minY: Math.min(...ys, 0),
    maxY: Math.max(...ys, 4),
  };
}
