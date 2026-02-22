import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { CurrentInventoryByTag, OutOfStockItem, LowStockItem, ConsumptionSummary, InventoryAnalyticsFilters, NewStockArrival, InventoryType } from '../types/inventory-analytics';

// Extended interface for PDF display
export interface PDFInventoryItem extends CurrentInventoryByTag {
    inventory_type: string;
    last_activity_date?: string;
}

// Define styles for the PDF
const styles = StyleSheet.create({
    page: {
        padding: 30, // Reduced padding to fit more
        fontSize: 9, // Slightly smaller font
        fontFamily: 'Helvetica',
        color: '#334155', // Slate-700
    },
    header: {
        marginBottom: 20,
        borderBottom: 1,
        borderBottomColor: '#cbd5e1', // Slate-300
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logo: {
        width: 80,
        height: 40,
        objectFit: 'contain',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a', // Slate-900
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b', // Slate-500
        marginTop: 4,
    },
    section: {
        marginBottom: 20,
    },
    sectionHeader: {
        backgroundColor: '#f1f5f9', // Slate-100
        padding: 6,
        marginBottom: 8,
        borderRadius: 2,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeft: 3,
        borderLeftColor: '#4f46e5', // Indigo-600
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1e293b', // Slate-800
        marginLeft: 5,
    },
    table: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#e2e8f0', // Slate-200
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0', // Slate-200
        minHeight: 20,
        alignItems: 'center',
    },
    tableHeader: {
        backgroundColor: '#f8fafc', // Slate-50
        fontWeight: 'bold',
        fontSize: 8,
        color: '#475569', // Slate-600
    },
    col: {
        padding: 4,
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0', // Slate-200
    },
    lastCol: {
        borderRightWidth: 0,
    },
    // Column Widths
    colName: { width: '40%' },
    colType: { width: '20%' },
    colQty: { width: '20%', textAlign: 'right' },
    colDate: { width: '20%', textAlign: 'right' },

    // Specific Low Stock Columns
    colLowName: { width: '35%' },
    colLowCurrent: { width: '20%', textAlign: 'right' },
    colLowThreshold: { width: '20%', textAlign: 'right' },
    colLowShortage: { width: '25%', textAlign: 'right', color: '#e11d48' }, // Rose-600

    // Specific Consumption Columns
    colConsTag: { width: '40%' },
    colConsTotal: { width: '30%', textAlign: 'right', color: '#4f46e5' }, // Indigo-600
    colConsWaste: { width: '30%', textAlign: 'right', color: '#e11d48' }, // Rose-600

    // Text Styles
    textBold: {
        fontWeight: 'bold',
    },
    textSmall: {
        fontSize: 8,
    },
    textError: {
        color: '#e11d48',
    },
    archivedBadge: {
        fontSize: 6,
        color: '#64748b',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
        marginLeft: 3,
    },
    emptyText: {
        fontSize: 8,
        color: '#94a3b8',
        textAlign: 'center',
        padding: 10,
        fontStyle: 'italic',
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10,
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

    const categories: { type: InventoryType; label: string; color: string }[] = [
        { type: 'raw_material', label: 'Raw Materials', color: '#3b82f6' }, // Blue
        { type: 'recurring_product', label: 'Recurring Products', color: '#8b5cf6' }, // Purple
        { type: 'produced_goods', label: 'Produced Goods', color: '#10b981' } // Emerald
    ];

    // Filter categories if specific type is selected
    const categoriesToRender = filters.inventoryType
        ? categories.filter(c => c.type === filters.inventoryType)
        : categories;

    return (
        <Document>
            {categoriesToRender.map((category) => {
                // Filter data for this category
                const catInventory = currentInventory.filter(i => i.inventory_type === category.type);
                const catOut = outOfStockItems.filter(i => i.inventory_type === category.type);
                const catLow = lowStockItems.filter(i => i.inventory_type === category.type);

                // Consumption data filtering (by matching tag_id)
                const tagTypeMap = new Map<string, string>();
                currentInventory.forEach(i => tagTypeMap.set(i.tag_id, i.inventory_type));
                outOfStockItems.forEach(i => tagTypeMap.set(i.tag_id, i.inventory_type));
                lowStockItems.forEach(i => tagTypeMap.set(i.tag_id, i.inventory_type));

                const catConsumption = consumptionData.filter(c => tagTypeMap.get(c.tag_id) === category.type);
                const catNewStock = newStockArrivals.filter(n => n.inventory_type === category.type);

                // Get detailed lots/batches for this category
                const catLots = category.type === 'raw_material' ? rawMaterialLots :
                               category.type === 'recurring_product' ? recurringProductLots :
                               category.type === 'produced_goods' ? producedGoodsBatches : [];

                return (
                    <Page key={category.type} size="A4" style={styles.page}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Image src="/hatvoni-logo.png" style={styles.logo} />
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={styles.title}>{category.label} Report</Text>
                                <Text style={styles.subtitle}>Generated on {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                            <View>
                                <Text style={[styles.subtitle, { textAlign: 'right' }]}>Period: {periodLabel}</Text>
                            </View>
                        </View>

                        {/* Section 1: Current Stock Status with Detailed Breakdown */}
                        <View style={styles.section}>
                            <View style={[styles.sectionHeader, { borderLeftColor: category.color }]}>
                                <Text style={styles.sectionTitle}>Current Stock Status - Detailed View</Text>
                            </View>
                            
                            {catInventory.length > 0 ? (
                                catInventory.map((tag, tagIdx) => {
                                    // Get lots/batches for this specific tag
                                    // For raw materials, also filter by usable status
                                    const tagLots = catLots.filter((lot: any) => {
                                        if (lot.tag_id !== tag.tag_id) return false;
                                        // For raw materials, match the usable status
                                        if (category.type === 'raw_material' && tag.usable !== undefined) {
                                            return lot.usable === tag.usable;
                                        }
                                        return true;
                                    });
                                    
                                    return (
                                        <View key={tagIdx} style={{ marginBottom: 15 }}>
                                            {/* Tag Summary Row */}
                                            <View style={{ backgroundColor: '#f8fafc', padding: 6, borderRadius: 2, marginBottom: 4 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e293b' }}>
                                                            {tag.tag_name}
                                                        </Text>
                                                        {category.type === 'raw_material' && tag.usable !== undefined && (
                                                            <Text style={{ fontSize: 8, color: tag.usable ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                                                                ({tag.usable ? 'Usable' : 'Unusable'})
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <View style={{ flexDirection: 'row', gap: 15 }}>
                                                        <Text style={{ fontSize: 9, color: '#64748b' }}>
                                                            Total: <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{tag.current_balance.toFixed(2)} {tag.default_unit}</Text>
                                                        </Text>
                                                        <Text style={{ fontSize: 9, color: '#64748b' }}>
                                                            Items: <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{tag.item_count}</Text>
                                                        </Text>
                                                        <Text style={{ fontSize: 8, color: '#94a3b8' }}>
                                                            Last: {formatDate(tag.last_activity_date)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Detailed Lots/Batches for this Tag */}
                                            {tagLots.length > 0 && (
                                                <View style={styles.table}>
                                                    {category.type === 'raw_material' && (
                                                        <>
                                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                                <Text style={[styles.col, { width: '15%' }]}>Lot ID</Text>
                                                                <Text style={[styles.col, { width: '10%' }]}>Status</Text>
                                                                <Text style={[styles.col, { width: '15%', textAlign: 'right' }]}>Available</Text>
                                                                <Text style={[styles.col, { width: '12%' }]}>Received</Text>
                                                                <Text style={[styles.col, { width: '20%' }]}>Supplier</Text>
                                                                <Text style={[styles.col, styles.lastCol, { width: '28%' }]}>Collected By</Text>
                                                            </View>
                                                            {tagLots.map((lot: any, lotIdx: number) => (
                                                                <View key={lotIdx} style={styles.tableRow}>
                                                                    <Text style={[styles.col, { width: '15%', fontSize: 7 }]}>
                                                                        {lot.lot_id}
                                                                        {lot.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                                    </Text>
                                                                    <Text style={[styles.col, { width: '10%', fontSize: 7, color: lot.usable ? '#10b981' : '#f59e0b' }]}>
                                                                        {lot.usable ? 'Usable' : 'Unusable'}
                                                                    </Text>
                                                                    <Text style={[styles.col, { width: '15%', textAlign: 'right', fontSize: 7, fontWeight: 'bold' }]}>
                                                                        {lot.quantity_available.toFixed(2)} {lot.unit}
                                                                    </Text>
                                                                    <Text style={[styles.col, { width: '12%', fontSize: 7 }]}>{formatDate(lot.received_date)}</Text>
                                                                    <Text style={[styles.col, { width: '20%', fontSize: 7 }]}>{lot.supplier_name || 'N/A'}</Text>
                                                                    <Text style={[styles.col, styles.lastCol, { width: '28%', fontSize: 7 }]}>
                                                                        {lot.collected_by_name || 'N/A'}
                                                                    </Text>
                                                                </View>
                                                            ))}
                                                        </>
                                                    )}

                                                    {category.type === 'recurring_product' && (
                                                        <>
                                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                                <Text style={[styles.col, { width: '20%' }]}>Lot ID</Text>
                                                                <Text style={[styles.col, { width: '35%' }]}>Item Name</Text>
                                                                <Text style={[styles.col, { width: '25%', textAlign: 'right' }]}>Available</Text>
                                                                <Text style={[styles.col, styles.lastCol, { width: '20%' }]}>Received</Text>
                                                            </View>
                                                            {tagLots.map((lot: any, lotIdx: number) => (
                                                                <View key={lotIdx} style={styles.tableRow}>
                                                                    <Text style={[styles.col, { width: '20%', fontSize: 7 }]}>
                                                                        {lot.lot_id}
                                                                        {lot.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                                    </Text>
                                                                    <Text style={[styles.col, { width: '35%', fontSize: 7 }]}>{lot.name}</Text>
                                                                    <Text style={[styles.col, { width: '25%', textAlign: 'right', fontSize: 7, fontWeight: 'bold' }]}>
                                                                        {lot.quantity_available.toFixed(2)} {lot.unit}
                                                                    </Text>
                                                                    <Text style={[styles.col, styles.lastCol, { width: '20%', fontSize: 7 }]}>{formatDate(lot.received_date)}</Text>
                                                                </View>
                                                            ))}
                                                        </>
                                                    )}

                                                    {category.type === 'produced_goods' && (
                                                        <>
                                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                                <Text style={[styles.col, { width: '25%' }]}>Batch ID</Text>
                                                                <Text style={[styles.col, { width: '20%', textAlign: 'right' }]}>Created</Text>
                                                                <Text style={[styles.col, { width: '20%', textAlign: 'right' }]}>Available</Text>
                                                                <Text style={[styles.col, { width: '15%', textAlign: 'right' }]}>Sold/Used</Text>
                                                                <Text style={[styles.col, styles.lastCol, { width: '20%' }]}>Production Date</Text>
                                                            </View>
                                                            {tagLots.map((batch: any, batchIdx: number) => {
                                                                const soldUsed = batch.quantity_created - batch.quantity_available;
                                                                return (
                                                                    <View key={batchIdx} style={styles.tableRow}>
                                                                        <Text style={[styles.col, { width: '25%', fontSize: 7 }]}>
                                                                            {batch.batch_name}
                                                                            {batch.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                                        </Text>
                                                                        <Text style={[styles.col, { width: '20%', textAlign: 'right', fontSize: 7 }]}>
                                                                            {batch.quantity_created.toFixed(2)} {batch.unit}
                                                                        </Text>
                                                                        <Text style={[styles.col, { width: '20%', textAlign: 'right', fontSize: 7, fontWeight: 'bold', color: '#10b981' }]}>
                                                                            {batch.quantity_available.toFixed(2)} {batch.unit}
                                                                        </Text>
                                                                        <Text style={[styles.col, { width: '15%', textAlign: 'right', fontSize: 7, color: '#64748b' }]}>
                                                                            {soldUsed.toFixed(2)}
                                                                        </Text>
                                                                        <Text style={[styles.col, styles.lastCol, { width: '20%', fontSize: 7 }]}>{formatDate(batch.production_date)}</Text>
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
                                <Text style={styles.emptyText}>No stock items found for this category.</Text>
                            )}
                        </View>

                        {/* Section 2: New Stock Arrivals (New Feature) */}
                        <View style={styles.section}>
                            <View style={[styles.sectionHeader, { borderLeftColor: category.color }]}>
                                <Text style={styles.sectionTitle}>New Stock Added ({periodLabel})</Text>
                            </View>
                            {catNewStock.length > 0 ? (
                                <View style={styles.table}>
                                    {category.type === 'raw_material' ? (
                                        // Raw Materials - Include Status and Collected By
                                        <>
                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                <Text style={[styles.col, { width: '12%' }]}>Date</Text>
                                                <Text style={[styles.col, { width: '20%' }]}>Item</Text>
                                                <Text style={[styles.col, { width: '12%' }]}>Lot ID</Text>
                                                <Text style={[styles.col, { width: '10%' }]}>Status</Text>
                                                <Text style={[styles.col, { width: '15%', textAlign: 'right' }]}>Quantity</Text>
                                                <Text style={[styles.col, { width: '15%' }]}>Supplier</Text>
                                                <Text style={[styles.col, styles.lastCol, { width: '16%' }]}>Collected By</Text>
                                            </View>
                                            {catNewStock.map((item, idx) => (
                                                <View key={idx} style={styles.tableRow}>
                                                    <Text style={[styles.col, { width: '12%', fontSize: 7 }]}>{formatDate(item.date)}</Text>
                                                    <Text style={[styles.col, { width: '20%', fontSize: 7 }]}>{item.item_name}</Text>
                                                    <Text style={[styles.col, { width: '12%', fontSize: 7 }]}>
                                                        {item.lot_batch_id}
                                                        {item.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                    </Text>
                                                    <Text style={[styles.col, { width: '10%', fontSize: 7, color: item.usable ? '#10b981' : '#f59e0b' }]}>
                                                        {item.usable ? 'Usable' : 'Unusable'}
                                                    </Text>
                                                    <Text style={[styles.col, { width: '15%', textAlign: 'right', fontSize: 7 }]}>
                                                        {item.quantity.toFixed(2)} {item.unit}
                                                    </Text>
                                                    <Text style={[styles.col, { width: '15%', fontSize: 7 }]}>{item.supplier || 'N/A'}</Text>
                                                    <Text style={[styles.col, styles.lastCol, { width: '16%', fontSize: 7 }]}>
                                                        {item.collected_by || 'N/A'}
                                                    </Text>
                                                </View>
                                            ))}
                                        </>
                                    ) : (
                                        // Other inventory types - Standard columns
                                        <>
                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                <Text style={[styles.col, { width: '25%' }]}>Date</Text>
                                                <Text style={[styles.col, { width: '35%' }]}>Item / Description</Text>
                                                <Text style={[styles.col, { width: '20%' }]}>Lot/Batch</Text>
                                                <Text style={[styles.col, styles.lastCol, { width: '20%', textAlign: 'right' }]}>Quantity</Text>
                                            </View>
                                            {catNewStock.map((item, idx) => (
                                                <View key={idx} style={styles.tableRow}>
                                                    <Text style={[styles.col, { width: '25%' }]}>{formatDate(item.date)}</Text>
                                                    <Text style={[styles.col, { width: '35%' }]}>{item.item_name}</Text>
                                                    <Text style={[styles.col, { width: '20%' }]}>
                                                        {item.lot_batch_id}
                                                        {item.is_archived && <Text style={styles.archivedBadge}> ARCHIVED</Text>}
                                                    </Text>
                                                    <Text style={[styles.col, styles.lastCol, { width: '20%', textAlign: 'right' }]}>
                                                        {item.quantity.toFixed(2)} {item.unit}
                                                    </Text>
                                                </View>
                                            ))}
                                        </>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No new stock added during this period.</Text>
                            )}
                        </View>

                        {/* Section 2: Critical Alerts - Out of Stock & Low Stock */}
                        {(catOut.length > 0 || catLow.length > 0) && (
                            <View style={styles.section}>
                                <View style={[styles.sectionHeader, { borderLeftColor: '#dc2626' }]}>
                                    <Text style={[styles.sectionTitle, { color: '#dc2626' }]}>⚠ Critical Stock Alerts</Text>
                                </View>

                                {/* Out of Stock - Detailed */}
                                {catOut.length > 0 && (
                                    <View style={{ marginBottom: 15 }}>
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#dc2626', marginBottom: 5 }}>
                                            OUT OF STOCK ({catOut.length} items)
                                        </Text>
                                        <View style={styles.table}>
                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                <Text style={[styles.col, { width: '40%' }]}>Tag Name</Text>
                                                <Text style={[styles.col, { width: '15%' }]}>Tag Key</Text>
                                                <Text style={[styles.col, { width: '15%', textAlign: 'right' }]}>Current Balance</Text>
                                                <Text style={[styles.col, { width: '15%' }]}>Unit</Text>
                                                <Text style={[styles.col, styles.lastCol, { width: '15%' }]}>Last Activity</Text>
                                            </View>
                                            {catOut.map((item, idx) => (
                                                <View key={idx} style={styles.tableRow}>
                                                    <Text style={[styles.col, { width: '40%', fontSize: 7, fontWeight: 'bold' }]}>{item.tag_name}</Text>
                                                    <Text style={[styles.col, { width: '15%', fontSize: 7 }]}>{item.tag_key}</Text>
                                                    <Text style={[styles.col, { width: '15%', textAlign: 'right', fontSize: 7, color: '#dc2626', fontWeight: 'bold' }]}>
                                                        {item.current_balance.toFixed(2)}
                                                    </Text>
                                                    <Text style={[styles.col, { width: '15%', fontSize: 7 }]}>{item.default_unit}</Text>
                                                    <Text style={[styles.col, styles.lastCol, { width: '15%', fontSize: 7 }]}>{formatDate(item.last_activity_date)}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <Text style={{ fontSize: 7, color: '#dc2626', marginTop: 3, fontStyle: 'italic' }}>
                                            ⚠ Action Required: Immediate reordering needed to prevent production/sales disruption
                                        </Text>
                                    </View>
                                )}

                                {/* Low Stock - Detailed */}
                                {catLow.length > 0 && (
                                    <View>
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#d97706', marginBottom: 5 }}>
                                            LOW STOCK ({catLow.length} items)
                                        </Text>
                                        <View style={styles.table}>
                                            <View style={[styles.tableRow, styles.tableHeader]}>
                                                <Text style={[styles.col, { width: '30%' }]}>Tag Name</Text>
                                                <Text style={[styles.col, { width: '12%' }]}>Tag Key</Text>
                                                <Text style={[styles.col, { width: '13%', textAlign: 'right' }]}>Current</Text>
                                                <Text style={[styles.col, { width: '13%', textAlign: 'right' }]}>Threshold</Text>
                                                <Text style={[styles.col, { width: '13%', textAlign: 'right' }]}>Shortage</Text>
                                                <Text style={[styles.col, { width: '10%' }]}>Unit</Text>
                                                <Text style={[styles.col, styles.lastCol, { width: '9%' }]}>Last Activity</Text>
                                            </View>
                                            {catLow.map((item, idx) => {
                                                const shortagePercent = ((item.shortage_amount / item.threshold_quantity) * 100).toFixed(0);
                                                return (
                                                    <View key={idx} style={styles.tableRow}>
                                                        <Text style={[styles.col, { width: '30%', fontSize: 7, fontWeight: 'bold' }]}>{item.tag_name}</Text>
                                                        <Text style={[styles.col, { width: '12%', fontSize: 7 }]}>{item.tag_key}</Text>
                                                        <Text style={[styles.col, { width: '13%', textAlign: 'right', fontSize: 7, color: '#d97706' }]}>
                                                            {item.current_balance.toFixed(2)}
                                                        </Text>
                                                        <Text style={[styles.col, { width: '13%', textAlign: 'right', fontSize: 7 }]}>
                                                            {item.threshold_quantity.toFixed(2)}
                                                        </Text>
                                                        <Text style={[styles.col, { width: '13%', textAlign: 'right', fontSize: 7, color: '#dc2626', fontWeight: 'bold' }]}>
                                                            {item.shortage_amount.toFixed(2)} ({shortagePercent}%)
                                                        </Text>
                                                        <Text style={[styles.col, { width: '10%', fontSize: 7 }]}>{item.default_unit}</Text>
                                                        <Text style={[styles.col, styles.lastCol, { width: '9%', fontSize: 7 }]}>{formatDate(item.last_activity_date)}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                        <Text style={{ fontSize: 7, color: '#d97706', marginTop: 3, fontStyle: 'italic' }}>
                                            ⚠ Recommendation: Plan reordering to maintain optimal stock levels
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}


                        {/* Section 3: Consumption & Waste Analysis */}
                        <View style={styles.section}>
                            <View style={[styles.sectionHeader, { borderLeftColor: category.color }]}>
                                <Text style={styles.sectionTitle}>Consumption & Waste Analysis ({periodLabel})</Text>
                            </View>
                            {catConsumption.length > 0 ? (
                                <View style={styles.table}>
                                    <View style={[styles.tableRow, styles.tableHeader]}>
                                        <Text style={[styles.col, { width: '35%' }]}>Tag Name</Text>
                                        <Text style={[styles.col, { width: '15%', textAlign: 'right' }]}>Consumed</Text>
                                        <Text style={[styles.col, { width: '15%', textAlign: 'right' }]}>Wasted</Text>
                                        <Text style={[styles.col, { width: '12%', textAlign: 'right' }]}>Waste %</Text>
                                        <Text style={[styles.col, { width: '11%', textAlign: 'center' }]}>Txns</Text>
                                        <Text style={[styles.col, styles.lastCol, { width: '12%' }]}>Unit</Text>
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
                                                    <Text style={[styles.col, { width: '35%', fontSize: 7 }]}>{tag.name}</Text>
                                                    <Text style={[styles.col, { width: '15%', textAlign: 'right', fontSize: 7, color: '#4f46e5', fontWeight: 'bold' }]}>
                                                        {tag.consumed.toFixed(2)}
                                                    </Text>
                                                    <Text style={[styles.col, { width: '15%', textAlign: 'right', fontSize: 7, color: '#e11d48' }]}>
                                                        {tag.wasted.toFixed(2)}
                                                    </Text>
                                                    <Text style={[styles.col, { width: '12%', textAlign: 'right', fontSize: 7, color: parseFloat(wastePercent) > 10 ? '#dc2626' : '#64748b', fontWeight: parseFloat(wastePercent) > 10 ? 'bold' : 'normal' }]}>
                                                        {wastePercent}%
                                                    </Text>
                                                    <Text style={[styles.col, { width: '11%', textAlign: 'center', fontSize: 7 }]}>
                                                        {totalTxns}
                                                    </Text>
                                                    <Text style={[styles.col, styles.lastCol, { width: '12%', fontSize: 7 }]}>{tag.unit}</Text>
                                                </View>
                                            );
                                        })}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No consumption recorded during this period.</Text>
                            )}
                            {catConsumption.length > 0 && (
                                <Text style={{ fontSize: 7, color: '#64748b', marginTop: 3, fontStyle: 'italic' }}>
                                    💡 Waste % above 10% requires investigation for process improvement
                                </Text>
                            )}
                        </View>

                        <View style={styles.footer}>
                            <Text>Hatvoni Inventory Management System | {category.label} Report</Text>
                        </View>
                    </Page>
                );
            })}
        </Document>
    );
};
