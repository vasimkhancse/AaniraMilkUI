import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Rect, Ellipse, G, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function PastureIllustration({ height = 120 }) {
  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox="0 0 400 120" preserveAspectRatio="none">
        <Defs>
          {/* Green grass hill gradient */}
          <LinearGradient id="grassGrad1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#84CC16" />
            <Stop offset="100%" stopColor="#4D7C0F" />
          </LinearGradient>
          <LinearGradient id="grassGrad2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#A3E635" />
            <Stop offset="100%" stopColor="#65A30D" />
          </LinearGradient>
          <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.9" />
          </LinearGradient>
        </Defs>

        {/* Soft mountain / background hill */}
        <Path
          d="M 0 50 Q 80 20 180 45 T 400 35 L 400 120 L 0 120 Z"
          fill="#D9F99D"
          opacity="0.85"
        />

        {/* Foreground rolling hill */}
        <Path
          d="M 0 65 Q 120 40 240 65 T 400 50 L 400 120 L 0 120 Z"
          fill="url(#grassGrad2)"
        />

        {/* Little wildflowers */}
        <Circle cx="40" cy="85" r="3" fill="#FFFFFF" />
        <Circle cx="40" cy="85" r="1.5" fill="#FACC15" />

        <Circle cx="120" cy="95" r="3" fill="#FFFFFF" />
        <Circle cx="120" cy="95" r="1.5" fill="#FACC15" />

        <Circle cx="280" cy="90" r="3" fill="#FFFFFF" />
        <Circle cx="280" cy="90" r="1.5" fill="#FACC15" />

        {/* Cute Spotted Cow on Left */}
        <G transform="translate(30, 42) scale(0.7)">
          {/* Cow body */}
          <Ellipse cx="50" cy="45" rx="30" ry="18" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
          {/* Black patches on body */}
          <Path d="M 32 32 Q 40 38 35 48 Q 28 45 32 32 Z" fill="#1E293B" />
          <Path d="M 55 35 Q 65 42 60 52 Q 50 48 55 35 Z" fill="#1E293B" />
          <Path d="M 42 48 Q 48 56 40 58 Q 36 52 42 48 Z" fill="#1E293B" />

          {/* Cow Head */}
          <Ellipse cx="22" cy="35" rx="14" ry="12" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
          <Path d="M 14 26 Q 22 24 24 32 Q 16 32 14 26 Z" fill="#1E293B" />
          {/* Horns & Ears */}
          <Path d="M 16 26 Q 12 18 20 22 Z" fill="#FBBF24" stroke="#1E293B" strokeWidth="1.5" />
          <Path d="M 28 26 Q 32 18 24 22 Z" fill="#FBBF24" stroke="#1E293B" strokeWidth="1.5" />
          <Ellipse cx="10" cy="32" rx="4" ry="2" fill="#FCA5A5" />
          <Ellipse cx="34" cy="32" rx="4" ry="2" fill="#FCA5A5" />
          {/* Snout */}
          <Ellipse cx="18" cy="40" rx="9" ry="6" fill="#FBCFE8" stroke="#1E293B" strokeWidth="1.5" />
          <Circle cx="15" cy="40" r="1" fill="#831843" />
          <Circle cx="21" cy="40" r="1" fill="#831843" />
          {/* Eye */}
          <Circle cx="20" cy="32" r="1.8" fill="#1E293B" />

          {/* Legs */}
          <Rect x="30" y="58" width="5" height="18" rx="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          <Rect x="30" y="73" width="5" height="3" fill="#1E293B" />

          <Rect x="42" y="60" width="5" height="16" rx="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          <Rect x="42" y="73" width="5" height="3" fill="#1E293B" />

          <Rect x="60" y="58" width="5" height="18" rx="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          <Rect x="60" y="73" width="5" height="3" fill="#1E293B" />

          <Rect x="70" y="60" width="5" height="16" rx="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          <Rect x="70" y="73" width="5" height="3" fill="#1E293B" />

          {/* Udder */}
          <Ellipse cx="58" cy="58" rx="6" ry="4" fill="#FBCFE8" />

          {/* Tail */}
          <Path d="M 78 40 Q 86 48 84 58" stroke="#1E293B" strokeWidth="2" fill="none" />
          <Circle cx="84" cy="58" r="2.5" fill="#1E293B" />
        </G>

        {/* Large Milk Bottle on Right */}
        <G transform="translate(320, 20) scale(0.95)">
          {/* Bottle Cap */}
          <Rect x="16" y="8" width="20" height="7" rx="3" fill="#0060AF" stroke="#004080" strokeWidth="1.5" />
          <Rect x="20" y="15" width="12" height="6" fill="#0060AF" />

          {/* Bottle Body */}
          <Path
            d="M 14 21 C 14 20 38 20 38 21 L 44 38 L 44 86 C 44 90 8 90 8 86 L 8 38 Z"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* Blue Label Banner */}
          <Rect x="9" y="48" width="34" height="18" fill="#0060AF" />
          <Path d="M 15 57 L 22 57 M 26 57 L 37 57" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <Circle cx="26" cy="57" r="2" fill="#FFFFFF" />

          {/* Glass Gloss highlight */}
          <Path d="M 12 32 L 12 78" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
