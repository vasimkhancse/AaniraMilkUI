// Aanira Milk Data & State Service (Connected to PostgreSQL Backend)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_MASTERS } from '../data/initialData';
import { apiService } from './apiService';

const KEYS = {
  MASTERS: '@aanira_masters_v2',
  DELIVERIES: '@aanira_deliveries_v2',
  CURRENT_USER: '@aanira_current_user_v2',
};

export const storageService = {
  // Initialize and sync data from PostgreSQL backend
  async initData() {
    try {
      const backendMasters = await apiService.getMasters();
      if (backendMasters) {
        await AsyncStorage.setItem(KEYS.MASTERS, JSON.stringify(backendMasters));
      }
    } catch (e) {
      console.warn('Backend offline or not reachable during init, using cached storage:', e.message);
      const existingMasters = await AsyncStorage.getItem(KEYS.MASTERS);
      if (!existingMasters) {
        await AsyncStorage.setItem(KEYS.MASTERS, JSON.stringify(INITIAL_MASTERS));
      }
    }
  },

  // Masters: Rates, Shifts, Areas, Users, Customers, Presets
  async getMasters() {
    try {
      const data = await apiService.getMasters();
      if (data) {
        await AsyncStorage.setItem(KEYS.MASTERS, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      // Fallback to local cache
    }

    try {
      const cached = await AsyncStorage.getItem(KEYS.MASTERS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // fallback
    }

    return INITIAL_MASTERS;
  },

  async saveMasters(masters) {
    try {
      if (masters.milkRatePerLiter) {
        await apiService.updateMilkRate(masters.milkRatePerLiter);
        const rateNum = Number(masters.milkRatePerLiter);
        if (masters.customers && Array.isArray(masters.customers)) {
          masters.customers = masters.customers.map(c => ({
            ...c,
            pricePerLiter: rateNum,
          }));
        }
      }
      await AsyncStorage.setItem(KEYS.MASTERS, JSON.stringify(masters));
      return true;
    } catch (e) {
      console.warn('Error saving masters:', e);
      await AsyncStorage.setItem(KEYS.MASTERS, JSON.stringify(masters));
      return true;
    }
  },

  // Customers helpers
  async getCustomers(areaId = null) {
    try {
      const customers = await apiService.getCustomers(areaId);
      if (Array.isArray(customers)) {
        return customers.sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));
      }
      return customers;
    } catch (e) {
      const masters = await this.getMasters();
      let customers = masters.customers || [];
      if (areaId && areaId !== 'all') {
        customers = customers.filter(c => c.areaId === areaId);
      }
      return customers.sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));
    }
  },

  async saveCustomer(customerData) {
    try {
      await apiService.saveCustomer(customerData);
      const masters = await this.getMasters();
      return masters.customers || [];
    } catch (e) {
      const errMsg = (e.message || '').toLowerCase();
      if (
        errMsg.includes('already registered') ||
        errMsg.includes('phone') ||
        errMsg.includes('required') ||
        errMsg.includes('exists') ||
        errMsg.includes('unique')
      ) {
        throw e;
      }
      console.warn('Failed to save customer to backend, saving locally:', e);
      const masters = await this.getMasters();
      let customers = [...(masters.customers || [])];
      
      const cleanPhone = (customerData.phone || '').replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone) {
        const dup = customers.find(
          c => (!customerData.id || c.id !== customerData.id) && (c.phone || '').replace(/[^0-9]/g, '').slice(-10) === cleanPhone
        );
        if (dup) {
          throw new Error(`Phone number is already registered to customer "${dup.name}"`);
        }
      }

      if (customerData.id) {
        const index = customers.findIndex(c => c.id === customerData.id);
        if (index >= 0) {
          customers[index] = { ...customers[index], ...customerData };
        } else {
          customers.push(customerData);
        }
      } else {
        const areaCusts = customers.filter(c => c.areaId === (customerData.areaId || 'area-1'));
        const maxSeq = areaCusts.reduce((max, c) => Math.max(max, c.sequence || 0), 0);
        const newCustomer = {
          ...customerData,
          id: `cust-${Date.now()}`,
          sequence: customerData.sequence !== undefined ? customerData.sequence : (maxSeq + 1),
          active: true,
        };
        customers.push(newCustomer);
      }

      customers.sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));
      masters.customers = customers;
      await this.saveMasters(masters);
      return masters.customers;
    }
  },

  async reorderCustomers(payload) {
    try {
      const res = await apiService.reorderCustomers(payload);
      const masters = await this.getMasters();
      if (res && res.customers) {
        // If area-specific reordering, merge with other areas
        if (payload.areaId && payload.areaId !== 'all') {
          const otherCustomers = (masters.customers || []).filter(c => c.areaId !== payload.areaId);
          masters.customers = [...otherCustomers, ...res.customers].sort(
            (a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || '')
          );
        } else {
          masters.customers = res.customers;
        }
        await AsyncStorage.setItem(KEYS.MASTERS, JSON.stringify(masters));
        return masters.customers;
      }
      return masters.customers || [];
    } catch (e) {
      console.warn('Failed to reorder customers on backend, updating locally:', e);
      const masters = await this.getMasters();
      let customers = [...(masters.customers || [])];

      if (payload.customerIds && Array.isArray(payload.customerIds)) {
        const idToSeq = {};
        payload.customerIds.forEach((id, idx) => {
          idToSeq[id] = idx + 1;
        });
        customers = customers.map(c => {
          if (idToSeq[c.id] !== undefined) {
            return { ...c, sequence: idToSeq[c.id] };
          }
          return c;
        });
      } else if (payload.items && Array.isArray(payload.items)) {
        const idToSeq = {};
        payload.items.forEach(item => {
          if (item.id) idToSeq[item.id] = Number(item.sequence) || 0;
        });
        customers = customers.map(c => {
          if (idToSeq[c.id] !== undefined) {
            return { ...c, sequence: idToSeq[c.id] };
          }
          return c;
        });
      }

      customers.sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.name || '').localeCompare(b.name || ''));
      masters.customers = customers;
      await this.saveMasters(masters);
      return masters.customers;
    }
  },

  async deleteCustomer(customerId) {
    try {
      await apiService.deleteCustomer(customerId);
      const masters = await this.getMasters();
      return masters.customers || [];
    } catch (e) {
      console.warn('Failed to delete customer on backend, updating locally:', e);
      const masters = await this.getMasters();
      masters.customers = (masters.customers || []).filter(c => c.id !== customerId);
      await this.saveMasters(masters);
      return masters.customers;
    }
  },

  // Areas helpers
  async saveArea(areaData) {
    try {
      await apiService.saveArea(areaData);
      const masters = await this.getMasters();
      return masters.areas || [];
    } catch (e) {
      console.warn('Failed to save area on backend, updating locally:', e);
      const masters = await this.getMasters();
      let areas = [...(masters.areas || [])];
      if (areaData.id) {
        const index = areas.findIndex(a => a.id === areaData.id);
        if (index >= 0) {
          areas[index] = { ...areas[index], ...areaData };
        } else {
          areas.push(areaData);
        }
      } else {
        areas.push({ ...areaData, id: `area-${Date.now()}` });
      }
      masters.areas = areas;
      await this.saveMasters(masters);
      return masters.areas;
    }
  },

  async deleteArea(areaId) {
    try {
      await apiService.deleteArea(areaId);
      const masters = await this.getMasters();
      return masters.areas || [];
    } catch (e) {
      console.warn('Failed to delete area on backend, updating locally:', e);
      const masters = await this.getMasters();
      masters.areas = (masters.areas || []).filter(a => a.id !== areaId);
      await this.saveMasters(masters);
      return masters.areas;
    }
  },

  // Users helpers
  async saveUser(userData) {
    try {
      await apiService.saveUser(userData);
      const masters = await this.getMasters();
      return masters.users || [];
    } catch (e) {
      console.warn('Failed to save user on backend, updating locally:', e);
      const masters = await this.getMasters();
      let users = [...(masters.users || [])];
      if (userData.id) {
        const index = users.findIndex(u => u.id === userData.id || (userData.name && u.name === userData.name));
        if (index >= 0) {
          users[index] = { ...users[index], ...userData };
        } else {
          users.push(userData);
        }
      } else {
        const slug = (userData.name || 'staff').toLowerCase().replace(/[^a-z0-9]/g, '_');
        users.push({ ...userData, id: `user_${slug}_${Date.now().toString().slice(-4)}` });
      }
      masters.users = users;
      await this.saveMasters(masters);
      return masters.users;
    }
  },

  async deleteUser(userId) {
    try {
      await apiService.deleteUser(userId);
      const masters = await this.getMasters();
      return masters.users || [];
    } catch (e) {
      console.warn('Failed to delete user on backend, updating locally:', e);
      const masters = await this.getMasters();
      masters.users = (masters.users || []).filter(u => u.id !== userId && u.username !== userId);
      await this.saveMasters(masters);
      return masters.users;
    }
  },

  // Deliveries helpers
  async getDeliveries(filters = {}) {
    try {
      const live = await apiService.getDeliveries(filters);
      if (Array.isArray(live)) {
        await AsyncStorage.setItem(KEYS.DELIVERIES, JSON.stringify(live));
        return live;
      }
    } catch (e) {
      // Backend unavailable, fallback to cache
    }

    try {
      const data = await AsyncStorage.getItem(KEYS.DELIVERIES);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async saveDeliveriesBatch(batchPayload) {
    try {
      const result = await apiService.saveDeliveriesBatch(batchPayload);
      const updated = await this.getDeliveries();
      return { success: true, count: result.count || (Array.isArray(batchPayload) ? batchPayload.length : batchPayload.entries?.length || 0), updated };
    } catch (e) {
      console.warn('Error saving deliveries batch to backend, saving to local cache:', e);
      const newDeliveries = Array.isArray(batchPayload) ? batchPayload : (batchPayload.entries || []);
      let existing = await this.getDeliveries();
      const newKeys = new Set(newDeliveries.map(d => `${d.customerId}_${d.date}_${d.shift}`));
      existing = existing.filter(d => !newKeys.has(`${d.customerId}_${d.date}_${d.shift}`));

      const validNew = newDeliveries.filter(d => Number(d.qty) > 0);
      const updated = [...existing, ...validNew];
      await AsyncStorage.setItem(KEYS.DELIVERIES, JSON.stringify(updated));
      return { success: true, count: validNew.length, updated };
    }
  },

  async getDeliveriesForDateAndShift(dateStr, shift) {
    return this.getDeliveries({ date: dateStr, shift });
  },

  async getMonthlySummary(yearMonthStr, areaId = 'all') {
    try {
      const summary = await apiService.getMonthlySummary(yearMonthStr, areaId);
      if (summary) return summary;
    } catch (e) {
      console.warn('Backend error in getMonthlySummary, calculating locally:', e);
    }

    // Local fallback calculation
    const all = await this.getDeliveries();
    const masters = await this.getMasters();
    const customers = (masters.customers || []).filter(c => areaId === 'all' || c.areaId === areaId);

    const monthDeliveries = all.filter(d => d.date && d.date.startsWith(yearMonthStr));

    const customerMap = {};
    customers.forEach(c => {
      customerMap[c.id] = {
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        areaId: c.areaId,
        totalMilk: 0,
        totalAmount: 0,
        deliveryCount: 0,
        entries: [],
      };
    });

    monthDeliveries.forEach(del => {
      if (!customerMap[del.customerId]) {
        customerMap[del.customerId] = {
          customerId: del.customerId,
          customerName: del.customerName || 'Customer',
          phone: '',
          areaId: del.areaId || 'area-1',
          totalMilk: 0,
          totalAmount: 0,
          deliveryCount: 0,
          entries: [],
        };
      }
      const item = customerMap[del.customerId];
      item.totalMilk += Number(del.qty || 0);
      item.totalAmount += Number(del.amount || 0);
      item.deliveryCount += 1;
      item.entries.push(del);
    });

    const customerSummaries = Object.values(customerMap)
      .map(c => ({
        ...c,
        totalMilk: Number(c.totalMilk.toFixed(2)),
        totalAmount: Math.round(c.totalAmount),
      }))
      .sort((a, b) => b.totalMilk - a.totalMilk);

    const grandTotalMilk = customerSummaries.reduce((sum, c) => sum + c.totalMilk, 0);
    const grandTotalAmount = customerSummaries.reduce((sum, c) => sum + c.totalAmount, 0);
    const activeCustomersCount = customerSummaries.filter(c => c.totalMilk > 0).length || customerSummaries.length;

    return {
      month: yearMonthStr,
      totalCustomers: activeCustomersCount,
      totalMilk: Number(grandTotalMilk.toFixed(2)),
      totalAmount: grandTotalAmount,
      customerSummaries,
    };
  },

  async getCustomerMonthlyBill(customerId, yearMonthStr) {
    try {
      const bill = await apiService.getCustomerMonthlyBill(customerId, yearMonthStr);
      if (bill) return bill;
    } catch (e) {
      console.warn('Backend error in getCustomerMonthlyBill, calculating locally:', e);
    }

    const all = await this.getDeliveries();
    const masters = await this.getMasters();
    const customer = (masters.customers || []).find(c => c.id === customerId);

    const entries = all
      .filter(d => d.customerId === customerId && d.date && d.date.startsWith(yearMonthStr))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalMilk = entries.reduce((sum, e) => sum + Number(e.qty || 0), 0);
    const totalAmount = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      customer: customer || { id: customerId, name: 'Customer', phone: '+91 98765 43210' },
      month: yearMonthStr,
      entries,
      totalMilk: Number(totalMilk.toFixed(2)),
      totalAmount: Math.round(totalAmount),
    };
  },

  // Auth User
  async getCurrentUser() {
    try {
      const user = await AsyncStorage.getItem(KEYS.CURRENT_USER);
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },

  async setCurrentUser(user) {
    try {
      if (user) {
        await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(KEYS.CURRENT_USER);
      }
    } catch (e) {
      console.error('Error saving user:', e);
    }
  },
};
