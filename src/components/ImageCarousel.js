import React, { useRef, useState } from "react";
import { Dimensions, Image, ScrollView, View } from "react-native";
import { absoluteUploadUrl } from "../services/issues";
import { useTheme } from "../context/ThemeContext";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ImageCarousel({ images = [] }) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const imageWidth = SCREEN_WIDTH - 64;

  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const onScroll = (e) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / imageWidth);
    setActiveIndex(index);
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
        {images.map((uri, index) => (
          <View key={`${uri}-${index}`} style={{ width: imageWidth, height: 220 }}>
            <Image
              source={{ uri: absoluteUploadUrl(uri) }}
              resizeMode="cover"
              style={{ width: "100%", height: "100%", backgroundColor: colors.surfaceAlt }}
              accessibilityLabel={`Issue image ${index + 1}`}
            />
          </View>
        ))}
      </ScrollView>

      {images.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 }}>
          {images.map((_, index) => (
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
    </View>
  );
}
