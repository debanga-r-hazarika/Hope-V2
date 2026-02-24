// Sales Analytics Types

export interface SalesAnalyticsFilters {
  startDate?: string;
  endDate?: string;
  customerType?: string;
  productTag?: string;
}

// Sales Summary
export interface SalesSummary {
  totalSalesValue: number;
  totalOrderedQuantity: number;
  totalOrdersCount: number;
  paidAmount: number;
  pendingAmount: number;
  pendingPaymentCount: number;
  partialPaymentCount: number;
  fullPaymentCount: number;
}

// Customer-wise Sales
export interface CustomerSalesReport {
  customerId: string;
  customerName: string;
  customerType: string;
  totalOrders: number;
  totalOrderedValue: number;
  outstandingAmount: number;
  lastOrderDate?: string;
}

// Product/Tag-wise Sales
export interface ProductSalesReport {
  tagId: string;
  tagName: string;
  quantitySold: number;
  totalSalesValue: number;
  shareOfTotalSales: number; // Percentage
  unit: string;
}

// Outstanding Payments
export interface OutstandingPaymentReport {
  customerId: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  orderedItemValue: number;
  amountReceived: number;
  balancePending: number;
  daysOutstanding: number;
}

// Sales Trend Data (for charts)
export interface SalesTrendData {
  month: string; // YYYY-MM format
  salesValue: number;
  ordersCount: number;
}

// Product Sales Trend Data (for charts)
export interface ProductSalesTrendData {
  month: string; // YYYY-MM format
  quantitySold: number;
  salesValue: number;
  ordersCount: number;
}

// Product Performance (for charts)
export interface ProductPerformanceData {
  tagName: string;
  salesValue: number;
  quantitySold: number;
  sharePercentage: number;
}

// Customer Concentration (for charts)
export interface CustomerConcentrationData {
  customerName: string;
  salesValue: number;
  sharePercentage: number;
}

// Top/Bottom Products
export interface ProductExtremeData {
  tagId: string;
  tagName: string;
  quantitySold: number;
  salesValue: number;
  unit: string;
  rank: number;
}

// Customer Payment Performance
export interface CustomerPaymentPerformance {
  customerId: string;
  customerName: string;
  customerType: string;
  totalPaid: number;
  totalOutstanding: number;
  averageDelayDays: number;
  ordersCount: number;
}

// Sales Distribution Analysis
export interface SalesDistribution {
  top1CustomerShare: number;
  top3CustomersShare: number;
  top5CustomersShare: number;
  top1ProductShare: number;
  top3ProductsShare: number;
}

// Customer Type Distribution
export interface CustomerTypeDistribution {
  customerType: string;
  totalSales: number;
  orderCount: number;
  customerCount: number;
  sharePercentage: number;
}
