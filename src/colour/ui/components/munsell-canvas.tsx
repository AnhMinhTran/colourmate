import React, { useCallback, useEffect, useRef, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GLView } from "expo-gl";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import { ColourPoint } from "../../models/colourPoint";
import {
  buildScenePoints,
  screenToNDC,
} from "../../services/munsellSceneService";
import { useMunsellScene } from "../hooks/use-munsell-scene";

const INITIAL_THETA = Math.PI / 4;
const INITIAL_PHI = Math.PI / 6;
const INITIAL_ZOOM = 2.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ORBIT_SENSITIVITY = 0.005;

interface MunsellCanvasProps {
  colours: ColourPoint[];
  onSelectColour: (id: string) => void;
}

/**
 * 3D viewport component rendering the Munsell colour space.
 * Wraps a GLView with gesture handlers for orbit (pan), zoom (pinch),
 * and point selection (tap).
 * @param colours - ColourPoint array to render as spheres in 3D space
 * @param onSelectColour - Callback invoked with the id of a tapped colour point
 */
export function MunsellCanvas({ colours, onSelectColour }: MunsellCanvasProps) {
  const { onContextCreate, setPoints, updateCamera, raycastAtScreen, dispose } =
    useMunsellScene();

  const thetaRef = useRef(INITIAL_THETA);
  const phiRef = useRef(INITIAL_PHI);
  const zoomRef = useRef(INITIAL_ZOOM);
  const savedThetaRef = useRef(INITIAL_THETA);
  const savedPhiRef = useRef(INITIAL_PHI);
  const savedZoomRef = useRef(INITIAL_ZOOM);
  const layoutRef = useRef({ width: 0, height: 0 });

  const scenePoints = useMemo(() => buildScenePoints(colours), [colours]);

  useEffect(() => {
    setPoints(scenePoints);
  }, [scenePoints, setPoints]);

  useEffect(() => {
    updateCamera(thetaRef.current, phiRef.current, zoomRef.current);
  }, [updateCamera]);

  useEffect(() => {
    return () => dispose();
  }, [dispose]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedThetaRef.current = thetaRef.current;
      savedPhiRef.current = phiRef.current;
    })
    .onUpdate((event) => {
      thetaRef.current =
        savedThetaRef.current + event.translationX * ORBIT_SENSITIVITY;
      phiRef.current =
        savedPhiRef.current + event.translationY * ORBIT_SENSITIVITY;
      updateCamera(thetaRef.current, phiRef.current, zoomRef.current);
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedZoomRef.current = zoomRef.current;
    })
    .onUpdate((event) => {
      const newZoom = savedZoomRef.current / event.scale;
      zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      updateCamera(thetaRef.current, phiRef.current, zoomRef.current);
    });

  const tapGesture = Gesture.Tap().onEnd((event) => {
    const { width, height } = layoutRef.current;
    if (width === 0 || height === 0) return;

    const ndc = screenToNDC(event.x, event.y, width, height);
    const hitId = raycastAtScreen(ndc.x, ndc.y);
    if (hitId) {
      onSelectColour(hitId);
    }
  });

  const composedGesture = Gesture.Race(
    tapGesture,
    Gesture.Simultaneous(panGesture, pinchGesture)
  );

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      layoutRef.current = {
        width: e.nativeEvent.layout.width,
        height: e.nativeEvent.layout.height,
      };
    },
    []
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.container} onLayout={handleLayout}>
          <GLView style={styles.gl} onContextCreate={onContextCreate} />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gl: { flex: 1 },
});
