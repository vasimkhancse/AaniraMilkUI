import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';

/**
 * CircleLoader Component
 * Flexible circular loader for inline, button, or full-screen usage.
 */
export default function CircleLoader({
  size = 'small', // 'small' | 'large' | number
  color = '#0060AF',
  text = '',
  textColor = '#0060AF',
  style,
  textStyle,
  fullScreen = false,
  containerStyle,
}) {
  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreenContainer, containerStyle]}>
      <ActivityIndicator size={size} color={color} style={style} />
      {Boolean(text) && (
        <Text style={[styles.loadingText, { color: textColor }, textStyle]}>
          {text}
        </Text>
      )}
    </View>
  );

  return content;
}

/**
 * LoadingOverlay Component
 * Displays a modal circle loader overlay during async operations (Save, Update, Delete, Sync)
 */
export function LoadingOverlay({ visible, message = 'Processing...' }) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlayBackground}>
        <View style={styles.overlayCard}>
          <View style={styles.spinnerCircle}>
            <ActivityIndicator size="large" color="#0060AF" />
          </View>
          <Text style={styles.overlayText}>{message}</Text>
          <Text style={styles.overlaySubText}>Please wait a moment</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  fullScreenContainer: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  spinnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  overlayText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  overlaySubText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
});
