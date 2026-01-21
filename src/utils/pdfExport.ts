import html2pdf from 'html2pdf.js'
import { format } from 'date-fns'
import { InventoryReportData, ReportFilters } from '../types/reportTypes'
import { formatCurrency } from './formatters'
import { WEIGHT_UNIT } from './units'

interface PDFExportOptions {
  reportData: InventoryReportData
  filters: ReportFilters
  canvasRefs: {
    stockLevelChart: HTMLCanvasElement | null
    categoryDistributionChart: HTMLCanvasElement | null
    inventoryValueChart: HTMLCanvasElement | null
    lowStockAlertChart: HTMLCanvasElement | null
    inventoryTrendChart: HTMLCanvasElement | null
    salesByPricingTierChart: HTMLCanvasElement | null
  }
  companyName?: string
}

export const exportInventoryReportToPDF = async (options: PDFExportOptions) => {
  const { reportData, filters, canvasRefs, companyName = 'Your Company' } = options

  // Convert canvas elements to base64 images
  const getImageFromCanvas = (canvas: HTMLCanvasElement | null): string => {
    if (!canvas) return ''
    return canvas.toDataURL('image/png')
  }

  const chartImages = {
    stockLevel: getImageFromCanvas(canvasRefs.stockLevelChart),
    categoryDistribution: getImageFromCanvas(canvasRefs.categoryDistributionChart),
    inventoryValue: getImageFromCanvas(canvasRefs.inventoryValueChart),
    lowStockAlert: getImageFromCanvas(canvasRefs.lowStockAlertChart),
    inventoryTrend: getImageFromCanvas(canvasRefs.inventoryTrendChart),
    salesByTier: getImageFromCanvas(canvasRefs.salesByPricingTierChart)
  }

  // Build HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #DC2626;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #DC2626;
          margin: 0 0 10px 0;
        }
        .header p {
          color: #666;
          margin: 5px 0;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        .summary-card {
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          padding: 15px;
          background: #F9FAFB;
        }
        .summary-card h3 {
          margin: 0 0 5px 0;
          font-size: 14px;
          color: #6B7280;
        }
        .summary-card p {
          margin: 0;
          font-size: 24px;
          font-weight: bold;
          color: #111827;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section h2 {
          color: #DC2626;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .chart-container {
          text-align: center;
          margin: 20px 0;
        }
        .chart-container img {
          max-width: 100%;
          height: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        table th {
          background: #F3F4F6;
          padding: 10px;
          text-align: left;
          border-bottom: 2px solid #E5E7EB;
          font-weight: 600;
        }
        table td {
          padding: 10px;
          border-bottom: 1px solid #E5E7EB;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-critical {
          background: #FEE2E2;
          color: #991B1B;
        }
        .status-warning {
          background: #FEF3C7;
          color: #92400E;
        }
        .status-low {
          background: #FFEDD5;
          color: #9A3412;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
          color: #6B7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <h1>${companyName}</h1>
        <h2>Inventory Analysis Report</h2>
        <p>Report Period: ${format(filters.startDate, 'MMMM dd, yyyy')} - ${format(filters.endDate, 'MMMM dd, yyyy')}</p>
        <p>Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
      </div>

      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <h3>Total Products</h3>
          <p>${reportData.totalProducts}</p>
        </div>
        <div class="summary-card">
          <h3>Total Value</h3>
          <p>${formatCurrency(reportData.totalValue)}</p>
        </div>
        <div class="summary-card">
          <h3>Low Stock Items</h3>
          <p>${reportData.lowStockCount}</p>
        </div>
        <div class="summary-card">
          <h3>Out of Stock</h3>
          <p>${reportData.outOfStockCount}</p>
        </div>
      </div>

      <!-- Stock Level Chart -->
      ${chartImages.stockLevel ? `
      <div class="section">
        <h2>Current Stock Levels</h2>
        <div class="chart-container">
          <img src="${chartImages.stockLevel}" alt="Stock Levels Chart" />
        </div>
      </div>
      ` : ''}

      <!-- Category Distribution -->
      ${chartImages.categoryDistribution ? `
      <div class="section">
        <h2>Category Distribution</h2>
        <div class="chart-container">
          <img src="${chartImages.categoryDistribution}" alt="Category Distribution Chart" />
        </div>
      </div>
      ` : ''}

      <!-- Low Stock Alert -->
      ${chartImages.lowStockAlert ? `
      <div class="section">
        <h2>Stock Status Distribution</h2>
        <div class="chart-container">
          <img src="${chartImages.lowStockAlert}" alt="Stock Status Chart" />
        </div>
      </div>
      ` : ''}

      <!-- Inventory Value -->
      ${chartImages.inventoryValue ? `
      <div class="section">
        <h2>Inventory Value by Category</h2>
        <div class="chart-container">
          <img src="${chartImages.inventoryValue}" alt="Inventory Value Chart" />
        </div>
      </div>
      ` : ''}

      <!-- Pricing Tier Analysis -->
      ${chartImages.salesByTier ? `
      <div class="section">
        <h2>Revenue by Pricing Tier</h2>
        <div class="chart-container">
          <img src="${chartImages.salesByTier}" alt="Pricing Tier Chart" />
        </div>
      </div>
      ` : ''}

      <!-- Inventory Trend -->
      ${chartImages.inventoryTrend ? `
      <div class="section">
        <h2>Inventory Trend</h2>
        <div class="chart-container">
          <img src="${chartImages.inventoryTrend}" alt="Inventory Trend Chart" />
        </div>
      </div>
      ` : ''}

      <!-- Low Stock Table -->
      <div class="section">
        <h2>Low Stock Items Requiring Attention</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Threshold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.stockLevelData
              .filter(item => item.status !== 'adequate')
              .slice(0, 30)
              .map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.category}</td>
                  <td>${item.currentStock} ${WEIGHT_UNIT}</td>
                  <td>${item.threshold} ${WEIGHT_UNIT}</td>
                  <td>
                    <span class="status-badge status-${item.status}">
                      ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Category Breakdown Table -->
      <div class="section">
        <h2>Category Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Products</th>
              <th>Total Quantity</th>
              <th>Dealer Cash Value</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.categoryBreakdown.map(cat => `
              <tr>
                <td>${cat.categoryName}</td>
                <td>${cat.productCount}</td>
                <td>${cat.totalQuantity} ${WEIGHT_UNIT}</td>
                <td>${formatCurrency(cat.valueDealerCash)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>${companyName} - Inventory Management System</p>
        <p>This report is confidential and intended for internal use only.</p>
      </div>
    </body>
    </html>
  `

  // Create a temporary div to hold the HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  document.body.appendChild(tempDiv)

  // PDF options
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `inventory_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }

  try {
    // Generate PDF
    await html2pdf().set(opt).from(tempDiv).save()
  } finally {
    // Clean up
    document.body.removeChild(tempDiv)
  }
}
