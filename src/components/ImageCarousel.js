import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { absoluteUploadUrl } from "../services/issues";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ImageCarousel({
  images = [],
  resolveImageUri,
  onRemoveImage,
  height = 220,
  enableFullscreen = true
}) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerScrollRef = useRef(null);
  const imageWidth = SCREEN_WIDTH - 64;

  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const getImageUri = (entry, index) => {
    if (typeof resolveImageUri === "function") {
      const customUri = String(resolveImageUri(entry, index) || "").trim();
      return customUri;
    }
    if (typeof entry === "string") {
      return absoluteUploadUrl(entry);
    }
    if (entry && typeof entry === "object" && typeof entry.uri === "string") {
      return String(entry.uri).trim();
    }
    return "";
  };

  const displayEntries = images
    .map((entry, index) => ({ entry, index, uri: getImageUri(entry, index) }))
    .filter((item) => item.uri);
  if (displayEntries.length === 0) return null;

  const onScroll = (e) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / imageWidth);
    setActiveIndex(index);
  };

  useEffect(() => {
    if (!viewerVisible || !viewerScrollRef.current) return;
    const targetOffset = Math.max(0, viewerIndex) * SCREEN_WIDTH;
    const timer = setTimeout(() => {
      viewerScrollRef.current?.scrollTo({ x: targetOffset, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [viewerVisible, viewerIndex]);

  const onViewerScroll = (e) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / SCREEN_WIDTH);
    setViewerIndex(index);
  };

  const openViewer = (index) => {
    if (!enableFullscreen) return;
    setViewerIndex(index);
    setViewerVisible(true);
  };

  return (
    <View style={{ marginTop: 12 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ borderRadius: 16, overflow: "hidden" }}
      >
        {displayEntries.map((item) => (
          <View key={`${item.uri}-${item.index}`} style={{ width: imageWidth, height }}>
            <Pressable
              onPress={(event) => {
                event?.stopPropagation?.();
                openViewer(item.index);
              }}
              style={({ pressed }) => [{ width: "100%", height: "100%" }, pressFeedbackStyle(pressed)]}
            >
              <Image
                source={{ uri: item.uri }}
                resizeMode="cover"
                style={{ width: "100%", height: "100%", backgroundColor: colors.surfaceAlt }}
                accessibilityLabel={`Issue image ${item.index + 1}`}
              />
            </Pressable>
            {typeof onRemoveImage === "function" ? (
              <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5
                  }}
                >
                  <Text
                    onPress={() => onRemoveImage(item.index, item.entry)}
                    style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}
                  >
                    Remove
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {displayEntries.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 }}>
          {displayEntries.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={{
                width: activeIndex === index ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: activeIndex === index ? colors.primary : colors.border
              }}
            />
          ))}
        </View>
      ) : null}

      <Modal
        visible={viewerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.overlay }}>
          <View style={{ paddingTop: 44, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
              {viewerIndex + 1} / {displayEntries.length}
            </Text>
            <Pressable onPress={() => setViewerVisible(false)} hitSlop={10} style={({ pressed }) => [pressFeedbackStyle(pressed)]}>
              <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={viewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onViewerScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
          >
            {displayEntries.map((item) => (
              <View
                key={`viewer-${item.uri}-${item.index}`}
                style={{ width: SCREEN_WIDTH, height: "100%", justifyContent: "center", alignItems: "center" }}
              >
                <Image
                  source={{ uri: item.uri }}
                  resizeMode="contain"
                  style={{ width: SCREEN_WIDTH, height: "100%" }}
                  accessibilityLabel={`Expanded issue image ${item.index + 1}`}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
