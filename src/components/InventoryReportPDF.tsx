import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { CurrentInventoryByTag, OutOfStockItem, LowStockItem, ConsumptionSummary, InventoryAnalyticsFilters, NewStockArrival, InventoryType } from '../types/inventory-analytics';

// Extended interface for PDF display
export interface PDFInventoryItem extends CurrentInventoryByTag {
    inventory_type: string;
    last_activity_date?: string;
}

// Professional, Corporate, Minimal Styles
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
    // Tag Summary Container
    tagSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 4,
        marginTop: 12,
        marginBottom: 4,
        borderLeftWidth: 2,
        borderLeftColor: '#cbd5e1',
    },
    tagSummaryTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    tagSummaryDetail: {
        fontSize: 8,
        color: '#64748b'
    },
    archivedBadge: {
        fontSize: 5,
        color: '#64748b',
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
        marginLeft: 4,
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
    warningSection: {
        marginBottom: 20,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 4,
        borderLeftWidth: 3,
        borderLeftColor: '#f59e0b',
        padding: 12,
    },
    alertHeader: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#b91c1c',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    warningHeader: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#b45309',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
});

interface InventoryReportPDFProps {
    currentInventory: PDFInventoryItem[];
    outOfStockItems: OutOfStockItem[];
    lowStockItems: LowStockItem[];
    consumptionData: ConsumptionSummary[];
    newStockArrivals: NewStockArrival[];
    rawMaterialLots: any[];
    recurringProductLots: any[];
    producedGoodsBatches: any[];
    filters: InventoryAnalyticsFilters;
    periodLabel: string;
}

