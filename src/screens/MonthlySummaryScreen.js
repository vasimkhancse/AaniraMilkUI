import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { storageService } from '../services/storageService';
import CircleLoader from '../components/CircleLoader';
import {
  getCurrentYearMonth,
  formatYearMonth,
  getAvailableMonths,
} from '../utils/dateUtils';

export default function MonthlySummaryScreen({
  onSelectCustomerBill,
  onBack,
  deliveries,
  masters,
  currentUser,
}) {
  const [selectedYearMonth, setSelectedYearMonth] = useState(getCurrentYearMonth());
  
  const isAdmin = currentUser?.role === 'admin';
  const userAssignedArea = currentUser?.assignedArea && currentUser.assignedArea !== 'all' ? currentUser.assignedArea : 'area-1';
  const [selectedAreaFilter, setSelectedAreaFilter] = useState(isAdmin ? (currentUser?.assignedArea || 'all') : userAssignedArea);
  
  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState({
    totalCustomers: 0,
    totalMilk: 0,
    totalAmount: 0,
    customerSummaries: [],
  });
  const [searchQuery, setSearchQuery] = useState('');

  const areas = masters?.areas || [];
  const months = getAvailableMonths(deliveries, selectedYearMonth);
  const currentMonthLabel = formatYearMonth(selectedYearMonth);

  const selectedAreaObj = areas.find((a) => a.id === selectedAreaFilter);
  const areaDisplayLabel =
    selectedAreaFilter === 'all' ? 'All Areas' : selectedAreaObj?.name?.split(' - ')[0] || selectedAreaFilter.toUpperCase();

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const res = await storageService.getMonthlySummary(selectedYearMonth, selectedAreaFilter);
      if (res) {
        setSummaryData(res);
      }
    } catch (e) {
      console.warn('Error loading monthly summary:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedYearMonth, selectedAreaFilter, deliveries, masters]);

  const filteredCustomerSummaries = summaryData.customerSummaries.filter((c) => {
    const matchesSearch =
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    const matchesArea = selectedAreaFilter === 'all' || c.areaId === selectedAreaFilter;
    return matchesSearch && matchesArea;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Monthly Summary"
        rightBadgeText={currentMonthLabel}
        rightBadgeIcon="calendar-outline"
        showBack={Boolean(onBack)}
        onBack={onBack}
        subtitle={`Area: ${areaDisplayLabel}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Month Selector Carousel / Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthPillsContainer}
        >
          {months.map((m) => {
            const isSelected = m.value === selectedYearMonth;
            return (
              <TouchableOpacity
                key={m.value}
                style={[styles.monthPill, isSelected && styles.monthPillActive]}
                onPress={() => setSelectedYearMonth(m.value)}
              >
                <Text style={[styles.monthPillText, isSelected && styles.monthPillTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Area Filter Pills (Admin only can view all and switch areas) */}
        {isAdmin && (
          <View style={styles.areaFilterSection}>
            <View style={styles.areaFilterHeader}>
              <Ionicons name="location" size={14} color="#0060AF" style={{ marginRight: 4 }} />
              <Text style={styles.areaFilterLabel}>Select Area:</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.areaPillsContainer}
            >
              <TouchableOpacity
                style={[
                  styles.areaPill,
                  selectedAreaFilter === 'all' && styles.areaPillActive,
                ]}
                onPress={() => setSelectedAreaFilter('all')}
              >
                <Text
                  style={[
                    styles.areaPillText,
                    selectedAreaFilter === 'all' && styles.areaPillTextActive,
                  ]}
                >
                  All Areas
                </Text>
              </TouchableOpacity>

              {areas.map((area) => {
                const isSelected = area.id === selectedAreaFilter;
                const shortName = area.name.split(' - ')[0] || area.name;
                return (
                  <TouchableOpacity
                    key={area.id}
                    style={[styles.areaPill, isSelected && styles.areaPillActive]}
                    onPress={() => setSelectedAreaFilter(area.id)}
                  >
                    <Text
                      style={[
                        styles.areaPillText,
                        isSelected && styles.areaPillTextActive,
                      ]}
                    >
                      {shortName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <CircleLoader
              size="large"
              color="#0060AF"
              text={`Fetching summary for ${currentMonthLabel}...`}
              textColor="#0060AF"
            />
          </View>
        ) : (
          <>
            {/* Top 2 Stat Cards Row */}
            <View style={styles.statsRow}>
              {/* Total Customers */}
              <View style={styles.statCard}>
                <View style={styles.statIconCircleBlue}>
                  <Ionicons name="people" size={20} color="#0060AF" />
                </View>
                <Text style={styles.statLabel}>Total Customers</Text>
                <Text style={styles.statValue}>{summaryData.totalCustomers}</Text>
              </View>

              {/* Total Milk (L) */}
              <View style={styles.statCard}>
                <View style={styles.statIconCircleBlue}>
                  <Ionicons name="water" size={20} color="#0060AF" />
                </View>
                <Text style={styles.statLabel}>Total Milk (L)</Text>
                <Text style={styles.statValue}>{summaryData.totalMilk.toFixed(1)}</Text>
              </View>
            </View>

            {/* Hero Total Amount Card */}
            <View style={styles.heroAmountCard}>
              <View style={styles.rupeeIconBadge}>
                <Text style={styles.rupeeSymbol}>₹</Text>
              </View>
              <View style={styles.heroAmountTextContainer}>
                <Text style={styles.heroAmountLabel}>Total Amount</Text>
                <Text style={styles.heroAmountValue}>
                  ₹ {summaryData.totalAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Customer Wise Summary Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Customer Wise Summary</Text>
              <Text style={styles.sectionSubtitle}>
                {filteredCustomerSummaries.length} customers
              </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search customer..."
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

            {/* Customer Summary Table */}
            <View style={styles.tableCard}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableColHeader, styles.colIndex]}>#</Text>
                <Text style={[styles.tableColHeader, styles.colName]}>Customer Name</Text>
                <Text style={[styles.tableColHeader, styles.colMilk]}>Total Milk (L)</Text>
                <Text style={[styles.tableColHeader, styles.colAmount]}>Amount</Text>
              </View>

              {/* Table Rows */}
              {filteredCustomerSummaries.length === 0 ? (
                <View style={styles.emptyTable}>
                  <Text style={styles.emptyText}>No delivery records found for this month</Text>
                </View>
              ) : (
                filteredCustomerSummaries.map((c, idx) => (
                  <TouchableOpacity
                    key={c.customerId}
                    style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                    onPress={() => onSelectCustomerBill(c.customerId, selectedYearMonth)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tableCell, styles.colIndex]}>{idx + 1}</Text>
                    <View style={[styles.tableCell, styles.colName]}>
                      <Text style={styles.customerNameText}>{c.customerName}</Text>
                      <Text style={styles.customerSubText}>Tap to view bill ➔</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.colMilk, styles.milkValueText]}>
                      {c.totalMilk.toFixed(1)}
                    </Text>
                    <Text style={[styles.tableCell, styles.colAmount, styles.amountValueText]}>
                      ₹{c.totalAmount.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  monthPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  monthPillActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  monthPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  monthPillTextActive: {
    color: '#FFFFFF',
  },
  areaFilterSection: {
    marginBottom: 14,
  },
  areaFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  areaFilterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  areaPillsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  areaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  areaPillActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  areaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  areaPillTextActive: {
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconCircleBlue: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0060AF',
  },
  heroAmountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  rupeeIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0060AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rupeeSymbol: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  heroAmountTextContainer: {
    flex: 1,
  },
  heroAmountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  heroAmountValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0060AF',
    letterSpacing: -0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
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
  colMilk: {
    width: 95,
    textAlign: 'center',
  },
  colAmount: {
    width: 85,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    color: '#0060AF',
    fontWeight: '600',
  },
  milkValueText: {
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  amountValueText: {
    fontWeight: '800',
    color: '#0060AF',
    fontSize: 14,
    textAlign: 'right',
  },
  emptyTable: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
