import * as THREE from "three";

export function generateSunflowerPoints(
  count: number,
  radius: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const v = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;

    v.setFromSphericalCoords(radius, phi, theta);
    points.push(v.clone());
  }

  return points;
}
