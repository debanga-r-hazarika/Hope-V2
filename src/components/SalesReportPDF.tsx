import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Line as SvgLine } from '@react-pdf/renderer';
import type {
  SalesSummary,
  CustomerSalesReport,
  ProductSalesReport,
  OutstandingPaymentReport,
  SalesTrendData,
} from '../types/sales-analytics';

// Professional, Corporate, Minimal Styles (matching inventory report)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#334155',
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 20,
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 40,
    objectFit: 'contain',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaContainer: {
    alignItems: 'flex-end',
  },
  subtitle: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  subtitleBold: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  periodBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  periodText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // KPI Summary Grid
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    borderLeftWidth: 3,
  },
  kpiCardGreen: {
    borderLeftColor: '#10b981',
  },
  kpiCardBlue: {
    borderLeftColor: '#3b82f6',
  },
  kpiCardAmber: {
    borderLeftColor: '#f59e0b',
  },
  kpiCardPurple: {
    borderLeftColor: '#8b5cf6',
  },
  kpiLabel: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  kpiSubtext: {
    fontSize: 6,
    color: '#64748b',
  },
  // Table Structure
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 4,
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
    paddingVertical: 6,
  },
  colHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  colText: {
    fontSize: 8,
    color: '#334155',
    paddingHorizontal: 4,
  },
  colAmount: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 8,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 10,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  alertSection: {
    marginBottom: 20,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    padding: 12,
  },
  alertHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#b91c1c',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  // Chart styles
  chartContainer: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chartTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  chartLegendItem: {
    fontSize: 7,
    color: '#64748b',
  },
  // Summary boxes
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 8,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
});

interface SalesReportPDFProps {
  summary: SalesSummary;
  customerSales: CustomerSalesReport[];
  productSales: ProductSalesReport[];
  outstandingPayments: OutstandingPaymentReport[];
  salesTrend: SalesTrendData[];
  periodLabel: string;
}

// Bar Chart Component for PDF
const BarChart = ({ data, maxValue, height = 120, width = 480, color = '#6366f1' }: {
  data: { label: string; value: number }[];
  maxValue: number;
  height?: number;
  width?: number;
  color?: string;
}) => {
  const chartHeight = height - 30; // Leave space for labels
  const barWidth = (width - 40) / data.length - 8;
  const maxBarHeight = chartHeight - 20;

  return (
    <Svg height={height} width={width}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = chartHeight - (ratio * maxBarHeight);
        return (
          <SvgLine
            key={i}
            x1="30"
            y1={y.toString()}
            x2={width.toString()}
            y2={y.toString()}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Bars */}
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * maxBarHeight;
        const x = 40 + index * (barWidth + 8);
        const y = chartHeight - barHeight;

        return (
          <View key={index}>
            <Rect
              x={x.toString()}
              y={y.toString()}
              width={barWidth.toString()}
              height={barHeight.toString()}
              fill={color}
              opacity="0.8"
            />
            {/* Value label on top of bar */}
            <Text
              x={(x + barWidth / 2).toString()}
              y={(y - 5).toString()}
              style={{
                fontSize: 6,
                fill: '#334155',
                textAnchor: 'middle',
                fontWeight: 'bold',
              }}
            >
              {item.value.toFixed(0)}
            </Text>
            {/* X-axis label */}
            <Text
              x={(x + barWidth / 2).toString()}
              y={(chartHeight + 12).toString()}
              style={{
                fontSize: 6,
                fill: '#64748b',
                textAnchor: 'middle',
              }}
            >
              {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
            </Text>
          </View>
        );
      })}
    </Svg>
  );
};

