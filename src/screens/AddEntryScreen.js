import React, { useState, useEffect, useMemo } from 'react';
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
import CalendarModal from '../components/CalendarModal';
import { getTodayIso, formatDisplayDate } from '../utils/dateUtils';
import CircleLoader, { LoadingOverlay } from '../components/CircleLoader';

export default function AddEntryScreen({
  masters,
  currentUser,
  deliveries,
  onSaveEntries,
  onBack,
  onNavigateToSummary,
  onNavigateToMasters,
  onRefresh,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const selectedShift = currentUser?.shift || 'Morning'; // Shift set during Login
  const [searchQuery, setSearchQuery] = useState('');
  
  const isAdmin = currentUser?.role === 'admin';
  const userAssignedArea = currentUser?.assignedArea && currentUser.assignedArea !== 'all' ? currentUser.assignedArea : 'area-1';
  const [selectedAreaFilter, setSelectedAreaFilter] = useState(isAdmin ? (currentUser?.assignedArea || 'all') : userAssignedArea);
  
  const [entriesMap, setEntriesMap] = useState({});
  const [activeModalCustomer, setActiveModalCustomer] = useState(null);
  const [modalCustomQty, setModalCustomQty] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [savedSearchQuery, setSavedSearchQuery] = useState('');

  const baseRate = masters?.milkRatePerLiter || 60;
  const quantityPresets = masters?.quantityPresets || [
    { label: '0.25 L', value: 0.25 },
    { label: '0.50 L', value: 0.5 },
    { label: '1.00 L', value: 1.0 },
    { label: '1.50 L', value: 1.5 },
    { label: '2.00 L', value: 2.0 },
  ];

  const allCustomers = masters?.customers || [];
  const areas = masters?.areas || [];

  const selectedAreaObj = areas.find((a) => a.id === selectedAreaFilter);
  const selectedAreaName =
    selectedAreaFilter === 'all'
      ? 'All Areas'
      : selectedAreaObj?.name?.split(' - ')[0] || selectedAreaFilter.toUpperCase();

  // Customer lookup map for instant access to sequence, phone, etc.
  const customerMap = useMemo(() => {
    const map = new Map();
    allCustomers.forEach((c) => {
      map.set(c.id, c);
    });
    return map;
  }, [allCustomers]);

  // Sort customers strictly by sequence number first, then name
  const sortedCustomers = useMemo(() => {
    return [...allCustomers].sort(
      (a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || '')
    );
  }, [allCustomers]);

  // Filter customers by selected area, search query, and quantity > 0 for the selected shift
  const filteredCustomers = sortedCustomers.filter((c) => {
    const matchesArea = selectedAreaFilter === 'all' || c.areaId === selectedAreaFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    if (!matchesArea || !matchesSearch) return false;

    // Check if customer has a quantity > 0 for this shift (Morning or Evening)
    const isMorning = (selectedShift || '').toLowerCase() === 'morning';
    const defaultShiftQty = isMorning
      ? Number(c.defaultMorningQty ?? 0)
      : Number(c.defaultEveningQty ?? 0);

    // Check if an existing saved delivery with qty > 0 exists for this customer on this date and shift
    const hasPositiveSavedEntry = (deliveries || []).some((d) => {
      const dateMatches = d.date && d.date.slice(0, 10) === selectedDate.slice(0, 10);
      const shiftMatches =
        (d.shift || '').trim().toLowerCase() === (selectedShift || '').trim().toLowerCase();
      return dateMatches && shiftMatches && d.customerId === c.id && Number(d.qty || 0) > 0;
    });

    return defaultShiftQty > 0 || hasPositiveSavedEntry;
  });

  // Map of customer ID to customer Area
  const customerAreaMap = new Map(allCustomers.map((c) => [c.id, c.areaId]));

  // Check if entries are already saved for this DATE, SHIFT, AND AREA (positive quantities only)
  const existingDeliveriesForShiftAndArea = (deliveries || []).filter((d) => {
    const dateMatches = d.date && d.date.slice(0, 10) === selectedDate.slice(0, 10);
    const shiftMatches =
      (d.shift || '').trim().toLowerCase() === (selectedShift || '').trim().toLowerCase();
    if (!dateMatches || !shiftMatches) return false;
    if (Number(d.qty || 0) <= 0) return false;

    const custArea = d.areaId || customerAreaMap.get(d.customerId);
    if (selectedAreaFilter !== 'all') {
      return custArea === selectedAreaFilter;
    }
    return true;
  });

  const hasExistingSavedEntry = existingDeliveriesForShiftAndArea.length > 0;

  // Saved deliveries strictly ordered by sequence number first, then customer name
  const displayedSavedDeliveries = useMemo(() => {
    let list = [...existingDeliveriesForShiftAndArea];

    if (savedSearchQuery.trim()) {
      const q = savedSearchQuery.trim().toLowerCase();
      list = list.filter((del) => {
        const cust = customerMap.get(del.customerId);
        const nameMatch = (del.customerName || cust?.name || '').toLowerCase().includes(q);
        const phoneMatch = cust?.phone ? cust.phone.includes(q) : false;
        return nameMatch || phoneMatch;
      });
    }

    return list.sort((a, b) => {
      const custA = customerMap.get(a.customerId);
      const custB = customerMap.get(b.customerId);
      const seqA = custA?.sequence !== undefined ? Number(custA.sequence) : (Number(a.sequence) || 0);
      const seqB = custB?.sequence !== undefined ? Number(custB.sequence) : (Number(b.sequence) || 0);
      const nameA = (a.customerName || custA?.name || '').trim();
      const nameB = (b.customerName || custB?.name || '').trim();

      return seqA - seqB || nameA.localeCompare(nameB);
    });
  }, [existingDeliveriesForShiftAndArea, savedSearchQuery, customerMap]);

  // Load existing entries or prefill based on customer behavior
  useEffect(() => {
    const newEntries = {};
    const existing = (deliveries || []).filter((d) => {
      const dateMatches = d.date && d.date.slice(0, 10) === selectedDate.slice(0, 10);
      const shiftMatches =
        (d.shift || '').trim().toLowerCase() === (selectedShift || '').trim().toLowerCase();
      return dateMatches && shiftMatches;
    });

    const isMorning = (selectedShift || '').toLowerCase() === 'morning';

    allCustomers.forEach((cust) => {
      const match = existing.find((e) => e.customerId === cust.id);
      if (match && Number(match.qty) > 0) {
        newEntries[cust.id] = {
          qty: Number(match.qty),
          rate: match.rate || cust.pricePerLiter || baseRate,
        };
      } else {
        // Customer default behavior
        const defaultQty = isMorning
          ? Number(cust.defaultMorningQty ?? 0)
          : Number(cust.defaultEveningQty ?? 0);
        newEntries[cust.id] = {
          qty: defaultQty,
          rate: cust.pricePerLiter || baseRate,
        };
      }
    });

    setEntriesMap(newEntries);
    setIsEditingSaved(false);
  }, [selectedDate, selectedShift, selectedAreaFilter, deliveries, masters]);

  // Adjust quantity
  const handleQtyChange = (customerId, newQty) => {
    const validQty = Math.max(0, Number(newQty));
    setEntriesMap((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        qty: Number(validQty.toFixed(2)),
      },
    }));
  };

  const handleStepQty = (customerId, step) => {
    const current = entriesMap[customerId]?.qty || 0;
    const updated = Math.max(0, current + step);
    handleQtyChange(customerId, updated);
  };

  // Quick date shifts
  const changeDateByDays = (days) => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${yyyy}-${mm}-${dd}`);
    } catch (e) {
      console.warn(e);
    }
  };

  // Calculate totals for currently displayed customers in table
  const activeEntries = filteredCustomers.map((c) => {
    const entry = entriesMap[c.id] || { qty: 0, rate: baseRate };
    const qty = entry.qty || 0;
    const amount = Math.round(qty * entry.rate);
    return { customer: c, qty, rate: entry.rate, amount };
  });

  const totalDeliveredCustomers = activeEntries.filter((e) => e.qty > 0).length;
  const totalMilkLitres = activeEntries.reduce((sum, e) => sum + e.qty, 0);
  const totalAmountRupees = activeEntries.reduce((sum, e) => sum + e.amount, 0);

  // Saved deliveries summary metrics
  const savedDeliveredCount = existingDeliveriesForShiftAndArea.filter((d) => Number(d.qty) > 0).length;
  const savedTotalMilk = existingDeliveriesForShiftAndArea.reduce((sum, d) => sum + Number(d.qty || 0), 0);
  const savedTotalAmount = existingDeliveriesForShiftAndArea.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = filteredCustomers.map((cust) => {
        const entry = entriesMap[cust.id] || { qty: 0, rate: baseRate };
        return {
          id: `del-${cust.id}-${selectedDate}-${selectedShift.toLowerCase()}`,
          customerId: cust.id,
          customerName: cust.name,
          date: selectedDate,
          shift: selectedShift,
          qty: entry.qty,
          rate: entry.rate,
          amount: Math.round(entry.qty * entry.rate),
          supplyBoyId: currentUser?.name || currentUser?.id || 'Staff',
          areaId: cust.areaId,
          recordedAt: new Date().toISOString(),
        };
      });

      await onSaveEntries(batch);
      if (onRefresh) {
        await onRefresh();
      }
      setIsEditingSaved(false);
      setSaveSuccessNotice(true);
      setTimeout(() => {
        setSaveSuccessNotice(false);
      }, 3000);
    } catch (e) {
      console.warn('Error saving entries:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToSaved = () => {
    const resetMap = { ...entriesMap };
    const isMorning = (selectedShift || '').toLowerCase() === 'morning';
    allCustomers.forEach((cust) => {
      const match = existingDeliveriesForShiftAndArea.find((e) => e.customerId === cust.id);
      if (match && Number(match.qty) > 0) {
        resetMap[cust.id] = {
          qty: Number(match.qty),
          rate: match.rate || cust.pricePerLiter || baseRate,
        };
      } else {
        const defaultQty = isMorning
          ? Number(cust.defaultMorningQty ?? 0)
          : Number(cust.defaultEveningQty ?? 0);
        resetMap[cust.id] = {
          qty: defaultQty,
          rate: cust.pricePerLiter || baseRate,
        };
      }
    });
    setEntriesMap(resetMap);
    setIsEditingSaved(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Milk Delivery Entry"
        rightBadgeText={`${formatDisplayDate(selectedDate)} • ${selectedShift}`}
        rightBadgeIcon={selectedShift === 'Morning' ? 'sunny' : 'moon'}
        onRightBadgePress={() => setIsCalendarOpen(true)}
        showBack={Boolean(onBack)}
        onBack={onBack}
        subtitle={`Area: ${selectedAreaName} | ${currentUser?.name || 'Staff'}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Date Selector Navigation Bar */}
        <View style={styles.dateNavRow}>
          <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeDateByDays(-1)}>
            <Ionicons name="chevron-back" size={18} color="#0060AF" />
            <Text style={styles.dateNavBtnText}>Prev Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.currentDateBadge}
            onPress={() => setIsCalendarOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar" size={16} color="#0060AF" style={{ marginRight: 6 }} />
            <Text style={styles.currentDateText}>{formatDisplayDate(selectedDate)}</Text>
            <Ionicons name="chevron-down" size={13} color="#0060AF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeDateByDays(1)}>
            <Text style={styles.dateNavBtnText}>Next Day</Text>
            <Ionicons name="chevron-forward" size={18} color="#0060AF" />
          </TouchableOpacity>
        </View>

        {/* Current Active Shift & Area Info Bar */}
        <View style={styles.activeShiftBanner}>
          <View style={styles.activeShiftLeft}>
            <View
              style={[
                styles.shiftIconBadge,
                { backgroundColor: selectedShift === 'Morning' ? '#FEF3C7' : '#E0E7FF' },
              ]}
            >
              <Ionicons
                name={selectedShift === 'Morning' ? 'sunny' : 'moon'}
                size={18}
                color={selectedShift === 'Morning' ? '#D97706' : '#4F46E5'}
              />
            </View>
            <View>
              <Text style={styles.activeShiftTitle}>
                {selectedShift} Shift • {selectedAreaName}
              </Text>
              <Text style={styles.activeShiftSub}>
                {selectedShift === 'Morning' ? 'Morning (5:30 - 9:00 AM)' : 'Evening (4:30 - 8:00 PM)'}
              </Text>
            </View>
          </View>

          <View style={styles.shiftPill}>
            <Text style={styles.shiftPillText}>{selectedShift}</Text>
          </View>
        </View>

        {/* Area Filter Selector Pills (Admin only can view all and switch areas) */}
        {isAdmin && (
          <View style={styles.areaFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaFilterScroll}>
              <TouchableOpacity
                style={[styles.areaPillBtn, selectedAreaFilter === 'all' && styles.areaPillBtnActive]}
                onPress={() => setSelectedAreaFilter('all')}
              >
                <Text style={[styles.areaPillBtnText, selectedAreaFilter === 'all' && styles.areaPillBtnTextActive]}>
                  All Areas
                </Text>
              </TouchableOpacity>
              {areas.map((a) => {
                const isSelected = selectedAreaFilter === a.id;
                const shortName = a.name.split(' - ')[0] || a.name;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.areaPillBtn, isSelected && styles.areaPillBtnActive]}
                    onPress={() => setSelectedAreaFilter(a.id)}
                  >
                    <Text style={[styles.areaPillBtnText, isSelected && styles.areaPillBtnTextActive]}>
                      {shortName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ========================================================================= */}
        {/* CASE A: ENTRIES ARE ALREADY SAVED AND USER IS NOT IN EDIT MODE            */}
        {/* (HIDE TABLE, SHOW SAVED BANNER, STATS, READ-ONLY LIST, AND EDIT BUTTON)    */}
        {/* ========================================================================= */}
        {hasExistingSavedEntry && !isEditingSaved ? (
          <View style={styles.savedOverviewCard}>
            {/* Top Success Badge */}
            <View style={styles.savedBannerTop}>
              <View style={styles.savedBadgeIcon}>
                <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.savedBannerTitle}>Entries Already Saved</Text>
                <Text style={styles.savedBannerSubtitle}>
                  {formatDisplayDate(selectedDate)} • {selectedShift} Shift • {selectedAreaName}
                </Text>
              </View>
            </View>

            {/* Saved Totals Grid */}
            <View style={styles.savedMetricsRow}>
              <View style={styles.savedMetricBox}>
                <Text style={styles.savedMetricLabel}>Customers</Text>
                <Text style={styles.savedMetricValue}>{savedDeliveredCount}</Text>
              </View>
              <View style={styles.savedMetricDivider} />
              <View style={styles.savedMetricBox}>
                <Text style={styles.savedMetricLabel}>Total Milk</Text>
                <Text style={styles.savedMetricValue}>{savedTotalMilk.toFixed(1)} L</Text>
              </View>
              <View style={styles.savedMetricDivider} />
              <View style={styles.savedMetricBox}>
                <Text style={styles.savedMetricLabel}>Total Amount</Text>
                <Text style={[styles.savedMetricValue, { color: '#0060AF' }]}>₹{savedTotalAmount}</Text>
              </View>
            </View>

            {/* Saved Deliveries Read-Only List */}
            <View style={styles.savedListHeader}>
              <Text style={styles.savedListTitle}>Saved Deliveries</Text>
              <Text style={styles.savedListCount}>{existingDeliveriesForShiftAndArea.length} records</Text>
            </View>

            {/* Optional Search Bar for Saved Deliveries */}
            {existingDeliveriesForShiftAndArea.length > 5 && (
              <View style={styles.savedSearchBar}>
                <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.savedSearchInput}
                  placeholder="Search saved customer..."
                  placeholderTextColor="#94A3B8"
                  value={savedSearchQuery}
                  onChangeText={setSavedSearchQuery}
                />
                {savedSearchQuery ? (
                  <TouchableOpacity onPress={() => setSavedSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <View style={styles.savedTable}>
              <View style={styles.savedTableHeader}>
                <Text style={[styles.savedColHead, { width: 34, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.savedColHead, { flex: 1.2 }]}>Customer</Text>
                <Text style={[styles.savedColHead, { width: 70, textAlign: 'center' }]}>Qty (L)</Text>
                <Text style={[styles.savedColHead, { width: 75, textAlign: 'right' }]}>Amount</Text>
              </View>

              {displayedSavedDeliveries.length === 0 ? (
                <View style={styles.emptySavedTable}>
                  <Text style={styles.emptySavedText}>No matching saved entries found</Text>
                </View>
              ) : (
                displayedSavedDeliveries.map((del, idx) => {
                  const cust = customerMap.get(del.customerId);
                  const custSeq = cust?.sequence !== undefined ? Number(cust.sequence) : (Number(del.sequence) || 0);

                  return (
                    <View key={del.id || idx} style={[styles.savedTableRow, idx % 2 === 1 && styles.savedTableRowAlt]}>
                      <Text style={[styles.savedCellText, { width: 34, textAlign: 'center', color: '#64748B', fontWeight: '700' }]}>
                        {idx + 1}
                      </Text>
                      <View style={{ flex: 1.2, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                          <Text style={[styles.savedCellText, { fontWeight: '700' }]}>
                            {del.customerName || cust?.name || 'Customer'}
                          </Text>
                        </View>
                        {cust?.phone ? (
                          <Text style={styles.savedPhoneSubText}>{cust.phone}</Text>
                        ) : null}
                      </View>
                      <View style={{ width: 70, alignItems: 'center' }}>
                        <View style={styles.savedQtyChip}>
                          <Text style={styles.savedQtyChipText}>{del.qty} L</Text>
                        </View>
                      </View>
                      <Text style={[styles.savedCellText, { width: 75, textAlign: 'right', fontWeight: '800', color: '#0060AF' }]}>
                        ₹{del.amount}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Prominent Edit Deliveries Button */}
            <TouchableOpacity
              style={styles.bigEditBtn}
              onPress={() => setIsEditingSaved(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="pencil" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.bigEditBtnText}>Edit Deliveries Table</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ========================================================================= */
          /* CASE B: NEW ENTRY OR EDITING SAVED ENTRY (SHOW FULL EDITABLE TABLE)        */
          /* ========================================================================= */
          <>
            {/* If in edit mode for an already saved entry, show Edit Mode Alert Header */}
            {hasExistingSavedEntry && isEditingSaved && (
              <View style={styles.editingAlertBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="create" size={20} color="#D97706" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editingAlertTitle}>Editing Saved Deliveries</Text>
                    <Text style={styles.editingAlertSub}>
                      Modify customer milk quantities below and tap Update
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.cancelEditBtn} onPress={handleResetToSaved}>
                  <Ionicons name="close" size={14} color="#64748B" style={{ marginRight: 2 }} />
                  <Text style={styles.cancelEditBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search customer by name..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Customer Table */}
            <View style={styles.tableCard}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableColHeader, styles.colIndex]}>#</Text>
                <Text style={[styles.tableColHeader, styles.colName]}>Customer Name</Text>
                <Text style={[styles.tableColHeader, styles.colQty]}>Qty (L)</Text>
                <Text style={[styles.tableColHeader, styles.colAmount]}>Amount</Text>
              </View>

              {/* Table Rows */}
              {filteredCustomers.length === 0 ? (
                <View style={styles.emptyTable}>
                  <Ionicons name="people-outline" size={32} color="#94A3B8" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyText}>No customers found for this area filter</Text>
                  {onNavigateToMasters && currentUser?.role === 'admin' && (
                    <TouchableOpacity
                      style={{
                        marginTop: 8,
                        backgroundColor: '#0060AF',
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      onPress={onNavigateToMasters}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                        Add Customer in Masters
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filteredCustomers.map((cust, idx) => {
                  const entry = entriesMap[cust.id] || { qty: 0, rate: baseRate };
                  const qty = entry.qty || 0;
                  const amount = Math.round(qty * entry.rate);
                  const isZero = qty === 0;

                  return (
                    <View key={cust.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                      <Text style={[styles.tableCell, styles.colIndex]}>{idx + 1}</Text>

                      <View style={[styles.tableCell, styles.colName]}>
                        <Text style={styles.customerNameText}>{cust.name}</Text>
                        {cust.phone ? <Text style={styles.customerSubText}>{cust.phone}</Text> : null}
                      </View>

                      <View style={[styles.tableCell, styles.colQty]}>
                        <TouchableOpacity
                          style={[
                            styles.qtyBadgeBtn,
                            isZero && styles.qtyBadgeBtnZero,
                            hasExistingSavedEntry && styles.qtyBadgeBtnEditing,
                          ]}
                          onPress={() => {
                            setActiveModalCustomer(cust);
                            setModalCustomQty(String(qty));
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.qtyBadgeText, isZero && styles.qtyBadgeTextZero]}>
                            {qty} L
                          </Text>
                          <Ionicons
                            name="pencil"
                            size={11}
                            color={isZero ? '#94A3B8' : '#0060AF'}
                            style={{ marginLeft: 3 }}
                          />
                        </TouchableOpacity>

                        {/* Quick Stepper Buttons */}
                        <View style={styles.stepperRow}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleStepQty(cust.id, -0.25)}
                          >
                            <Text style={styles.stepBtnText}>-</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleStepQty(cust.id, 0.25)}
                          >
                            <Text style={styles.stepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={[styles.tableCell, styles.colAmount, styles.amountText]}>
                        ₹{amount}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Summary Footer Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Total Customers</Text>
                <Text style={styles.summaryValue}>{totalDeliveredCustomers}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Total Milk (L)</Text>
                <Text style={styles.summaryValue}>{totalMilkLitres.toFixed(1)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryValueHighlight}>₹{totalAmountRupees}</Text>
              </View>
            </View>

            {/* Save / Update Entry Button */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                hasExistingSavedEntry && styles.updateBtn,
                isSaving && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              {isSaving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CircleLoader size="small" color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {hasExistingSavedEntry ? 'Updating Milk Entries...' : 'Saving Milk Entries...'}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons
                    name={hasExistingSavedEntry ? 'cloud-upload-outline' : 'save-outline'}
                    size={20}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.saveBtnText}>
                    {hasExistingSavedEntry ? 'Update Saved Entry' : 'Save Entry'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <LoadingOverlay
          visible={isSaving}
          message={hasExistingSavedEntry ? 'Updating milk entries...' : 'Saving milk entries...'}
        />

        {saveSuccessNotice && (
          <View style={styles.toastNotice}>
            <Ionicons name="checkmark-circle" size={20} color="#16A34A" style={{ marginRight: 6 }} />
            <Text style={styles.toastText}>
              Entries for {formatDisplayDate(selectedDate)} ({selectedShift}){' '}
              {hasExistingSavedEntry ? 'updated' : 'saved'} successfully!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Quantity Edit Modal */}
      {activeModalCustomer && (
        <Modal transparent animationType="fade" visible={Boolean(activeModalCustomer)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Milk Quantity</Text>
                <TouchableOpacity onPress={() => setActiveModalCustomer(null)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalCustomerName}>
                {activeModalCustomer.name} • {selectedShift} Shift
              </Text>
              <Text style={styles.modalHelpText}>Choose quick preset or enter exact litres:</Text>

              {/* Quantity Presets */}
              <View style={styles.presetGrid}>
                {quantityPresets.map((preset) => {
                  const isSelected = (entriesMap[activeModalCustomer.id]?.qty || 0) === preset.value;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                      onPress={() => {
                        handleQtyChange(activeModalCustomer.id, preset.value);
                        setActiveModalCustomer(null);
                      }}
                    >
                      <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]}>
                        {preset.label} ({preset.value}L)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Number Input */}
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customNumberInput}
                  keyboardType="decimal-pad"
                  placeholder="Custom Litres (e.g. 0.75)"
                  placeholderTextColor="#94A3B8"
                  value={modalCustomQty}
                  onChangeText={setModalCustomQty}
                />
                <TouchableOpacity
                  style={styles.applyCustomBtn}
                  onPress={() => {
                    const num = parseFloat(modalCustomQty);
                    if (!isNaN(num)) {
                      handleQtyChange(activeModalCustomer.id, num);
                    }
                    setActiveModalCustomer(null);
                  }}
                >
                  <Text style={styles.applyCustomBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.zeroBtn}
                onPress={() => {
                  handleQtyChange(activeModalCustomer.id, 0);
                  setActiveModalCustomer(null);
                }}
              >
                <Text style={styles.zeroBtnText}>Mark as 0 L (No Delivery)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Calendar Date Picker Modal */}
      <CalendarModal
        visible={isCalendarOpen}
        selectedDate={selectedDate}
        onSelectDate={(newDate) => setSelectedDate(newDate)}
        onClose={() => setIsCalendarOpen(false)}
        deliveries={deliveries}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  dateNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0060AF',
  },
  currentDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentDateText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0060AF',
  },
  activeShiftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  activeShiftLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shiftIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  activeShiftTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeShiftSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  shiftPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shiftPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0060AF',
  },
  areaFilterContainer: {
    marginBottom: 12,
  },
  areaFilterScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  areaPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  areaPillBtnActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  areaPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  areaPillBtnTextActive: {
    color: '#FFFFFF',
  },
  savedOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    marginBottom: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  savedBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
  },
  savedBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },
  savedBannerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  savedMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  savedMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  savedMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
  },
  savedMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  savedMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  savedListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  savedListTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  savedListCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  
  savedPhoneSubText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  savedSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  savedSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
  },
  emptySavedTable: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySavedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  savedTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  savedTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  savedColHead: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  savedTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  savedTableRowAlt: {
    backgroundColor: '#FAFDFB',
  },
  savedCellText: {
    fontSize: 12,
    color: '#1E293B',
  },
  savedQtyChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savedQtyChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0060AF',
  },
  bigEditBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  bigEditBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editingAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    marginBottom: 12,
  },
  editingAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  editingAlertSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#78350F',
    marginTop: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  areaFilterChips: {
    flexDirection: 'row',
    gap: 4,
  },
  areaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  areaChipActive: {
    backgroundColor: '#0060AF',
  },
  areaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  areaChipTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E1',
  },
  tableColHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  colIndex: {
    width: 28,
    textAlign: 'center',
  },
  colName: {
    flex: 1.2,
    paddingHorizontal: 6,
  },
  colQty: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colAmount: {
    width: 70,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFDFB',
  },
  tableCell: {
    fontSize: 13,
    color: '#1E293B',
  },
  customerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  customerSubText: {
    fontSize: 10,
    color: '#64748B',
  },
  qtyBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qtyBadgeBtnZero: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0060AF',
  },
  qtyBadgeTextZero: {
    color: '#94A3B8',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
  },
  stepBtn: {
    width: 22,
    height: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#334155',
    lineHeight: 16,
  },
  amountText: {
    fontWeight: '800',
    color: '#0060AF',
    fontSize: 14,
  },
  emptyTable: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  summaryValueHighlight: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0060AF',
  },
  saveBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0.1,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  toastNotice: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
    borderRadius: 12,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
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
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0060AF',
    marginBottom: 4,
  },
  modalHelpText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    flexBasis: '48%',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  presetBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0060AF',
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  customNumberInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  applyCustomBtn: {
    backgroundColor: '#0060AF',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyCustomBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  zeroBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  zeroBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
});
