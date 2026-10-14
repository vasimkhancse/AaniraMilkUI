import { Platform } from 'react-native';

// In Expo/React Native, determine API host based on environment
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'https://aaniramilkapi.onrender.com/api';
  }
  if (Platform.OS === 'android') {
    // Android emulator alias for host machine localhost
    return 'https://aaniramilkapi.onrender.com/api';
  }
  // iOS simulator or default
  return 'https://aaniramilkapi.onrender.com/api';
};

export const API_BASE_URL = getBaseUrl();

async function request(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[apiService] Request failed: ${endpoint}`, error.message);
    throw error;
  }
}

export const apiService = {
  // Health & connection check
  async checkHealth() {
    return request('/health');
  },

  // Masters
  async getMasters() {
    return request('/masters');
  },

  async updateMilkRate(milkRatePerLiter) {
    return request('/masters/rate', {
      method: 'POST',
      body: JSON.stringify({ milkRatePerLiter }),
    });
  },

  async updateAreaRate(areaId, pricePerLiter) {
    return request('/customers/update-area-rate', {
      method: 'POST',
      body: JSON.stringify({ areaId, pricePerLiter }),
    });
  },

  async updateSetting(key, value) {
    return request('/masters/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  },

  // Areas
  async getAreas() {
    return request('/areas');
  },

  async saveArea(areaData) {
    return request('/areas', {
      method: 'POST',
      body: JSON.stringify(areaData),
    });
  },

  async deleteArea(id) {
    return request(`/areas/${id}`, {
      method: 'DELETE',
    });
  },

  // Users
  async getUsers() {
    return request('/users');
  },

  async saveUser(userData) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async deleteUser(id) {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Customers
  async getCustomers(areaId = null) {
    const query = areaId && areaId !== 'all' ? `?areaId=${encodeURIComponent(areaId)}` : '';
    return request(`/customers${query}`);
  },

  async getCustomer(id) {
    return request(`/customers/${id}`);
  },

  async saveCustomer(customerData) {
    if (customerData.id && !customerData.id.startsWith('cust-temp-')) {
      return request(`/customers/${customerData.id}`, {
        method: 'PUT',
        body: JSON.stringify(customerData),
      });
    }
    return request('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  },

  async deleteCustomer(id) {
    return request(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  async reorderCustomers(payload) {
    return request('/customers/reorder', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Deliveries
  async getDeliveries(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.shift) params.append('shift', filters.shift);
    if (filters.customerId) params.append('customerId', filters.customerId);
    if (filters.month) params.append('month', filters.month);
    if (filters.areaId && filters.areaId !== 'all') params.append('areaId', filters.areaId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/deliveries${qs}`);
  },

  async saveDeliveriesBatch(batchData) {
    // batchData: { entries: [...], date, shift, supplyBoyId, areaId } or array
    const payload = Array.isArray(batchData) ? { entries: batchData } : batchData;
    return request('/deliveries/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteDelivery(id) {
    return request(`/deliveries/${id}`, {
      method: 'DELETE',
    });
  },

  // Reports
  async getMonthlySummary(month, areaId = 'all') {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (areaId && areaId !== 'all') params.append('areaId', areaId);
    return request(`/reports/monthly-summary?${params.toString()}`);
  },

  async getCustomerMonthlyBill(customerId, month) {
    const params = new URLSearchParams({ customerId, month });
    return request(`/reports/customer-bill?${params.toString()}`);
  },

  // Auth
  async login(username, areaId) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, areaId }),
    });
  },
};
