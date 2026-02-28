import { Document, Page, Text, View, StyleSheet, Image, Svg, Rect, Line as SvgLine } from '@react-pdf/renderer';
import type {
    FinanceMetrics,
    IncomeSummaryReport,
    ExpenseSummaryReport,
    CashFlowReport,
    OutstandingReceivable,
    CashFlowTrendData,
} from '../types/finance-analytics';

// Ultra-Modern, Clean Dashboard PDF Styles
const styles = StyleSheet.create({
    page: {
        backgroundColor: '#f8fafc', // Even lighter slate for finance
        fontFamily: 'Helvetica',
        paddingBottom: 40,
    },
    topHeader: {
        backgroundColor: '#1e1b4b', // Deep indigo/violet for finance
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
        color: '#a5b4fc',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    periodBadge: {
        backgroundColor: '#3730a3',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        marginBottom: 8,
    },
    periodText: {
        color: '#e0e7ff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    generatedText: {
        color: '#818cf8',
        fontSize: 8,
    },
    generatedDate: {
        color: '#c7d2fe',
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
    kpiSky: { borderTopColor: '#0ea5e9' },
    kpiRose: { borderTopColor: '#f43f5e' },
    kpiAmber: { borderTopColor: '#f59e0b' },
    kpiPurple: { borderTopColor: '#a855f7' },
    kpiOrange: { borderTopColor: '#f97316' },

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
    badgeSuccess: { backgroundColor: '#dcfce7', color: '#166534' },
    badgeWarning: { backgroundColor: '#fef3c7', color: '#92400e' },
    badgeDanger: { backgroundColor: '#fee2e2', color: '#991b1b' },
});

interface FinanceReportPDFProps {
    metrics: FinanceMetrics | null;
    incomeReport: IncomeSummaryReport | null;
    expenseReport: ExpenseSummaryReport | null;
    cashFlowReport: CashFlowReport | null;
    receivables: OutstandingReceivable[];
    cashFlowTrend: CashFlowTrendData[];
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

    const TopHeader = ({ titleLabel }: { titleLabel: string }) => (
        <View style={styles.topHeader} fixed>
            <View style={styles.headerLeft}>
                <Image src="/hatvoni-logo.png" style={styles.logo} />
                <Text style={styles.reportTitle}>{titleLabel}</Text>
                <Text style={styles.reportSubtitle}>Hatvoni ERP Financials</Text>
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
            <Text style={styles.footerText}>Secure Financial Document · Hatvoni ERP</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
    );

    return (
        <Document>
            {/* ----------------- PAGE 1: EXECUTIVE SUMMARY ----------------- */}
            <Page size="A4" style={styles.page}>
                <TopHeader titleLabel="Executive Finance Summary" />

                <View style={styles.contentContainer}>
                    {/* Cash Flow Summary */}
                    {cashFlowReport && (
                        <View style={styles.kpiContainer}>
                            <View style={[styles.kpiBox, styles.kpiEmerald]}>
                                <Text style={styles.kpiLabel}>Total Inflow</Text>
                                <Text style={styles.kpiValue}>{formatCur(cashFlowReport.totalIncome)}</Text>
                                <Text style={styles.kpiSubtext}>All income sources</Text>
                            </View>
                            <View style={[styles.kpiBox, styles.kpiRose]}>
                                <Text style={styles.kpiLabel}>Total Outflow</Text>
                                <Text style={styles.kpiValue}>{formatCur(cashFlowReport.totalExpenses)}</Text>
                                <Text style={styles.kpiSubtext}>All expenditure</Text>
                            </View>
                            <View style={[styles.kpiBox, cashFlowReport.cashFlowStatus === 'positive' ? styles.kpiIndigo : styles.kpiOrange]}>
                                <Text style={styles.kpiLabel}>Net Cash Movement</Text>
                                <Text style={styles.kpiValue}>{formatCur(cashFlowReport.netCashFlow)}</Text>
                                <Text style={styles.kpiSubtext}>For selected period</Text>
                            </View>
                        </View>
                    )}

                    {/* Key Metrics Grid */}
                    {metrics && (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Financial Decision Metrics</Text>
                            </View>
                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 2 }]}>Metric</Text>
                                    <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Value</Text>
                                    <Text style={[styles.th, { flex: 2, paddingLeft: 10 }]}>Description</Text>
                                </View>

                                {[
                                    { label: 'Revenue Growth', val: metrics.revenueGrowthRate != null ? `${metrics.revenueGrowthRate.toFixed(1)}%` : '—', desc: 'Growth rate vs previous period' },
                                    { label: 'Operational Margin', val: metrics.operationalMargin != null ? `${metrics.operationalMargin.toFixed(1)}%` : '—', desc: 'Margin post operational costs' },
                                    { label: 'Gross Margin', val: metrics.grossMargin != null ? `${metrics.grossMargin.toFixed(1)}%` : '—', desc: 'Profit after direct production costs' },
                                    { label: 'Expense to Revenue', val: metrics.expenseToRevenueRatio != null ? metrics.expenseToRevenueRatio.toFixed(2) : '—', desc: 'Proportion of revenue spent' },
                                    { label: 'Customer Concentration', val: metrics.customerConcentrationRatio != null ? `${metrics.customerConcentrationRatio.toFixed(1)}%` : '—', desc: 'Revenue from top customers' },
                                    { label: 'Receivables Ratio', val: metrics.receivablesRatio != null ? `${metrics.receivablesRatio.toFixed(1)}%` : '—', desc: 'Uncollected sales revenue share' },
                                    { label: 'ROI', val: metrics.roi != null ? `${metrics.roi.toFixed(1)}%` : '—', desc: 'Return on invested capital' }
                                ].map((m, idx) => (
                                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                                        <Text style={[styles.tdBold, { flex: 2 }]}>{m.label}</Text>
                                        <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>{m.val}</Text>
                                        <Text style={[styles.td, { flex: 2, paddingLeft: 10, color: '#64748b' }]}>{m.desc}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Flow Trend Chart */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Net Cash Trend (Last 8 Months)</Text>
                        </View>
                        {cashFlowTrend.length > 0 ? (
                            <View style={styles.chartWrapper}>
                                <BarChart
                                    data={cashFlowTrend.slice(-8).map(trend => {
                                        const dt = new Date(trend.month + '-01');
                                        return { label: dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: trend.netCash };
                                    })}
                                    color="#6366f1"
                                    height={180}
                                />
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No cash flow baseline available.</Text>
                        )}
                    </View>
                </View>
                <RepoFooter />
            </Page>

            {/* ----------------- PAGE 2: INCOME & EXPENSE DETAILS ----------------- */}
            <Page size="A4" style={styles.page}>
                <TopHeader titleLabel="Income & Expense Breakdown" />

                <View style={styles.contentContainer}>
                    {incomeReport && (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Income Sources Analysis</Text>
                            </View>
                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 3 }]}>Income Source</Text>
                                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Amount</Text>
                                    <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Share %</Text>
                                </View>
                                {incomeReport.incomeBySource.map((src, idx) => (
                                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                                        <Text style={[styles.tdBold, { flex: 3, textTransform: 'capitalize' }]}>{src.source.replace(/_/g, ' ')}</Text>
                                        <Text style={[styles.tdAmount, { flex: 2, textAlign: 'right', color: '#16a34a' }]}>{formatCur(src.amount)}</Text>
                                        <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{src.percentage.toFixed(1)}%</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {expenseReport && (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Expense Behaviors & Categories</Text>
                            </View>
                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 3 }]}>Expense Category</Text>
                                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Amount Spent</Text>
                                    <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Share %</Text>
                                </View>
                                {expenseReport.expensesByCategory.map((exp, idx) => (
                                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                                        <Text style={[styles.tdBold, { flex: 3, textTransform: 'capitalize' }]}>{exp.category.replace(/_/g, ' ')}</Text>
                                        <Text style={[styles.tdAmount, { flex: 2, textAlign: 'right', color: '#dc2626' }]}>{formatCur(exp.amount)}</Text>
                                        <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{exp.percentage.toFixed(1)}%</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
                <RepoFooter />
            </Page>

            {/* ----------------- PAGE 3: RECEIVABLES ----------------- */}
            <Page size="A4" style={styles.page}>
                <TopHeader titleLabel="Receivables & Debt" />

                <View style={styles.contentContainer}>
                    {receivables.length > 0 ? (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Outstanding Customer Receivables</Text>
                            </View>
                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 3 }]}>Customer</Text>
                                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Order Value</Text>
                                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Pending</Text>
                                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>O/S Days</Text>
                                </View>
                                {receivables.slice(0, 25).map((r, idx) => (
                                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                                        <Text style={[styles.tdBold, { flex: 3 }]}>{r.customerName}</Text>
                                        <Text style={[styles.td, { flex: 2, textAlign: 'right' }]}>{formatCur(r.totalOrderValue)}</Text>
                                        <Text style={[styles.tdAmount, { flex: 2, textAlign: 'right', color: '#b91c1c' }]}>{formatCur(r.amountPending)}</Text>
                                        <Text style={[styles.td, { flex: 1.5, textAlign: 'right', fontWeight: 'bold' }]}>{r.daysOutstanding}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <Text style={styles.emptyText}>No outstanding receivables to report.</Text>
                        </View>
                    )}
                </View>
                <RepoFooter />
            </Page>
        </Document>
    );
};
