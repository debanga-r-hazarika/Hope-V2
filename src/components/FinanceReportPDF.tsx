import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Line as SvgLine } from '@react-pdf/renderer';
import type {
    FinanceMetrics,
    IncomeSummaryReport,
    ExpenseSummaryReport,
    CashFlowReport,
    OutstandingReceivable,
    CashFlowTrendData,
} from '../types/finance-analytics';

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
    kpiGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
    kpiItem: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 2, borderLeftColor: '#cbd5e1' },
    kpiLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 4, fontWeight: 'bold' },
    kpiValue: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
    kpiDesc: { fontSize: 7, color: '#94a3b8' },
    chartWrapper: { marginTop: 10, alignItems: 'center' },
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

interface FinanceReportPDFProps {
    metrics: FinanceMetrics | null;
    incomeReport: IncomeSummaryReport | null;
    expenseReport: ExpenseSummaryReport | null;
    cashFlowReport: CashFlowReport | null;
    receivables: OutstandingReceivable[];
    cashFlowTrend: CashFlowTrendData[];
    periodLabel: string;
}

export const FinanceReportPDF = ({
    metrics,
    incomeReport,
    expenseReport,
    cashFlowReport,
    receivables,
    cashFlowTrend,
    periodLabel,
}: FinanceReportPDFProps) => {
    const formatCur = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
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
                <Text style={styles.title}>Finance Report</Text>
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
            <Text style={styles.footerText}>Hatvoni ERP · Corporate Finance Report</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
    );

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {renderHeader('EXECUTIVE FINANCE SUMMARY')}

                {cashFlowReport && (
                    <View style={styles.kpiGrid}>
                        <View style={styles.kpiItem}>
                            <Text style={styles.kpiLabel}>Total Inflow</Text>
                            <Text style={styles.kpiValue}>{formatCur(cashFlowReport.totalIncome)}</Text>
                            <Text style={styles.kpiDesc}>All income sources</Text>
                        </View>
                        <View style={styles.kpiItem}>
                            <Text style={styles.kpiLabel}>Total Outflow</Text>
                            <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{formatCur(cashFlowReport.totalExpenses)}</Text>
                            <Text style={styles.kpiDesc}>All expenditure</Text>
                        </View>
                        <View style={[styles.kpiItem, cashFlowReport.cashFlowStatus === 'positive' ? {} : { borderLeftColor: '#f59e0b' }]}>
                            <Text style={styles.kpiLabel}>Net Cash Movement</Text>
                            <Text style={styles.kpiValue}>{formatCur(cashFlowReport.netCashFlow)}</Text>
                            <Text style={styles.kpiDesc}>selected period</Text>
                        </View>
                    </View>
                )}

                {metrics && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Financial Decision Metrics</Text>
                        </View>
                        <View style={styles.table}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.colHeader, { width: '30%' }]}>Metric</Text>
                                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Value</Text>
                                <Text style={[styles.colHeader, { width: '50%' }]}>Description</Text>
                            </View>

                            {[
                                { label: 'Revenue Growth', val: metrics.revenueGrowthRate != null ? `${metrics.revenueGrowthRate.toFixed(1)}%` : '—', desc: 'Growth rate vs previous period' },
                                { label: 'Operational Margin', val: metrics.operationalMargin != null ? `${metrics.operationalMargin.toFixed(1)}%` : '—', desc: 'Margin post operational costs' },
                                { label: 'Gross Margin', val: metrics.grossMargin != null ? `${metrics.grossMargin.toFixed(1)}%` : '—', desc: 'Profit after direct production costs' },
                                { label: 'Expense Ratio', val: metrics.expenseToRevenueRatio != null ? metrics.expenseToRevenueRatio.toFixed(2) : '—', desc: 'Proportion of revenue spent' },
                                { label: 'Concentration', val: metrics.customerConcentrationRatio != null ? `${metrics.customerConcentrationRatio.toFixed(1)}%` : '—', desc: 'Revenue from top customers' },
                                { label: 'Receivables Ratio', val: metrics.receivablesRatio != null ? `${metrics.receivablesRatio.toFixed(1)}%` : '—', desc: 'Uncollected sales revenue share' },
                                { label: 'ROI', val: metrics.roi != null ? `${metrics.roi.toFixed(1)}%` : '—', desc: 'Return on invested capital' }
                            ].map((m, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.colText, { width: '30%', fontWeight: 'bold' }]}>{m.label}</Text>
                                    <Text style={[styles.colText, { width: '20%', textAlign: 'right', fontWeight: 'bold' }]}>{m.val}</Text>
                                    <Text style={[styles.colText, { width: '50%' }]}>{m.desc}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Net Cash Trend (Last 8 Months)</Text>
                    </View>
                    {cashFlowTrend.length > 0 ? (
                        <View style={styles.chartWrapper}>
                            <BarChart
                                data={cashFlowTrend.slice(-8).map(trend => {
                                    const dt = new Date(trend.month + '-01');
                                    return { label: dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: trend.netCash };
                                })}
                                color="#475569"
                                height={160}
                            />
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No cash flow baseline available.</Text>
                    )}
                </View>
                {renderFooter()}
            </Page>

            <Page size="A4" style={styles.page}>
                {renderHeader('INCOME & EXPENSE BREAKDOWN')}

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Income Sources Analysis</Text>
                    </View>
                    {incomeReport ? (
                        <View style={styles.table}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.colHeader, { width: '50%' }]}>Income Source</Text>
                                <Text style={[styles.colHeader, { width: '30%', textAlign: 'right' }]}>Amount</Text>
                                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Share %</Text>
                            </View>
                            {incomeReport.incomeBySource.map((src, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.colText, { width: '50%', fontWeight: 'bold', textTransform: 'capitalize' }]}>{src.source.replace(/_/g, ' ')}</Text>
                                    <Text style={[styles.colText, styles.colAmount, { width: '30%', textAlign: 'right', color: '#16a34a' }]}>{formatCur(src.amount)}</Text>
                                    <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>{src.percentage.toFixed(1)}%</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No income data recorded.</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Expense Categories Analysis</Text>
                    </View>
                    {expenseReport ? (
                        <View style={styles.table}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.colHeader, { width: '50%' }]}>Expense Category</Text>
                                <Text style={[styles.colHeader, { width: '30%', textAlign: 'right' }]}>Amount Spent</Text>
                                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Share %</Text>
                            </View>
                            {expenseReport.expensesByCategory.map((exp, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.colText, { width: '50%', fontWeight: 'bold', textTransform: 'capitalize' }]}>{exp.category.replace(/_/g, ' ')}</Text>
                                    <Text style={[styles.colText, styles.colAmount, { width: '30%', textAlign: 'right', color: '#b91c1c' }]}>{formatCur(exp.amount)}</Text>
                                    <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>{exp.percentage.toFixed(1)}%</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No expense data recorded.</Text>
                    )}
                </View>
                {renderFooter()}
            </Page>

            <Page size="A4" style={styles.page}>
                {renderHeader('RECEIVABLES')}

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Outstanding Customer Receivables</Text>
                    </View>
                    {receivables.length > 0 ? (
                        <View style={styles.table}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.colHeader, { width: '40%' }]}>Customer</Text>
                                <Text style={[styles.colHeader, { width: '25%', textAlign: 'right' }]}>Order Value</Text>
                                <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Pending</Text>
                                <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Days</Text>
                            </View>
                            {receivables.slice(0, 25).map((r, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.colText, { width: '40%', fontWeight: 'bold' }]}>{r.customerName}</Text>
                                    <Text style={[styles.colText, { width: '25%', textAlign: 'right' }]}>{formatCur(r.totalOrderValue)}</Text>
                                    <Text style={[styles.colText, styles.colAmount, { width: '20%', textAlign: 'right', color: '#b91c1c' }]}>{formatCur(r.amountPending)}</Text>
                                    <Text style={[styles.colText, { width: '15%', textAlign: 'right', fontWeight: 'bold' }]}>{r.daysOutstanding}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No outstanding receivables to report.</Text>
                    )}
                </View>
                {renderFooter()}
            </Page>
        </Document>
    );
};
