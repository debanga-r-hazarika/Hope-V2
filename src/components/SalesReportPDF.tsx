import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Line as SvgLine } from '@react-pdf/renderer';
import type {
  SalesSummary,
  CustomerSalesReport,
  ProductSalesReport,
  OutstandingPaymentReport,
  SalesTrendData,
} from '../types/sales-analytics';

// Ultra-Modern, Clean Dashboard PDF Styles
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f1f5f9', // Light slate background for modern card look
    fontFamily: 'Helvetica',
    paddingBottom: 40,
  },
  topHeader: {
    backgroundColor: '#0f172a', // Deep slate 900
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    width: 130,
    height: 40,
    objectFit: 'contain',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 4,
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  periodBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  periodText: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: 'bold',
  },
  generatedText: {
    color: '#64748b',
    fontSize: 8,
  },
  generatedDate: {
    color: '#cbd5e1',
    fontWeight: 'bold',
  },
  contentContainer: {
    paddingHorizontal: 40,
    paddingTop: 24,
  },
  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // KPI Grid
  kpiContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 4,
  },
  kpiLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  kpiSubtext: {
    fontSize: 8,
    color: '#94a3b8',
  },
  // Colors for KPIs
  kpiIndigo: { borderTopColor: '#6366f1' },
  kpiEmerald: { borderTopColor: '#10b981' },
  kpiAmber: { borderTopColor: '#f59e0b' },
  kpiRose: { borderTopColor: '#f43f5e' },

  // Tables
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#fafaf9',
  },
  th: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 9,
    color: '#334155',
  },
  tdBold: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  tdAmount: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 10,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Alerts
  alertBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  alertTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#b91c1c',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  alertText: {
    fontSize: 9,
    color: '#991b1b',
  },
  // Charts
  chartWrapper: {
    marginTop: 10,
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 8,
    color: '#64748b',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },

  // Status badges
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 7,
    fontWeight: 'bold',
  },
  badgeSuccess: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeWarning: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgeDanger: { backgroundColor: '#fee2e2', color: '#991b1b' },
});

interface SalesReportPDFProps {
  summary: SalesSummary;
  customerSales: CustomerSalesReport[];
  productSales: ProductSalesReport[];
  outstandingPayments: OutstandingPaymentReport[];
  salesTrend: SalesTrendData[];
  periodLabel: string;
}

