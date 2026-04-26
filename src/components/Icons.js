import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

const iconSize = (size) => ({ width: size, height: size });

/**
 * ShieldCheck Icon - Security/Login
 */
export const ShieldCheckIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * MessageCircle Icon - Browse Complaints
 */
export const MessageCircleIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * Plus Icon - File Complaint
 */
export const PlusIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * Bookmark Icon - My Issues
 */
export const BookmarkIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5, filled = false }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? color : "none"}>
      <Path
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : "none"}
      />
    </Svg>
  </View>
);

/**
 * BarChart Icon - Analytics/Dashboard
 */
export const BarChartIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path d="M3 3v18h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 11h3v10H7z" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M15 7h3v14h-3z" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M11 14h3v7h-3z" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  </View>
);

/**
 * Users Icon - Head/Team Management
 */
export const UsersIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M16 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * Settings Icon - Admin Panel
 */
export const SettingsIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * Tag Icon - Tag Management
 */
export const TagIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="6.5" cy="6.5" r="1.5" fill={color} />
    </Svg>
  </View>
);

/**
 * Filter Icon - Personalized Feed
 */
export const FilterIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M22 3H2l8 9.46v7l6 3v-10L22 3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * MapPin Icon - Location
 */
export const MapPinIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

/**
 * Heart Icon - Like/Favorite
 */
export const HeartIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5, filled = false }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? color : "none"}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : "none"}
      />
    </Svg>
  </View>
);

/**
 * Share2 Icon - Share Action
 */
export const Share2Icon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.59 13.51l6.83 3.98M15.41 6.49l-6.82 3.98" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

/**
 * LogIn Icon - Alternative login icon
 */
export const LogInIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M20 12H9.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * User Icon - Profile
 */
export const UserIcon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * MessageCircle2 Icon - Comments
 */
export const MessageCircle2Icon = ({ size = 24, color = "#8B0000", strokeWidth = 1.5 }) => (
  <View style={iconSize(size)}>
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4v-4H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);
