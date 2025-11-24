import * as THREE from "three";

export function spherePointToUV(
  point: THREE.Vector3,
  radius: number
): THREE.Vector2 {
  const lon = Math.atan2(point.z, point.x);
  const lat = Math.asin(point.y / radius);

  const u = 1 - (lon / (2 * Math.PI) + 0.5);
  const v = 0.5 - lat / Math.PI;

  return new THREE.Vector2(u, v);
}
