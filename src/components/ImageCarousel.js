import React from "react";
import { Dimensions, Image, ScrollView, View } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ImageCarousel({ images = [] }) {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 10, borderRadius: 8, overflow: "hidden" }}
    >
      {images.map((uri, index) => (
        <View key={`${uri}-${index}`} style={{ width: SCREEN_WIDTH - 32, height: 220 }}>
          <Image
            source={{ uri }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%", backgroundColor: "#EEF2F6" }}
            accessibilityLabel={`Issue image ${index + 1}`}
          />
        </View>
      ))}
    </ScrollView>
  );
}