export const SalesReportPDF = ({
  summary,
  customerSales,
  productSales,
  outstandingPayments,
  salesTrend,
  periodLabel,
}: SalesReportPDFProps) => {
  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = () => {
    return new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderHeader = (subtitleSection: string) => (
    <View style={styles.header} fixed>
      <Image src="/hatvoni-logo.png" style={styles.logo} />
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Sales Analytics Report</Text>
        <Text style={styles.subtitle}>{subtitleSection}</Text>
      </View>
      <View style={styles.metaContainer}>
        <Text style={styles.subtitle}>Generated on <Text style={styles.subtitleBold}>{formatDateTime()}</Text></Text>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>{periodLabel}</Text>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Hatvoni ERP · Sales Analytics Report</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document>
      {/* PAGE 1: EXECUTIVE SUMMARY & KPIs */}
      <Page size="A4" style={styles.page}>
        {renderHeader('EXECUTIVE SUMMARY')}

        {/* KPI Cards Grid */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiCardGreen]}>
            <Text style={styles.kpiLabel}>Total Sales Value</Text>
            <Text style={styles.kpiValue}>{formatCurrency(summary.totalSalesValue)}</Text>
            <Text style={styles.kpiSubtext}>{summary.totalOrdersCount} completed orders</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardBlue]}>
            <Text style={styles.kpiLabel}>Paid Amount</Text>
            <Text style={styles.kpiValue}>{formatCurrency(summary.paidAmount)}</Text>
            <Text style={styles.kpiSubtext}>{summary.fullPaymentCount} fully paid</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiCardAmber]}>
            <Text style={styles.kpiLabel}>Outstanding</Text>
            <Text style={styles.kpiValue}>{formatCurrency(summary.pendingAmount)}</Text>
            <Text style={styles.kpiSubtext}>{summary.pendingPaymentCount + summary.partialPaymentCount} pending</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardPurple]}>
            <Text style={styles.kpiLabel}>Total Quantity</Text>
            <Text style={styles.kpiValue}>{summary.totalOrderedQuantity.toFixed(0)}</Text>
            <Text style={styles.kpiSubtext}>units ordered</Text>
          </View>
        </View>

        {/* Payment Status Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Status Breakdown</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>• Full Payment</Text>
            <Text style={styles.summaryValue}>{summary.fullPaymentCount} orders</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>• Partial Payment</Text>
            <Text style={styles.summaryValue}>{summary.partialPaymentCount} orders</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>• Pending Payment</Text>
            <Text style={styles.summaryValue}>{summary.pendingPaymentCount} orders</Text>
          </View>
        </View>

        {/* Sales Trend Chart */}
        {salesTrend.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Monthly Sales Trend</Text>
            <BarChart
              data={salesTrend.slice(-6).map(trend => {
                const monthDate = new Date(trend.month + '-01');
                const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'short' });
                return {
                  label: monthLabel,
                  value: trend.salesValue,
                };
              })}
              maxValue={Math.max(...salesTrend.map(t => t.salesValue)) * 1.1}
              color="#10b981"
            />
            <View style={styles.chartLegend}>
              <Text style={styles.chartLegendItem}>Last 6 months sales performance</Text>
              <Text style={styles.chartLegendItem}>
                Total: {formatCurrency(salesTrend.slice(-6).reduce((sum, t) => sum + t.salesValue, 0))}
              </Text>
            </View>
          </View>
        )}

        {renderFooter()}
      </Page>

      {/* PAGE 2: OUTSTANDING PAYMENTS */}
      {outstandingPayments.length > 0 && (
        <Page size="A4" style={styles.page}>
          {renderHeader('OUTSTANDING PAYMENTS ANALYSIS')}

          <View style={styles.alertSection}>
            <Text style={styles.alertHeader}>
              Critical: {outstandingPayments.length} Orders with Outstanding Payments
            </Text>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Outstanding Amount</Text>
                <Text style={[styles.summaryValue, { color: '#b91c1c' }]}>
                  {formatCurrency(outstandingPayments.reduce((sum, p) => sum + p.balancePending, 0))}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Average Days Outstanding</Text>
                <Text style={styles.summaryValue}>
                  {Math.round(outstandingPayments.reduce((sum, p) => sum + p.daysOutstanding, 0) / outstandingPayments.length)} days
                </Text>
              </View>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colHeader, { width: '20%' }]}>Customer</Text>
                <Text style={[styles.colHeader, { width: '12%' }]}>Order</Text>
                <Text style={[styles.colHeader, { width: '12%' }]}>Date</Text>
                <Text style={[styles.colHeader, { width: '18%', textAlign: 'right' }]}>Order Value</Text>
                <Text style={[styles.colHeader, { width: '18%', textAlign: 'right' }]}>Received</Text>
                <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Balance</Text>
                <Text style={[styles.colHeader, { width: '5%', textAlign: 'right' }]}>Days</Text>
              </View>
              {outstandingPayments.slice(0, 20).map((payment, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.colText, { width: '20%', fontWeight: 'bold' }]}>{payment.customerName}</Text>
                  <Text style={[styles.colText, { width: '12%' }]}>{payment.orderNumber}</Text>
                  <Text style={[styles.colText, { width: '12%' }]}>{formatDate(payment.orderDate)}</Text>
                  <Text style={[styles.colText, { width: '18%', textAlign: 'right' }]}>
                    {formatCurrency(payment.orderedItemValue)}
                  </Text>
                  <Text style={[styles.colText, { width: '18%', textAlign: 'right', color: '#16a34a' }]}>
                    {formatCurrency(payment.amountReceived)}
                  </Text>
                  <Text style={[styles.colText, styles.colAmount, { width: '15%', textAlign: 'right', color: '#b91c1c' }]}>
                    {formatCurrency(payment.balancePending)}
                  </Text>
                  <Text style={[styles.colText, { width: '5%', textAlign: 'right', fontSize: 7 }]}>
                    {payment.daysOutstanding}d
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {renderFooter()}
        </Page>
      )}

      {/* PAGE 3: CUSTOMER ANALYSIS */}
      <Page size="A4" style={styles.page}>
        {renderHeader('CUSTOMER-WISE SALES ANALYSIS')}

        {/* Top Customers Chart */}
        {customerSales.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Top 10 Customers by Sales Value</Text>
            <BarChart
              data={customerSales.slice(0, 10).map(c => ({
                label: c.customerName.length > 12 ? c.customerName.substring(0, 12) : c.customerName,
                value: c.totalOrderedValue,
              }))}
              maxValue={Math.max(...customerSales.slice(0, 10).map(c => c.totalOrderedValue)) * 1.1}
              color="#3b82f6"
            />
            <View style={styles.chartLegend}>
              <Text style={styles.chartLegendItem}>Top 10 customers represent {((customerSales.slice(0, 10).reduce((sum, c) => sum + c.totalOrderedValue, 0) / summary.totalSalesValue) * 100).toFixed(1)}% of total sales</Text>
            </View>
          </View>
        )}

        {/* Customer Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer Sales Performance</Text>
          </View>
          {customerSales.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colHeader, { width: '25%' }]}>Customer Name</Text>
                <Text style={[styles.colHeader, { width: '15%' }]}>Type</Text>
                <Text style={[styles.colHeader, { width: '10%', textAlign: 'center' }]}>Orders</Text>
                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Total Value</Text>
                <Text style={[styles.colHeader, { width: '18%', textAlign: 'right' }]}>Outstanding</Text>
                <Text style={[styles.colHeader, { width: '12%' }]}>Last Order</Text>
              </View>
              {customerSales.slice(0, 15).map((customer, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.colText, { width: '25%', fontWeight: 'bold' }]}>{customer.customerName}</Text>
                  <Text style={[styles.colText, { width: '15%' }]}>{customer.customerType}</Text>
                  <Text style={[styles.colText, { width: '10%', textAlign: 'center' }]}>{customer.totalOrders}</Text>
                  <Text style={[styles.colText, styles.colAmount, { width: '20%', textAlign: 'right' }]}>
                    {formatCurrency(customer.totalOrderedValue)}
                  </Text>
                  <Text style={[styles.colText, { width: '18%', textAlign: 'right', color: customer.outstandingAmount > 0 ? '#b91c1c' : '#16a34a' }]}>
                    {formatCurrency(customer.outstandingAmount)}
                  </Text>
                  <Text style={[styles.colText, { width: '12%' }]}>{formatDate(customer.lastOrderDate)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No customer sales data available.</Text>
          )}
        </View>

        {renderFooter()}
      </Page>

      {/* PAGE 4: PRODUCT ANALYSIS */}
      <Page size="A4" style={styles.page}>
        {renderHeader('PRODUCT-WISE SALES ANALYSIS')}

        {/* Top Products Chart */}
        {productSales.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Top 10 Products by Sales Value</Text>
            <BarChart
              data={productSales.slice(0, 10).map(p => ({
                label: p.tagName.length > 12 ? p.tagName.substring(0, 12) : p.tagName,
                value: p.totalSalesValue,
              }))}
              maxValue={Math.max(...productSales.slice(0, 10).map(p => p.totalSalesValue)) * 1.1}
              color="#8b5cf6"
            />
            <View style={styles.chartLegend}>
              <Text style={styles.chartLegendItem}>Top 10 products represent {((productSales.slice(0, 10).reduce((sum, p) => sum + p.totalSalesValue, 0) / summary.totalSalesValue) * 100).toFixed(1)}% of total sales</Text>
            </View>
          </View>
        )}

        {/* Product Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Product Sales Performance</Text>
          </View>
          {productSales.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colHeader, { width: '35%' }]}>Product Name</Text>
                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Quantity Sold</Text>
                <Text style={[styles.colHeader, { width: '25%', textAlign: 'right' }]}>Sales Value</Text>
                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Share %</Text>
              </View>
              {productSales.slice(0, 15).map((product, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.colText, { width: '35%', fontWeight: 'bold' }]}>{product.tagName}</Text>
                  <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>
                    {product.quantitySold.toFixed(2)} {product.unit}
                  </Text>
                  <Text style={[styles.colText, styles.colAmount, { width: '25%', textAlign: 'right' }]}>
                    {formatCurrency(product.totalSalesValue)}
                  </Text>
                  <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>
                    {product.shareOfTotalSales.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No product sales data available.</Text>
          )}
        </View>

        {renderFooter()}
      </Page>
    </Document>
  );
};
