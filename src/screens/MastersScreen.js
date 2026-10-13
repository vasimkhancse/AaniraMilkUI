import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import CircleLoader, { LoadingOverlay } from '../components/CircleLoader';
import { useBackModal } from '../services/modalBackHandler';

export default function MastersScreen({ masters, onUpdateMasters, onResetDemoData, onBack, onRefresh }) {
  const [activeTab, setActiveTab] = useState('customers'); // customers | rates | areas | users
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [isCustomerFullscreen, setIsCustomerFullscreen] = useState(true);
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
  const [custAreaFilter, setCustAreaFilter] = useState('all');
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAreaId, setCustAreaId] = useState('area-1');
  const [custMorningQty, setCustMorningQty] = useState('1.0');
  const [custEveningQty, setCustEveningQty] = useState('0.5');
  const [custPricePerLiter, setCustPricePerLiter] = useState('60');
  const [custSequence, setCustSequence] = useState('1');
  const [custModalError, setCustModalError] = useState('');

  // Reorder / Sort by Sequence Modal States
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [isReorderFullscreen, setIsReorderFullscreen] = useState(true);
  const [reorderAreaId, setReorderAreaId] = useState(masters?.areas?.[0]?.id || 'area-1');
  const [reorderList, setReorderList] = useState([]);
  const [isSavingReorder, setIsSavingReorder] = useState(false);
  const [draggedCustIndex, setDraggedCustIndex] = useState(null);
  const [dragOverCustIndex, setDragOverCustIndex] = useState(null);

  // Rate master state
  const [baseMilkRate, setBaseMilkRate] = useState(String(masters?.milkRatePerLiter || 60));
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaShort, setNewAreaShort] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserArea, setNewUserArea] = useState(masters?.areas?.[0]?.id || 'area-1');
  const [isUserAreaDropdownOpen, setIsUserAreaDropdownOpen] = useState(false);

  const openAddCustomer = (preselectedAreaId = null) => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    const fallbackArea = masters?.areas?.[0]?.id || 'area-1';
    const targetArea = preselectedAreaId || (custAreaFilter !== 'all' ? custAreaFilter : fallbackArea);
    setCustAreaId(targetArea);
    setCustMorningQty('1.0');
    setCustEveningQty('0.0');
    setCustPricePerLiter(String(masters?.milkRatePerLiter || 60));
    
    // Suggest next sequence number for this area
    const areaCusts = (masters?.customers || []).filter(c => c.areaId === targetArea);
    const maxSeq = areaCusts.reduce((max, c) => Math.max(max, Number(c.sequence) || 0), 0);
    setCustSequence(String(maxSeq + 1));
    
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
    setCustSequence(String(c.sequence || 1));
    setCustModalError('');
    setCustomerModalVisible(true);
  };

  const handleSelectCustArea = (newAreaId) => {
    setCustAreaId(newAreaId);
    if (editingCustomer && editingCustomer.areaId === newAreaId) {
      // Reverted to original area: restore existing sequence
      setCustSequence(String(editingCustomer.sequence || 1));
    } else {
      // Calculate next sequence for the newly selected area
      const areaCusts = (masters?.customers || []).filter(
        (c) => c.areaId === newAreaId && (!editingCustomer || c.id !== editingCustomer.id)
      );
      const maxSeq = areaCusts.reduce((max, c) => Math.max(max, Number(c.sequence) || 0), 0);
      setCustSequence(String(maxSeq + 1));
    }
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

    // Check for duplicate phone number in existing customers
    const duplicatePhoneCustomer = (masters?.customers || []).find(
      (c) =>
        (!editingCustomer || c.id !== editingCustomer.id) &&
        c.phone &&
        c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone
    );

    if (duplicatePhoneCustomer) {
      setCustModalError(`Phone number is already registered to customer "${duplicatePhoneCustomer.name}"`);
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
        sequence: parseInt(custSequence, 10) || 1,
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
      setCustModalError(e.message || 'Failed to save customer to database. Please try again.');
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

  // Reorder Modal Actions
  const openReorderModal = (preselectedAreaId = null) => {
    const areaId = preselectedAreaId || (custAreaFilter !== 'all' ? custAreaFilter : (masters?.areas?.[0]?.id || 'area-1'));
    setReorderAreaId(areaId);
    const areaCusts = (masters?.customers || [])
      .filter((c) => c.areaId === areaId)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));
    setReorderList(areaCusts);
    setDraggedCustIndex(null);
    setDragOverCustIndex(null);
    setReorderModalVisible(true);
  };

  const handleSwitchReorderArea = (newAreaId) => {
    setReorderAreaId(newAreaId);
    const areaCusts = (masters?.customers || [])
      .filter((c) => c.areaId === newAreaId)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));
    setReorderList(areaCusts);
    setDraggedCustIndex(null);
    setDragOverCustIndex(null);
  };

  const moveCustomer = (fromIndex, toIndex) => {
    setReorderList((prevList) => {
      if (toIndex < 0 || toIndex >= prevList.length || fromIndex === toIndex) return prevList;
      const updated = [...prevList];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  const moveToTop = (index) => {
    moveCustomer(index, 0);
  };

  const moveToBottom = (index) => {
    setReorderList((prevList) => {
      if (index === prevList.length - 1) return prevList;
      const updated = [...prevList];
      const [movedItem] = updated.splice(index, 1);
      updated.push(movedItem);
      return updated;
    });
  };

  const sortReorderAlphabetical = () => {
    setReorderList((prevList) => {
      return [...prevList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
  };

  const dragSourceIdxRef = useRef(null);
  const dragOverIdxRef = useRef(null);

  const handleDragStart = useCallback((index) => {
    dragSourceIdxRef.current = index;
    dragOverIdxRef.current = null;
    setDraggedCustIndex(index);
  }, []);

  const handleDragOver = useCallback((index) => {
    if (dragOverIdxRef.current !== index) {
      dragOverIdxRef.current = index;
      setDragOverCustIndex(index);
    }
  }, []);

  const handleDrop = useCallback((sourceIdx, dropIndex) => {
    const fromIdx = !isNaN(sourceIdx) && sourceIdx !== null ? sourceIdx : dragSourceIdxRef.current;
    if (fromIdx !== null && fromIdx !== undefined && !isNaN(fromIdx) && fromIdx !== dropIndex) {
      moveCustomer(fromIdx, dropIndex);
    }
    dragSourceIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDraggedCustIndex(null);
    setDragOverCustIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragSourceIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDraggedCustIndex(null);
    setDragOverCustIndex(null);
  }, []);

  const handleTouchHandleStart = (index, e) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return;
    const touch = e?.nativeEvent?.touches ? e.nativeEvent.touches[0] : (e?.touches ? e.touches[0] : null);
    if (!touch) return;

    dragSourceIdxRef.current = index;
    dragOverIdxRef.current = index;
    setDraggedCustIndex(index);
    setDragOverCustIndex(index);

    const onWindowTouchMove = (moveEvt) => {
      const curTouch = moveEvt.touches ? moveEvt.touches[0] : null;
      if (!curTouch) return;
      if (moveEvt.cancelable) moveEvt.preventDefault();

      const elem = document.elementFromPoint(curTouch.clientX, curTouch.clientY);
      const card = elem?.closest ? elem.closest('[data-reorder-index]') : null;
      if (card) {
        const targetIdx = parseInt(card.getAttribute('data-reorder-index'), 10);
        if (!isNaN(targetIdx) && dragOverIdxRef.current !== targetIdx) {
          dragOverIdxRef.current = targetIdx;
          setDragOverCustIndex(targetIdx);
        }
      }
    };

    const onWindowTouchEnd = () => {
      const fromIdx = dragSourceIdxRef.current;
      const toIdx = dragOverIdxRef.current;
      if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
        moveCustomer(fromIdx, toIdx);
      }
      dragSourceIdxRef.current = null;
      dragOverIdxRef.current = null;
      setDraggedCustIndex(null);
      setDragOverCustIndex(null);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
    };

    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd);
    window.addEventListener('touchcancel', onWindowTouchEnd);
  };

  const handleSaveReorder = async () => {
    setIsSavingReorder(true);
    try {
      const customerIds = reorderList.map((c) => c.id);
      const updatedCustomers = await storageService.reorderCustomers({
        areaId: reorderAreaId,
        customerIds,
      });
      onUpdateMasters({
        ...masters,
        customers: updatedCustomers,
      });
      const areaName = (masters?.areas || []).find(a => a.id === reorderAreaId)?.name || 'area';
      setSyncStatus(`Sequence updated for ${areaName}`);
      setReorderModalVisible(false);
      setTimeout(() => setSyncStatus(''), 2500);
    } catch (err) {
      console.warn('Error saving customer sequence:', err);
    } finally {
      setIsSavingReorder(false);
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

  // Auto-intercept Back button (mobile hardware back and browser back) when any modal is open
  useBackModal(customerModalVisible, () => setCustomerModalVisible(false));
  useBackModal(reorderModalVisible, () => setReorderModalVisible(false));
  useBackModal(areaModalVisible, () => setAreaModalVisible(false));
  useBackModal(userModalVisible, () => setUserModalVisible(false));

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
            {activeTab === 'customers' && (() => {
              const allCusts = masters?.customers || [];
              const allAreas = masters?.areas || [];

              // Filter by search query
              const matchesSearch = (c) => {
                if (!custSearchQuery.trim()) return true;
                const q = custSearchQuery.toLowerCase().trim();
                const nameMatch = (c.name || '').toLowerCase().includes(q);
                const phoneMatch = (c.phone || '').includes(q);
                return nameMatch || phoneMatch;
              };

              // Identify distinct areas to display
              const areasToDisplay =
                custAreaFilter === 'all'
                  ? allAreas
                  : allAreas.filter((a) => a.id === custAreaFilter);

              // Unassigned customers
              const knownAreaIds = new Set(allAreas.map((a) => a.id));
              const unassignedCusts = allCusts.filter(
                (c) => !knownAreaIds.has(c.areaId) && matchesSearch(c)
              );

              const totalFilteredCustomers = allCusts.filter(
                (c) =>
                  (custAreaFilter === 'all' || c.areaId === custAreaFilter) && matchesSearch(c)
              ).length;

              const renderCustomerCard = (c, area) => {
                const isDeleting = isDeletingCustomerId === c.id;
                return (
                  <View key={c.id} style={styles.cardItem}>
                    <View style={styles.cardItemLeft}>
                      <View style={styles.avatarMiniWrap}>
                        <View style={styles.avatarMini}>
                          <Text style={styles.avatarMiniText}>
                            {(c.name || 'C').slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.seqNumberBadge}>
                          <Text style={styles.seqNumberBadgeText}>#{c.sequence || 1}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1, marginLeft: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.cardItemTitle}>{c.name}</Text>
                          
                        </View>
                        <Text style={styles.cardItemSubtitle}>
                          {c.phone || 'No phone'} • {area?.shortName || area?.name?.split(' - ')[0] || c.areaId}
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
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil" size={17} color="#0060AF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleDeleteCustomer(c.id)}
                        disabled={isDeleting}
                        activeOpacity={0.7}
                      >
                        {isDeleting ? (
                          <CircleLoader size="small" color="#DC2626" />
                        ) : (
                          <Ionicons name="trash-outline" size={17} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              };

              return (
                <View>
                  {/* Top Bar with Title and Add / Sort Buttons */}
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.sectionTitle}>Customer Master (Area-wise)</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {allCusts.length > 0 && (
                        <TouchableOpacity
                          style={styles.reorderHeaderBtn}
                          onPress={() => openReorderModal(custAreaFilter !== 'all' ? custAreaFilter : null)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="swap-vertical" size={16} color="#0060AF" />
                          <Text style={styles.reorderHeaderBtnText}>Sort Order</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => openAddCustomer(custAreaFilter !== 'all' ? custAreaFilter : null)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                        <Text style={styles.addBtnText}>Add New</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Customer Search Bar */}
                  <View style={styles.custSearchContainer}>
                    <Ionicons name="search" size={16} color="#64748B" style={styles.custSearchIcon} />
                    <TextInput
                      style={styles.custSearchInput}
                      placeholder="Search by customer name or phone..."
                      placeholderTextColor="#94A3B8"
                      value={custSearchQuery}
                      onChangeText={setCustSearchQuery}
                    />
                    {custSearchQuery ? (
                      <TouchableOpacity onPress={() => setCustSearchQuery('')} style={styles.custSearchClear}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Area Filter Tabs Horizontal Scroll */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.areaFilterBar}
                  >
                    <TouchableOpacity
                      style={[
                        styles.areaFilterChip,
                        custAreaFilter === 'all' && styles.areaFilterChipActive,
                      ]}
                      onPress={() => setCustAreaFilter('all')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.areaFilterChipText,
                          custAreaFilter === 'all' && styles.areaFilterChipTextActive,
                        ]}
                      >
                        All Areas ({allCusts.length})
                      </Text>
                    </TouchableOpacity>

                    {allAreas.map((area) => {
                      const count = allCusts.filter((c) => c.areaId === area.id).length;
                      const isActive = custAreaFilter === area.id;
                      return (
                        <TouchableOpacity
                          key={area.id}
                          style={[styles.areaFilterChip, isActive && styles.areaFilterChipActive]}
                          onPress={() => setCustAreaFilter(area.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="location"
                            size={12}
                            color={isActive ? '#FFFFFF' : '#0060AF'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.areaFilterChipText,
                              isActive && styles.areaFilterChipTextActive,
                            ]}
                          >
                            {area.shortName || area.name.split(' - ')[0]} ({count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {allCusts.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons
                        name="people-outline"
                        size={40}
                        color="#94A3B8"
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={styles.emptyCardTitle}>No customers added yet</Text>
                      <Text style={styles.emptyCardSub}>
                        Add your first customer by tapping the "+ Add New" button above.
                      </Text>
                      <TouchableOpacity
                        style={styles.addBtnLarge}
                        onPress={() => openAddCustomer()}
                      >
                        <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.addBtnText}>Add Customer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : totalFilteredCustomers === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons
                        name="search-outline"
                        size={36}
                        color="#94A3B8"
                        style={{ marginBottom: 6 }}
                      />
                      <Text style={styles.emptyCardTitle}>No matching customers found</Text>
                      <Text style={styles.emptyCardSub}>
                        No customers match "{custSearchQuery}" in {custAreaFilter === 'all' ? 'any area' : 'this area'}.
                      </Text>
                      <TouchableOpacity
                        style={[styles.addBtnLarge, { backgroundColor: '#E2E8F0' }]}
                        onPress={() => {
                          setCustSearchQuery('');
                          setCustAreaFilter('all');
                        }}
                      >
                        <Text style={[styles.addBtnText, { color: '#334155' }]}>Clear Search & Filters</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {/* Area Grouped Sections */}
                      {areasToDisplay.map((area) => {
                        const areaCustomers = allCusts
                          .filter((c) => c.areaId === area.id && matchesSearch(c))
                          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));

                        if (areaCustomers.length === 0 && custSearchQuery) {
                          // Skip empty areas when searching
                          return null;
                        }

                        const totalM = areaCustomers.reduce(
                          (sum, c) => sum + (Number(c.defaultMorningQty) || 0),
                          0
                        );
                        const totalE = areaCustomers.reduce(
                          (sum, c) => sum + (Number(c.defaultEveningQty) || 0),
                          0
                        );

                        return (
                          <View key={area.id} style={styles.areaGroupContainer}>
                            {/* Area Header */}
                            <View style={styles.areaGroupHeader}>
                              <View style={styles.areaGroupHeaderLeft}>
                                <View style={styles.areaGroupPinBubble}>
                                  <Ionicons name="location" size={16} color="#0060AF" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={styles.areaGroupTitleRow}>
                                    <Text style={styles.areaGroupTitle}>{area.name}</Text>
                                    <View style={styles.areaGroupCountBadge}>
                                      <Text style={styles.areaGroupCountText}>
                                        {areaCustomers.length} {areaCustomers.length === 1 ? 'Customer' : 'Customers'}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={styles.areaGroupDemandSummary}>
                                    ☀️ Morning: {totalM.toFixed(1)}L  •  🌙 Evening: {totalE.toFixed(1)}L
                                  </Text>
                                </View>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {areaCustomers.length > 1 && (
                                  <TouchableOpacity
                                    style={styles.areaGroupSortBtn}
                                    onPress={() => openReorderModal(area.id)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="swap-vertical" size={13} color="#0060AF" />
                                    <Text style={styles.areaGroupSortBtnText}>Sort Order</Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                  style={styles.areaGroupAddBtn}
                                  onPress={() => openAddCustomer(area.id)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="add" size={14} color="#0060AF" />
                                  <Text style={styles.areaGroupAddBtnText}>Add</Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Customer Cards in Area */}
                            {areaCustomers.length === 0 ? (
                              <View style={styles.areaEmptyBox}>
                                <Text style={styles.areaEmptyText}>No customers in {area.name} yet</Text>
                                <TouchableOpacity
                                  style={styles.areaEmptyAddBtn}
                                  onPress={() => openAddCustomer(area.id)}
                                >
                                  <Ionicons
                                    name="add-circle-outline"
                                    size={15}
                                    color="#0060AF"
                                    style={{ marginRight: 4 }}
                                  />
                                  <Text style={styles.areaEmptyAddBtnText}>
                                    Add Customer to {area.shortName || area.name.split(' - ')[0]}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.areaCustomerCardsWrap}>
                                {areaCustomers.map((c) => renderCustomerCard(c, area))}
                              </View>
                            )}
                          </View>
                        );
                      })}

                      {/* Unassigned / Other Customers */}
                      {(custAreaFilter === 'all' || custAreaFilter === 'unassigned') &&
                        unassignedCusts.length > 0 && (
                          <View style={styles.areaGroupContainer}>
                            <View style={[styles.areaGroupHeader, { borderColor: '#FDE68A' }]}>
                              <View style={styles.areaGroupHeaderLeft}>
                                <View style={[styles.areaGroupPinBubble, { backgroundColor: '#FEF3C7' }]}>
                                  <Ionicons name="help-circle" size={16} color="#D97706" />
                                </View>
                                <View>
                                  <Text style={styles.areaGroupTitle}>Unassigned Area Customers</Text>
                                  <Text style={styles.areaGroupDemandSummary}>
                                    {unassignedCusts.length} customers with unassigned area ID
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.areaCustomerCardsWrap}>
                              {unassignedCusts.map((c) =>
                                renderCustomerCard(c, { name: 'Unassigned Area', shortName: 'Other' })
                              )}
                            </View>
                          </View>
                        )}
                    </>
                  )}
                </View>
              );
            })()}

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
      <Modal
        transparent={!isCustomerFullscreen}
        animationType="slide"
        visible={customerModalVisible}
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={[styles.modalOverlay, isCustomerFullscreen && styles.customerModalOverlayFullscreen]}>
          <View style={[styles.modalCard, styles.customerModalCard, isCustomerFullscreen && styles.customerModalCardFullscreen]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                <View style={styles.custHeaderIconBadge}>
                  <Ionicons name="person" size={18} color="#0060AF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                  </Text>
                  <Text style={styles.custModalSubtitle}>
                    {editingCustomer
                      ? `Editing sequence #${custSequence || ''} • ${custName || editingCustomer.name}`
                      : `Delivery sequence #${custSequence || 'Auto'} in selected area`}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setIsCustomerFullscreen(!isCustomerFullscreen)}
                  style={styles.reorderHeaderIconBtn}
                  title={isCustomerFullscreen ? 'Restore window view' : 'Expand to full screen'}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isCustomerFullscreen ? 'contract-outline' : 'expand-outline'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCustomerModalVisible(false)}
                  disabled={isSavingCustomer}
                  style={styles.reorderHeaderIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              bounces={false}
              style={{ flex: 1 }}
              contentContainerStyle={isCustomerFullscreen ? styles.customerScrollFullscreen : null}
            >
              {custModalError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.modalErrorText}>{custModalError}</Text>
                </View>
              ) : null}

              {/* Section 1: Customer Profile & Phone */}
              <View style={null}>

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
              </View>

              {/* Section 2: Area & Route */}
              <View style={null}>

                <Text style={styles.inputLabelModal}>Assigned Area</Text>
                <View style={styles.areaSelectRow}>
                  {(masters?.areas || []).map((area) => {
                    const isSelected = custAreaId === area.id;
                    return (
                      <TouchableOpacity
                        key={area.id}
                        style={[styles.areaSelectBtn, isSelected && styles.areaSelectBtnActive]}
                        onPress={() => handleSelectCustArea(area.id)}
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
              </View>

              {/* Section 3: Milk Quotas & Rates */}
              <View style={ null}>
             

                <View style={isCustomerFullscreen ? styles.custFormRow2Col : null}>
                  <View style={isCustomerFullscreen ? styles.custFormCol : null}>
                    <Text style={styles.inputLabelModal}>Default Morning Qty (L)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="1.0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={custMorningQty}
                      onChangeText={setCustMorningQty}
                    />
                  </View>

                  <View style={isCustomerFullscreen ? styles.custFormCol : null}>
                    <Text style={styles.inputLabelModal}>Default Evening Qty (L)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0.0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={custEveningQty}
                      onChangeText={setCustEveningQty}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabelModal}>Rate per Litre (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="60"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={custPricePerLiter}
                  onChangeText={setCustPricePerLiter}
                />
              </View>

              <View style={styles.custActionsRow}>
                <TouchableOpacity
                  style={styles.custCancelBtn}
                  onPress={() => setCustomerModalVisible(false)}
                  disabled={isSavingCustomer}
                >
                  <Text style={styles.custCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveCustomerBtn, { flex: 2, marginTop: 0 }, isSavingCustomer && styles.btnDisabled]}
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
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer Drag & Drop / Reorder Sequence Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={reorderModalVisible}
        onRequestClose={() => setReorderModalVisible(false)}
      >
        <View style={[styles.modalOverlay, styles.reorderModalOverlay]}>
          <View style={[styles.modalCard, styles.reorderModalCard, isReorderFullscreen && styles.reorderModalCardFullscreen]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                <View style={styles.reorderHeaderIconBadge}>
                  <Ionicons name="swap-vertical" size={18} color="#0060AF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Sort Customer Sequence</Text>
                  <Text style={styles.reorderModalSubtitle}>
                    Drag & drop or use arrows to set delivery order
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setIsReorderFullscreen(!isReorderFullscreen)}
                  style={styles.reorderHeaderIconBtn}
                  title={isReorderFullscreen ? "Restore smaller view" : "Expand to full view"}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isReorderFullscreen ? "contract-outline" : "expand-outline"}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setReorderModalVisible(false)}
                  disabled={isSavingReorder}
                  style={styles.reorderHeaderIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Area Filter Selector Pills inside Modal */}
            <View style={styles.reorderAreaTabsWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reorderAreaTabsBar}>
                {(masters?.areas || []).map((area) => {
                  const isSelected = reorderAreaId === area.id;
                  const count = (masters?.customers || []).filter(c => c.areaId === area.id).length;
                  return (
                    <TouchableOpacity
                      key={area.id}
                      style={[styles.reorderAreaTab, isSelected && styles.reorderAreaTabActive]}
                      onPress={() => handleSwitchReorderArea(area.id)}
                    >
                      <Ionicons
                        name="location"
                        size={12}
                        color={isSelected ? '#FFFFFF' : '#0060AF'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.reorderAreaTabText, isSelected && styles.reorderAreaTabTextActive]}>
                        {area.shortName || area.name.split(' - ')[0]} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Modal Quick Actions Bar */}
            <View style={styles.reorderQuickBar}>
              <Text style={styles.reorderCountText}>
                {reorderList.length} customer{reorderList.length === 1 ? '' : 's'} in this route
              </Text>
              {reorderList.length > 1 && (
                <TouchableOpacity
                  style={styles.reorderQuickActionBtn}
                  onPress={sortReorderAlphabetical}
                >
                  <Ionicons name="text-outline" size={13} color="#0060AF" style={{ marginRight: 4 }} />
                  <Text style={styles.reorderQuickActionText}>Sort A-Z</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Customer Reorder List */}
            <ScrollView style={styles.reorderScrollContainer} bounces={false}>
              {reorderList.length === 0 ? (
                <View style={styles.reorderEmptyBox}>
                  <Ionicons name="people-outline" size={36} color="#94A3B8" style={{ marginBottom: 6 }} />
                  <Text style={styles.reorderEmptyTitle}>No customers in this area</Text>
                  <Text style={styles.reorderEmptySub}>
                    Select another area from the tabs above or add customers to this area.
                  </Text>
                </View>
              ) : (
                reorderList.map((cust, idx) => (
                  <ReorderCustomerItem
                    key={cust.id}
                    cust={cust}
                    idx={idx}
                    total={reorderList.length}
                    isDragging={draggedCustIndex === idx}
                    isOver={dragOverCustIndex === idx}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onMoveCustomer={moveCustomer}
                    onMoveToTop={moveToTop}
                    onMoveToBottom={moveToBottom}
                    onTouchHandleStart={handleTouchHandleStart}
                  />
                ))
              )}
            </ScrollView>

            {/* Save Reorder Button */}
            {reorderList.length > 0 && (
              <View style={styles.reorderFooter}>
                <TouchableOpacity
                  style={[styles.reorderSaveBtn, isSavingReorder && styles.btnDisabled]}
                  onPress={handleSaveReorder}
                  disabled={isSavingReorder}
                  activeOpacity={0.85}
                >
                  {isSavingReorder ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <CircleLoader size="small" color="#FFFFFF" />
                      <Text style={styles.reorderSaveBtnText}>Updating Sequence...</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.reorderSaveBtnText}>Save Sequence Order</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Area Edit Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={areaModalVisible}
        onRequestClose={() => setAreaModalVisible(false)}
      >
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
      <Modal
        transparent
        animationType="slide"
        visible={userModalVisible}
        onRequestClose={() => setUserModalVisible(false)}
      >
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

// Component for each draggable & reorderable customer row
function ReorderCustomerItem({
  cust,
  idx,
  total,
  isDragging,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveCustomer,
  onTouchHandleStart,
}) {
  const itemRef = useRef(null);
  const isFirst = idx === 0;
  const isLast = idx === total - 1;

  // Mutable ref so PanResponder always has access to the latest index and callbacks on mobile
  const propsRef = useRef({ idx, total, onDragStart, onDragOver, onMoveCustomer, onDragEnd });
  propsRef.current = { idx, total, onDragStart, onDragOver, onMoveCustomer, onDragEnd };

  // Native mobile PanResponder: works on Android and iOS (and web touch)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 3,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 3,
        onPanResponderGrant: () => {
          propsRef.current.onDragStart(propsRef.current.idx);
        },
        onPanResponderMove: (_, gestureState) => {
          const { onDragOver: over, idx: currentIdx, total: totalCount } = propsRef.current;
          const approxItemHeight = 62;
          const offsetSlots = Math.round(gestureState.dy / approxItemHeight);
          const targetIdx = Math.max(0, Math.min(totalCount - 1, currentIdx + offsetSlots));
          over(targetIdx);
        },
        onPanResponderRelease: (_, gestureState) => {
          const { onMoveCustomer: move, onDragEnd: end, idx: currentIdx, total: totalCount } = propsRef.current;
          const approxItemHeight = 62;
          const offsetSlots = Math.round(gestureState.dy / approxItemHeight);
          const targetIdx = Math.max(0, Math.min(totalCount - 1, currentIdx + offsetSlots));
          if (targetIdx !== currentIdx) {
            move(currentIdx, targetIdx);
          }
          end();
        },
        onPanResponderTerminate: () => {
          propsRef.current.onDragEnd();
        },
      }),
    []
  );

  // HTML5 drag and drop for desktop Web browsers
  useEffect(() => {
    if (Platform.OS !== 'web' || !itemRef.current) return;
    const el = itemRef.current;

    el.setAttribute('draggable', 'true');
    el.setAttribute('data-reorder-index', String(idx));

    const handleDomDragStart = (e) => {
      if (e.target && e.target.closest && e.target.closest('button, [role="button"]')) {
        e.preventDefault();
        return;
      }
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      }
      onDragStart(idx);
    };

    const handleDomDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      onDragOver(idx);
    };

    const handleDomDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      let sourceIdx = parseInt(e.dataTransfer?.getData('text/plain'), 10);
      onDrop(sourceIdx, idx);
    };

    const handleDomDragEnd = () => {
      onDragEnd();
    };

    el.addEventListener('dragstart', handleDomDragStart);
    el.addEventListener('dragover', handleDomDragOver);
    el.addEventListener('drop', handleDomDrop);
    el.addEventListener('dragend', handleDomDragEnd);

    return () => {
      el.removeEventListener('dragstart', handleDomDragStart);
      el.removeEventListener('dragover', handleDomDragOver);
      el.removeEventListener('drop', handleDomDrop);
      el.removeEventListener('dragend', handleDomDragEnd);
    };
  }, [idx, onDragStart, onDragOver, onDrop, onDragEnd]);

  return (
    <View
      ref={itemRef}
      style={[
        styles.reorderItemCard,
        isDragging && styles.reorderItemDragging,
        isOver && styles.reorderItemDragOver,
      ]}
    >
      {/* Sequence Badge */}
      <View style={styles.reorderSeqBubble}>
        <Text style={styles.reorderSeqBubbleText}>{idx + 1}</Text>
      </View>

      {/* Customer Info */}
      <View style={styles.reorderItemInfo}>
        <Text style={styles.reorderItemName}>{cust.name}</Text>
        <Text style={styles.reorderItemSub}>
          {cust.phone || 'No phone'} • ☀️ {cust.defaultMorningQty ?? 1}L | 🌙 {cust.defaultEveningQty ?? 0}L
        </Text>
      </View>

      {/* Move Actions: Up, Down, Drag Handle */}
      <View style={styles.reorderBtnGroup}>
        <TouchableOpacity
          style={[styles.reorderStepBtn, isFirst && styles.reorderStepBtnDisabled]}
          onPress={() => onMoveCustomer(idx, idx - 1)}
          disabled={isFirst}
          activeOpacity={0.7}
          title="Move up"
        >
          <Ionicons name="arrow-up" size={14} color={isFirst ? '#CBD5E1' : '#0060AF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reorderStepBtn, isLast && styles.reorderStepBtnDisabled]}
          onPress={() => onMoveCustomer(idx, idx + 1)}
          disabled={isLast}
          activeOpacity={0.7}
          title="Move down"
        >
          <Ionicons name="arrow-down" size={14} color={isLast ? '#CBD5E1' : '#0060AF'} />
        </TouchableOpacity>

        {/* Drag Handle: PanResponder enabled for Mobile + HTML5 touch */}
        <View
          style={styles.reorderDragHandle}
          {...panResponder.panHandlers}
          onTouchStart={(e) => onTouchHandleStart(idx, e)}
          title="Drag up or down to reorder"
        >
          <Ionicons name="reorder-three" size={22} color="#0060AF" />
        </View>
      </View>
    </View>
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
  custSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  custSearchIcon: {
    marginRight: 8,
  },
  custSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    height: '100%',
  },
  custSearchClear: {
    padding: 4,
  },
  areaFilterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
    marginBottom: 8,
  },
  areaFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  areaFilterChipActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  areaFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  areaFilterChipTextActive: {
    color: '#FFFFFF',
  },
  areaGroupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  areaGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  areaGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  areaGroupPinBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  areaGroupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  areaGroupCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  areaGroupCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0060AF',
  },
  areaGroupDemandSummary: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  areaGroupAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    marginLeft: 8,
  },
  areaGroupAddBtnText: {
    color: '#0060AF',
    fontSize: 12,
    fontWeight: '700',
  },
  areaCustomerCardsWrap: {
    padding: 10,
  },
  areaEmptyBox: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 8,
  },
  areaEmptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  areaEmptyAddBtnText: {
    fontSize: 12,
    color: '#0060AF',
    fontWeight: '700',
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
  avatarMiniWrap: {
    position: 'relative',
  },
  seqNumberBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0060AF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  seqNumberBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  seqInlinePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  seqInlinePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0060AF',
  },
  reorderHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0060AF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reorderHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0060AF',
  },
  areaGroupSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  areaGroupSortBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0060AF',
  },
  reorderModalCard: {
    maxHeight: '90%',
    width: '94%',
    maxWidth: 560,
    paddingBottom: 14,
  },
  reorderHeaderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  reorderAreaTabsWrap: {
    marginVertical: 10,
  },
  reorderAreaTabsBar: {
    flexDirection: 'row',
    gap: 6,
  },
  reorderAreaTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reorderAreaTabActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  reorderAreaTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  reorderAreaTabTextActive: {
    color: '#FFFFFF',
  },
  reorderQuickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  reorderCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  reorderQuickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reorderQuickActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0060AF',
  },
  reorderScrollContainer: {
    flex: 1,
    minHeight: 240,
  },
  reorderModalOverlay: {
    padding: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  reorderModalCard: {
    width: '96%',
    maxWidth: 960,
    height: '94%',
    maxHeight: '96%',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  customerModalOverlayFullscreen: {
    padding: 0,
    backgroundColor: '#FFFFFF',
  },
  customerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '95%',
    maxWidth: 520,
    maxHeight: '92%',
  },
  customerModalCardFullscreen: {
    width: '100%',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    padding: 16,
    flex: 1,
    backgroundColor: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
  },
  customerScrollFullscreen: {
    paddingBottom: 40,
  },
  custHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  custModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  custFormSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  custSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  custSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0060AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  custFormRow2Col: {
    flexDirection: 'row',
    gap: 12,
  },
  custFormCol: {
    flex: 1,
  },
  custActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  custCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  custCancelBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  reorderModalCardFullscreen: {
    width: '100%',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    padding: 16,
  },
  reorderHeaderIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    cursor: 'grab',
    userSelect: 'none',
  },
  reorderItemDragging: {
    opacity: 0.4,
    borderColor: '#0060AF',
    backgroundColor: '#F0F9FF',
    cursor: 'grabbing',
  },
  reorderItemDragOver: {
    borderColor: '#0284C7',
    borderWidth: 2,
    backgroundColor: '#E0F2FE',
    transform: [{ scale: 1.02 }],
  },
  reorderSeqBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0060AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reorderSeqBubbleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  reorderItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  reorderItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  reorderItemSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  reorderBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reorderStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderStepBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.4,
  },
  reorderDragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'grab',
    touchAction: 'none',
  },
  reorderTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  reorderTipText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
    flex: 1,
  },
  reorderFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reorderSaveBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  reorderEmptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  reorderEmptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
});
