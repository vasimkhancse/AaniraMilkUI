// Aanira Milk Master Defaults (Clean Schema)

export const INITIAL_MASTERS = {
  milkRatePerLiter: 60, // ₹60 per liter
  quantityPresets: [
    { label: '1/4 L', value: 0.25, display: '0.25' },
    { label: '1/2 L', value: 0.5, display: '0.5' },
    { label: '1 L', value: 1.0, display: '1' },
    { label: '1.5 L', value: 1.5, display: '1.5' },
    { label: '2 L', value: 2.0, display: '2' },
  ],
  shifts: [
    { id: 'morning', name: 'Morning', icon: 'sunny-outline', timeRange: '6:00 AM - 8:30 AM' },
    { id: 'evening', name: 'Evening', icon: 'moon-outline', timeRange: '5:00 PM - 7:30 PM' },
  ],
  areas: [
    { id: 'area-1', name: 'Area 1 - Kovaipudur North', shortName: 'Area 1' },
    { id: 'area-2', name: 'Area 2 - Kovaipudur South', shortName: 'Area 2' },
    { id: 'area-3', name: 'Area 3 - Ashram Road', shortName: 'Area 3' },
    { id: 'area-4', name: 'Area 4 - VLB Ring Road', shortName: 'Area 4' },
  ],
  users: [
    { id: 'admin', username: 'admin', name: 'Store Admin', role: 'admin', assignedArea: 'all', phone: '+91 99440 00000' },
    { id: 'ravi_sb', username: 'ravi', name: 'Ravi Kumar', role: 'supply_boy', assignedArea: 'area-1', phone: '+91 98765 43210' },
    { id: 'bala_sb', username: 'bala', name: 'Bala Murugan', role: 'supply_boy', assignedArea: 'area-2', phone: '+91 98456 12345' },
    { id: 'kumar_sb', username: 'kumar', name: 'Kumar Logan', role: 'supply_boy', assignedArea: 'area-3', phone: '+91 97890 12345' },
  ],
  customers: [],
};

// Clean empty deliveries list (all dummy seed deliveries removed)
export const generateSeedDeliveries = () => {
  return [];
};
