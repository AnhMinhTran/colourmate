import { useCallback, useRef } from "react";
import { ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";

import { ScenePoint, sphericalToCartesian } from "../../services/munsellSceneService";

const SCENE_CENTER = new THREE.Vector3(0, 0.5, 0);
const GUIDE_COLOR = 0x888888;
const GUIDE_OPACITY = 0.25;
const SPHERE_SEGMENTS = 12;
const POINT_RADIUS = 0.02;

interface SceneState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  instancedMesh: THREE.InstancedMesh | null;
  outlineMesh: THREE.InstancedMesh | null;
  frameId: number;
  disposed: boolean;
}

/**
 * Manages the Three.js scene lifecycle for Munsell 3D colour space rendering.
 * Handles scene creation, camera orbiting, raycasting for point selection,
 * and the render loop within an Expo GL context.
 * @returns Object with methods to initialize the GL context, update camera,
 *          rebuild colour point meshes, and perform raycasting for tap selection
 */
export function useMunsellScene() {
  const stateRef = useRef<SceneState | null>(null);
  const pointsRef = useRef<ScenePoint[]>([]);
  const cameraParamsRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6, zoom: 2.5 });

  /**
   * Initializes the Three.js scene, camera, renderer, and visual guides
   * when the GL context becomes available.
   * @param gl - The Expo WebGL rendering context from GLView's onContextCreate
   */
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    // expo-gl can return null for info log methods; three.js calls .trim() on
    // the result unconditionally, causing a crash on some devices.
    const _getShaderInfoLog = gl.getShaderInfoLog.bind(gl);
    (gl as any).getShaderInfoLog = (s: WebGLShader) => _getShaderInfoLog(s) ?? '';
    const _getProgramInfoLog = gl.getProgramInfoLog.bind(gl);
    (gl as any).getProgramInfoLog = (p: WebGLProgram) => _getProgramInfoLog(p) ?? '';
    const _getShaderPrecisionFormat = gl.getShaderPrecisionFormat.bind(gl);
    (gl as any).getShaderPrecisionFormat = (...args: [number, number]) =>
      _getShaderPrecisionFormat(...args) ?? { rangeMin: 127, rangeMax: 127, precision: 23 };

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0xf5f5f5, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.01,
      100
    );

    addGuides(scene);

    const state: SceneState = {
      scene,
      camera,
      renderer,
      instancedMesh: null,
      outlineMesh: null,
      frameId: 0,
      disposed: false,
    };
    stateRef.current = state;

    // Points may have been set before the context was ready — build them now.
    if (pointsRef.current.length > 0) {
      buildPointMeshes(state, pointsRef.current);
    }

    // Camera params may have been set before the context was ready — apply them now.
    const { theta, phi, zoom } = cameraParamsRef.current;
    const clampedPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi));
    const pos = sphericalToCartesian(theta, clampedPhi, zoom);
    camera.position.set(pos.x + SCENE_CENTER.x, pos.y + SCENE_CENTER.y, pos.z + SCENE_CENTER.z);
    camera.lookAt(SCENE_CENTER);

    const animate = () => {
      if (state.disposed) return;
      state.frameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  }, []);

  /**
   * Stores points and rebuilds the instanced meshes if the scene is ready.
   * If called before onContextCreate, the points are queued and applied
   * automatically once the GL context becomes available.
   */
  const setPoints = useCallback((points: ScenePoint[]) => {
    pointsRef.current = points;
    const state = stateRef.current;
    if (!state) return;
    buildPointMeshes(state, points);
  }, []);

  /**
   * Updates the camera position using spherical coordinates for orbit control.
   * Camera always looks at the scene center (middle of the Munsell value axis).
   * @param theta - Azimuth angle in radians (horizontal orbit)
   * @param phi - Elevation angle in radians (vertical orbit, clamped internally)
   * @param zoom - Camera distance from the scene center
   */
  const updateCamera = useCallback(
    (theta: number, phi: number, zoom: number) => {
      cameraParamsRef.current = { theta, phi, zoom };
      const state = stateRef.current;
      if (!state) return;

      const clampedPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi));
      const pos = sphericalToCartesian(theta, clampedPhi, zoom);

      state.camera.position.set(
        pos.x + SCENE_CENTER.x,
        pos.y + SCENE_CENTER.y,
        pos.z + SCENE_CENTER.z
      );
      state.camera.lookAt(SCENE_CENTER);
    },
    []
  );

  /**
   * Performs raycasting from screen coordinates to identify which colour
   * point (if any) was tapped. Returns the instanceId which maps to the
   * index in the points array.
   * @param ndcX - Normalized device coordinate X [-1, 1]
   * @param ndcY - Normalized device coordinate Y [-1, 1]
   * @returns The id string of the tapped ColourPoint, or null if nothing hit
   */
  const raycastAtScreen = useCallback(
    (ndcX: number, ndcY: number): string | null => {
      const state = stateRef.current;
      if (!state || !state.instancedMesh) return null;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), state.camera);

      const intersects = raycaster.intersectObject(state.instancedMesh);
      if (intersects.length === 0) return null;

      const instanceId = intersects[0].instanceId;
      if (instanceId === undefined) return null;

      const points = pointsRef.current;
      if (instanceId < 0 || instanceId >= points.length) return null;

      return points[instanceId].id;
    },
    []
  );

  /**
   * Cleans up the Three.js scene, stopping the render loop and disposing
   * of GPU resources. Should be called when the component unmounts.
   */
  const dispose = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    state.disposed = true;
    cancelAnimationFrame(state.frameId);

    if (state.instancedMesh) {
      state.instancedMesh.geometry.dispose();
      (state.instancedMesh.material as THREE.Material).dispose();
    }
    if (state.outlineMesh) {
      state.outlineMesh.geometry.dispose();
      (state.outlineMesh.material as THREE.Material).dispose();
    }
    state.renderer.dispose();
    stateRef.current = null;
  }, []);

  return { onContextCreate, setPoints, updateCamera, raycastAtScreen, dispose };
}

