import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

export default function AaniraLogo({
  compact = false,
  showTagline = true,
  showLocation = true,
  iconOnly = false,
  horizontal = false,
  size = null,
  variant = 'default', // 'default' | 'light'
}) {
  const iconSize = size || (compact ? (iconOnly ? 36 : 52) : (iconOnly ? 44 : 72));
  const isLight = variant === 'light';
  const primaryColor = isLight ? '#FFFFFF' : '#0060AF';
  const bgFill = isLight ? 'rgba(255, 255, 255, 0.2)' : '#EAF4FC';
  const strokeColor = isLight ? '#FFFFFF' : '#0060AF';

  const renderIcon = () => (
    <View style={[styles.iconWrapper, horizontal && styles.iconWrapperHorizontal]}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 100 100" fill="none">
        {/* Outer milk splash wave arc */}
        <Path
          d="M 12 56 C 10 32 30 14 50 14 C 74 14 90 32 88 56 C 86 78 68 88 50 88 C 30 88 14 76 12 56 Z"
          stroke={strokeColor}
          strokeWidth="3.5"
          fill={bgFill}
        />
        {/* Cow Head Shape */}
        <Path
          d="M 32 35 C 32 26 40 28 44 32 C 48 30 52 30 56 32 C 60 28 68 26 68 35 C 68 42 62 44 60 48 C 60 56 40 56 40 48 C 38 44 32 42 32 35 Z"
          fill={primaryColor}
        />
        {/* Cow Horns & Ears */}
        <Path
          d="M 30 38 C 22 36 20 44 26 46 C 30 46 34 42 34 38 Z"
          fill={primaryColor}
        />
        <Path
          d="M 70 38 C 78 36 80 44 74 46 C 70 46 66 42 66 38 Z"
          fill={primaryColor}
        />
        {/* Cow White Muzzle */}
        <Path
          d="M 41 45 C 41 42 59 42 59 45 C 60 52 40 52 41 45 Z"
          fill="#FFFFFF"
        />
        <Circle cx="46" cy="47" r="1.5" fill="#0060AF" />
        <Circle cx="54" cy="47" r="1.5" fill="#0060AF" />
        {/* Cow Eyes */}
        <Circle cx="44" cy="38" r="1.8" fill="#FFFFFF" />
        <Circle cx="56" cy="38" r="1.8" fill="#FFFFFF" />
        {/* Milk Bottle Graphic next to Cow */}
        <G transform="translate(56, 46) scale(0.6)">
          <Rect x="10" y="2" width="12" height="4" rx="1.5" fill={primaryColor} />
          <Rect x="13" y="6" width="6" height="4" fill={primaryColor} />
          <Path
            d="M 9 10 C 9 8 23 8 23 10 L 25 32 C 25 35 7 35 7 32 Z"
            fill={primaryColor}
          />
          {/* White milk fill inside */}
          <Rect x="10" y="14" width="12" height="15" rx="2" fill="#FFFFFF" />
        </G>
      </Svg>
    </View>
  );

  if (iconOnly) {
    return renderIcon();
  }

  return (
    <View style={[styles.container, horizontal && styles.containerHorizontal]}>
      {renderIcon()}

      {/* Brand Text */}
      <View style={[styles.textContainer, horizontal && styles.textContainerHorizontal]}>
        <View style={styles.brandTitleRow}>
          <Text
            style={[
              styles.brandName,
              compact && styles.compactBrandName,
              isLight && styles.lightText,
            ]}
          >
            Aanira
          </Text>
          {showLocation && (
            <View style={[styles.locationPill, isLight && styles.lightLocationPill]}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={[styles.locationText, isLight && styles.lightLocationText]}>
                Kovaipudur
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.brandSubtitle,
            compact && styles.compactSubtitle,
            isLight && styles.lightSubtitle,
          ]}
        >
          Milk & Milk Products
        </Text>
        {showTagline && !compact && (
          <Text style={[styles.tagline, isLight && styles.lightTagline]}>
            Fresh Milk  •  Healthy Family
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconWrapper: {
    marginBottom: 4,
  },
  iconWrapperHorizontal: {
    marginBottom: 0,
    marginRight: 8,
  },
  textContainer: {
    alignItems: 'center',
  },
  textContainerHorizontal: {
    alignItems: 'flex-start',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0060AF',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  compactBrandName: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  lightText: {
    color: '#FFFFFF',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C3E1F9',
  },
  lightLocationPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  locationIcon: {
    fontSize: 11,
    marginRight: 2,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0060AF',
  },
  lightLocationText: {
    color: '#FFFFFF',
  },
  brandSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0060AF',
    marginTop: -2,
    letterSpacing: 0.2,
  },
  compactSubtitle: {
    fontSize: 11,
    marginTop: 0,
  },
  lightSubtitle: {
    color: '#E0F2FE',
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B6B8A',
    fontStyle: 'italic',
    marginTop: 4,
  },
  lightTagline: {
    color: '#BAE6FD',
  },
});
