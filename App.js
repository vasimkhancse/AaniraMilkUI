import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storageService } from './src/services/storageService';
import { hasOpenModals, closeTopModal } from './src/services/modalBackHandler';
import AaniraLogo from './src/components/AaniraLogo';
import LoginScreen from './src/screens/LoginScreen';
import AddEntryScreen from './src/screens/AddEntryScreen';
import MonthlySummaryScreen from './src/screens/MonthlySummaryScreen';
import CustomerBillScreen from './src/screens/CustomerBillScreen';
import MastersScreen from './src/screens/MastersScreen';
import { getCurrentYearMonth } from './src/utils/dateUtils';

import CircleLoader, { LoadingOverlay } from './src/components/CircleLoader';
import AppHeader from './src/components/AppHeader';

export default function App() {
  const { width } = useWindowDimensions();
  const [isReady, setIsReady] = useState(false);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' | 'summary' | 'bill' | 'masters'
  const [selectedCustomerIdForBill, setSelectedCustomerIdForBill] = useState('cust-2'); // Ravi by default
  const [selectedBillMonth, setSelectedBillMonth] = useState(getCurrentYearMonth());
  const [masters, setMasters] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deviceFrameMode, setDeviceFrameMode] = useState(width > 768);

  // Navigation History Stack for back button handling across Web and Mobile
  const [navStack, setNavStack] = useState([{ tab: 'entry' }]);
  const navStackRef = useRef([{ tab: 'entry' }]);
  const lastBackPressRef = useRef(0);

  // Initialize data on mount
  useEffect(() => {
    async function init() {
      await storageService.initData();
      const loadedMasters = await storageService.getMasters();
      const loadedDeliveries = await storageService.getDeliveries();
      const user = await storageService.getCurrentUser();
      
      setMasters(loadedMasters);
      setDeliveries(loadedDeliveries);
      if (user) {
        setCurrentUser(user);
      }
      setIsReady(true);
    }
    init();
  }, []);

  const [refreshKey, setRefreshKey] = useState(0);

  // Function to refresh both masters and deliveries from storage/backend
  const refreshAppData = async () => {
    try {
      const [loadedMasters, loadedDeliveries] = await Promise.all([
        storageService.getMasters(),
        storageService.getDeliveries(),
      ]);
      if (loadedMasters) setMasters(loadedMasters);
      if (loadedDeliveries) setDeliveries(loadedDeliveries);
    } catch (err) {
      console.warn('Error refreshing tab data:', err);
    }
  };

  const applyScreenState = (screenInfo) => {
    if (!screenInfo) return;
    setActiveTab(screenInfo.tab || 'entry');
    if (screenInfo.customerId) {
      setSelectedCustomerIdForBill(screenInfo.customerId);
    }
    if (screenInfo.month) {
      setSelectedBillMonth(screenInfo.month);
    }
    setRefreshKey((prev) => prev + 1);
    refreshAppData();
  };

  const navigateTo = (screenInfo, replace = false) => {
    const current = navStackRef.current[navStackRef.current.length - 1];
    if (
      current &&
      current.tab === screenInfo.tab &&
      current.customerId === screenInfo.customerId &&
      current.month === screenInfo.month
    ) {
      return;
    }

    let newStack;
    if (replace) {
      newStack = [...navStackRef.current.slice(0, -1), screenInfo];
    } else {
      newStack = [...navStackRef.current, screenInfo];
    }
    navStackRef.current = newStack;
    setNavStack(newStack);
    applyScreenState(screenInfo);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
      try {
        window.history.pushState(
          { ...screenInfo, depth: newStack.length - 1 },
          '',
          `#${screenInfo.tab}`
        );
      } catch (e) {
        console.warn('history.pushState error:', e);
      }
    }
  };

  const handleGoBack = (syncWebHistory = true) => {
    // 1. If any modal is open across the entire app, close it first!
    if (hasOpenModals()) {
      closeTopModal();
      return true;
    }

    // 2. If we have previous screens in our history, go back to previous page
    if (navStackRef.current.length > 1) {
      const newStack = navStackRef.current.slice(0, -1);
      navStackRef.current = newStack;
      setNavStack(newStack);

      const prevScreen = newStack[newStack.length - 1];
      applyScreenState(prevScreen);

      if (syncWebHistory && Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
        try {
          window.history.back();
        } catch (e) {
          console.warn('history.back error:', e);
        }
      }
      return true;
    }

    // 3. At root screen ('entry')
    if (Platform.OS !== 'web') {
      const now = Date.now();
      if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      if (Platform.OS === 'android' && ToastAndroid?.show) {
        ToastAndroid.show('Press back again to exit Aanira Milk', ToastAndroid.SHORT);
      }
      return true;
    }

    return false;
  };

  // Web Browser Back Button (popstate) Listener
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
      try {
        window.history.replaceState({ tab: 'entry', depth: 0 }, '', '#entry');
      } catch (e) {}

      const handlePopState = (e) => {
        if (hasOpenModals()) {
          closeTopModal();
          const current = navStackRef.current[navStackRef.current.length - 1];
          if (current && window.history) {
            try {
              window.history.pushState(
                { ...current, depth: navStackRef.current.length - 1 },
                '',
                `#${current.tab}`
              );
            } catch (err) {}
          }
          return;
        }

        // Pop internal navigation stack without calling window.history.back() again
        handleGoBack(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, []);

  // Android Mobile Hardware Back Button Listener
  useEffect(() => {
    const handleHardwareBack = () => {
      return handleGoBack(true);
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => {
      if (backSub?.remove) {
        backSub.remove();
      } else {
        BackHandler.removeEventListener('hardwareBackPress', handleHardwareBack);
      }
    };
  }, []);

  const handleTabPress = async (tabName) => {
    navigateTo({ tab: tabName });
  };

  const handleLogin = async (user) => {
    setCurrentUser(user);
    await storageService.setCurrentUser(user);
    navStackRef.current = [{ tab: 'entry' }];
    setNavStack([{ tab: 'entry' }]);
    applyScreenState({ tab: 'entry' });
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    await storageService.setCurrentUser(null);
    navStackRef.current = [{ tab: 'entry' }];
    setNavStack([{ tab: 'entry' }]);
  };

  const handleSaveEntriesBatch = async (batch) => {
    await storageService.saveDeliveriesBatch(batch);
    const updated = await storageService.getDeliveries();
    setDeliveries(updated);
  };

  const handleNavigateToCustomerBill = async (customerId, month) => {
    navigateTo({
      tab: 'bill',
      customerId,
      month: month || selectedBillMonth,
    });
  };

  const handleResetDemoData = async () => {
    setIsTabLoading(true);
    await storageService.resetToDemoData();
    const loadedMasters = await storageService.getMasters();
    const loadedDeliveries = await storageService.getDeliveries();
    setMasters(loadedMasters);
    setDeliveries(loadedDeliveries);
    setSelectedCustomerIdForBill('cust-2');
    setRefreshKey((prev) => prev + 1);
    setIsTabLoading(false);
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.initLogoBox}>
          <AaniraLogo />
        </View>
        <View style={{ marginTop: 24 }}>
          <CircleLoader size="large" color="#0060AF" text="Loading Aanira Milk & Data..." textColor="#0060AF" />
        </View>
      </View>
    );
  }

  // Render current screen with unique key for full refresh on each tab click
  const renderScreenContent = () => {
    if (!currentUser) {
      return <LoginScreen masters={masters} onLogin={handleLogin} />;
    }

    const screenKey = `${activeTab}-${refreshKey}`;

    switch (activeTab) {
      case 'entry':
        return (
          <AddEntryScreen
            key={screenKey}
            masters={masters}
            currentUser={currentUser}
            deliveries={deliveries}
            onSaveEntries={handleSaveEntriesBatch}
            onNavigateToSummary={() => handleTabPress('summary')}
            onNavigateToMasters={() => handleTabPress('masters')}
            onRefresh={refreshAppData}
          />
        );
      case 'summary':
        return (
          <MonthlySummaryScreen
            key={screenKey}
            masters={masters}
            currentUser={currentUser}
            deliveries={deliveries}
            onSelectCustomerBill={handleNavigateToCustomerBill}
            onBack={() => handleGoBack(true)}
            onRefresh={refreshAppData}
          />
        );
      case 'bill':
        return (
          <CustomerBillScreen
            key={screenKey}
            customerId={selectedCustomerIdForBill}
            month={selectedBillMonth}
            masters={masters}
            deliveries={deliveries}
            onBack={() => handleGoBack(true)}
            onRefresh={refreshAppData}
          />
        );
      case 'masters':
        if (currentUser?.role !== 'admin') {
          return (
            <SafeAreaView style={styles.restrictedContainer}>
              <AppHeader title="Access Restricted" showBack onBack={() => handleGoBack(true)} />
              <View style={styles.restrictedBox}>
                <Ionicons name="shield-outline" size={48} color="#DC2626" />
                <Text style={styles.restrictedTitle}>Admin Access Only</Text>
                <Text style={styles.restrictedText}>
                  Only administrators have permission to access Masters and System Settings.
                </Text>
                <TouchableOpacity
                  style={styles.restrictedBtn}
                  onPress={() => handleGoBack(true)}
                >
                  <Text style={styles.restrictedBtnText}>Back to Delivery Sheets</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          );
        }
        return (
          <MastersScreen
            key={screenKey}
            masters={masters}
            currentUser={currentUser}
            onUpdateMasters={setMasters}
            onResetDemoData={handleResetDemoData}
            onBack={() => handleGoBack(true)}
            onRefresh={refreshAppData}
          />
        );
      default:
        return null;
    }
  };

  // Main UI Wrapper
  const content = (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0060AF" />

      {/* Screen view */}
      <View style={styles.contentArea}>{renderScreenContent()}</View>

      <LoadingOverlay visible={isTabLoading} message="Refreshing data..." />

      {/* Bottom Navigation Bar (Visible when logged in) */}
      {currentUser && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleTabPress('entry')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'entry' ? 'add-circle' : 'add-circle-outline'}
              size={24}
              color={activeTab === 'entry' ? '#0060AF' : '#64748B'}
            />
            <Text style={[styles.navLabel, activeTab === 'entry' && styles.navLabelActive]}>
              Add Entry
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleTabPress('summary')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'summary' ? 'bar-chart' : 'bar-chart-outline'}
              size={22}
              color={activeTab === 'summary' ? '#0060AF' : '#64748B'}
            />
            <Text style={[styles.navLabel, activeTab === 'summary' && styles.navLabelActive]}>
              Summary
            </Text>
          </TouchableOpacity>

          {/* Masters Tab - ONLY VISIBLE FOR ADMIN */}
          {currentUser?.role === 'admin' && (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleTabPress('masters')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'masters' ? 'options' : 'options-outline'}
                size={22}
                color={activeTab === 'masters' ? '#0060AF' : '#64748B'}
              />
              <Text style={[styles.navLabel, activeTab === 'masters' && styles.navLabelActive]}>
                Masters
              </Text>
            </TouchableOpacity>
          )}

          {/* User / Logout button */}
          <TouchableOpacity style={styles.navItem} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color="#DC2626" />
            <Text style={[styles.navLabel, { color: '#DC2626' }]}>Exit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // If on desktop web, offer neat container simulator or full width
  if (Platform.OS === 'web' && width > 768) {
    return (
      <View style={styles.webDesktopBackground}>
        {/* Top Web Control Bar */}
        <View style={styles.webTopBar}>
          <View style={styles.webBrandRow}>
            <AaniraLogo compact horizontal variant="light" showTagline={false} size={30} />
          </View>
          <View style={styles.webControlsRow}>
            <TouchableOpacity
              style={[styles.webModeBtn, deviceFrameMode && styles.webModeBtnActive]}
              onPress={() => setDeviceFrameMode(true)}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={16}
                color={deviceFrameMode ? '#FFFFFF' : '#0060AF'}
              />
              <Text
                style={[styles.webModeBtnText, deviceFrameMode && styles.webModeBtnTextActive]}
              >
                Mobile View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webModeBtn, !deviceFrameMode && styles.webModeBtnActive]}
              onPress={() => setDeviceFrameMode(false)}
            >
              <Ionicons
                name="laptop-outline"
                size={16}
                color={!deviceFrameMode ? '#FFFFFF' : '#0060AF'}
              />
              <Text
                style={[styles.webModeBtnText, !deviceFrameMode && styles.webModeBtnTextActive]}
              >
                Wide Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Simulator Device Frame or Expanded Layout */}
        <View style={styles.webCenterWrapper}>
          <View
            style={[
              styles.webFrameCard,
              deviceFrameMode ? styles.phoneDimensions : styles.dashboardDimensions,
            ]}
          >
            {content}
          </View>
        </View>
      </View>
    );
  }

  return <SafeAreaView style={styles.root}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0060AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  initLogoBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    shadowColor: '#0060AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0060AF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentArea: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 3,
  },
  navLabelActive: {
    color: '#0060AF',
    fontWeight: '800',
  },
  webDesktopBackground: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  webTopBar: {
    height: 52,
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  webBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  webBrandTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  webBrandLocation: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  webControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  webModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  webModeBtnActive: {
    backgroundColor: '#0060AF',
    borderColor: '#0060AF',
  },
  webModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  webModeBtnTextActive: {
    color: '#FFFFFF',
  },
  webCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  webFrameCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#334155',
  },
  phoneDimensions: {
    width: 410,
    height: '95%',
    maxHeight: 840,
  },
  dashboardDimensions: {
    width: '95%',
    maxWidth: 960,
    height: '95%',
  },
  restrictedContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  restrictedBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 8,
  },
  restrictedText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  restrictedBtn: {
    backgroundColor: '#0060AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  restrictedBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
