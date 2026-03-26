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

  /**
   * Initializes the Three.js scene, camera, renderer, and visual guides
   * when the GL context becomes available.
   * @param gl - The Expo WebGL rendering context from GLView's onContextCreate
   */
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
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
    addLighting(scene);

    const state: SceneState = {
      scene,
      camera,
      renderer,
      instancedMesh: null,
      frameId: 0,
      disposed: false,
    };
    stateRef.current = state;

    const animate = () => {
      if (state.disposed) return;
      state.frameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  }, []);

  /**
   * Rebuilds the instanced mesh representing colour points in the scene.
   * Uses THREE.InstancedMesh for efficient single-draw-call rendering
   * of potentially hundreds of colour spheres.
   * @param points - Array of ScenePoint data with positions and colours
   */
  const setPoints = useCallback((points: ScenePoint[]) => {
    pointsRef.current = points;
    const state = stateRef.current;
    if (!state) return;

    if (state.instancedMesh) {
      state.scene.remove(state.instancedMesh);
      state.instancedMesh.geometry.dispose();
      (state.instancedMesh.material as THREE.Material).dispose();
      state.instancedMesh = null;
    }

    if (points.length === 0) return;

    const geometry = new THREE.SphereGeometry(
      POINT_RADIUS,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );
    const material = new THREE.MeshStandardMaterial({ vertexColors: false });

    const mesh = new THREE.InstancedMesh(geometry, material, points.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.position.x, p.position.y, p.position.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(p.color.r / 255, p.color.g / 255, p.color.b / 255);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    state.instancedMesh = mesh;
    state.scene.add(mesh);
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
    state.renderer.dispose();
    stateRef.current = null;
  }, []);

  return { onContextCreate, setPoints, updateCamera, raycastAtScreen, dispose };
}

/**
 * Adds visual guide geometry to the scene: a vertical axis line (value axis),
 * a base circle ring (chroma at value=0), and a subtle wireframe cylinder
 * to indicate the Munsell space boundary.
 * @param scene - The Three.js scene to add guides to
 */
function addGuides(scene: THREE.Scene) {
  const axisMaterial = new THREE.LineBasicMaterial({
    color: GUIDE_COLOR,
    transparent: true,
    opacity: GUIDE_OPACITY,
  });

  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  scene.add(new THREE.Line(axisGeometry, axisMaterial));

  const ringGeometry = new THREE.RingGeometry(0.98, 1, 64);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: GUIDE_COLOR,
    transparent: true,
    opacity: GUIDE_OPACITY,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

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

/**
 * Adds ambient and directional lighting to the scene for proper colour
 * rendering of the instanced sphere meshes.
 * @param scene - The Three.js scene to add lights to
 */
function addLighting(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(2, 3, 2);
  scene.add(directional);
}