export const InventoryReportPDF = ({
    currentInventory,
    outOfStockItems,
    lowStockItems,
    consumptionData,
    newStockArrivals,
    rawMaterialLots,
    recurringProductLots,
    producedGoodsBatches,
    filters,
    periodLabel
}: InventoryReportPDFProps) => {

    const formatDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return '-'
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

    const categories: { type: InventoryType; label: string; }[] = [
        { type: 'raw_material', label: 'Raw Materials' },
        { type: 'recurring_product', label: 'Recurring Products' },
        { type: 'produced_goods', label: 'Produced Goods' }
    ];

    const categoriesToRender = filters.inventoryType
        ? categories.filter(c => c.type === filters.inventoryType)
        : categories;

    return (
        <Document>
            {categoriesToRender.map((category) => {
                const catInventory = currentInventory.filter(i => i.inventory_type === category.type);
                const catOut = outOfStockItems.filter(i => i.inventory_type === category.type);
                const catLow = lowStockItems.filter(i => i.inventory_type === category.type);

                const tagTypeMap = new Map<string, string>();
                currentInventory.forEach(i => tagTypeMap.set(i.tag_id, i.inventory_type));
                outOfStockItems.forEach(i => tagTypeMap.set(i.tag_id, i.inventory_type));
                lowStockItems.forEach(i => tagTypeMap.set(i.tag_id, i.inventory_type));

                const catConsumption = consumptionData.filter(c => tagTypeMap.get(c.tag_id) === category.type);
                const catNewStock = newStockArrivals.filter(n => n.inventory_type === category.type);

                const catLots = category.type === 'raw_material' ? rawMaterialLots :
                    category.type === 'recurring_product' ? recurringProductLots :
                        category.type === 'produced_goods' ? producedGoodsBatches : [];

                const renderHeader = (subtitleSection: string) => (
                    <View style={styles.header} fixed>
                        <Image src="/hatvoni-logo.png" style={styles.logo} />
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>{category.label} Report</Text>
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
                        <Text style={styles.footerText}>Hatvoni ERP · Corporate Inventory Report</Text>
                        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                    </View>
                );

                return (
                    <React.Fragment key={category.type}>
                        {/* ==================================================== */}
                        {/* PAGE 1: CURRENT STOCK STATUS DATABASE & ALERTS       */}
                        {/* ==================================================== */}
                        <Page size="A4" style={styles.page}>
                            {renderHeader('CURRENT STOCK STATUS DATABASE')}

                            {/* Critical Alerts */}
                            {catOut.length > 0 && (
                                <View style={styles.alertSection}>
                                    <Text style={styles.alertHeader}>Critical: Out of Stock</Text>
                                    <View style={styles.table}>
                                        <View style={styles.tableHeaderRow}>
                                            <Text style={[styles.colHeader, { width: '40%' }]}>Item Name</Text>
                                            <Text style={[styles.colHeader, { width: '20%' }]}>Tag Key</Text>
                                            <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Balance</Text>
                                            <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Last Activity</Text>
                                        </View>
                                        {catOut.map((item, idx) => (
                                            <View key={idx} style={[styles.tableRow, { borderBottomColor: '#fca5a5' }]}>
                                                <Text style={[styles.colText, { width: '40%', fontWeight: 'bold' }]}>{item.tag_name}</Text>
                                                <Text style={[styles.colText, { width: '20%' }]}>{item.tag_key}</Text>
                                                <Text style={[styles.colText, { width: '20%', textAlign: 'right', color: '#b91c1c', fontWeight: 'bold' }]}>
                                                    0.00 {item.default_unit}
                                                </Text>
                                                <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>{formatDate(item.last_activity_date)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {catLow.length > 0 && (
                                <View style={styles.warningSection}>
                                    <Text style={styles.warningHeader}>Warning: Low Stock</Text>
                                    <View style={styles.table}>
                                        <View style={styles.tableHeaderRow}>
                                            <Text style={[styles.colHeader, { width: '30%' }]}>Item Name</Text>
                                            <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Current</Text>
                                            <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Threshold</Text>
                                            <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Shortage</Text>
                                            <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Last Activity</Text>
                                        </View>
                                        {catLow.map((item, idx) => {
                                            const shortagePercent = ((item.shortage_amount / item.threshold_quantity) * 100).toFixed(0);
                                            return (
                                                <View key={idx} style={[styles.tableRow, { borderBottomColor: '#fde68a' }]}>
                                                    <Text style={[styles.colText, { width: '30%', fontWeight: 'bold' }]}>{item.tag_name}</Text>
                                                    <Text style={[styles.colText, { width: '15%', textAlign: 'right' }]}>
                                                        {item.current_balance.toFixed(2)} {item.default_unit}
                                                    </Text>
                                                    <Text style={[styles.colText, { width: '15%', textAlign: 'right' }]}>
                                                        {item.threshold_quantity.toFixed(2)}
                                                    </Text>
                                                    <Text style={[styles.colText, { width: '20%', textAlign: 'right', color: '#b45309', fontWeight: 'bold' }]}>
                                                        {item.shortage_amount.toFixed(2)} ({shortagePercent}%)
                                                    </Text>
                                                    <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>{formatDate(item.last_activity_date)}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* Current Stock Status Detailed */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Inventory Details</Text>
                                </View>
                                {catInventory.length > 0 ? (
                                    catInventory.map((tag, tagIdx) => {
                                        const tagLots = catLots.filter((lot: any) => {
                                            if (lot.tag_id !== tag.tag_id) return false;
                                            if (category.type === 'raw_material' && tag.usable !== undefined) {
                                                return lot.usable === tag.usable;
                                            }
                                            return true;
                                        });

                                        return (
                                            <View key={tagIdx} style={{ marginBottom: 16 }}>
                                                <View style={styles.tagSummary}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={styles.tagSummaryTitle}>{tag.tag_name}</Text>
                                                        {category.type === 'raw_material' && tag.usable !== undefined && (
                                                            <Text style={{ fontSize: 8, color: tag.usable ? '#16a34a' : '#ea580c', marginLeft: 8, fontWeight: 'bold' }}>
                                                                ({tag.usable ? 'Usable' : 'Unusable'})
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <View style={{ flexDirection: 'row', gap: 20 }}>
                                                        <Text style={styles.tagSummaryDetail}>
                                                            Total Balance: <Text style={styles.colAmount}>{tag.current_balance.toFixed(2)} {tag.default_unit}</Text>
                                                        </Text>
                                                        <Text style={styles.tagSummaryDetail}>
                                                            Batches/Lots: <Text style={styles.colAmount}>{tag.item_count}</Text>
                                                        </Text>
                                                    </View>
                                                </View>

                                                {tagLots.length > 0 && (
                                                    <View style={styles.table}>
                                                        {category.type === 'raw_material' && (
                                                            <>
                                                                <View style={styles.tableHeaderRow}>
                                                                    <Text style={[styles.colHeader, { width: '20%' }]}>Lot ID</Text>
                                                                    <Text style={[styles.colHeader, { width: '15%' }]}>Status</Text>
                                                                    <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Available</Text>
                                                                    <Text style={[styles.colHeader, { width: '25%' }]}>Supplier</Text>
                                                                    <Text style={[styles.colHeader, { width: '25%' }]}>Collected By</Text>
                                                                </View>
                                                                {tagLots.map((lot: any, lotIdx: number) => (
                                                                    <View key={lotIdx} style={styles.tableRow}>
                                                                        <Text style={[styles.colText, { width: '20%' }]}>
                                                                            {lot.lot_id}
                                                                            {lot.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                                        </Text>
                                                                        <Text style={[styles.colText, { width: '15%', color: lot.usable ? '#16a34a' : '#ea580c' }]}>
                                                                            {lot.usable ? 'Usable' : 'Unusable'}
                                                                        </Text>
                                                                        <Text style={[styles.colText, styles.colAmount, { width: '15%', textAlign: 'right' }]}>
                                                                            {lot.quantity_available.toFixed(2)} {lot.unit}
                                                                        </Text>
                                                                        <Text style={[styles.colText, { width: '25%' }]}>{lot.supplier_name || '—'}</Text>
                                                                        <Text style={[styles.colText, { width: '25%' }]}>{lot.collected_by_name || '—'}</Text>
                                                                    </View>
                                                                ))}
                                                            </>
                                                        )}

                                                        {category.type === 'recurring_product' && (
                                                            <>
                                                                <View style={styles.tableHeaderRow}>
                                                                    <Text style={[styles.colHeader, { width: '25%' }]}>Lot ID</Text>
                                                                    <Text style={[styles.colHeader, { width: '40%' }]}>Product Name</Text>
                                                                    <Text style={[styles.colHeader, { width: '15%' }]}>Received</Text>
                                                                    <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Available</Text>
                                                                </View>
                                                                {tagLots.map((lot: any, lotIdx: number) => (
                                                                    <View key={lotIdx} style={styles.tableRow}>
                                                                        <Text style={[styles.colText, { width: '25%' }]}>
                                                                            {lot.lot_id}
                                                                            {lot.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                                        </Text>
                                                                        <Text style={[styles.colText, { width: '40%' }]}>{lot.name}</Text>
                                                                        <Text style={[styles.colText, { width: '15%' }]}>{formatDate(lot.received_date)}</Text>
                                                                        <Text style={[styles.colText, styles.colAmount, { width: '20%', textAlign: 'right' }]}>
                                                                            {lot.quantity_available.toFixed(2)} {lot.unit}
                                                                        </Text>
                                                                    </View>
                                                                ))}
                                                            </>
                                                        )}

                                                        {category.type === 'produced_goods' && (
                                                            <>
                                                                <View style={styles.tableHeaderRow}>
                                                                    <Text style={[styles.colHeader, { width: '25%' }]}>Batch ID</Text>
                                                                    <Text style={[styles.colHeader, { width: '20%' }]}>Production Date</Text>
                                                                    <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Created</Text>
                                                                    <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Sold/Used</Text>
                                                                    <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Available</Text>
                                                                </View>
                                                                {tagLots.map((batch: any, batchIdx: number) => {
                                                                    const soldUsed = batch.quantity_created - batch.quantity_available;
                                                                    return (
                                                                        <View key={batchIdx} style={styles.tableRow}>
                                                                            <Text style={[styles.colText, { width: '25%' }]}>
                                                                                {batch.batch_name}
                                                                                {batch.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                                            </Text>
                                                                            <Text style={[styles.colText, { width: '20%' }]}>{formatDate(batch.production_date)}</Text>
                                                                            <Text style={[styles.colText, { width: '15%', textAlign: 'right' }]}>
                                                                                {batch.quantity_created.toFixed(2)}
                                                                            </Text>
                                                                            <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>
                                                                                {soldUsed.toFixed(2)}
                                                                            </Text>
                                                                            <Text style={[styles.colText, styles.colAmount, { width: '20%', textAlign: 'right' }]}>
                                                                                {batch.quantity_available.toFixed(2)} {batch.unit}
                                                                            </Text>
                                                                        </View>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                ) : (
                                    <Text style={styles.emptyText}>No stock items available in this category.</Text>
                                )}
                            </View>
                            {renderFooter()}
                        </Page>

                        {/* ==================================================== */}
                        {/* PAGE 2: STOCK ARRIVALS TRACKING                      */}
                        {/* ==================================================== */}
                        <Page size="A4" style={styles.page}>
                            {renderHeader('STOCK ARRIVALS TRACKING')}

                            {/* Arrivals Section */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Stock Arrivals History</Text>
                                </View>
                                {catNewStock.length > 0 ? (
                                    <View style={styles.table}>
                                        {category.type === 'raw_material' ? (
                                            <>
                                                <View style={styles.tableHeaderRow}>
                                                    <Text style={[styles.colHeader, { width: '15%' }]}>Date</Text>
                                                    <Text style={[styles.colHeader, { width: '20%' }]}>Item</Text>
                                                    <Text style={[styles.colHeader, { width: '15%' }]}>Lot ID</Text>
                                                    <Text style={[styles.colHeader, { width: '20%' }]}>Supplier</Text>
                                                    <Text style={[styles.colHeader, { width: '15%' }]}>Collected By</Text>
                                                    <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Quantity</Text>
                                                </View>
                                                {catNewStock.map((item, idx) => (
                                                    <View key={idx} style={styles.tableRow}>
                                                        <Text style={[styles.colText, { width: '15%' }]}>{formatDate(item.date)}</Text>
                                                        <Text style={[styles.colText, { width: '20%' }]}>{item.item_name}</Text>
                                                        <Text style={[styles.colText, { width: '15%' }]}>{item.lot_batch_id}</Text>
                                                        <Text style={[styles.colText, { width: '20%' }]}>{item.supplier || '—'}</Text>
                                                        <Text style={[styles.colText, { width: '15%' }]}>{item.collected_by || '—'}</Text>
                                                        <Text style={[styles.colText, styles.colAmount, { width: '15%', textAlign: 'right' }]}>
                                                            {item.quantity.toFixed(2)} {item.unit}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </>
                                        ) : (
                                            <>
                                                <View style={styles.tableHeaderRow}>
                                                    <Text style={[styles.colHeader, { width: '20%' }]}>Date</Text>
                                                    <Text style={[styles.colHeader, { width: '40%' }]}>Item Description</Text>
                                                    <Text style={[styles.colHeader, { width: '20%' }]}>Lot/Batch ID</Text>
                                                    <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Quantity</Text>
                                                </View>
                                                {catNewStock.map((item, idx) => (
                                                    <View key={idx} style={styles.tableRow}>
                                                        <Text style={[styles.colText, { width: '20%' }]}>{formatDate(item.date)}</Text>
                                                        <Text style={[styles.colText, { width: '40%' }]}>{item.item_name}</Text>
                                                        <Text style={[styles.colText, { width: '20%' }]}>{item.lot_batch_id}</Text>
                                                        <Text style={[styles.colText, styles.colAmount, { width: '20%', textAlign: 'right' }]}>
                                                            {item.quantity.toFixed(2)} {item.unit}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </>
                                        )}
                                    </View>
                                ) : (
                                    <Text style={styles.emptyText}>No stock arrivals recorded during this period.</Text>
                                )}
                            </View>
                            {renderFooter()}
                        </Page>

                        {/* ==================================================== */}
                        {/* PAGE 3: CONSUMPTION & WASTE OVERVIEW                 */}
                        {/* ==================================================== */}
                        <Page size="A4" style={styles.page}>
                            {renderHeader('CONSUMPTION & WASTE OVERVIEW')}

                            {/* Consumption Secton */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Consumption & Waste Details</Text>
                                </View>
                                {catConsumption.length > 0 ? (
                                    <View style={styles.table}>
                                        <View style={styles.tableHeaderRow}>
                                            <Text style={[styles.colHeader, { width: '35%' }]}>Item Name</Text>
                                            <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Consumed</Text>
                                            <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Wasted</Text>
                                            <Text style={[styles.colHeader, { width: '15%', textAlign: 'right' }]}>Waste %</Text>
                                            <Text style={[styles.colHeader, { width: '20%', textAlign: 'right' }]}>Total Transactions</Text>
                                        </View>
                                        {Object.values(catConsumption.reduce((acc, item) => {
                                            const key = item.tag_id;
                                            if (!acc[key]) {
                                                acc[key] = {
                                                    id: item.tag_id,
                                                    name: item.tag_name,
                                                    consumed: 0,
                                                    wasted: 0,
                                                    unit: item.default_unit,
                                                    consumptionTxns: 0,
                                                    wasteTxns: 0
                                                };
                                            }
                                            acc[key].consumed += item.total_consumed || 0;
                                            acc[key].wasted += item.total_wasted || 0;
                                            acc[key].consumptionTxns += item.consumption_transactions || 0;
                                            acc[key].wasteTxns += item.waste_transactions || 0;
                                            return acc;
                                        }, {} as Record<string, any>))
                                            .sort((a: any, b: any) => b.consumed - a.consumed)
                                            .map((tag: any, idx) => {
                                                const wastePercent = tag.consumed > 0 ? ((tag.wasted / tag.consumed) * 100).toFixed(1) : '0.0';
                                                const totalTxns = tag.consumptionTxns + tag.wasteTxns;
                                                return (
                                                    <View key={idx} style={styles.tableRow}>
                                                        <Text style={[styles.colText, { width: '35%', fontWeight: 'bold' }]}>{tag.name}</Text>
                                                        <Text style={[styles.colText, { width: '15%', textAlign: 'right', color: '#334155' }]}>
                                                            {tag.consumed.toFixed(2)} {tag.unit}
                                                        </Text>
                                                        <Text style={[styles.colText, { width: '15%', textAlign: 'right', color: tag.wasted > 0 ? '#b91c1c' : '#334155' }]}>
                                                            {tag.wasted.toFixed(2)} {tag.unit}
                                                        </Text>
                                                        <Text style={[styles.colText, { width: '15%', textAlign: 'right', fontWeight: parseFloat(wastePercent) > 10 ? 'bold' : 'normal', color: parseFloat(wastePercent) > 10 ? '#b91c1c' : '#64748b' }]}>
                                                            {wastePercent}%
                                                        </Text>
                                                        <Text style={[styles.colText, { width: '20%', textAlign: 'right' }]}>
                                                            {totalTxns}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                    </View>
                                ) : (
                                    <Text style={styles.emptyText}>No consumption/waste recorded during this period.</Text>
                                )}
                            </View>
                            {renderFooter()}
                        </Page>
                    </React.Fragment>
                );
            })}
        </Document>
    );
};
