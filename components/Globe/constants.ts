import * as THREE from "three";

export const GLOBE_LAND_MAP = "/landmask.png";
export const GLOBE_RADIUS = 500;
export const DOT_COUNT = 60000;

export const ARC_NODES = [
  { name: "EU_01_London", coords: [51.5074, -0.1278] },
  { name: "EU_02_Paris", coords: [48.52, -3.27] },
  { name: "EU_03_Berlin", coords: [50.52, -14.5] },
  { name: "EU_04_Munich", coords: [47.5, -11.582] },
  { name: "EU_05_Amsterdam", coords: [50.62, -4.9041] },
  { name: "EU_06_Frankfurt", coords: [49, -8.6821] },
  { name: "EU_07_Zurich", coords: [46.37, -8.5417] },
  { name: "EU_08_Stockholm", coords: [58, -18.06] },
  { name: "EU_09_Copenhagen", coords: [55.67, -10.56] },
  { name: "EU_10_Dublin", coords: [53.5, 6.5] },
  { name: "EU_11_Barcelona", coords: [42, -2] },
  { name: "EU_12_Madrid", coords: [40.4, 5] },
  { name: "EU_13_Rome", coords: [40.5, -15.5] },
  { name: "EU_14_Lisbon", coords: [38.72, 9] },
  { name: "NA_01_NewYork", coords: [42.71, 71.5] },
  { name: "NA_02_SanFrancisco", coords: [37.77, 122.41] },
  { name: "NA_03_Seattle", coords: [47.6, 122.33] },
  { name: "NA_04_LosAngeles", coords: [36.05, 118.24] },
  { name: "NA_05_Austin", coords: [30.26, 97.74] },
  { name: "NA_06_Boston", coords: [42.36, 71.05] },
  { name: "NA_07_Toronto", coords: [43.6532, 79.38] },
  { name: "NA_08_Orlando", coords: [28.28, 82.12] },
  { name: "AS_01_Tokyo", coords: [35.68, -139.6917] },
  { name: "AS_02_Singapore", coords: [1.35, -103.81] },
  { name: "AS_03_HongKong", coords: [22.31, -114.16] },
  { name: "AS_04_Shanghai", coords: [31.2304, -121.4737] },
  { name: "AS_05_Beijing", coords: [39.9, -116.4] },
  { name: "AS_06_Seoul", coords: [37.56, -126.97] },
  { name: "AS_07_Bangalore", coords: [12.97, -77.59] },
  { name: "AS_08_Dubai", coords: [25.2, -55.27] },
  { name: "SA_01_SaoPaulo", coords: [-23.55, 46.63] },
  { name: "SA_02_BuenosAires", coords: [-34.6, 58.38] },
  { name: "SA_03_MexicoCity", coords: [19.43, 99.13] },
  { name: "SA_04_Bogota", coords: [4.71, 74.07] },
  { name: "SA_05_Santiago", coords: [-33.44, 70.66] },
  { name: "AF_01_Johannesburg", coords: [-26.2, -28.04] },
  { name: "AF_02_Cairo", coords: [30.04, -31.23] },
  { name: "AF_03_Nairobi", coords: [-1.29, -36.82] },
  { name: "OC_01_Sydney", coords: [-33.86, -151.2] },
  { name: "OC_02_Melbourne", coords: [-37.81, -144.96] },
  { name: "OC_03_Auckland", coords: [-36.84, -174.76] },
];

export const textureLoader = new THREE.TextureLoader();
export const DISK_TEXTURE = "/disc_texture.png";

export const ARC_TEXTURE_PATHS = [
  "/arc-texture-1.png",
  "/arc-texture-2.png",
  "/arc-texture-3.png",
  "/arc-texture-4.png",
];

/* SHADERS CONFIG */
export const DOTS_VERTEX_SHADER = `
  attribute float randomOffset;
  varying float vRnd;

  uniform float uTime;

  void main() {
    vRnd = randomOffset;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    //size based on distance of the camera
    float size = 5.0 * (300.0 / -mv.z);
    gl_PointSize = max(size, 4.0);

    gl_Position = projectionMatrix * mv;
  }
`;

export const DOTS_FRAGMENT_SHADER = `
  precision mediump float;

  uniform float uTime;
  varying float vRnd;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float pulse = sin(uTime * 0.15 + vRnd * 6.0) * 0.25 + 0.5;

    vec3 darkBlue  = vec3(0.043, 0.145, 0.251); // #0b2540
    vec3 midBlue   = vec3(0.121, 0.247, 0.400); // #1f3f66
    vec3 lightBlue = vec3(0.478, 0.654, 0.839); // #7aa7d6

    vec3 base = mix(darkBlue, midBlue, pulse);
    vec3 color = mix(base, lightBlue, pulse * 0.3);

    gl_FragColor = vec4(color, 1.0);
  }
`;
