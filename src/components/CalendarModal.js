import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTodayIso, formatDisplayDate } from '../utils/dateUtils';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function CalendarModal({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  deliveries = [],
}) {
  const todayIso = getTodayIso();
  const initialDate = selectedDate || todayIso;

  const [currentYear, setCurrentYear] = useState(() => {
    const parts = initialDate.split('-');
    return parseInt(parts[0], 10) || new Date().getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const parts = initialDate.split('-');
    return (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) - 1; // 0-indexed
  });

  // When modal opens or selectedDate changes, sync the calendar month view
  useEffect(() => {
    if (visible && selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setCurrentYear(y);
          setCurrentMonth(m);
        }
      }
    }
  }, [visible, selectedDate]);

  // Set of dates with recorded deliveries
  const deliveryDatesSet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(deliveries)) {
      deliveries.forEach((d) => {
        if (d && d.date) {
          set.add(d.date.slice(0, 10));
        }
      });
    }
    return set;
  }, [deliveries]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    onSelectDate(todayIso);
    onClose();
  };

  const handleSelectQuick = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    onSelectDate(dateStr);
    onClose();
  };

  // Build calendar matrix for current month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthNum = currentMonth === 0 ? 12 : currentMonth;
      const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
      const isoStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNumber: dayNum,
        isoString: isoStr,
        isCurrentMonth: false,
        isPrev: true,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const isoStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        isoString: isoStr,
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete grid to 35 or 42 cells
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthNum = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
      const isoStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        isoString: isoStr,
        isCurrentMonth: false,
        isNext: true,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const handlePickDate = (isoStr) => {
    onSelectDate(isoStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.calendarIconBubble}>
                <Ionicons name="calendar" size={18} color="#0060AF" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Choose Delivery Date</Text>
                <Text style={styles.modalSubtitle}>
                  Selected: {formatDisplayDate(selectedDate)}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Quick Presets */}
          <View style={styles.quickPresetsRow}>
            <TouchableOpacity
              style={styles.quickPresetBtn}
              onPress={() => handleSelectQuick(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickPresetText}>Yesterday</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickPresetBtn, styles.quickPresetBtnToday]}
              onPress={() => handleSelectQuick(0)}
              activeOpacity={0.7}
            >
              <Ionicons name="today-outline" size={13} color="#0060AF" style={{ marginRight: 4 }} />
              <Text style={[styles.quickPresetText, styles.quickPresetTextToday]}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickPresetBtn}
              onPress={() => handleSelectQuick(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickPresetText}>Tomorrow</Text>
            </TouchableOpacity>
          </View>

          {/* Month & Year Navigation Row */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={handlePrevMonth}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#0060AF" />
            </TouchableOpacity>

            <View style={styles.monthYearCenter}>
              <Text style={styles.monthYearTitle}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={handleNextMonth}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={20} color="#0060AF" />
            </TouchableOpacity>
          </View>

          {/* Weekdays Row */}
          <View style={styles.weekdaysRow}>
            {DAYS_OF_WEEK.map((day, idx) => (
              <View key={day} style={styles.weekdayCell}>
                <Text
                  style={[
                    styles.weekdayText,
                    (idx === 0 || idx === 6) && styles.weekendText,
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Days Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((item, index) => {
              const isSelected = item.isoString === selectedDate;
              const isToday = item.isoString === todayIso;
              const hasDeliveries = deliveryDatesSet.has(item.isoString);

              return (
                <TouchableOpacity
                  key={`${item.isoString}-${index}`}
                  style={[
                    styles.dayCell,
                    !item.isCurrentMonth && styles.dayCellOutside,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => handlePickDate(item.isoString)}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !item.isCurrentMonth && styles.dayTextOutside,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {item.dayNumber}
                  </Text>

                  {/* Delivery dot indicator */}
                  {hasDeliveries && (
                    <View
                      style={[
                        styles.deliveryDot,
                        isSelected && styles.deliveryDotSelected,
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.footerTodayBtn}
              onPress={handleJumpToToday}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={15} color="#0060AF" style={{ marginRight: 5 }} />
              <Text style={styles.footerTodayText}>Go to Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerCloseBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.footerCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EBF4FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  quickPresetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  quickPresetBtnToday: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickPresetTextToday: {
    color: '#0060AF',
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  monthYearCenter: {
    alignItems: 'center',
  },
  monthYearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  weekendText: {
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 10,
    position: 'relative',
  },
  dayCellOutside: {
    opacity: 0.35,
  },
  dayCellSelected: {
    backgroundColor: '#0060AF',
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#0060AF',
    backgroundColor: '#F0F7FF',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayTextOutside: {
    color: '#94A3B8',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextToday: {
    color: '#0060AF',
    fontWeight: '700',
  },
  deliveryDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  deliveryDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  footerTodayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0060AF',
  },
  footerCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  footerCloseBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});
