import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import CircleLoader from '../components/CircleLoader';
import {
  buildMonthlyMatrixData,
  downloadLandscapePdf,
  shareSummaryViaWhatsApp,
  printLandscapeReport,
  generateWhatsAppSummaryText,
} from '../services/pdfReportService';
import {
  getCurrentYearMonth,
  formatYearMonth,
  getAvailableMonths,
} from '../utils/dateUtils';
import { formatMilkQty } from '../utils/formatUtils';
import { useBackModal } from '../services/modalBackHandler';

export default function MonthlyAreaPdfScreen({
  month = getCurrentYearMonth(),
  initialAreaId = 'all',
  masters = {},
  deliveries = [],
  onBack,
}) {
  const [selectedMonth, setSelectedMonth] = useState(month || getCurrentYearMonth());
  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomerListExpanded, setIsCustomerListExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'customers'

  // Modals for Feedback
  const [statusModal, setStatusModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success', // 'success' | 'error' | 'info'
  });

  useBackModal(statusModal.visible, () => setStatusModal({ ...statusModal, visible: false }));

  const months = getAvailableMonths(deliveries, selectedMonth);
  const areas = masters?.areas || [];
  const allCustomers = masters?.customers || [];

  // Filter customers based on area
  const visibleAreaCustomers = useMemo(() => {
    return allCustomers.filter(c => {
      if (c.active === false) return false;
      if (selectedAreaId === 'all') return true;
      return c.areaId === selectedAreaId;
    });
  }, [allCustomers, selectedAreaId]);

  // Selected customer IDs set (Default: all customers in visible area are selected!)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(() => {
    const initialSet = new Set();
    visibleAreaCustomers.forEach(c => initialSet.add(c.id));
    return initialSet;
  });

  // When area changes, update customer selection to all customers in that newly selected area
  useEffect(() => {
    const newSet = new Set();
    visibleAreaCustomers.forEach(c => newSet.add(c.id));
    setSelectedCustomerIds(newSet);
  }, [selectedAreaId, visibleAreaCustomers]);

  // Customer search filtering
  const searchedCustomers = useMemo(() => {
    if (!searchQuery.trim()) return visibleAreaCustomers;
    const q = searchQuery.toLowerCase().trim();
    return visibleAreaCustomers.filter(
      c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  }, [visibleAreaCustomers, searchQuery]);

  // Handle toggling single customer
  const toggleCustomer = (customerId) => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  // Select all visible customers
  const selectAllCustomers = () => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      searchedCustomers.forEach(c => next.add(c.id));
      return next;
    });
  };

  // Deselect all visible customers
  const deselectAllCustomers = () => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      searchedCustomers.forEach(c => next.delete(c.id));
      return next;
    });
  };

  // Build matrix data live based on user selection
  const matrixData = useMemo(() => {
    return buildMonthlyMatrixData({
      month: selectedMonth,
      selectedAreaId,
      selectedCustomerIds,
      deliveries,
      masters,
    });
  }, [selectedMonth, selectedAreaId, selectedCustomerIds, deliveries, masters]);

  // Action: Download Landscape PDF
  const handleDownloadPdf = async () => {
    if (matrixData.grandTotals.totalCustomers === 0) {
      setStatusModal({
        visible: true,
        title: 'No Customers Selected',
        message: 'Please select at least one customer to generate the PDF report.',
        type: 'error',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Generating Landscape PDF...');
    try {
      const filename = `Aanira_Monthly_Summary_${selectedMonth}_${selectedAreaId === 'all' ? 'All_Areas' : selectedAreaId}.pdf`;
      const res = await downloadLandscapePdf({ matrixData, filename });

      setStatusModal({
        visible: true,
        title: 'PDF Downloaded!',
        message: `Your monthly area-wise landscape PDF "${filename}" has been generated successfully.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Download error:', err);
      setStatusModal({
        visible: true,
        title: 'Generation Failed',
        message: err.message || 'Unable to generate PDF document. Please try again.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Share via WhatsApp
  const handleShareWhatsApp = async () => {
    if (matrixData.grandTotals.totalCustomers === 0) {
      setStatusModal({
        visible: true,
        title: 'No Customers Selected',
        message: 'Please select at least one customer to share the report.',
        type: 'error',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Preparing WhatsApp share...');
    try {
      const filename = `Aanira_Monthly_Summary_${selectedMonth}_${selectedAreaId === 'all' ? 'All_Areas' : selectedAreaId}.pdf`;
      const res = await shareSummaryViaWhatsApp({ matrixData, filename });

      if (Platform.OS === 'web') {
        if (res.method === 'web_share_api_file') {
          setStatusModal({
            visible: true,
            title: 'PDF Shared Successfully!',
            message: 'The PDF report file and delivery summary have been sent via WhatsApp.',
            type: 'success',
          });
        } else if (res.method !== 'user_cancelled') {
          setStatusModal({
            visible: true,
            title: 'PDF Downloaded & WhatsApp Opened',
            message: `The PDF file "${filename}" has been downloaded to your computer and WhatsApp Web is open. Simply drag or attach the downloaded PDF into your WhatsApp chat.`,
            type: 'success',
          });
        }
      }
    } catch (err) {
      console.error('WhatsApp share error:', err);
      setStatusModal({
        visible: true,
        title: 'Share Failed',
        message: err.message || 'Unable to open WhatsApp share. Please check your network or try downloading.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  

  const currentMonthLabel = formatYearMonth(selectedMonth);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Area-Wise Summary PDF"
        subtitle={`${matrixData.areaLabel} • ${currentMonthLabel}`}
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightBadgeText={currentMonthLabel}
        rightBadgeIcon="calendar-outline"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Month Selector Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthPillsContainer}
        >
          {months.map(m => {
            const isSelected = m.value === selectedMonth;
            return (
              <TouchableOpacity
                key={m.value}
                style={[styles.monthPill, isSelected && styles.monthPillActive]}
                onPress={() => setSelectedMonth(m.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.monthPillText, isSelected && styles.monthPillTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Area Filter Selector Pills */}
        <View style={styles.areaFilterCard}>
          <View style={styles.areaFilterHeader}>
            <Ionicons name="location" size={16} color="#0060AF" style={{ marginRight: 6 }} />
            <Text style={styles.areaFilterTitle}>Area Selection:</Text>
            <Text style={styles.areaFilterNote}>
              {selectedAreaId === 'all' ? '(All areas selected by default)' : `(${visibleAreaCustomers.length} customers)`}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.areaPillsContainer}
          >
            {/* All Areas Pill */}
            <TouchableOpacity
              style={[styles.areaPill, selectedAreaId === 'all' && styles.areaPillActive]}
              onPress={() => setSelectedAreaId('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.areaPillText, selectedAreaId === 'all' && styles.areaPillTextActive]}>
                All Areas
              </Text>
            </TouchableOpacity>

            {/* Individual Area Pills */}
            {areas.map(a => {
              const isSelected = a.id === selectedAreaId;
              const short = a.shortName || a.name.split(' - ')[0] || a.name;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.areaPill, isSelected && styles.areaPillActive]}
                  onPress={() => setSelectedAreaId(a.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.areaPillText, isSelected && styles.areaPillTextActive]}>
                    {short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Live Metrics Summary Cards */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconCircleBlue}>
              <Ionicons name="people" size={18} color="#0060AF" />
            </View>
            <Text style={styles.metricLabel}>Customers</Text>
            <Text style={styles.metricValue}>{matrixData.grandTotals.totalCustomers}</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconCircleBlue}>
              <Ionicons name="water" size={18} color="#0060AF" />
            </View>
            <Text style={styles.metricLabel}>Total Milk (L)</Text>
            <Text style={styles.metricValue}>{formatMilkQty(matrixData.grandTotals.totalMilk)}</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconCircleBlue}>
              <Text style={styles.metricRupee}>₹</Text>
            </View>
            <Text style={styles.metricLabel}>Grand Total</Text>
            <Text style={styles.metricValueAmount}>
              ₹{matrixData.grandTotals.totalAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Main View Tabs: Preview vs Customer Customization */}
        <View style={styles.viewTabsContainer}>
          <TouchableOpacity
            style={[styles.viewTab, activeTab === 'preview' && styles.viewTabActive]}
            onPress={() => setActiveTab('preview')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="newspaper-outline"
              size={16}
              color={activeTab === 'preview' ? '#0060AF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.viewTabText, activeTab === 'preview' && styles.viewTabTextActive]}>
              Landscape PDF Preview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewTab, activeTab === 'customers' && styles.viewTabActive]}
            onPress={() => setActiveTab('customers')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkbox-outline"
              size={16}
              color={activeTab === 'customers' ? '#0060AF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.viewTabText, activeTab === 'customers' && styles.viewTabTextActive]}>
              Customize Customers ({selectedCustomerIds.size}/{visibleAreaCustomers.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: CUSTOMER CUSTOMIZATION */}
        {activeTab === 'customers' && (
          <View style={styles.customizationCard}>
            <View style={styles.custHeaderRow}>
              <View>
                <Text style={styles.custSectionTitle}>Customer Selection</Text>
                <Text style={styles.custSectionSubtitle}>
                  {selectedCustomerIds.size} of {visibleAreaCustomers.length} customers included in report
                </Text>
              </View>
              <View style={styles.quickSelectActions}>
                <TouchableOpacity
                  style={styles.quickSelectBtn}
                  onPress={selectAllCustomers}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={14} color="#0060AF" style={{ marginRight: 3 }} />
                  <Text style={styles.quickSelectText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickSelectBtn, styles.quickSelectBtnDeselect]}
                  onPress={deselectAllCustomers}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={14} color="#EF4444" style={{ marginRight: 3 }} />
                  <Text style={[styles.quickSelectText, { color: '#EF4444' }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Filter customers by name or phone..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Customer List */}
            {searchedCustomers.length === 0 ? (
              <View style={styles.emptyCustBox}>
                <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyCustText}>No customers found matching "{searchQuery}"</Text>
              </View>
            ) : (
              <View style={styles.custListContainer}>
                {searchedCustomers.map((cust, idx) => {
                  const isChecked = selectedCustomerIds.has(cust.id);
                  const custArea = areas.find(a => a.id === cust.areaId);
                  const areaShort = custArea?.shortName || custArea?.name?.split(' - ')[0] || cust.areaId;

                  return (
                    <TouchableOpacity
                      key={cust.id}
                      style={[styles.custItemRow, isChecked && styles.custItemRowChecked]}
                      onPress={() => toggleCustomer(cust.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.custCheckboxBox}>
                        <Ionicons
                          name={isChecked ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isChecked ? '#0060AF' : '#94A3B8'}
                        />
                      </View>
                      <View style={styles.custInfoCol}>
                        <View style={styles.custNameRow}>
                          <Text style={[styles.custNameText, isChecked && styles.custNameTextChecked]}>
                            {cust.sequence ? `${cust.sequence}. ` : ''}{cust.name}
                          </Text>
                          {areaShort && (
                            <View style={styles.custAreaBadge}>
                              <Text style={styles.custAreaBadgeText}>{areaShort}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.custPhoneText}>{cust.phone || 'No phone'}</Text>
                      </View>
                      <View style={styles.custRateBox}>
                        <Text style={styles.custRateText}>₹{cust.pricePerLiter || 60}/L</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: LIVE LANDSCAPE TABLE PREVIEW */}
        {activeTab === 'preview' && (
          <View style={styles.tableCard}>
            <View style={styles.tableCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableCardTitle}>Landscape Report Layout (A4 Horizontal)</Text>
                <Text style={styles.tableCardSub}>
                  Days 1 to {matrixData.daysInMonth} • Scroll horizontally to inspect all daily columns
                </Text>
              </View>
              <View style={styles.layoutBadge}>
                <Ionicons name="phone-landscape-outline" size={14} color="#0060AF" style={{ marginRight: 4 }} />
                <Text style={styles.layoutBadgeText}>Landscape</Text>
              </View>
            </View>

            {/* Horizontally & Vertically Scrollable Preview Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableHorizontalScroll}>
              <View style={styles.tableInnerBox}>
                {/* Table Header Row */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, styles.thSno]}>#</Text>
                  <Text style={[styles.thCell, styles.thName]}>Customer Name</Text>
                  {matrixData.dayLabels.map(d => (
                    <Text key={d} style={[styles.thCell, styles.thDay]}>{d}</Text>
                  ))}
                  <Text style={[styles.thCell, styles.thTotal]}>Total (L)</Text>
                  <Text style={[styles.thCell, styles.thAmount]}>Amount</Text>
                </View>

                {/* Table Body */}
                {matrixData.areas.length === 0 || matrixData.grandTotals.totalCustomers === 0 ? (
                  <View style={styles.tableEmptyBox}>
                    <Ionicons name="document-text-outline" size={36} color="#CBD5E1" />
                    <Text style={styles.tableEmptyText}>No customers selected for this area report.</Text>
                    <Text style={styles.tableEmptySub}>
                      Switch to "Customize Customers" tab to check customers.
                    </Text>
                  </View>
                ) : (
                  matrixData.areas.map(area => (
                    <React.Fragment key={area.areaId}>
                      {/* Area Header Row */}
                      <View style={styles.areaHeaderRow}>
                        <Text style={styles.areaHeaderText}>
                          📍 {area.areaName} ({area.customers.length} Customers • {formatMilkQty(area.totalMilk)} L • {area.totalAmount.toLocaleString('en-IN')})
                        </Text>
                      </View>

                      {/* Customer Rows */}
                      {area.customers.map((cust, cIdx) => (
                        <View
                          key={cust.customerId}
                          style={[styles.tableDataRow, cIdx % 2 === 1 && styles.tableDataRowAlt]}
                        >
                          <Text style={[styles.tdCell, styles.thSno]}>{cust.sequence || cIdx + 1}</Text>
                          <Text style={[styles.tdCell, styles.thName]} numberOfLines={1}>
                            {cust.customerName}
                          </Text>
                          {cust.dailyQuantities.map((q, qIdx) => (
                            <Text
                              key={qIdx}
                              style={[
                                styles.tdCell,
                                styles.thDay,
                                q > 0 ? styles.tdDayHasQty : styles.tdDayEmpty,
                              ]}
                            >
                              {q > 0 ? formatMilkQty(q) : '-'}
                            </Text>
                          ))}
                          <Text style={[styles.tdCell, styles.thTotal, styles.tdTotalText]}>
                            {formatMilkQty(cust.totalMilk)}
                          </Text>
                          <Text style={[styles.tdCell, styles.thAmount, styles.tdAmountText]}>
                            {cust.totalAmount.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      ))}

                      {/* Area Subtotal Row */}
                      <View style={styles.areaSubtotalRow}>
                        <Text style={[styles.tdCell, styles.thSno]}></Text>
                        <Text style={[styles.tdCell, styles.thName, styles.subtotalLabelText]}>
                          TOTAL - {area.shortName || area.areaName}
                        </Text>
                        {area.dayTotals.map((q, qIdx) => (
                          <Text
                            key={qIdx}
                            style={[styles.tdCell, styles.thDay, styles.subtotalDayText]}
                          >
                            {q > 0 ? formatMilkQty(q) : '-'}
                          </Text>
                        ))}
                        <Text style={[styles.tdCell, styles.thTotal, styles.subtotalTotalText]}>
                          {formatMilkQty(area.totalMilk)}
                        </Text>
                        <Text style={[styles.tdCell, styles.thAmount, styles.subtotalAmountText]}>
                          {area.totalAmount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </React.Fragment>
                  ))
                )}

                {/* Overall Grand Total Row */}
                {matrixData.grandTotals.totalCustomers > 0 && (
                  <View style={styles.grandTotalRow}>
                    <Text style={[styles.tdCell, styles.thSno]}></Text>
                    <Text style={[styles.tdCell, styles.thName, styles.grandTotalLabelText]}>
                      OVERALL GRAND TOTAL
                    </Text>
                    {matrixData.grandTotals.dayTotals.map((q, qIdx) => (
                      <Text
                        key={qIdx}
                        style={[styles.tdCell, styles.thDay, styles.grandTotalDayText]}
                      >
                        {q > 0 ? formatMilkQty(q) : '-'}
                      </Text>
                    ))}
                    <Text style={[styles.tdCell, styles.thTotal, styles.grandTotalTotalText]}>
                      {formatMilkQty(matrixData.grandTotals.totalMilk)}
                    </Text>
                    <Text style={[styles.tdCell, styles.thAmount, styles.grandTotalAmountText]}>
                      {matrixData.grandTotals.totalAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Export & Action Buttons */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Download & Share Landscape Report</Text>

          <View style={styles.actionButtonsRow}>
            {/* Download PDF Button */}
            <TouchableOpacity
              style={[styles.mainActionBtn, styles.downloadBtn]}
              onPress={handleDownloadPdf}
              activeOpacity={0.85}
              disabled={isProcessing}
            >
              <Ionicons name="cloud-download" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.mainActionBtnText}>Download PDF</Text>
            </TouchableOpacity>

            {/* WhatsApp Share Button */}
            <TouchableOpacity
              style={[styles.mainActionBtn, styles.whatsappBtn]}
              onPress={handleShareWhatsApp}
              activeOpacity={0.85}
              disabled={isProcessing}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.mainActionBtnText}>Share on WhatsApp</Text>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>

      {/* Processing Loader Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#0060AF" style={{ marginBottom: 12 }} />
            <Text style={styles.processingTitle}>{processingMessage}</Text>
            <Text style={styles.processingSub}>Please wait a moment</Text>
          </View>
        </View>
      )}

      {/* Status / Alert Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={statusModal.visible}
        onRequestClose={() => setStatusModal({ ...statusModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalCard}>
            <View style={[
              styles.statusIconCircle,
              statusModal.type === 'success' ? styles.statusIconCircleSuccess : styles.statusIconCircleError
            ]}>
              <Ionicons
                name={statusModal.type === 'success' ? 'checkmark' : 'alert-circle'}
                size={28}
                color={statusModal.type === 'success' ? '#16A34A' : '#EF4444'}
              />
            </View>
            <Text style={styles.statusModalTitle}>{statusModal.title}</Text>
            <Text style={styles.statusModalMessage}>{statusModal.message}</Text>

            <TouchableOpacity
              style={styles.statusModalCloseBtn}
              onPress={() => setStatusModal({ ...statusModal, visible: false })}
              activeOpacity={0.85}
            >
              <Text style={styles.statusModalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
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
  areaFilterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  areaFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  areaFilterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  areaFilterNote: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '500',
  },
  areaPillsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  areaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  areaPillActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  areaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  areaPillTextActive: {
    color: '#FFFFFF',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  metricIconCircleBlue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricRupee: {
    color: '#0060AF',
    fontSize: 16,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  metricValueAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0060AF',
  },
  viewTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  viewTabActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  viewTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  viewTabTextActive: {
    color: '#0060AF',
  },
  customizationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  custHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  custSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  custSectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  quickSelectActions: {
    flexDirection: 'row',
    gap: 6,
  },
  quickSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickSelectBtnDeselect: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  quickSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0060AF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  custListContainer: {
    marginBottom: 8,
  },
  emptyCustBox: {
    alignItems: 'center',
    padding: 24,
  },
  emptyCustText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  custItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  custItemRowChecked: {
    backgroundColor: '#F0F9FF',
  },
  custCheckboxBox: {
    marginRight: 10,
  },
  custInfoCol: {
    flex: 1,
  },
  custNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  custNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  custNameTextChecked: {
    fontWeight: '800',
    color: '#0F172A',
  },
  custAreaBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  custAreaBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  custPhoneText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  custRateBox: {
    paddingLeft: 8,
  },
  custRateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0060AF',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  tableCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  layoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  layoutBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0060AF',
  },
  tableHorizontalScroll: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
  },
  tableInnerBox: {
    minWidth: 1180,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  thCell: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 6,
    paddingHorizontal: 1,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#475569',
  },
  thSno: { width: 32 },
  thName: { width: 140, textAlign: 'left', paddingLeft: 6 },
  thDay: { width: 32 },
  thTotal: { width: 62, textAlign: 'right', paddingRight: 6 },
  thAmount: { width: 70, textAlign: 'right', paddingRight: 6 },
  areaHeaderRow: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  areaHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  tableDataRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tdCell: {
    fontSize: 9.5,
    color: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 1,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#E2E8F0',
  },
  tdDayHasQty: {
    fontWeight: '700',
    color: '#0F172A',
  },
  tdDayEmpty: {
    color: '#CBD5E1',
  },
  tdTotalText: {
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    paddingRight: 6,
  },
  tdAmountText: {
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    paddingRight: 6,
  },
  areaSubtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  subtotalLabelText: {
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'left',
    paddingLeft: 6,
  },
  subtotalDayText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  subtotalTotalText: {
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'right',
    paddingRight: 6,
  },
  subtotalAmountText: {
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'right',
    paddingRight: 6,
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 2,
  },
  grandTotalLabelText: {
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'left',
    paddingLeft: 6,
    fontSize: 11,
  },
  grandTotalDayText: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  grandTotalTotalText: {
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'right',
    paddingRight: 6,
  },
  grandTotalAmountText: {
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'right',
    paddingRight: 6,
  },
  tableEmptyBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
  },
  tableEmptySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    marginBottom: 30,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mainActionBtn: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  downloadBtn: {
    backgroundColor: '#0060AF',
  },
  whatsappBtn: {
    backgroundColor: '#16A34A',
  },
  printBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    flex: 0.6,
    minWidth: 90,
  },
  mainActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  printBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    width: 260,
  },
  processingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  processingSub: {
    fontSize: 11,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  statusModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  statusIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusIconCircleSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusIconCircleError: {
    backgroundColor: '#FEE2E2',
  },
  statusModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusModalMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  statusModalCloseBtn: {
    backgroundColor: '#0060AF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  statusModalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

