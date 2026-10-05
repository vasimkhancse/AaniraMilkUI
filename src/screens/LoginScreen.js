import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AaniraLogo from '../components/AaniraLogo';
import PastureIllustration from '../components/PastureIllustration';

import CircleLoader from '../components/CircleLoader';

export default function LoginScreen({ masters, onLogin }) {
  const currentHour = new Date().getHours();
  const defaultShift = currentHour >= 14 ? 'Evening' : 'Morning';
  
  const [supplyBoyId, setSupplyBoyId] = useState('');
  const [selectedArea, setSelectedArea] = useState('area-1');
  const [selectedShift, setSelectedShift] = useState(defaultShift);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const users = masters?.users || [];
  const areas = masters?.areas || [];

  const selectedUserObj = supplyBoyId
    ? users.find(
        (u) =>
          u.id === supplyBoyId.trim() ||
          (u.name && u.name.toLowerCase() === supplyBoyId.trim().toLowerCase())
      )
    : null;

  const handleSelectUser = (user) => {
    setSupplyBoyId(user.id || user.name);
    if (user.assignedArea && user.assignedArea !== 'all') {
      setSelectedArea(user.assignedArea);
    }
    setIsUserDropdownOpen(false);
    setErrorMsg('');
  };

  const handleQuickSelect = (user) => {
    setSupplyBoyId(user.id);
    setSelectedArea(user.areaId);
    setIsUserDropdownOpen(false);
    setIsAreaDropdownOpen(false);
    setIsShiftDropdownOpen(false);
    setErrorMsg('');
  };

  const handleLoginSubmit = async () => {
    if (!supplyBoyId || !supplyBoyId.trim()) {
      setErrorMsg('Please select a Delivery Boy / Staff member');
      return;
    }
    if (!selectedArea || !selectedArea.trim()) {
      setErrorMsg('Please select a Delivery Area');
      return;
    }
    if (!selectedShift || !selectedShift.trim()) {
      setErrorMsg('Please select a Delivery Shift');
      return;
    }

    setIsLoggingIn(true);
    try {
      const matchedUser = users.find(
        (u) =>
          u.id === supplyBoyId.trim() ||
          (u.name && u.name.toLowerCase() === supplyBoyId.trim().toLowerCase())
      );

      const userObj = {
        id: matchedUser ? matchedUser.id : supplyBoyId.trim(),
        name: matchedUser ? matchedUser.name : `Staff (${supplyBoyId.trim()})`,
        role: matchedUser ? matchedUser.role : (supplyBoyId.toLowerCase() === 'admin' ? 'admin' : 'supply_boy'),
        assignedArea: selectedArea,
        shift: selectedShift,
      };

      await onLogin(userObj);
    } catch (e) {
      console.warn('Login error:', e);
      setErrorMsg('Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const selectedAreaObj = areas.find((a) => a.id === selectedArea) || areas[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Top Blue Wave Header with Mobile App Logo */}
          <View style={styles.topCurve}>
            <View style={styles.logoCard}>
              <AaniraLogo />
            </View>
          </View>

          {/* Form Container */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Delivery Boy & Staff Login</Text>
            <Text style={styles.formSubtitle}>Select your profile and area to access delivery sheets</Text>

            

            {/* Delivery Boy / Staff Dropdown Selector */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="person-circle" size={18} color="#0060AF" style={styles.inputIcon} />
                <Text style={styles.inputLabel}>Delivery Boy / Staff *</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.dropdownSelector,
                  isUserDropdownOpen && styles.dropdownSelectorActive,
                  !supplyBoyId && errorMsg ? { borderColor: '#DC2626' } : null,
                ]}
                onPress={() => {
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                  setIsAreaDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownSelectedRow}>
                  <View style={[styles.userAvatarIcon, !selectedUserObj && { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons
                      name={
                        !selectedUserObj
                          ? 'person-outline'
                          : selectedUserObj.role === 'admin'
                          ? 'shield-checkmark'
                          : 'bicycle'
                      }
                      size={16}
                      color={
                        !selectedUserObj
                          ? '#64748B'
                          : selectedUserObj.role === 'admin'
                          ? '#0060AF'
                          : '#0060AF'
                      }
                    />
                  </View>
                  <View style={styles.selectedUserInfo}>
                    <Text style={[styles.dropdownSelectedText, !selectedUserObj && { color: '#94A3B8' }]}>
                      {selectedUserObj ? selectedUserObj.name : 'Select Staff Member *'}
                    </Text>
                    <Text style={styles.dropdownSelectedSubtext}>
                      {selectedUserObj
                        ? (selectedUserObj.role === 'admin' ? 'Admin Manager' : 'Delivery Boy')
                        : 'Tap to choose your profile'}
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name={isUserDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#0060AF"
                />
              </TouchableOpacity>

              {isUserDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {users.map((user) => {
                    const isSelected =
                      user.id === supplyBoyId ||
                      (user.name && user.name.toLowerCase() === supplyBoyId.toLowerCase()) ||
                      (user.username && user.username.toLowerCase() === supplyBoyId.toLowerCase());
                    const userAreaName =
                      user.assignedArea === 'all'
                        ? 'All Areas'
                        : areas.find((a) => a.id === user.assignedArea)?.name?.split(' - ')[0] ||
                          user.assignedArea;

                    return (
                      <TouchableOpacity
                        key={user.id || user.username || user.name}
                        style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                        onPress={() => handleSelectUser(user)}
                      >
                        <View style={styles.dropdownOptionLeft}>
                          <View
                            style={[
                              styles.dropdownOptionAvatar,
                              isSelected && styles.dropdownOptionAvatarSelected,
                            ]}
                          >
                            <Ionicons
                              name={user.role === 'admin' ? 'shield-checkmark' : 'bicycle'}
                              size={15}
                              color={isSelected ? '#FFFFFF' : '#0060AF'}
                            />
                          </View>
                          <View>
                            <Text
                              style={[
                                styles.dropdownOptionText,
                                isSelected && styles.dropdownOptionTextSelected,
                              ]}
                            >
                              {user.name}
                            </Text>
                            <Text style={styles.dropdownOptionSub}>
                              {user.role === 'admin' ? 'Admin' : 'Delivery Boy'} • {userAreaName}
                            </Text>
                          </View>
                        </View>

                        {isSelected && <Ionicons name="checkmark-circle" size={18} color="#0060AF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Area Dropdown Selector */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="location" size={18} color="#0060AF" style={styles.inputIcon} />
                <Text style={styles.inputLabel}>Delivery Area</Text>
              </View>

              <TouchableOpacity
                style={[styles.dropdownSelector, isAreaDropdownOpen && styles.dropdownSelectorActive]}
                onPress={() => {
                  setIsAreaDropdownOpen(!isAreaDropdownOpen);
                  setIsUserDropdownOpen(false);
                  setIsShiftDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownSelectedRow}>
                  <View style={styles.userAvatarIcon}>
                    <Ionicons name="map-outline" size={16} color="#0060AF" />
                  </View>
                  <Text style={styles.dropdownSelectedText}>
                    {selectedAreaObj?.name || 'Select your area'}
                  </Text>
                </View>
                <Ionicons
                  name={isAreaDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#0060AF"
                />
              </TouchableOpacity>

              {isAreaDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {areas.map((area) => {
                    const isSelected = area.id === selectedArea;
                    return (
                      <TouchableOpacity
                        key={area.id}
                        style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                        onPress={() => {
                          setSelectedArea(area.id);
                          setIsAreaDropdownOpen(false);
                        }}
                      >
                        <View style={styles.dropdownOptionLeft}>
                          <Ionicons
                            name="location-outline"
                            size={16}
                            color={isSelected ? '#0060AF' : '#64748B'}
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={[
                              styles.dropdownOptionText,
                              isSelected && styles.dropdownOptionTextSelected,
                            ]}
                          >
                            {area.name}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color="#0060AF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Shift Dropdown Selector */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Ionicons name="time" size={18} color="#0060AF" style={styles.inputIcon} />
                <Text style={styles.inputLabel}>Delivery Shift</Text>
              </View>

              <TouchableOpacity
                style={[styles.dropdownSelector, isShiftDropdownOpen && styles.dropdownSelectorActive]}
                onPress={() => {
                  setIsShiftDropdownOpen(!isShiftDropdownOpen);
                  setIsUserDropdownOpen(false);
                  setIsAreaDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownSelectedRow}>
                  <View style={[styles.userAvatarIcon, { backgroundColor: selectedShift === 'Morning' ? '#FEF3C7' : '#E0E7FF' }]}>
                    <Ionicons
                      name={selectedShift === 'Morning' ? 'sunny' : 'moon'}
                      size={17}
                      color={selectedShift === 'Morning' ? '#D97706' : '#4F46E5'}
                    />
                  </View>
                  <View style={styles.selectedUserInfo}>
                    <Text style={styles.dropdownSelectedText}>
                      {selectedShift === 'Morning' ? 'Morning Shift' : 'Evening Shift'}
                    </Text>
                    <Text style={styles.dropdownSelectedSubtext}>
                      {selectedShift === 'Morning' ? '5:30 AM - 9:00 AM Delivery' : '4:30 PM - 8:00 PM Delivery'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isShiftDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#0060AF"
                />
              </TouchableOpacity>

              {isShiftDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {[
                    { id: 'Morning', label: 'Morning Shift', sub: '5:30 AM - 9:00 AM Delivery', icon: 'sunny', color: '#D97706', bg: '#FEF3C7' },
                    { id: 'Evening', label: 'Evening Shift', sub: '4:30 PM - 8:00 PM Delivery', icon: 'moon', color: '#4F46E5', bg: '#E0E7FF' },
                  ].map((s) => {
                    const isSelected = selectedShift === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                        onPress={() => {
                          setSelectedShift(s.id);
                          setIsShiftDropdownOpen(false);
                        }}
                      >
                        <View style={styles.dropdownOptionLeft}>
                          <View
                            style={[
                              styles.dropdownOptionAvatar,
                              { backgroundColor: isSelected ? '#0060AF' : s.bg },
                            ]}
                          >
                            <Ionicons
                              name={s.icon}
                              size={15}
                              color={isSelected ? '#FFFFFF' : s.color}
                            />
                          </View>
                          <View>
                            <Text
                              style={[
                                styles.dropdownOptionText,
                                isSelected && styles.dropdownOptionTextSelected,
                              ]}
                            >
                              {s.label}
                            </Text>
                            <Text style={styles.dropdownOptionSub}>{s.sub}</Text>
                          </View>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color="#0060AF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, isLoggingIn && styles.loginBtnDisabled]}
              onPress={handleLoginSubmit}
              activeOpacity={0.85}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CircleLoader size="small" color="#FFFFFF" />
                  <Text style={styles.loginBtnText}>Logging In...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Proceed to Delivery Sheets</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Scenic Pasture & Cow Illustration */}
          <View style={styles.bottomIllustration}>
            <PastureIllustration height={120} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  topCurve: {
    backgroundColor: '#0060AF',
    paddingTop: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
    shadowColor: '#00437A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  logoCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 24,
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginTop: -20,
    marginHorizontal: 18,
    padding: 22,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 14,
  },
  chipRow: {
    marginBottom: 14,
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 12,
  },
  chipHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  chipScroll: {
    gap: 6,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  userChipActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  userChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0060AF',
  },
  userChipTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputIcon: {
    marginRight: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  dropdownSelectorActive: {
    borderColor: '#0060AF',
    backgroundColor: '#F0F7FF',
  },
  dropdownSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedUserInfo: {
    flex: 1,
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownSelectedSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownOptionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropdownOptionAvatarSelected: {
    backgroundColor: '#0060AF',
  },
  dropdownOptionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  dropdownOptionTextSelected: {
    color: '#0060AF',
    fontWeight: '700',
  },
  dropdownOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0.1,
  },
  loginBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  bottomIllustration: {
    marginTop: 16,
    width: '100%',
  },
});
