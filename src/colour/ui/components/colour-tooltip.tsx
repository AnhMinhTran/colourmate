import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ColourPoint } from "../../models/colourPoint";
import { AppColors } from "@/src/ui/constants/theme";

interface ColourTooltipProps {
  colour: ColourPoint | null;
  onDismiss: () => void;
}

/**
 * Overlay tooltip that displays colour information when a 3D point is tapped.
 * Shows the colour name, brand, and a swatch preview. Positioned at the top
 * of the parent view as an absolute overlay.
 * @param colour - The selected ColourPoint to display, or null to hide
 * @param onDismiss - Callback to close the tooltip
 */
export function ColourTooltip({ colour, onDismiss }: ColourTooltipProps) {
  const router = useRouter();

  if (!colour) return null;

  const bg = `rgb(${colour.rgb.r}, ${colour.rgb.g}, ${colour.rgb.b})`;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: colour.id } })}
      >
        <View style={[styles.swatch, { backgroundColor: bg }]} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {colour.name}
          </Text>
          <Text style={styles.brand} numberOfLines={1}>
            {colour.brand}
          </Text>
        </View>
        <Pressable onPress={onDismiss} style={styles.dismiss} hitSlop={12}>
          <Text style={styles.dismissText}>X</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: AppColors.text,
  },
  brand: {
    fontSize: 12,
    color: AppColors.muted,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.muted,
  },
});
