import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import CircleLoader, { LoadingOverlay } from '../components/CircleLoader';

export default function MastersScreen({ masters, onUpdateMasters, onResetDemoData, onBack, onRefresh }) {
  const [activeTab, setActiveTab] = useState('customers'); // customers | rates | areas | users
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');

  // Loading states
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isDeletingCustomerId, setIsDeletingCustomerId] = useState(null);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isSavingArea, setIsSavingArea] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSubTabPress = async (tab) => {
    setActiveTab(tab);
    setIsTabLoading(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        const freshMasters = await storageService.getMasters();
        if (freshMasters && onUpdateMasters) {
          onUpdateMasters(freshMasters);
        }
      }
    } catch (e) {
      console.warn('Error refreshing masters data:', e);
    } finally {
      setIsTabLoading(false);
    }
  };

  // Form states for Customer Add/Edit
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAreaId, setCustAreaId] = useState('area-1');
  const [custMorningQty, setCustMorningQty] = useState('1.0');
  const [custEveningQty, setCustEveningQty] = useState('0.5');
  const [custPricePerLiter, setCustPricePerLiter] = useState('60');
  const [custModalError, setCustModalError] = useState('');

  // Rate master state
  const [baseMilkRate, setBaseMilkRate] = useState(String(masters?.milkRatePerLiter || 60));
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaShort, setNewAreaShort] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserArea, setNewUserArea] = useState(masters?.areas?.[0]?.id || 'area-1');
  const [isUserAreaDropdownOpen, setIsUserAreaDropdownOpen] = useState(false);

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustAreaId(masters?.areas?.[0]?.id || 'area-1');
    setCustMorningQty('1.0');
    setCustEveningQty('0.0');
    setCustPricePerLiter(String(masters?.milkRatePerLiter || 60));
    setCustModalError('');
    setCustomerModalVisible(true);
  };

  const openEditCustomer = (c) => {
    setEditingCustomer(c);
    setCustName(c.name || '');
    const digits = (c.phone || '').replace(/[^0-9]/g, '');
    const cleaned = digits.length > 10 && digits.startsWith('91') ? digits.slice(2, 12) : digits.slice(0, 10);
    setCustPhone(cleaned);
    setCustAreaId(c.areaId || 'area-1');
    setCustMorningQty(String(c.defaultMorningQty ?? 1.0));
    setCustEveningQty(String(c.defaultEveningQty ?? 0.0));
    setCustPricePerLiter(String(c.pricePerLiter || masters?.milkRatePerLiter || 60));
    setCustModalError('');
    setCustomerModalVisible(true);
  };

  const handleSaveCustomer = async () => {
    const trimmedName = custName.trim();
    if (!trimmedName) {
      setCustModalError('Customer Name is required');
      return;
    }

    const cleanPhone = custPhone.trim().replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      setCustModalError('Phone number is required');
      return;
    }

    if (cleanPhone.length !== 10) {
      setCustModalError('Phone number must be exactly 10 digits');
      return;
    }

    setCustModalError('');
    setIsSavingCustomer(true);
    try {
      const payload = {
        id: editingCustomer?.id,
        name: trimmedName,
        phone: `+91 ${cleanPhone}`,
        areaId: custAreaId,
        defaultMorningQty: parseFloat(custMorningQty) || 0,
        defaultEveningQty: parseFloat(custEveningQty) || 0,
        pricePerLiter: parseFloat(custPricePerLiter) || 60,
        active: true,
      };

      const updatedCustList = await storageService.saveCustomer(payload);
      onUpdateMasters({
        ...masters,
        customers: updatedCustList,
      });
      setCustomerModalVisible(false);
    } catch (e) {
      console.warn('Error saving customer:', e);
      setCustModalError('Failed to save customer to database. Please try again.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    setIsDeletingCustomerId(id);
    try {
      const updated = await storageService.deleteCustomer(id);
      onUpdateMasters({
        ...masters,
        customers: updated,
      });
    } catch (e) {
      console.warn('Error deleting customer:', e);
    } finally {
      setIsDeletingCustomerId(null);
    }
  };

  const handleSaveBaseRate = async () => {
    const num = parseFloat(baseMilkRate);
    if (!isNaN(num) && num > 0) {
      setIsSavingRate(true);
      try {
        const updatedCustomers = (masters?.customers || []).map((c) => ({
          ...c,
          pricePerLiter: num,
        }));
        const updated = {
          ...masters,
          milkRatePerLiter: num,
          customers: updatedCustomers,
        };
        await storageService.saveMasters(updated);
        onUpdateMasters(updated);
        setSyncStatus('Base milk rate & all customer rates updated in PostgreSQL');
        setTimeout(() => setSyncStatus(''), 2500);
      } catch (e) {
        console.warn('Error updating rate:', e);
      } finally {
        setIsSavingRate(false);
      }
    }
  };

  // Area edit state
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [editAreaShort, setEditAreaShort] = useState('');
  const [isDeletingAreaId, setIsDeletingAreaId] = useState(null);

  // User edit state
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserArea, setEditUserArea] = useState('area-1');
  const [isEditUserAreaDropdownOpen, setIsEditUserAreaDropdownOpen] = useState(false);
  const [isDeletingUserId, setIsDeletingUserId] = useState(null);

  const handleAddArea = async () => {
    if (!newAreaName.trim()) return;
    setIsSavingArea(true);
    const newId = `area-${Date.now()}`;
    const areaPayload = {
      id: newId,
      name: newAreaName.trim(),
      shortName: newAreaShort.trim() || newAreaName.trim().slice(0, 8),
    };

    try {
      const updatedAreas = await storageService.saveArea(areaPayload);
      const updated = { ...masters, areas: updatedAreas };
      onUpdateMasters(updated);
      setNewAreaName('');
      setNewAreaShort('');
      setSyncStatus('New area added successfully');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (e) {
      console.warn('Error saving area:', e);
    } finally {
      setIsSavingArea(false);
    }
  };

  const openEditArea = (area) => {
    setEditingArea(area);
    setEditAreaName(area.name || '');
    setEditAreaShort(area.shortName || '');
    setAreaModalVisible(true);
  };

  const handleSaveEditArea = async () => {
    if (!editAreaName.trim() || !editingArea) return;
    setIsSavingArea(true);
    try {
      const payload = {
        id: editingArea.id,
        name: editAreaName.trim(),
        shortName: editAreaShort.trim() || editAreaName.trim().slice(0, 8),
      };
      const updatedAreas = await storageService.saveArea(payload);
      const updated = { ...masters, areas: updatedAreas };
      onUpdateMasters(updated);
      setAreaModalVisible(false);
      setSyncStatus('Area updated successfully');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (e) {
      console.warn('Error updating area:', e);
    } finally {
      setIsSavingArea(false);
    }
  };

  const handleDeleteArea = async (areaId) => {
    setIsDeletingAreaId(areaId);
    try {
      const updatedAreas = await storageService.deleteArea(areaId);
      const updated = { ...masters, areas: updatedAreas };
      onUpdateMasters(updated);
      setSyncStatus('Area deleted successfully');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (e) {
      console.warn('Error deleting area:', e);
    } finally {
      setIsDeletingAreaId(null);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim()) return;
    setIsSavingUser(true);
    const cleanSlug = newUserName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const userPayload = {
      id: `user_${cleanSlug}_${Date.now().toString().slice(-4)}`,
      name: newUserName.trim(),
      role: 'supply_boy',
      assignedArea: newUserArea,
      phone: '',
    };

    try {
      const updatedUsers = await storageService.saveUser(userPayload);
      const updated = { ...masters, users: updatedUsers };
      onUpdateMasters(updated);
      setNewUserName('');
      setSyncStatus('Delivery staff added successfully');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (e) {
      console.warn('Error adding user:', e);
    } finally {
      setIsSavingUser(false);
    }
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setEditUserName(user.name || '');
    setEditUserArea(user.assignedArea || 'area-1');
    setIsEditUserAreaDropdownOpen(false);
    setUserModalVisible(true);
  };

  const handleSaveEditUser = async () => {
    if (!editUserName.trim() || !editingUser) return;
    setIsSavingUser(true);
    try {
      const payload = {
        id: editingUser.id,
        name: editUserName.trim(),
        role: editingUser.role || 'supply_boy',
        assignedArea: editUserArea,
        phone: editingUser.phone || '',
      };
      const updatedUsers = await storageService.saveUser(payload);
      const updated = { ...masters, users: updatedUsers };
      onUpdateMasters(updated);
      setUserModalVisible(false);
      setSyncStatus('Staff member updated successfully');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (e) {
      console.warn('Error updating user:', e);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    setIsDeletingUserId(userId);
    try {
      const updatedUsers = await storageService.deleteUser(userId);
      const updated = { ...masters, users: updatedUsers };
      onUpdateMasters(updated);
      setSyncStatus('Staff member deleted successfully');
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (e) {
      console.warn('Error deleting user:', e);
    } finally {
      setIsDeletingUserId(null);
    }
  };

  const handleRefreshDatabase = async () => {
    setIsSyncing(true);
    try {
      setSyncStatus('Syncing with PostgreSQL...');
      const freshMasters = await apiService.getMasters();
      if (freshMasters) {
        onUpdateMasters(freshMasters);
        setSyncStatus('Synced successfully with Neon PostgreSQL!');
      }
    } catch (e) {
      setSyncStatus('Failed to connect to backend: ' + e.message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Masters & Configuration"
        rightBadgeText="Settings"
        rightBadgeIcon="construct-outline"
        showBack={Boolean(onBack)}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'customers' && styles.tabBtnActive]}
            onPress={() => handleSubTabPress('customers')}
          >
            <Ionicons
              name="people"
              size={16}
              color={activeTab === 'customers' ? '#0060AF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'customers' && styles.tabTextActive]}>
              Customers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'rates' && styles.tabBtnActive]}
            onPress={() => handleSubTabPress('rates')}
          >
            <Ionicons
              name="pricetag"
              size={16}
              color={activeTab === 'rates' ? '#0060AF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'rates' && styles.tabTextActive]}>
              Rates & Qty
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'areas' && styles.tabBtnActive]}
            onPress={() => handleSubTabPress('areas')}
          >
            <Ionicons
              name="map"
              size={16}
              color={activeTab === 'areas' ? '#0060AF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'areas' && styles.tabTextActive]}>
              Areas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'users' && styles.tabBtnActive]}
            onPress={() => handleSubTabPress('users')}
          >
            <Ionicons
              name="bicycle"
              size={16}
              color={activeTab === 'users' ? '#0060AF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
              Delivery Boys
            </Text>
          </TouchableOpacity>
        </View>

        {syncStatus ? (
          <View style={styles.syncStatusNotice}>
            <Ionicons name="information-circle" size={16} color="#0060AF" />
            <Text style={styles.syncStatusText}>{syncStatus}</Text>
          </View>
        ) : null}

        {/* Sub-tab loading indicator */}
        {isTabLoading ? (
          <View style={styles.tabLoadingBox}>
            <CircleLoader
              size="large"
              color="#0060AF"
              text={`Loading ${activeTab} configuration...`}
              textColor="#0060AF"
            />
          </View>
        ) : (
          <>
            {/* TAB 1: CUSTOMERS MASTER */}
            {activeTab === 'customers' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Customer Master & Defaults</Text>
                    <Text style={styles.sectionSubtitle}>
                      Add customer profiles 
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={openAddCustomer}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addBtnText}>Add New</Text>
                  </TouchableOpacity>
                </View>

                {(masters?.customers || []).length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="people-outline" size={40} color="#94A3B8" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyCardTitle}>No customers added yet</Text>
                    <Text style={styles.emptyCardSub}>
                      Add your first customer by tapping the "+ Add New" button above.
                    </Text>
                    <TouchableOpacity style={styles.addBtnLarge} onPress={openAddCustomer}>
                      <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.addBtnText}>Add Customer</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  (masters?.customers || []).map((c) => {
                    const area = (masters?.areas || []).find((a) => a.id === c.areaId);
                    const isDeleting = isDeletingCustomerId === c.id;
                    return (
                      <View key={c.id} style={styles.cardItem}>
                        <View style={styles.cardItemLeft}>
                          <View style={styles.avatarMini}>
                            <Text style={styles.avatarMiniText}>{c.name.slice(0, 1).toUpperCase()}</Text>
                          </View>
                          <View>
                            <Text style={styles.cardItemTitle}>{c.name}</Text>
                            <Text style={styles.cardItemSubtitle}>
                              {c.phone || 'No phone'} • {area?.name || c.areaId}
                            </Text>
                            <View style={styles.behaviorRow}>
                              <View style={styles.behaviorBadge}>
                                <Text style={styles.behaviorBadgeText}>
                                  ☀️ M: {c.defaultMorningQty ?? 1}L
                                </Text>
                              </View>
                              <View style={styles.behaviorBadge}>
                                <Text style={styles.behaviorBadgeText}>
                                  🌙 E: {c.defaultEveningQty ?? 0}L
                                </Text>
                              </View>
                              <Text style={styles.rateBadgeText}>₹{c.pricePerLiter || 60}/L</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => openEditCustomer(c)}
                            disabled={isDeleting}
                          >
                            <Ionicons name="pencil" size={18} color="#0060AF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => handleDeleteCustomer(c.id)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <CircleLoader size="small" color="#DC2626" />
                            ) : (
                              <Ionicons name="trash-outline" size={18} color="#DC2626" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* TAB 2: RATES & QUANTITY PRESETS */}
            {activeTab === 'rates' && (
              <View>
                <Text style={styles.sectionTitle}>Milk Rate & Quantity Master</Text>

                <View style={styles.settingsCard}>
                  <Text style={styles.cardHeaderSmall}>Standard Base Price per Litre</Text>
                  <View style={styles.inlineEditRow}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.rateInput}
                      keyboardType="numeric"
                      value={baseMilkRate}
                      onChangeText={setBaseMilkRate}
                    />
                    <TouchableOpacity
                      style={[styles.saveSmallBtn, isSavingRate && styles.btnDisabled]}
                      onPress={handleSaveBaseRate}
                      disabled={isSavingRate}
                    >
                      {isSavingRate ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CircleLoader size="small" color="#FFFFFF" />
                          <Text style={styles.saveSmallBtnText}>Updating...</Text>
                        </View>
                      ) : (
                        <Text style={styles.saveSmallBtnText}>Update Rate</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingsCard}>
                  <Text style={styles.cardHeaderSmall}>Available Quantity Units & Presets</Text>
                  <View style={styles.presetChipWrap}>
                    {(masters?.quantityPresets || []).map((p) => (
                      <View key={p.label} style={styles.fixedPresetChip}>
                        <Ionicons name="water" size={14} color="#0060AF" style={{ marginRight: 4 }} />
                        <Text style={styles.fixedPresetText}>
                          {p.label} = {p.value} Litres
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Shifts Configuration */}
                <View style={styles.settingsCard}>
                  <Text style={styles.cardHeaderSmall}>Delivery Shifts</Text>
                  <View style={styles.shiftList}>
                    <View style={styles.shiftItem}>
                      <Ionicons name="sunny" size={20} color="#F59E0B" />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.shiftItemTitle}>Morning Shift</Text>
                        <Text style={styles.shiftItemTime}>6:00 AM - 8:30 AM</Text>
                      </View>
                    </View>
                    <View style={styles.shiftItem}>
                      <Ionicons name="moon" size={20} color="#6366F1" />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.shiftItemTitle}>Evening Shift</Text>
                        <Text style={styles.shiftItemTime}>5:00 PM - 7:30 PM</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>)}
               {/* TAB 3: AREAS MASTER */}
            {activeTab === 'areas' && (
              <View>
                <Text style={styles.sectionTitle}>Delivery Areas Master</Text>

                <View style={styles.settingsCard}>
                  <Text style={styles.cardHeaderSmall}>Add New Delivery Area</Text>
                  <TextInput
                    style={styles.textInputFull}
                    placeholder="Area Name (e.g. Area 4 - VLB Campus)"
                    placeholderTextColor="#94A3B8"
                    value={newAreaName}
                    onChangeText={setNewAreaName}
                  />
                  <TouchableOpacity
                    style={[styles.addFullBtn, isSavingArea && styles.btnDisabled]}
                    onPress={handleAddArea}
                    disabled={isSavingArea}
                  >
                    {isSavingArea ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CircleLoader size="small" color="#FFFFFF" />
                        <Text style={styles.addFullBtnText}>Adding Area...</Text>
                      </View>
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.addFullBtnText}>Add Area</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {(masters?.areas || []).map((area, idx) => (
                  <View key={area.id} style={styles.cardItem}>
                    <View style={styles.cardItemLeft}>
                      <View style={styles.areaIndexBadge}>
                        <Text style={styles.areaIndexText}>{idx + 1}</Text>
                      </View>
                      <View>
                        <Text style={styles.cardItemTitle}>{area.name}</Text>
                        
                      </View>
                    </View>
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => openEditArea(area)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil" size={16} color="#0060AF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionIconBtn, styles.actionIconBtnDelete]}
                        onPress={() => handleDeleteArea(area.id)}
                        disabled={isDeletingAreaId === area.id}
                        activeOpacity={0.7}
                      >
                        {isDeletingAreaId === area.id ? (
                          <CircleLoader size="small" color="#DC2626" />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB 4: USERS / DELIVERY BOYS */}
            {activeTab === 'users' && (
              <View>
                <Text style={styles.sectionTitle}>Delivery Boys & Staff</Text>
                <Text style={styles.sectionSubtitle}>Manage delivery staff profiles and assign delivery areas</Text>

                <View style={styles.settingsCard}>
                  <Text style={styles.cardHeaderSmall}>Add Delivery Boy / Staff</Text>
                  
                  <Text style={[styles.inputLabelSmall, { marginTop: 4 }]}>Staff Full Name</Text>
                  <TextInput
                    style={styles.textInputFull}
                    placeholder="Full Name (e.g. Bala Murugan)"
                    placeholderTextColor="#94A3B8"
                    value={newUserName}
                    onChangeText={setNewUserName}
                  />

                  {/* Area Dropdown Selector */}
                  <Text style={[styles.inputLabelSmall, { marginTop: 8 }]}>Assigned Delivery Area</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setIsUserAreaDropdownOpen(!isUserAreaDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedRow}>
                      <Ionicons name="location" size={16} color="#0060AF" style={{ marginRight: 8 }} />
                      <Text style={styles.dropdownSelectedText}>
                        {newUserArea === 'all'
                          ? 'All Areas'
                          : (masters?.areas || []).find((a) => a.id === newUserArea)?.name || newUserArea}
                      </Text>
                    </View>
                    <Ionicons
                      name={isUserAreaDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#0060AF"
                    />
                  </TouchableOpacity>

                  {isUserAreaDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      <TouchableOpacity
                        style={[styles.dropdownOption, newUserArea === 'all' && styles.dropdownOptionSelected]}
                        onPress={() => {
                          setNewUserArea('all');
                          setIsUserAreaDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, newUserArea === 'all' && styles.dropdownOptionTextSelected]}>
                          All Areas
                        </Text>
                        {newUserArea === 'all' && <Ionicons name="checkmark" size={16} color="#0060AF" />}
                      </TouchableOpacity>

                      {(masters?.areas || []).map((a) => {
                        const isSelected = newUserArea === a.id;
                        return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                            onPress={() => {
                              setNewUserArea(a.id);
                              setIsUserAreaDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}
                            >
                              {a.name}
                            </Text>
                            {isSelected && <Ionicons name="checkmark" size={16} color="#0060AF" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.addFullBtn, isSavingUser && styles.btnDisabled]}
                    onPress={handleAddUser}
                    disabled={isSavingUser}
                  >
                    {isSavingUser ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CircleLoader size="small" color="#FFFFFF" />
                        <Text style={styles.addFullBtnText}>Adding Staff...</Text>
                      </View>
                    ) : (
                      <>
                        <Ionicons name="person-add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.addFullBtnText}>Add Staff Member</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Staff List */}
                <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
                  Existing Staff Members ({masters?.users?.length || 0})
                </Text>

                {(masters?.users || []).map((u) => {
                  const areaObj = (masters?.areas || []).find((a) => a.id === u.assignedArea);
                  const areaLabel =
                    u.assignedArea === 'all'
                      ? 'All Areas'
                      : areaObj?.name?.split(' - ')[0] || u.assignedArea;

                  return (
                    <View key={u.id} style={styles.cardItem}>
                      <View style={styles.cardItemLeft}>
                        <View style={[styles.avatarMini, { backgroundColor: u.role === 'admin' ? '#FEF3C7' : '#EFF6FF' }]}>
                          <Ionicons
                            name={u.role === 'admin' ? 'shield-checkmark' : 'bicycle'}
                            size={16}
                            color={u.role === 'admin' ? '#D97706' : '#0060AF'}
                          />
                        </View>
                        <View>
                          <Text style={styles.cardItemTitle}>{u.name}</Text>
                         
                        </View>
                      </View>
                      <View style={styles.cardRightWithActions}>
                        <View style={styles.roleBadge}>
                          <Ionicons name="location-outline" size={12} color="#0060AF" style={{ marginRight: 3 }} />
                          <Text style={styles.roleBadgeText}>{areaLabel}</Text>
                        </View>
                        <View style={styles.cardActionRow}>
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => openEditUser(u)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="pencil" size={16} color="#0060AF" />
                          </TouchableOpacity>
                          {u.role !== 'admin' && (
                            <TouchableOpacity
                              style={[styles.actionIconBtn, styles.actionIconBtnDelete]}
                              onPress={() => handleDeleteUser(u.id)}
                              disabled={isDeletingUserId === u.id}
                              activeOpacity={0.7}
                            >
                              {isDeletingUserId === u.id ? (
                                <CircleLoader size="small" color="#DC2626" />
                              ) : (
                                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Live Database Sync Card */}
        {/* <View style={styles.syncCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="cloud-done" size={18} color="#0284C7" />
            <Text style={styles.syncTitle}>PostgreSQL Database Sync</Text>
          </View>
          <Text style={styles.syncSubtitle}>
            Connected to Neon Cloud PostgreSQL Database. All changes are stored persistently in the cloud.
          </Text>
          <TouchableOpacity
            style={[styles.syncBtn, isSyncing && styles.btnDisabled]}
            onPress={handleRefreshDatabase}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CircleLoader size="small" color="#FFFFFF" />
                <Text style={styles.syncBtnText}>Syncing with Cloud...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.syncBtnText}>Refresh Live Data from Cloud</Text>
              </>
            )}
          </TouchableOpacity>
        </View> */}
      </ScrollView>

      {/* Customer Edit / Add Modal */}
      <Modal transparent animationType="slide" visible={customerModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </Text>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} disabled={isSavingCustomer}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false}>
              {custModalError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.modalErrorText}>{custModalError}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabelModal}>Customer Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Kumar, Priya, Ravi"
                placeholderTextColor="#94A3B8"
                value={custName}
                onChangeText={(text) => {
                  setCustName(text);
                  if (custModalError) setCustModalError('');
                }}
              />

              <View style={styles.inputLabelRowSpace}>
                <Text style={styles.inputLabelModal}>Phone Number (WhatsApp) *</Text>
                <Text
                  style={[
                    styles.inputCounterText,
                    custPhone.length === 10 && styles.inputCounterValid,
                  ]}
                >
                  {custPhone.length}/10 digits
                </Text>
              </View>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInputField}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={custPhone}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
                    setCustPhone(cleaned);
                    if (custModalError) setCustModalError('');
                  }}
                />
              </View>

              <Text style={styles.inputLabelModal}>Assigned Area</Text>
              <View style={styles.areaSelectRow}>
                {(masters?.areas || []).map((area) => {
                  const isSelected = custAreaId === area.id;
                  return (
                    <TouchableOpacity
                      key={area.id}
                      style={[styles.areaSelectBtn, isSelected && styles.areaSelectBtnActive]}
                      onPress={() => setCustAreaId(area.id)}
                    >
                      <Text
                        style={[
                          styles.areaSelectText,
                          isSelected && styles.areaSelectTextActive,
                        ]}
                      >
                        {area.shortName || area.name.split(' - ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabelModal}>Default Morning Quantity (Litres)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="1.0"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={custMorningQty}
                onChangeText={setCustMorningQty}
              />

              <Text style={styles.inputLabelModal}>Default Evening Quantity (Litres)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.0"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={custEveningQty}
                onChangeText={setCustEveningQty}
              />

              <Text style={styles.inputLabelModal}>Rate per Litre (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="60"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={custPricePerLiter}
                onChangeText={setCustPricePerLiter}
              />

              <TouchableOpacity
                style={[styles.saveCustomerBtn, isSavingCustomer && styles.btnDisabled]}
                onPress={handleSaveCustomer}
                disabled={isSavingCustomer}
              >
                {isSavingCustomer ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CircleLoader size="small" color="#FFFFFF" />
                    <Text style={styles.saveCustomerBtnText}>Saving Customer...</Text>
                  </View>
                ) : (
                  <Text style={styles.saveCustomerBtnText}>
                    {editingCustomer ? 'Update Customer' : 'Save New Customer'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Area Edit Modal */}
      <Modal transparent animationType="slide" visible={areaModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Delivery Area</Text>
              <TouchableOpacity onPress={() => setAreaModalVisible(false)} disabled={isSavingArea}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabelModal}>Area Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Area 1 - North Colony"
              placeholderTextColor="#94A3B8"
              value={editAreaName}
              onChangeText={setEditAreaName}
            />

            

            <TouchableOpacity
              style={[styles.saveCustomerBtn, isSavingArea && styles.btnDisabled]}
              onPress={handleSaveEditArea}
              disabled={isSavingArea}
            >
              {isSavingArea ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CircleLoader size="small" color="#FFFFFF" />
                  <Text style={styles.saveCustomerBtnText}>Updating Area...</Text>
                </View>
              ) : (
                <Text style={styles.saveCustomerBtnText}>Update Delivery Area</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* User / Staff Edit Modal */}
      <Modal transparent animationType="slide" visible={userModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Delivery Staff</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)} disabled={isSavingUser}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabelModal}>Staff Full Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Bala Murugan"
              placeholderTextColor="#94A3B8"
              value={editUserName}
              onChangeText={setEditUserName}
            />

            <Text style={styles.inputLabelModal}>Assigned Delivery Area</Text>
            <TouchableOpacity
              style={styles.dropdownSelector}
              onPress={() => setIsEditUserAreaDropdownOpen(!isEditUserAreaDropdownOpen)}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownSelectedRow}>
                <Ionicons name="location" size={16} color="#0060AF" style={{ marginRight: 8 }} />
                <Text style={styles.dropdownSelectedText}>
                  {editUserArea === 'all'
                    ? 'All Areas'
                    : (masters?.areas || []).find((a) => a.id === editUserArea)?.name || editUserArea}
                </Text>
              </View>
              <Ionicons
                name={isEditUserAreaDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#0060AF"
              />
            </TouchableOpacity>

            {isEditUserAreaDropdownOpen && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={[styles.dropdownOption, editUserArea === 'all' && styles.dropdownOptionSelected]}
                  onPress={() => {
                    setEditUserArea('all');
                    setIsEditUserAreaDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, editUserArea === 'all' && styles.dropdownOptionTextSelected]}>
                    All Areas
                  </Text>
                  {editUserArea === 'all' && <Ionicons name="checkmark" size={16} color="#0060AF" />}
                </TouchableOpacity>

                {(masters?.areas || []).map((a) => {
                  const isSelected = editUserArea === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                      onPress={() => {
                        setEditUserArea(a.id);
                        setIsEditUserAreaDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                        {a.name}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#0060AF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveCustomerBtn, isSavingUser && styles.btnDisabled]}
              onPress={handleSaveEditUser}
              disabled={isSavingUser}
            >
              {isSavingUser ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CircleLoader size="small" color="#FFFFFF" />
                  <Text style={styles.saveCustomerBtnText}>Updating Staff...</Text>
                </View>
              ) : (
                <Text style={styles.saveCustomerBtnText}>Update Staff Member</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingOverlay
        visible={isSavingCustomer || isSavingArea || isSavingUser}
        message="Saving changes to database..."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36,
  },
  tabLoadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0060AF',
  },
  syncStatusNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0060AF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0060AF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarMini: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarMiniText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0060AF',
  },
  cardItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  cardItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  behaviorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  behaviorBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  behaviorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  rateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconActionBtn: {
    padding: 6,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0060AF',
  },
  rateInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    width: 90,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  saveSmallBtn: {
    backgroundColor: '#0060AF',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  presetChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fixedPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fixedPresetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0060AF',
  },
  shiftList: {
    gap: 8,
  },
  shiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  shiftItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  shiftItemTime: {
    fontSize: 11,
    color: '#64748B',
  },
  textInputFull: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#0F172A',
  },
  addFullBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 10,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addFullBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  areaIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  areaIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0060AF',
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  syncCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  syncSubtitle: {
    fontSize: 11,
    color: '#0284C7',
    marginBottom: 12,
    lineHeight: 16,
  },
  syncBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabelModal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    height: 42,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  areaSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  areaSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  areaSelectBtnActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  areaSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  areaSelectTextActive: {
    color: '#FFFFFF',
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    gap: 6,
  },
  modalErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    flex: 1,
  },
  inputLabelRowSpace: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  inputCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  inputCounterValid: {
    color: '#16A34A',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
    height: 42,
    backgroundColor: '#FFFFFF',
  },
  countryCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1.5,
    borderRightColor: '#CBD5E1',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0060AF',
  },
  phoneInputField: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  saveCustomerBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  saveCustomerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  inputLabelSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 6,
  },
  dropdownSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownSelectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  dropdownOptionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  dropdownOptionTextSelected: {
    color: '#0060AF',
    fontWeight: '800',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionIconBtnDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardRightWithActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
