import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { storageService } from '../services/storageService';
import CircleLoader, { LoadingOverlay } from '../components/CircleLoader';
import {
  getCurrentYearMonth,
  formatYearMonth,
  formatDisplayDate,
  getAvailableMonths,
} from '../utils/dateUtils';
import { useBackModal } from '../services/modalBackHandler';

export default function CustomerBillScreen({
  customerId,
  month = getCurrentYearMonth(),
  onBack,
  deliveries,
  masters,
}) {
  const customersList = masters?.customers || [];
  const [activeCustomerId, setActiveCustomerId] = useState(
    customerId || customersList[0]?.id || null
  );
  const [billData, setBillData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Hook back button to close modals safely
  useBackModal(showCustomerPicker, () => setShowCustomerPicker(false));
  useBackModal(showShareModal, () => setShowShareModal(false));

  const [selectedMonth, setSelectedMonth] = useState(month || getCurrentYearMonth());
  const months = getAvailableMonths(deliveries, selectedMonth);
  const currentMonthLabel = formatYearMonth(selectedMonth);

  useEffect(() => {
    if (customerId) {
      setActiveCustomerId(customerId);
    } else if (!activeCustomerId && customersList.length > 0) {
      setActiveCustomerId(customersList[0].id);
    }
  }, [customerId, customersList]);

  const loadBill = async () => {
    if (!activeCustomerId) {
      setBillData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await storageService.getCustomerMonthlyBill(activeCustomerId, selectedMonth);
      setBillData(data);
    } catch (e) {
      console.warn('Error loading customer bill:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBill();
  }, [activeCustomerId, selectedMonth, deliveries, masters]);

  const currentCustObj = customersList.find((c) => c.id === activeCustomerId);
  const customer = billData?.customer || currentCustObj || { name: 'Select Customer', phone: '' };
  const entries = billData?.entries || [];
  const totalMilk = billData?.totalMilk || 0;
  const totalAmount = billData?.totalAmount || 0;

  // Helper to determine UPI payment phone number based on customer area ID
  const getPaymentPhone = () => {
    const custArea = String(customer?.areaId || customer?.area_id || currentCustObj?.areaId || currentCustObj?.area_id || '').toLowerCase().trim();
    if (custArea === 'area-1' || custArea === 'area1' || custArea === '1' || custArea === 'area_1') {
      return '+91 88832 66445';
    }
    return '+91 97901 66445';
  };

  // Generate formatted WhatsApp message text
  const generateWhatsAppMessage = () => {
    const rawLines = entries.map(
      (e) => `• ${formatDisplayDate(e.date)} (${e.shift}): ${e.qty}L - ₹${e.amount}`
    );
    const summaryLines = rawLines.slice(0, 15).join('\n');
    const moreText = entries.length > 15 ? `\n...and ${entries.length - 15} more deliveries` : '';
    const paymentPhone = getPaymentPhone();

    return `🥛 *AANIRA MILK & MILK PRODUCTS* 🥛
📍 *Kovaipudur, Coimbatore*
_Fresh Milk • Healthy Family_
----------------------------------
👤 *Customer:* ${customer.name}
📱 *Phone:* ${customer.phone || 'N/A'}
📅 *Billing Period:* ${currentMonthLabel}
----------------------------------
*Delivery Breakdown:*
${summaryLines}${moreText}
----------------------------------
📊 *Total Milk Supplied:* ${totalMilk.toFixed(1)} Litres
💰 *TOTAL AMOUNT DUE:* ₹${totalAmount.toLocaleString('en-IN')}
----------------------------------
💳 *Payment Methods:*
• Google Pay / PhonePe / Paytm: ${paymentPhone}
• Cash on Delivery

🙏 _Thank you for choosing Aanira Milk! Have a healthy day._`;
  };

  const handleSendWhatsApp = async () => {
    const cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91')
      ? cleanPhone
      : `91${cleanPhone.length === 10 ? cleanPhone : '9876543210'}`;
    const message = encodeURIComponent(generateWhatsAppMessage());
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${message}`;

    try {
      if (Platform.OS === 'web') {
        window.open(whatsappUrl, '_blank');
      } else {
        const supported = await Linking.canOpenURL(whatsappUrl);
        if (supported) {
          await Linking.openURL(whatsappUrl);
        } else {
          setShowShareModal(true);
        }
      }
    } catch (e) {
      setShowShareModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Customer Bill"
        rightBadgeText={currentMonthLabel}
        rightBadgeIcon="calendar-outline"
        showBack={true}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Customer Profile & Selector Card */}
        <View style={styles.customerCard}>
          <TouchableOpacity
            style={styles.customerLeft}
            onPress={() => setShowCustomerPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.customerInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.customerName}>{customer.name || 'Select Customer'}</Text>
                <Ionicons name="chevron-down-circle" size={16} color="#0060AF" />
              </View>
              <Text style={styles.customerPhone}>
                {customer.phone || 'Tap to switch customer'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Quick WhatsApp Send Pill on Top Right */}
          {activeCustomerId && (
            <TouchableOpacity
              style={styles.quickWhatsAppBtn}
              onPress={handleSendWhatsApp}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
              <Text style={styles.quickWhatsAppText}>Send Bill</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dynamic Month Selector Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthPillsContainer}
        >
          {months.map((m) => {
            const isSelected = m.value === selectedMonth;
            return (
              <TouchableOpacity
                key={m.value}
                style={[styles.monthPill, isSelected && styles.monthPillActive]}
                onPress={() => setSelectedMonth(m.value)}
              >
                <Text style={[styles.monthPillText, isSelected && styles.monthPillTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <CircleLoader
              size="large"
              color="#0060AF"
              text={`Fetching bill details for ${customer.name || 'Customer'}...`}
              textColor="#0060AF"
            />
          </View>
        ) : (
          <>
            {/* Itemized Delivery Breakdown Table */}
            <View style={styles.tableCard}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableColHeader, styles.colDate]}>Date</Text>
                <Text style={[styles.tableColHeader, styles.colShift]}>Shift</Text>
                <Text style={[styles.tableColHeader, styles.colQty]}>Qty (L)</Text>
                <Text style={[styles.tableColHeader, styles.colAmount]}>Amount</Text>
              </View>

              {/* Entries Rows */}
              {entries.length === 0 ? (
                <View style={styles.emptyTable}>
                  <Ionicons name="document-text-outline" size={32} color="#94A3B8" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyText}>No deliveries recorded for this customer in {currentMonthLabel}</Text>
                  <Text style={styles.emptySubtext}>Entries added in the Daily Entry screen will appear here live.</Text>
                </View>
              ) : (
                entries.map((entry, idx) => (
                  <View key={entry.id || idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]} >
                    <Text style={[styles.tableCell, styles.colDate, styles.dateCell]}>
                      {formatDisplayDate(entry.date)}
                    </Text>

                    <View style={[styles.tableCell, styles.colShift]}>
                      <View
                        style={[
                          styles.shiftBadge,
                          entry.shift === 'Morning' ? styles.shiftMorning : styles.shiftEvening,
                        ]}
                      >
                        <Text
                          style={[
                            styles.shiftBadgeText,
                            entry.shift === 'Morning' ? styles.shiftMorningText : styles.shiftEveningText,
                          ]}
                        >
                          {entry.shift}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.tableCell, styles.colQty, styles.qtyText]}>
                      {entry.qty}
                    </Text>

                    <Text style={[styles.tableCell, styles.colAmount, styles.amountText]}>
                      ₹{entry.amount}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Totals Card */}
            <View style={styles.totalsCard}>
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>Total Milk (L)</Text>
                <Text style={styles.totalValueMilk}>{totalMilk.toFixed(1)}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValueAmount}>₹{totalAmount.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Big WhatsApp Send Button */}
            {activeCustomerId && (
              <TouchableOpacity
                style={styles.whatsappActionBtn}
                onPress={handleSendWhatsApp}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.whatsappActionText}>Send Monthly Bill via WhatsApp</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Customer Picker Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={showCustomerPicker}
          onRequestClose={() => setShowCustomerPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Customer</Text>
                <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 350 }}>
                {customersList.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#64748B', textAlign: 'center' }}>
                      No customers found in database. Please create customers in the Masters tab.
                    </Text>
                  </View>
                ) : (
                  customersList.map((c) => {
                    const isSelected = c.id === activeCustomerId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.customerPickerRow, isSelected && styles.customerPickerRowActive]}
                        onPress={() => {
                          setActiveCustomerId(c.id);
                          setShowCustomerPicker(false);
                        }}
                      >
                        <View>
                          <Text style={[styles.customerPickerName, isSelected && styles.customerPickerNameActive]}>
                            {c.name}
                          </Text>
                          <Text style={styles.customerPickerPhone}>{c.phone || 'No phone'}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color="#0060AF" />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Bill Preview Modal */}
        <Modal
          transparent
          animationType="slide"
          visible={showShareModal}
          onRequestClose={() => setShowShareModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>WhatsApp Bill Preview</Text>
                <TouchableOpacity onPress={() => setShowShareModal(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.previewScrollBox}>
                <Text style={styles.previewText}>{generateWhatsAppMessage()}</Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.openDirectWhatsAppBtn}
                onPress={handleSendWhatsApp}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.openDirectWhatsAppText}>Open WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
    paddingBottom: 28,
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
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  customerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0060AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  quickWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  quickWhatsAppText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  monthPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
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
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0060AF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableColHeader: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
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
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    fontSize: 13,
    color: '#1E293B',
  },
  colDate: {
    flex: 1.2,
  },
  colShift: {
    flex: 1.1,
  },
  colQty: {
    flex: 0.9,
    textAlign: 'center',
  },
  colAmount: {
    flex: 1,
    textAlign: 'right',
  },
  dateCell: {
    fontWeight: '600',
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  shiftMorning: {
    backgroundColor: '#FEF3C7',
  },
  shiftEvening: {
    backgroundColor: '#E0E7FF',
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shiftMorningText: {
    color: '#B45309',
  },
  shiftEveningText: {
    color: '#4338CA',
  },
  qtyText: {
    fontWeight: '700',
    color: '#0060AF',
  },
  amountText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyTable: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  totalsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0060AF',
    marginBottom: 16,
  },
  totalCol: {
    flex: 1,
    alignItems: 'center',
  },
  totalDivider: {
    width: 1.5,
    height: '80%',
    backgroundColor: '#CBD5E1',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  totalValueMilk: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0060AF',
  },
  totalValueAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16A34A',
  },
  whatsappActionBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  whatsappActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
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
    width: '100%',
    maxWidth: 420,
    padding: 18,
    maxHeight: '80%',
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
  previewScrollBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    maxHeight: 280,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  openDirectWhatsAppBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openDirectWhatsAppText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  customerPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customerPickerRowActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  customerPickerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  customerPickerNameActive: {
    color: '#0060AF',
  },
  customerPickerPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
