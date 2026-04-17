import { useCallback, useRef } from "react";
import { ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import {
    computeBoundsTree,
    disposeBoundsTree,
    acceleratedRaycast,
} from "three-mesh-bvh";

import { sphericalToCartesian } from "../../../colour/services/munsellSceneService";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

interface SceneState {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    mesh: THREE.Mesh | null;
    faceCount: number;
    frameId: number;
    disposed: boolean;
}

const CLEAR_COLOR = 0xf5f5f5;

/**
 * Manages the Three.js scene lifecycle for STL 3D painting.
 * Handles scene creation, STL mesh loading with BVH-accelerated raycasting,
 * vertex colour painting, orbit camera, and the render loop.
 * @returns Object with methods to control the painting scene
 */
export function useStlPainterScene() {
    const stateRef = useRef<SceneState | null>(null);
    const cameraParamsRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6, zoom: 3 });
    const sceneCenterRef = useRef(new THREE.Vector3(0, 0, 0));

    /**
     * Initialises the Three.js scene, camera, renderer, and lighting when
     * the GL context becomes available.
     * @param gl - The Expo WebGL rendering context from GLView's onContextCreate
     */
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        const _getShaderInfoLog = gl.getShaderInfoLog.bind(gl);
        (gl as any).getShaderInfoLog = (s: WebGLShader) => _getShaderInfoLog(s) ?? "";
        const _getProgramInfoLog = gl.getProgramInfoLog.bind(gl);
        (gl as any).getProgramInfoLog = (p: WebGLProgram) => _getProgramInfoLog(p) ?? "";
        const _getShaderPrecisionFormat = gl.getShaderPrecisionFormat.bind(gl);
        (gl as any).getShaderPrecisionFormat = (...args: [number, number]) =>
            _getShaderPrecisionFormat(...args) ?? { rangeMin: 127, rangeMax: 127, precision: 23 };

        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        renderer.setClearColor(CLEAR_COLOR, 1);

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            50,
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.01,
            1000,
        );

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        scene.add(directionalLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(-5, -3, -5);
        scene.add(backLight);

        const state: SceneState = {
            scene,
            camera,
            renderer,
            mesh: null,
            faceCount: 0,
            frameId: 0,
            disposed: false,
        };
        stateRef.current = state;

        const { theta, phi, zoom } = cameraParamsRef.current;
        applyCameraPosition(state, theta, phi, zoom);

        const animate = () => {
            if (state.disposed) return;
            state.frameId = requestAnimationFrame(animate);
            renderer.render(scene, camera);
            gl.endFrameEXP();
        };
        animate();
    }, []);

    /**
     * Creates a BufferGeometry from parsed STL data, applies vertex colours
     * (default light grey), computes BVH for fast raycasting, and adds the
     * mesh to the scene. Auto-centres and scales the model to fit the viewport.
     * @param positions - Flat Float32Array of vertex positions (9 floats per face)
     * @param normals - Flat Float32Array of vertex normals (same layout)
     * @param faceCount - Number of triangular faces
     */
    const loadMesh = useCallback(
        (positions: Float32Array, normals: Float32Array, faceCount: number) => {
            const state = stateRef.current;
            if (!state) return;

            if (state.mesh) {
                state.scene.remove(state.mesh);
                state.mesh.geometry.disposeBoundsTree?.();
                state.mesh.geometry.dispose();
                (state.mesh.material as THREE.Material).dispose();
                state.mesh = null;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

            const colors = new Float32Array(positions.length);
            for (let i = 0; i < colors.length; i += 3) {
                colors[i] = 245 / 255;
                colors[i + 1] = 245 / 255;
                colors[i + 2] = 245 / 255;
            }
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

            geometry.computeBoundsTree?.();

            const material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.7,
                metalness: 0.1,
                flatShading: true,
            });

            const mesh = new THREE.Mesh(geometry, material);

            geometry.computeBoundingBox();
            const box = geometry.boundingBox!;
            const center = new THREE.Vector3();
            box.getCenter(center);
            mesh.position.sub(center);

            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
                const scale = 2 / maxDim;
                mesh.scale.setScalar(scale);
            }

            sceneCenterRef.current.set(0, 0, 0);

            state.scene.add(mesh);
            state.mesh = mesh;
            state.faceCount = faceCount;

            const { theta, phi, zoom } = cameraParamsRef.current;
            applyCameraPosition(state, theta, phi, zoom);
        },
        [],
    );

    /**
     * Updates the camera position using spherical coordinates for orbit control.
     * @param theta - Azimuth angle in radians (horizontal orbit)
     * @param phi - Elevation angle in radians (vertical orbit, clamped internally)
     * @param zoom - Camera distance from the scene center
     */
    const updateCamera = useCallback(
        (theta: number, phi: number, zoom: number) => {
            cameraParamsRef.current = { theta, phi, zoom };
            const state = stateRef.current;
            if (!state) return;
            applyCameraPosition(state, theta, phi, zoom);
        },
        [],
    );

    /**
     * Updates the vertex colour buffer for the given face indices.
     * @param faceIndices - Array of face indices to repaint
     * @param rgb - Colour to apply (each channel 0-255)
     */
    const paintFaces = useCallback(
        (faceIndices: number[], rgb: { r: number; g: number; b: number }) => {
            const state = stateRef.current;
            if (!state?.mesh) return;

            const colorAttr = state.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
            const rNorm = rgb.r / 255;
            const gNorm = rgb.g / 255;
            const bNorm = rgb.b / 255;

            for (const faceIdx of faceIndices) {
                const baseVertex = faceIdx * 3;
                for (let v = 0; v < 3; v++) {
                    const vi = baseVertex + v;
                    colorAttr.setXYZ(vi, rNorm, gNorm, bNorm);
                }
            }

            colorAttr.needsUpdate = true;
        },
        [],
    );

    /**
     * Performs raycasting from NDC screen coordinates to identify which
     * triangle face (if any) was hit. Returns the face index and the
     * world-space intersection point (needed for brush-radius mode).
     * @param ndcX - Normalised device coordinate X [-1, 1]
     * @param ndcY - Normalised device coordinate Y [-1, 1]
     * @returns Object with faceIndex and point, or null if no hit
     */
    const raycastAtScreen = useCallback(
        (ndcX: number, ndcY: number): { faceIndex: number; point: THREE.Vector3 } | null => {
            const state = stateRef.current;
            if (!state?.mesh) return null;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), state.camera);

            const intersects = raycaster.intersectObject(state.mesh);
            if (intersects.length === 0) return null;

            const hit = intersects[0];
            if (hit.faceIndex === undefined) return null;

            return { faceIndex: hit.faceIndex, point: hit.point };
        },
        [],
    );

    /**
     * Finds all faces whose centroid falls within a given world-space radius
     * of a centre point. Used for brush-radius painting mode.
     * @param center - World-space centre point of the brush
     * @param radius - Brush radius in world-space units
     * @returns Array of face indices within the brush radius
     */
    const findFacesInRadius = useCallback(
        (center: THREE.Vector3, radius: number): number[] => {
            const state = stateRef.current;
            if (!state?.mesh) return [];

            const posAttr = state.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
            const results: number[] = [];
            const radiusSq = radius * radius;
            const centroid = new THREE.Vector3();
            const worldV = new THREE.Vector3();

            for (let f = 0; f < state.faceCount; f++) {
                centroid.set(0, 0, 0);
                for (let v = 0; v < 3; v++) {
                    const vi = f * 3 + v;
                    worldV.set(
                        posAttr.getX(vi),
                        posAttr.getY(vi),
                        posAttr.getZ(vi),
                    );
                    state.mesh.localToWorld(worldV);
                    centroid.add(worldV);
                }
                centroid.divideScalar(3);

                if (centroid.distanceToSquared(center) <= radiusSq) {
                    results.push(f);
                }
            }

            return results;
        },
        [],
    );

    /**
     * Cleans up the Three.js scene, stopping the render loop and disposing
     * GPU resources. Should be called when the component unmounts.
     */
    const dispose = useCallback(() => {
        const state = stateRef.current;
        if (!state) return;
        state.disposed = true;
        cancelAnimationFrame(state.frameId);

        if (state.mesh) {
            state.mesh.geometry.disposeBoundsTree?.();
            state.mesh.geometry.dispose();
            (state.mesh.material as THREE.Material).dispose();
        }
        state.renderer.dispose();
        stateRef.current = null;
    }, []);

    return {
        onContextCreate,
        loadMesh,
        updateCamera,
        paintFaces,
        raycastAtScreen,
        findFacesInRadius,
        dispose,
    };
}

/**
 * Positions the camera in spherical coordinates around the scene centre.
 * @param state - Current scene state
 * @param theta - Azimuth angle
 * @param phi - Elevation angle (clamped to avoid gimbal lock)
 * @param zoom - Distance from scene centre
 */
function applyCameraPosition(state: SceneState, theta: number, phi: number, zoom: number): void {
    const clampedPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi));
    const pos = sphericalToCartesian(theta, clampedPhi, zoom);
    const center = new THREE.Vector3(0, 0, 0);
    state.camera.position.set(pos.x + center.x, pos.y + center.y, pos.z + center.z);
    state.camera.lookAt(center);
}
