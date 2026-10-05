import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AaniraLogo from './AaniraLogo';

export default function AppHeader({
  title,
  rightBadgeText,
  rightBadgeIcon = 'calendar-outline',
  onRightBadgePress,
  showBack = false,
  onBack,
  subtitle,
  showLogo = true,
}) {
  return (
    <View style={styles.header}>
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : showLogo ? (
          <View style={styles.logoWrapper}>
            <AaniraLogo iconOnly size={32} />
          </View>
        ) : null}

        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            {showBack && showLogo && (
              <View style={styles.miniLogoWrapper}>
                <AaniraLogo iconOnly size={20} />
              </View>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {rightBadgeText && (
        <TouchableOpacity
          style={styles.badge}
          onPress={onRightBadgePress}
          disabled={!onRightBadgePress}
          activeOpacity={0.8}
        >
          {rightBadgeIcon && <Ionicons name={rightBadgeIcon} size={15} color="#0060AF" style={styles.badgeIcon} />}
          <Text style={styles.badgeText}>{rightBadgeText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0060AF',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#003F75',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  logoWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  miniLogoWrapper: {
    marginRight: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#E0F2FE',
    fontWeight: '500',
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeIcon: {
    marginRight: 5,
  },
  badgeText: {
    color: '#0060AF',
    fontSize: 12,
    fontWeight: '700',
  },
});