/**
 * Clears existing colour meshes from the scene and rebuilds them from points.
 */
function buildPointMeshes(state: SceneState, points: ScenePoint[]) {
  if (state.instancedMesh) {
    state.scene.remove(state.instancedMesh);
    state.instancedMesh.geometry.dispose();
    (state.instancedMesh.material as THREE.Material).dispose();
    state.instancedMesh = null;
  }
  if (state.outlineMesh) {
    state.scene.remove(state.outlineMesh);
    state.outlineMesh.geometry.dispose();
    (state.outlineMesh.material as THREE.Material).dispose();
    state.outlineMesh = null;
  }

  if (points.length === 0) return;

  const geometry = new THREE.SphereGeometry(POINT_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
  const outlineGeometry = new THREE.SphereGeometry(POINT_RADIUS * 1.4, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
  const material = new THREE.MeshBasicMaterial({ vertexColors: false });
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  const outlineMesh = new THREE.InstancedMesh(outlineGeometry, outlineMaterial, points.length);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  outlineMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    dummy.position.set(p.position.x, p.position.y, p.position.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    outlineMesh.setMatrixAt(i, dummy.matrix);
    color.setRGB(p.color.r / 255, p.color.g / 255, p.color.b / 255);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  outlineMesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  state.outlineMesh = outlineMesh;
  state.instancedMesh = mesh;
  state.scene.add(outlineMesh);
  state.scene.add(mesh);
}

/**
 * Adds visual guide geometry to the scene:
 *  - A gradient cylinder (black→white) along the value axis
 *  - A full-spectrum hue ring at maximum chroma radius (r=1) at mid-height
 *  - A subtle wireframe cylinder to indicate the Munsell space boundary
 * @param scene - The Three.js scene to add guides to
 */
function addGuides(scene: THREE.Scene) {
  // Gradient value column: black at y=0, white at y=1
  const colGeom = new THREE.CylinderGeometry(0.022, 0.022, 1, 8, 20);
  const colPos = colGeom.attributes.position as THREE.BufferAttribute;
  const colColors = new Float32Array(colPos.count * 3);
  for (let i = 0; i < colPos.count; i++) {
    const t = Math.max(0, Math.min(1, colPos.getY(i) + 0.5));
    colColors[i * 3] = t;
    colColors[i * 3 + 1] = t;
    colColors[i * 3 + 2] = t;
  }
  colGeom.setAttribute("color", new THREE.BufferAttribute(colColors, 3));
  const column = new THREE.Mesh(
    colGeom,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 })
  );
  column.position.y = 0.5;
  scene.add(column);

  // Hue ring at maximum chroma (radius=1) at mid-height, full colour spectrum
  const HUE_SEGS = 180;
  const huePos = new Float32Array((HUE_SEGS + 1) * 3);
  const hueCol = new Float32Array((HUE_SEGS + 1) * 3);
  const tmpColor = new THREE.Color();
  for (let i = 0; i <= HUE_SEGS; i++) {
    const t = i / HUE_SEGS;
    const theta = t * Math.PI * 2;
    huePos[i * 3] = Math.cos(theta);
    huePos[i * 3 + 1] = 0.5;
    huePos[i * 3 + 2] = Math.sin(theta);
    tmpColor.setHSL(t, 1, 0.5);
    hueCol[i * 3] = tmpColor.r;
    hueCol[i * 3 + 1] = tmpColor.g;
    hueCol[i * 3 + 2] = tmpColor.b;
  }
  const hueGeom = new THREE.BufferGeometry();
  hueGeom.setAttribute("position", new THREE.BufferAttribute(huePos, 3));
  hueGeom.setAttribute("color", new THREE.BufferAttribute(hueCol, 3));
  scene.add(
    new THREE.Points(hueGeom, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, sizeAttenuation: true }))
  );

  // Wireframe cylinder outline
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
  const cylinderMaterial = new THREE.MeshBasicMaterial({
    color: GUIDE_COLOR,
    transparent: true,
    opacity: GUIDE_OPACITY * 0.5,
    wireframe: true,
  });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.y = 0.5;
  scene.add(cylinder);
}

