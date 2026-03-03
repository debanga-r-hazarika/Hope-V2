import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Line as SvgLine } from '@react-pdf/renderer';
import type {
  SalesSummary,
  CustomerSalesReport,
  ProductSalesReport,
  OutstandingPaymentReport,
  SalesTrendData,
} from '../types/sales-analytics';

// Professional, Corporate, Minimal Styles (Matching Inventory)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#334155', // Slate-700
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
    color: '#0f172a', // Slate-900
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaContainer: {
    alignItems: 'flex-end',
  },
  subtitle: {
    fontSize: 8,
    color: '#64748b', // Slate-500
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
  // Table Structure Minimal
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
  kpiGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  kpiItem: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 2, borderLeftColor: '#cbd5e1' },
  kpiLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 4, fontWeight: 'bold' },
  kpiValue: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  kpiDesc: { fontSize: 7, color: '#94a3b8' },
  chartWrapper: { marginTop: 10, alignItems: 'center' },
  badgeDanger: { backgroundColor: '#fee2e2', color: '#991b1b', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, fontSize: 6, fontWeight: 'bold' },
  badgeWarning: { backgroundColor: '#fef3c7', color: '#92400e', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, fontSize: 6, fontWeight: 'bold' },
});

// Improved Bar Chart Component
const BarChart = ({ data, color = '#334155', showValues = true, height = 160, width = 500 }: {
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

      {minVal < 0 && (
        <SvgLine x1={paddingParts.left.toString()} y1={zeroY.toString()} x2={(width - paddingParts.right).toString()} y2={zeroY.toString()} stroke="#94a3b8" strokeWidth="1.5" />
      )}

      <SvgLine x1={paddingParts.left.toString()} y1={(paddingParts.top + chartHeight).toString()} x2={(width - paddingParts.right).toString()} y2={(paddingParts.top + chartHeight).toString()} stroke="#cbd5e1" strokeWidth="1.5" />

      {data.map((item, index) => {
        const isNegative = item.value < 0;
        const barHeight = Math.abs(item.value / range) * chartHeight;
        const x = paddingParts.left + spacing + index * (barWidth + spacing);
        const y = isNegative ? zeroY : zeroY - barHeight;

        const displayLabel = item.label.length > 10 ? item.label.substring(0, 10) + '..' : item.label;
        const barColor = isNegative ? '#b91c1c' : color;

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

interface SalesReportPDFProps {
  summary: SalesSummary;
  customerSales: CustomerSalesReport[];
  productSales: ProductSalesReport[];
  outstandingPayments: OutstandingPaymentReport[];
  salesTrend: SalesTrendData[];
  periodLabel: string;
}

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

  const renderHeader = (subtitleSection: string) => (
    <View style={styles.header} fixed>
      <Image src="/hatvoni-logo.png" style={styles.logo} />
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Sales Report</Text>
        <Text style={styles.subtitle}>{subtitleSection}</Text>
      </View>
      <View style={styles.metaContainer}>
        <Text style={styles.subtitle}>Generated on <Text style={styles.subtitleBold}>{formGenDate()}</Text></Text>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>{periodLabel}</Text>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Hatvoni ERP · Corporate Sales Report</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {renderHeader('EXECUTIVE SALES SUMMARY')}

        <View style={styles.kpiGrid}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Total Revenue</Text>
            <Text style={styles.kpiValue}>{formatCur(summary.totalSalesValue)}</Text>
            <Text style={styles.kpiDesc}>{summary.totalOrdersCount} orders</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Realized Revenue</Text>
            <Text style={styles.kpiValue}>{formatCur(summary.paidAmount)}</Text>
            <Text style={styles.kpiDesc}>{summary.fullPaymentCount} paid orders</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Outstanding Bal</Text>
            <Text style={styles.kpiValue}>{formatCur(summary.pendingAmount)}</Text>
            <Text style={styles.kpiDesc}>{summary.pendingPaymentCount + summary.partialPaymentCount} active orders</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Units Sold</Text>
            <Text style={styles.kpiValue}>{summary.totalOrderedQuantity.toFixed(0)}</Text>
            <Text style={styles.kpiDesc}>across all lines</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Revenue Analytics Trend</Text>
          </View>
          {salesTrend.length > 0 ? (
            <View style={styles.chartWrapper}>
              <BarChart
                data={salesTrend.slice(-8).map(trend => {
                  const dt = new Date(trend.month + '-01');
                  return { label: dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: trend.salesValue };
                })}
                color="#475569"
                height={160}
              />
            </View>
          ) : (
            <Text style={styles.emptyText}>No trend data available.</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Realization Overview</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colHeader, { width: '40%' }]}>Payment Status</Text>
              <Text style={[styles.colHeader, { width: '30%', textAlign: 'right' }]}>Order Count</Text>
              <Text style={[styles.colHeader, { width: '30%', textAlign: 'right' }]}>% of Total</Text>
            </View>
            {[
              { label: 'Fully Paid', count: summary.fullPaymentCount, color: '#16a34a' },
              { label: 'Partially Paid', count: summary.partialPaymentCount, color: '#ea580c' },
              { label: 'Pending Payment', count: summary.pendingPaymentCount, color: '#b91c1c' }
            ].map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.colText, { width: '40%', fontWeight: 'bold', color: item.color }]}>{item.label}</Text>
                <Text style={[styles.colText, { width: '30%', textAlign: 'right' }]}>{item.count}</Text>
                <Text style={[styles.colText, { width: '30%', textAlign: 'right' }]}>
                  {summary.totalOrdersCount ? Math.round((item.count / summary.totalOrdersCount) * 100) : 0}%
                </Text>
              </View>
            ))}
          </View>
        </View>
        {renderFooter()}
      </Page>

      {outstandingPayments.length > 0 && (
        <Page size="A4" style={styles.page}>
          {renderHeader('ACCOUNTS RECEIVABLE')}

          <View style={styles.alertSection}>
            <Text style={styles.alertHeader}>Critical Collections Alert</Text>
            <Text style={{ fontSize: 8, color: '#991b1b' }}>
              There are {outstandingPayments.length} open invoices with a total outstanding balance of {formatCur(outstandingPayments.reduce((s, p) => s + p.balancePending, 0))}.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Aged Accounts Details</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colHeader, { width: '30%' }]}>Customer</Text>
                <Text style={[styles.colHeader, { width: '15%' }]}>Ref</Text>
                <Text style={[styles.colHeader, { width: '15%' }]}>Date</Text>
                <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Total</Text>
                <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Pending</Text>
                <Text style={[styles.colHeader, { width: '10%', textAlign: 'right' }]}>Days</Text>
              </View>
              {outstandingPayments.slice(0, 25).map((pmt, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.colText, { width: '30%', fontWeight: 'bold' }]}>{pmt.customerName}</Text>
                  <Text style={[styles.colText, { width: '15%' }]}>{pmt.orderNumber}</Text>
                  <Text style={[styles.colText, { width: '15%' }]}>{formatDt(pmt.orderDate)}</Text>
                  <Text style={[styles.colText, { width: '15%', textAlign: 'right' }]}>{formatCur(pmt.orderedItemValue)}</Text>
                  <Text style={[styles.colText, styles.colAmount, { width: '15%', textAlign: 'right', color: '#b91c1c' }]}>{formatCur(pmt.balancePending)}</Text>
                  <Text style={[styles.colText, { width: '10%', textAlign: 'right' }]}>
                    <Text style={pmt.daysOutstanding > 30 ? styles.badgeDanger : styles.badgeWarning}>{pmt.daysOutstanding}d</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {renderFooter()}
        </Page>
      )}

      <Page size="A4" style={styles.page}>
        {renderHeader('PORTFOLIO PERFORMANCE')}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Selling Products</Text>
          </View>
          {productSales.length > 0 ? (
            <View style={styles.chartWrapper}>
              <BarChart
                data={productSales.slice(0, 8).map(p => ({
                  label: p.tagName, value: p.totalSalesValue
                }))}
                color="#475569"
                height={140}
              />
            </View>
          ) : (
            <Text style={styles.emptyText}>No product sales data available.</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Product Sales Breakdown</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colHeader, { width: '35%' }]}>Product / Tag</Text>
              <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Volume</Text>
              <Text style={[styles.colHeader, { width: '25%', textAlign: 'right' }]}>Revenue</Text>
              <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Share</Text>
            </View>
            {productSales.slice(0, 15).map((prod, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.colText, { width: '35%', fontWeight: 'bold' }]}>{prod.tagName}</Text>
                <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>
                  {prod.quantitySold.toFixed(2)} <Text style={{ fontSize: 7, color: '#94a3b8' }}>{prod.unit}</Text>
                </Text>
                <Text style={[styles.colText, styles.colAmount, { width: '25%', textAlign: 'right' }]}>{formatCur(prod.totalSalesValue)}</Text>
                <Text style={[styles.colText, { width: '20%', textAlign: 'right', fontWeight: 'bold' }]}>
                  {prod.shareOfTotalSales.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
        {renderFooter()}
      </Page>
    </Document>
  );
};
