import { Platform, Linking } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatMilkQty } from '../utils/formatUtils';
import { formatYearMonth } from '../utils/dateUtils';

/**
 * Builds the complete daily matrix data structure for monthly area-wise reporting.
 */
export const buildMonthlyMatrixData = ({
  month,
  selectedAreaId = 'all',
  selectedCustomerIds = null, // Set or Array of selected customer IDs (if null/empty, all active are selected)
  deliveries = [],
  masters = {},
}) => {
  const [yearStr, monthStr] = (month || new Date().toISOString().slice(0, 7)).split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const dayLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const allAreas = masters?.areas || [];
  const relevantAreas = selectedAreaId === 'all'
    ? allAreas
    : allAreas.filter(a => a.id === selectedAreaId);

  // If specific area selected but not found in masters, create fallback entry
  if (relevantAreas.length === 0 && selectedAreaId !== 'all') {
    relevantAreas.push({
      id: selectedAreaId,
      name: selectedAreaId.toUpperCase(),
      shortName: selectedAreaId,
    });
  }

  const allCustomers = masters?.customers || [];
  const activeCustomers = allCustomers.filter(c => c.active !== false);

  // Filter customers by area
  const areaCustomersMap = {};
  relevantAreas.forEach(a => {
    areaCustomersMap[a.id] = [];
  });

  const defaultAreaId = relevantAreas[0]?.id || 'area-1';

  // Map month deliveries: customerId -> { dateStr: totalQty }
  const monthDeliveries = (deliveries || []).filter(
    d => d && d.date && d.date.startsWith(month)
  );

  const customerDailyMap = {};
  monthDeliveries.forEach(del => {
    const custId = del.customerId;
    if (!custId) return;
    if (!customerDailyMap[custId]) customerDailyMap[custId] = {};
    const cur = customerDailyMap[custId][del.date] || 0;
    customerDailyMap[custId][del.date] = Math.round((cur + Number(del.qty || 0)) * 100) / 100;
  });

  const isSelected = (custId) => {
    if (!selectedCustomerIds) return true;
    if (selectedCustomerIds instanceof Set) return selectedCustomerIds.has(custId);
    if (Array.isArray(selectedCustomerIds)) return selectedCustomerIds.includes(custId);
    return true;
  };

  // Assign customers to areas and calculate daily quantities
  activeCustomers.forEach(cust => {
    const matchesArea = selectedAreaId === 'all' || cust.areaId === selectedAreaId;
    if (!matchesArea) return;
    if (!isSelected(cust.id)) return;

    const targetAreaId = cust.areaId && areaCustomersMap[cust.areaId] ? cust.areaId : defaultAreaId;
    if (!areaCustomersMap[targetAreaId]) {
      areaCustomersMap[targetAreaId] = [];
    }

    const dailyQuantities = [];
    let custTotalMilk = 0;
    const custDays = customerDailyMap[cust.id] || {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${month}-${dayStr}`;
      const qty = custDays[dateKey] || 0;
      dailyQuantities.push(qty);
      custTotalMilk += qty;
    }

    custTotalMilk = Math.round(custTotalMilk * 100) / 100;
    const rate = Number(cust.pricePerLiter) || Number(masters?.milkRatePerLiter) || 60;
    const custTotalAmount = Math.round(custTotalMilk * rate);

    areaCustomersMap[targetAreaId].push({
      customerId: cust.id,
      customerName: cust.name,
      phone: cust.phone || '',
      areaId: cust.areaId || targetAreaId,
      sequence: cust.sequence || 0,
      pricePerLiter: rate,
      dailyQuantities,
      totalMilk: custTotalMilk,
      totalAmount: custTotalAmount,
    });
  });

  // Calculate area totals and grand totals
  const grandDayTotals = Array(daysInMonth).fill(0);
  let grandTotalMilk = 0;
  let grandTotalAmount = 0;
  let grandTotalCustomers = 0;

  const populatedAreas = relevantAreas.map(area => {
    const custs = areaCustomersMap[area.id] || [];
    custs.sort(
      (a, b) =>
        (a.sequence || 0) - (b.sequence || 0) ||
        (a.customerName || '').localeCompare(b.customerName || '')
    );

    const dayTotals = Array(daysInMonth).fill(0);
    let areaTotalMilk = 0;
    let areaTotalAmount = 0;

    custs.forEach(c => {
      c.dailyQuantities.forEach((qty, idx) => {
        dayTotals[idx] += qty;
        grandDayTotals[idx] += qty;
      });
      areaTotalMilk += c.totalMilk;
      areaTotalAmount += c.totalAmount;
    });

    areaTotalMilk = Math.round(areaTotalMilk * 100) / 100;
    grandTotalMilk += areaTotalMilk;
    grandTotalAmount += areaTotalAmount;
    grandTotalCustomers += custs.length;

    return {
      areaId: area.id,
      areaName: area.name,
      shortName: area.shortName || area.name,
      customers: custs,
      dayTotals: dayTotals.map(v => Math.round(v * 100) / 100),
      totalMilk: areaTotalMilk,
      totalAmount: areaTotalAmount,
      customerCount: custs.length,
    };
  }).filter(a => selectedAreaId !== 'all' || a.customerCount > 0);

  const selectedAreaObj = allAreas.find(a => a.id === selectedAreaId);
  const areaLabel = selectedAreaId === 'all'
    ? 'All Areas'
    : selectedAreaObj?.name || selectedAreaId.toUpperCase();

  return {
    month,
    monthLabel: formatYearMonth(month),
    daysInMonth,
    dayLabels,
    selectedAreaId,
    areaLabel,
    areas: populatedAreas,
    grandTotals: {
      dayTotals: grandDayTotals.map(v => Math.round(v * 100) / 100),
      totalMilk: Math.round(grandTotalMilk * 100) / 100,
      totalAmount: grandTotalAmount,
      totalCustomers: grandTotalCustomers,
    },
  };
};

/**
 * Generates landscape HTML report markup formatted for A4 Horizontal printing & PDF.
 */
export const generateLandscapeHtml = (matrixData) => {
  const {
    monthLabel,
    areaLabel,
    daysInMonth,
    dayLabels,
    areas,
    grandTotals,
  } = matrixData;

  const totalCols = 2 + daysInMonth + 2;

  let rowsHtml = '';
  let globalIndex = 1;

  areas.forEach(area => {
    // Area Header Banner
    rowsHtml += `
      <tr class="area-header-row">
        <td colspan="${totalCols}">
          📍 <strong>${area.areaName}</strong> &nbsp;•&nbsp; ${area.customers.length} Customers &nbsp;•&nbsp; Area Total: <strong>${formatMilkQty(area.totalMilk)} L</strong> &nbsp;•&nbsp; <strong>${area.totalAmount.toLocaleString('en-IN')}</strong>
        </td>
      </tr>
    `;

    // Customer Rows
    area.customers.forEach((cust, idx) => {
      const isAlt = idx % 2 === 1;
      let dayCells = '';
      cust.dailyQuantities.forEach(q => {
        if (q > 0) {
          dayCells += `<td class="day-val">${formatMilkQty(q)}</td>`;
        } else {
          dayCells += `<td class="day-empty">-</td>`;
        }
      });

      rowsHtml += `
        <tr class="${isAlt ? 'row-alt' : 'row-even'}">
          <td class="col-sno">${cust.sequence || globalIndex++}</td>
          <td class="col-name">${cust.customerName}</td>
          ${dayCells}
          <td class="col-total">${formatMilkQty(cust.totalMilk)}</td>
          <td class="col-amount">${cust.totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      `;
    });

    // Area Subtotal Row
    let areaDayCells = '';
    area.dayTotals.forEach(q => {
      areaDayCells += `<td>${q > 0 ? formatMilkQty(q) : '-'}</td>`;
    });

    rowsHtml += `
      <tr class="area-subtotal-row">
        <td></td>
        <td style="text-align: left; font-weight: bold;">TOTAL - ${area.shortName || area.areaName}</td>
        ${areaDayCells}
        <td class="col-total">${formatMilkQty(area.totalMilk)}</td>
        <td class="col-amount">${area.totalAmount.toLocaleString('en-IN')}</td>
      </tr>
    `;
  });

  // Grand Total Row
  let grandDayCells = '';
  grandTotals.dayTotals.forEach(q => {
    grandDayCells += `<td>${q > 0 ? formatMilkQty(q) : '-'}</td>`;
  });

  rowsHtml += `
    <tr class="grand-total-row">
      <td></td>
      <td style="text-align: left; font-weight: 900;">OVERALL GRAND TOTAL</td>
      ${grandDayCells}
      <td class="col-total">${formatMilkQty(grandTotals.totalMilk)}</td>
      <td class="col-amount">${grandTotals.totalAmount.toLocaleString('en-IN')}</td>
    </tr>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aanira Milk - Monthly Area-Wise Summary - ${monthLabel}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 6mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1E293B;
      padding-bottom: 5px;
      margin-bottom: 6px;
    }
    .brand-title {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .brand-sub {
      font-size: 7.5px;
      color: #64748B;
      margin-top: 2px;
    }
    .report-meta {
      text-align: right;
    }
    .report-title {
      font-size: 11px;
      font-weight: 800;
      color: #0F172A;
      margin: 0;
    }
    .report-badge {
      font-size: 8.5px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 7px;
    }
    th, td {
      border: 0.5px solid #CBD5E1;
      padding: 2.5px 0.5px;
      text-align: center;
      white-space: nowrap;
    }
    th {
      background-color: #1E293B;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 7.5px;
      padding: 3.5px 1px;
    }
    .col-sno { width: 20px; font-weight: 600; }
    .col-name { width: 105px; text-align: left; padding-left: 4px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
    .col-total { width: 46px; text-align: right; padding-right: 4px; font-weight: 800; }
    .col-amount { width: 52px; text-align: right; padding-right: 4px; font-weight: 800; }
    .day-val { font-weight: 600; color: #0F172A; font-size: 7px; }
    .day-empty { color: #CBD5E1; }
    .area-header-row td {
      background-color: #F1F5F9;
      color: #0F172A;
      font-weight: 800;
      text-align: left;
      padding: 3.5px 5px;
      font-size: 8px;
    }
    .row-even { background-color: #FFFFFF; }
    .row-alt { background-color: #F8FAFC; }
    .area-subtotal-row td {
      background-color: #E2E8F0;
      color: #0F172A;
      font-weight: 800;
      font-size: 7.5px;
    }
    .grand-total-row td {
      background-color: #1E293B;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 8px;
      padding: 4px 1px;
    }
    .footer-box {
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5px;
      color: #64748B;
      border-top: 1px solid #CBD5E1;
      padding-top: 3px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1 class="brand-title">AANIRA MILK & MILK PRODUCTS</h1>
      <div class="brand-sub">Fresh Milk • Healthy Family | Kovaipudur, Coimbatore | Phone: +91 88832 66445 / +91 97901 66445</div>
    </div>
    <div class="report-meta">
      <h2 class="report-title">MONTHLY AREA-WISE CUSTOMER SUMMARY</h2>
      <div class="report-badge">Billing Month: ${monthLabel} &nbsp;|&nbsp; Area: ${areaLabel} &nbsp;|&nbsp; Customers: ${grandTotals.totalCustomers}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-sno">#</th>
        <th class="col-name">Customer Name</th>
        ${dayLabels.map(d => `<th>${d}</th>`).join('')}
        <th class="col-total">Total (L)</th>
        <th class="col-amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer-box">
    <div>Aanira Milk & Milk Products • Kovaipudur, Coimbatore • Support: +91 88832 66445 / +91 97901 66445</div>
    <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Loads jsPDF dynamically in the browser (web-only) from official CDN
 * so Metro bundler never tries to bundle it statically.
 */
let webJsPdfPromise = null;
const loadWebJsPdf = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return Promise.resolve(null);
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf);
  if (webJsPdfPromise) return webJsPdfPromise;

  webJsPdfPromise = new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        const tableScript = document.createElement('script');
        tableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        tableScript.onload = () => resolve(window.jspdf || null);
        tableScript.onerror = () => resolve(window.jspdf || null);
        document.head.appendChild(tableScript);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    } catch (e) {
      resolve(null);
    }
  });

  return webJsPdfPromise;
};

/**
 * Generates landscape PDF via jsPDF if available in browser.
 */
const generateWebLandscapePdfDoc = async (matrixData) => {
  const jspdfModule = await loadWebJsPdf();
  if (!jspdfModule || !jspdfModule.jsPDF) return null;

  const { jsPDF } = jspdfModule;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const {
    monthLabel,
    areaLabel,
    daysInMonth,
    dayLabels,
    areas,
    grandTotals,
  } = matrixData;

  const totalCols = 1 + 1 + daysInMonth + 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Clean dark charcoal (NO blue)
  doc.text('AANIRA MILK & MILK PRODUCTS', 6, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Fresh Milk • Healthy Family | Kovaipudur, Coimbatore | Phone: +91 88832 66445 / +91 97901 66445', 6, 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('MONTHLY AREA-WISE CUSTOMER DELIVERY SUMMARY', 291, 10, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Billing Month: ${monthLabel} | Area: ${areaLabel} | Customers: ${grandTotals.totalCustomers}`, 291, 14.5, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(6, 16.5, 291, 16.5);

  const headRow = ['#', 'Customer Name'];
  dayLabels.forEach(d => headRow.push(d));
  headRow.push('Total (L)');
  headRow.push('Amount');

  const bodyRows = [];
  const areaSubtotalIndices = new Set();
  const grandTotalIndices = new Set();
  const areaHeaderIndices = new Set();
  let globalCustIdx = 1;

  areas.forEach(area => {
    areaHeaderIndices.add(bodyRows.length);
    bodyRows.push([
      {
        content: ` ${area.areaName} (${area.customers.length} Customers • ${formatMilkQty(area.totalMilk)} L • ${area.totalAmount.toLocaleString('en-IN')})`,
        colSpan: totalCols,
        styles: {
          halign: 'left',
          fontStyle: 'bold',
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontSize: 6.8,
          cellPadding: 1,
        },
      },
    ]);

    area.customers.forEach(cust => {
      const row = [
        String(cust.sequence || globalCustIdx++),
        cust.customerName,
      ];
      cust.dailyQuantities.forEach(q => {
        row.push(q > 0 ? formatMilkQty(q) : '-');
      });
      row.push(formatMilkQty(cust.totalMilk));
      row.push(cust.totalAmount.toLocaleString('en-IN'));
      bodyRows.push(row);
    });

    areaSubtotalIndices.add(bodyRows.length);
    const subtotalRow = ['', `TOTAL - ${area.shortName || area.areaName}`];
    area.dayTotals.forEach(q => subtotalRow.push(q > 0 ? formatMilkQty(q) : '-'));
    subtotalRow.push(formatMilkQty(area.totalMilk));
    subtotalRow.push(area.totalAmount.toLocaleString('en-IN'));
    bodyRows.push(subtotalRow);
  });

  grandTotalIndices.add(bodyRows.length);
  const grandTotalRow = ['', 'OVERALL GRAND TOTAL'];
  grandTotals.dayTotals.forEach(q => grandTotalRow.push(q > 0 ? formatMilkQty(q) : '-'));
  grandTotalRow.push(formatMilkQty(grandTotals.totalMilk));
  grandTotalRow.push(grandTotals.totalAmount.toLocaleString('en-IN'));
  bodyRows.push(grandTotalRow);

  // Column width calculations for A4 Landscape (Printable width 285mm with 6mm margins)
  // Non-day columns = 6 + 28 + 14 + 16 = 64mm
  // Remaining = 285 - 64 = 221mm (7.13mm for 31 days)
  const dayColWidth = Math.max(6.5, (221 / daysInMonth));
  const columnStyles = {
    0: { cellWidth: 6, halign: 'center' },
    1: { cellWidth: 28, halign: 'left', fontStyle: 'bold' },
  };
  for (let i = 1; i <= daysInMonth; i++) {
    columnStyles[i + 1] = { cellWidth: dayColWidth, halign: 'center' };
  }
  columnStyles[daysInMonth + 2] = { cellWidth: 14, halign: 'right', fontStyle: 'bold' };
  columnStyles[daysInMonth + 3] = { cellWidth: 16, halign: 'right', fontStyle: 'bold' };

  if (doc.autoTable) {
    doc.autoTable({
      head: [headRow],
      body: bodyRows,
      startY: 18,
      theme: 'grid',
      styles: {
        fontSize: 5.2,
        cellPadding: { top: 0.8, bottom: 0.8, left: 0.2, right: 0.2 },
        overflow: 'visible',
        valign: 'middle',
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59], // Dark slate #1E293B (NO blue)
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 5.8,
        halign: 'center',
      },
      columnStyles,
      didParseCell: (data) => {
        const idx = data.row.index;
        if (areaHeaderIndices.has(idx)) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [15, 23, 42];
          data.cell.styles.fontStyle = 'bold';
        } else if (areaSubtotalIndices.has(idx)) {
          data.cell.styles.fillColor = [226, 232, 240]; // Neutral light gray (NO blue)
          data.cell.styles.textColor = [15, 23, 42];
          data.cell.styles.fontStyle = 'bold';
        } else if (grandTotalIndices.has(idx)) {
          data.cell.styles.fillColor = [30, 41, 59]; // Dark neutral slate (NO blue)
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { top: 18, left: 6, right: 6, bottom: 8 },
    });
  }

  return doc;
};

/**
 * Downloads the landscape PDF file across Web and Mobile.
 */
export const downloadLandscapePdf = async ({ matrixData, filename }) => {
  const safeFilename = filename || `Aanira_Monthly_Summary_${matrixData.month}_${matrixData.selectedAreaId || 'All'}.pdf`;

  if (Platform.OS === 'web') {
    try {
      const doc = await generateWebLandscapePdfDoc(matrixData);
      if (doc && doc.save) {
        doc.save(safeFilename);
        return { success: true, method: 'direct_download', filename: safeFilename };
      }
    } catch (err) {
      console.warn('Web jsPDF download failed, using print/save fallback:', err);
    }

    // Direct browser landscape print / Save to PDF
    await printLandscapeReport(matrixData);
    return { success: true, method: 'browser_print_save', filename: safeFilename };
  }

  // Mobile (Android / iOS): Use Expo-Print to create PDF file and Expo-Sharing to save/download
  try {
    const html = generateLandscapeHtml(matrixData);
    const { uri } = await Print.printToFileAsync({
      html,
      width: 842,
      height: 595,
    });

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download / Save Monthly Summary PDF',
        UTI: 'com.adobe.pdf',
      });
      return { success: true, method: 'mobile_share', uri, filename: safeFilename };
    }

    return { success: true, method: 'mobile_print', uri, filename: safeFilename };
  } catch (err) {
    console.error('Error generating/downloading PDF on mobile:', err);
    throw err;
  }
};

/**
 * Generates formatted WhatsApp summary text with details and totals.
 */
export const generateWhatsAppSummaryText = (matrixData) => {
  const {
    monthLabel,
    areaLabel,
    areas,
    grandTotals,
  } = matrixData;

  const areaLines = areas.map(
    a => `• *${a.shortName || a.areaName}:* ${formatMilkQty(a.totalMilk)}L - Rs. ${a.totalAmount.toLocaleString('en-IN')} (${a.customers.length} cust)`
  ).join('\n');

  return `🥛 *AANIRA MILK & MILK PRODUCTS* 🥛
📍 *Kovaipudur, Coimbatore*
_Fresh Milk • Healthy Family_
━━━━━━━━━━━━━━━━━━━━━━━━
📋 *MONTHLY AREA-WISE DELIVERY SUMMARY*
📅 *Period:* ${monthLabel}
📍 *Area Filter:* ${areaLabel}
👥 *Total Customers:* ${grandTotals.totalCustomers}
━━━━━━━━━━━━━━━━━━━━━━━━
📊 *SUMMARY TOTALS:*
🥛 *Total Milk Supplied:* ${formatMilkQty(grandTotals.totalMilk)} Litres
💰 *GRAND TOTAL AMOUNT:* Rs. ${grandTotals.totalAmount.toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━━━━━
📍 *Area-Wise Breakdown:*
${areaLines}
━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Payment Methods:*
• GPay / PhonePe: +91 88832 66445 / +91 97901 66445
• Cash on Delivery

🙏 _Thank you for choosing Aanira Milk!_`;
};

/**
 * Shares the PDF and summary through WhatsApp across Web and Mobile.
 */
export const shareSummaryViaWhatsApp = async ({ matrixData, filename, targetPhone = '' }) => {
  const safeFilename = filename || `Aanira_Monthly_Summary_${matrixData.month}.pdf`;
  const summaryText = generateWhatsAppSummaryText(matrixData);
  const cleanPhone = (targetPhone || '').replace(/[^0-9]/g, '');
  const phoneParam = cleanPhone.length >= 10
    ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`)
    : '';

  const encodedText = encodeURIComponent(summaryText);
  const webWhatsappUrl = phoneParam
    ? `https://web.whatsapp.com/send?phone=${phoneParam}&text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
  const mobileWhatsappUrl = phoneParam
    ? `whatsapp://send?phone=${phoneParam}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;
  const universalUrl = phoneParam
    ? `https://wa.me/${phoneParam}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  if (Platform.OS === 'web') {
    let pdfBlob = null;
    let pdfFile = null;

    try {
      const doc = await generateWebLandscapePdfDoc(matrixData);
      if (doc) {
        pdfBlob = doc.output('blob');
        if (typeof File !== 'undefined' && pdfBlob) {
          pdfFile = new File([pdfBlob], safeFilename, { type: 'application/pdf' });
        }
      }
    } catch (e) {
      console.warn('Error generating PDF blob for web share:', e);
    }

    // 1. If Web Share API with File attachment is supported (Mobile browsers, macOS Safari, Windows Edge)
    if (pdfFile && typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            files: [pdfFile],
            title: 'Aanira Milk Monthly Summary',
            text: summaryText,
          });
          return {
            success: true,
            method: 'web_share_api_file',
            filename: safeFilename,
            message: 'PDF file and summary shared successfully!',
          };
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return { success: true, method: 'user_cancelled' };
        }
        console.warn('Web Share API with file failed, falling back to download + web whatsapp:', err);
      }
    }

    // 2. Desktop Browsers: Automatically download the PDF file so user has it ready
    try {
      if (pdfBlob) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (e) {
      console.warn('PDF download before WhatsApp share failed:', e);
    }

    // 3. Open WhatsApp Web or wa.me with the full formatted summary
    if (typeof window !== 'undefined') {
      window.open(webWhatsappUrl, '_blank') || window.open(universalUrl, '_blank');
    }

    return {
      success: true,
      method: 'web_whatsapp_download_and_open',
      filename: safeFilename,
      message: 'PDF downloaded! WhatsApp Web opened with complete summary.',
    };
  }

  // Mobile: Generate PDF file and invoke native share dialog with WhatsApp option
  try {
    const html = generateLandscapeHtml(matrixData);
    const { uri } = await Print.printToFileAsync({
      html,
      width: 842,
      height: 595,
    });

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Monthly Summary PDF via WhatsApp',
        UTI: 'com.adobe.pdf',
      });
      return { success: true, method: 'mobile_share_pdf', uri };
    }

    // Fallback if sharing unavailable
    const canOpen = await Linking.canOpenURL(mobileWhatsappUrl);
    if (canOpen) {
      await Linking.openURL(mobileWhatsappUrl);
    } else {
      await Linking.openURL(universalUrl);
    }
    return { success: true, method: 'mobile_link' };
  } catch (err) {
    console.error('Error sharing through WhatsApp:', err);
    throw err;
  }
};

/**
 * Triggers native landscape printing.
 */
export const printLandscapeReport = async (matrixData) => {
  const html = generateLandscapeHtml(matrixData);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
        return { success: true };
      }
    }
  }

  // Mobile
  await Print.printAsync({
    html,
    orientation: Print.Orientation.landscape,
  });
  return { success: true };
};