// Improved Bar Chart Component
const BarChart = ({ data, color = '#6366f1', showValues = true, height = 160, width = 500 }: {
  data: { label: string; value: number }[];
  color?: string;
  showValues?: boolean;
  height?: number;
  width?: number;
}) => {
  const paddingParts = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartHeight = height - paddingParts.top - paddingParts.bottom;
  const chartWidth = width - paddingParts.left - paddingParts.right;
  const barWidth = Math.min((chartWidth / Math.max(data.length, 1)) - 10, 40);
  const spacing = (chartWidth - (data.length * barWidth)) / (data.length + 1);

  const dataValues = data.map(d => d.value);
  const maxVal = Math.max(...dataValues, 100);
  const minVal = Math.min(...dataValues, 0);

  const range = (maxVal - minVal) * 1.15 || 100;
  const zeroY = paddingParts.top + chartHeight * (maxVal / range);

  const formatYAxis = (val: number) => {
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 1000000) return `${sign}Rs.${(absVal / 1000000).toFixed(1)}M`;
    if (absVal >= 1000) return `${sign}Rs.${(absVal / 1000).toFixed(0)}K`;
    return `${sign}Rs.${absVal}`;
  };

  return (
    <Svg height={height} width={width}>
      {/* Y-Axis Grid & Labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const val = minVal + (range * ratio);
        const y = paddingParts.top + chartHeight - (ratio * chartHeight);
        return (
          <View key={`grid-${i}`}>
            <Text x={(paddingParts.left - 5).toString()} y={(y + 3).toString()} style={{ fontSize: 7, fill: '#94a3b8', textAnchor: 'end' }}>
              {formatYAxis(val)}
            </Text>
            <SvgLine x1={paddingParts.left.toString()} y1={y.toString()} x2={(width - paddingParts.right).toString()} y2={y.toString()} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          </View>
        );
      })}

      {/* Zero Line */}
      {minVal < 0 && (
        <SvgLine x1={paddingParts.left.toString()} y1={zeroY.toString()} x2={(width - paddingParts.right).toString()} y2={zeroY.toString()} stroke="#94a3b8" strokeWidth="1.5" />
      )}

      {/* Axis Base Line */}
      <SvgLine x1={paddingParts.left.toString()} y1={(paddingParts.top + chartHeight).toString()} x2={(width - paddingParts.right).toString()} y2={(paddingParts.top + chartHeight).toString()} stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Bars */}
      {data.map((item, index) => {
        const isNegative = item.value < 0;
        const barHeight = Math.abs(item.value / range) * chartHeight;
        const x = paddingParts.left + spacing + index * (barWidth + spacing);
        const y = isNegative ? zeroY : zeroY - barHeight;

        const displayLabel = item.label.length > 10 ? item.label.substring(0, 10) + '..' : item.label;
        const barColor = isNegative ? '#f43f5e' : color;

        return (
          <View key={`bar-${index}`}>
            {showValues && item.value !== 0 && (
              <Text x={(x + barWidth / 2).toString()} y={(isNegative ? y + barHeight + 8 : y - 4).toString()} style={{ fontSize: 7, fill: '#475569', textAnchor: 'middle', fontWeight: 'bold' }}>
                {formatYAxis(item.value)}
              </Text>
            )}
            <Rect x={x.toString()} y={y.toString()} width={barWidth.toString()} height={barHeight.toString()} fill={barColor} rx={2} ry={2} />
            <Text x={(x + barWidth / 2).toString()} y={(paddingParts.top + chartHeight + 12).toString()} style={{ fontSize: 7, fill: '#64748b', textAnchor: 'middle' }}>
              {displayLabel}
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
  const formatCur = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatDt = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formGenDate = () => {
    return new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const TopHeader = ({ titleLabel }: { titleLabel: string }) => (
    <View style={styles.topHeader} fixed>
      <View style={styles.headerLeft}>
        <Image src="/hatvoni-logo.png" style={styles.logo} />
        <Text style={styles.reportTitle}>{titleLabel}</Text>
        <Text style={styles.reportSubtitle}>Hatvoni ERP Analytics</Text>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>{periodLabel}</Text>
        </View>
        <Text style={styles.generatedText}>
          Generated on <Text style={styles.generatedDate}>{formGenDate()}</Text>
        </Text>
      </View>
    </View>
  );

  const RepoFooter = () => (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Secure Document · Hatvoni ERP</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document>
      {/* ----------------- PAGE 1: EXECUTIVE SUMMARY ----------------- */}
      <Page size="A4" style={styles.page}>
        <TopHeader titleLabel="Executive Sales Summary" />

        <View style={styles.contentContainer}>
          {/* KPI Grid */}
          <View style={styles.kpiContainer}>
            <View style={[styles.kpiBox, styles.kpiIndigo]}>
              <Text style={styles.kpiLabel}>Total Revenue</Text>
              <Text style={styles.kpiValue}>{formatCur(summary.totalSalesValue)}</Text>
              <Text style={styles.kpiSubtext}>{summary.totalOrdersCount} total orders</Text>
            </View>
            <View style={[styles.kpiBox, styles.kpiEmerald]}>
              <Text style={styles.kpiLabel}>Realized Revenue (Paid)</Text>
              <Text style={styles.kpiValue}>{formatCur(summary.paidAmount)}</Text>
              <Text style={styles.kpiSubtext}>{summary.fullPaymentCount} fully paid orders</Text>
            </View>
          </View>

          <View style={styles.kpiContainer}>
            <View style={[styles.kpiBox, styles.kpiAmber]}>
              <Text style={styles.kpiLabel}>Outstanding Balance</Text>
              <Text style={styles.kpiValue}>{formatCur(summary.pendingAmount)}</Text>
              <Text style={styles.kpiSubtext}>from {summary.pendingPaymentCount + summary.partialPaymentCount} active orders</Text>
            </View>
            <View style={[styles.kpiBox, styles.kpiRose]}>
              <Text style={styles.kpiLabel}>Total Units Sold</Text>
              <Text style={styles.kpiValue}>{summary.totalOrderedQuantity.toFixed(0)}</Text>
              <Text style={styles.kpiSubtext}>across all product lines</Text>
            </View>
          </View>

          {/* Sales Trend Bar Chart */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Revenue Analytics Trend</Text>
            </View>
            {salesTrend.length > 0 ? (
              <View style={styles.chartWrapper}>
                <BarChart
                  data={salesTrend.slice(-8).map(trend => {
                    const dt = new Date(trend.month + '-01');
                    return { label: dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: trend.salesValue };
                  })}
                  color="#6366f1"
                  height={180}
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>No trend data available for selected period.</Text>
            )}
          </View>

          {/* Payment Status Breakdown */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Payment Realization Overview</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Payment Status</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Order Count</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>% of Total</Text>
              </View>
              {[
                { label: 'Fully Paid', count: summary.fullPaymentCount, color: '#16a34a' },
                { label: 'Partially Paid', count: summary.partialPaymentCount, color: '#d97706' },
                { label: 'Pending Payment', count: summary.pendingPaymentCount, color: '#dc2626' }
              ].map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdBold, { flex: 2, color: item.color }]}>{item.label}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{item.count}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {summary.totalOrdersCount ? Math.round((item.count / summary.totalOrdersCount) * 100) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <RepoFooter />
      </Page>

      {/* ----------------- PAGE 2: OUTSTANDING PAYMENTS ----------------- */}
      {outstandingPayments.length > 0 && (
        <Page size="A4" style={styles.page}>
          <TopHeader titleLabel="Accounts Receivable" />

          <View style={styles.contentContainer}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>Critical Collections Alert</Text>
              <Text style={styles.alertText}>
                There are {outstandingPayments.length} open invoices with a total outstanding balance of {formatCur(outstandingPayments.reduce((s, p) => s + p.balancePending, 0))}.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Aged Accounts Details</Text>
              </View>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 3 }]}>Customer</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>Ref</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
                  <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Total</Text>
                  <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Pending</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Days</Text>
                </View>
                {outstandingPayments.slice(0, 25).map((pmt, idx) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.tdBold, { flex: 3 }]}>{pmt.customerName}</Text>
                    <Text style={[styles.td, { flex: 1.5, fontSize: 8 }]}>{pmt.orderNumber}</Text>
                    <Text style={[styles.td, { flex: 1.5 }]}>{formatDt(pmt.orderDate)}</Text>
                    <Text style={[styles.tdAmount, { flex: 2, textAlign: 'right' }]}>{formatCur(pmt.orderedItemValue)}</Text>
                    <Text style={[styles.tdAmount, { flex: 2, textAlign: 'right', color: '#dc2626' }]}>{formatCur(pmt.balancePending)}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                      <Text style={pmt.daysOutstanding > 30 ? styles.badgeDanger : styles.badgeWarning}>
                        {pmt.daysOutstanding}d
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <RepoFooter />
        </Page>
      )}

      {/* ----------------- PAGE 3: PORTFOLIO PERFORMANCE ----------------- */}
      <Page size="A4" style={styles.page}>
        <TopHeader titleLabel="Portfolio & Client Performance" />

        <View style={styles.contentContainer}>
          {/* Top Customers Chart */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Top Client Contributions</Text>
            </View>
            {customerSales.length > 0 ? (
              <View style={styles.chartWrapper}>
                <BarChart
                  data={customerSales.slice(0, 8).map(c => ({
                    label: c.customerName, value: c.totalOrderedValue
                  }))}
                  color="#0ea5e9"
                  height={160}
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>No client sales data available.</Text>
            )}
          </View>

          {/* Top Products Chart */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Top Selling Products</Text>
            </View>
            {productSales.length > 0 ? (
              <View style={styles.chartWrapper}>
                <BarChart
                  data={productSales.slice(0, 8).map(p => ({
                    label: p.tagName, value: p.totalSalesValue
                  }))}
                  color="#8b5cf6"
                  height={160}
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>No product sales data available.</Text>
            )}
          </View>

          {/* Product Sales Table */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Product Sales Breakdown</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 4 }]}>Product / Tag</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Volume</Text>
                <Text style={[styles.th, { flex: 3, textAlign: 'right' }]}>Revenue</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Share</Text>
              </View>
              {productSales.slice(0, 15).map((prod, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tdBold, { flex: 4 }]}>{prod.tagName}</Text>
                  <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>
                    {prod.quantitySold.toFixed(2)} <Text style={{ fontSize: 7, color: '#94a3b8' }}>{prod.unit}</Text>
                  </Text>
                  <Text style={[styles.tdAmount, { flex: 3, textAlign: 'right', color: '#0f172a' }]}>{formatCur(prod.totalSalesValue)}</Text>
                  <Text style={[styles.td, { flex: 2, textAlign: 'right', fontWeight: 'bold' }]}>
                    {prod.shareOfTotalSales.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <RepoFooter />
      </Page>
    </Document>
  );
};

