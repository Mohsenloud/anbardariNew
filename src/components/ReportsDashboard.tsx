import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Product, Invoice, InvoiceItem, PurchaseInvoice, Customer, StoreSettings, AppUser } from '../types';
import {
  formatPrice,
  toPersianDigits,
  toEnglishDigits,
  getCurrentJalaliDate,
  addDaysToJalali,
  getInvoiceDaysAge,
} from '../utils/jalali';
import { isServiceItem } from '../utils/serviceHelper';
import { JalaliDatePicker } from './JalaliDatePicker';
import {
  TrendingUp,
  DollarSign,
  Boxes,
  ShoppingBag,
  AlertTriangle,
  Award,
  ArrowUpRight,
  PieChart,
  Wallet,
  FileSpreadsheet,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  BarChart3,
  FileText,
  UserCheck,
  PackageSearch,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Filter,
} from 'lucide-react';

interface ReportsDashboardProps {
  products: Product[];
  invoices: Invoice[];
  purchaseInvoices?: PurchaseInvoice[];
  customers?: Customer[];
  settings: StoreSettings;
  currentUser?: AppUser;
  onOpenNewInvoice: () => void;
  onOpenInventory: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

type DatePeriodFilter = 'all' | 'today' | '7days' | '30days' | 'year' | 'custom';
type ReportSubTab = 'overview' | 'product_customer' | 'profitability' | 'cashflow' | 'warehouse';
type ItemSortMode = 'profit' | 'revenue' | 'quantity' | 'margin';
type ItemTypeFilter = 'all' | 'goods' | 'services';
type WarehouseHealthFilter = 'low_stock' | 'out_of_stock' | 'stagnant';
type MatrixViewMode = 'by_product' | 'by_customer' | 'flat_log';
type MatrixSortMode = 'quantity' | 'revenue' | 'profit' | 'invoices';

/**
 * Normalizes any Jalali date string (e.g. "۱۴۰۳/۷/۵") to standard comparable "1403/07/05"
 */
function normalizeJalaliComparable(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = toEnglishDigits(dateStr).replace(/[^\d/]/g, '').trim();
  const parts = clean.split('/').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return clean;
  }
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${parts[0]}/${pad(parts[1])}/${pad(parts[2])}`;
}

/**
 * Checks whether a catalog product represents a non-physical service item.
 */
function isCatalogProductService(prod: Product): boolean {
  if (!prod) return false;
  if ((prod as any).isService === true || (prod as any).type === 'service') return true;
  const cat = (prod.category || '').trim().toLowerCase();
  if (cat === 'خدمات' || cat.includes('خدمات') || cat === 'service' || cat === 'services') {
    return true;
  }
  const code = (prod.code || '').trim().toUpperCase();
  if (code.startsWith('SRV-') || code.startsWith('SRV')) {
    return true;
  }
  return false;
}

/**
 * Resolves the unit cost (buyPrice) of an invoice item, falling back to the product/variant catalog
 * if the invoice item was saved with buyPrice = 0 or undefined.
 */
function resolveItemUnitCost(item: InvoiceItem, products: Product[]): number {
  const directBuyPrice = Number(item.buyPrice) || 0;
  if (directBuyPrice > 0) return directBuyPrice;

  if (!products || products.length === 0) return 0;

  const matchedProduct = products.find(
    (p) =>
      (item.productId && p.id === item.productId) ||
      (p.code && (item.productCode || item.code) && p.code.trim() === (item.productCode || item.code || '').trim())
  );

  if (!matchedProduct) return 0;

  if (matchedProduct.hasVariants && matchedProduct.variants && matchedProduct.variants.length > 0) {
    const matchedVariant = matchedProduct.variants.find(
      (v) =>
        (item.variantId && v.id === item.variantId) ||
        (item.variantName && v.name.trim() === item.variantName.trim())
    );
    if (matchedVariant && Number(matchedVariant.buyPrice) > 0) {
      return Number(matchedVariant.buyPrice);
    }
  }

  return Number(matchedProduct.buyPrice || matchedProduct.purchasePrice) || 0;
}

/**
 * Calculates the actual paid and remaining amounts for a confirmed invoice.
 */
function resolveInvoicePaymentBreakdown(inv: Invoice): { paid: number; remaining: number } {
  const finalTotal = Math.max(0, Number(inv.finalTotal) || 0);
  if (inv.paymentStatus === 'paid') {
    return { paid: finalTotal, remaining: 0 };
  }
  if (inv.paymentStatus === 'unpaid') {
    return { paid: 0, remaining: finalTotal };
  }
  // partial
  const paid = Math.min(finalTotal, Math.max(0, Number(inv.paidAmount) || 0));
  return { paid, remaining: Math.max(0, finalTotal - paid) };
}

export interface ProductCustomerSaleInvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  productKey: string;
  productCode: string;
  productName: string;
  unit: string;
  isService: boolean;
  quantity: number;
  unitPrice: number;
  discountShare: number;
  netRevenue: number;
  totalCost: number;
  netProfit: number;
  paymentStatus: Invoice['paymentStatus'];
  rawInvoice: Invoice;
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  products,
  invoices,
  purchaseInvoices = [],
  settings,
  currentUser,
  onOpenInventory,
  onViewInvoice,
}) => {
  const [periodFilter, setPeriodFilter] = useState<DatePeriodFilter>('all');
  const [customFromDate, setCustomFromDate] = useState<string>(() => addDaysToJalali(-30));
  const [customToDate, setCustomToDate] = useState<string>(() => getCurrentJalaliDate());

  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('overview');
  const [itemSortMode, setItemSortMode] = useState<ItemSortMode>('profit');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [warehouseHealthFilter, setWarehouseHealthFilter] = useState<WarehouseHealthFilter>('low_stock');

  // States for Product-to-Customer Matrix Report Tab
  const [matrixViewMode, setMatrixViewMode] = useState<MatrixViewMode>('by_product');
  const [matrixSortMode, setMatrixSortMode] = useState<MatrixSortMode>('quantity');
  const [selectedProductKey, setSelectedProductKey] = useState<string>('ALL');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string>('ALL');
  const [matrixProductSearch, setMatrixProductSearch] = useState<string>('');
  const [matrixCustomerSearch, setMatrixCustomerSearch] = useState<string>('');
  const [expandedMatrixRowKey, setExpandedMatrixRowKey] = useState<string | null>(null);

  const currentJalaliYear = useMemo(() => {
    const today = toEnglishDigits(getCurrentJalaliDate());
    return today.split('/')[0] || '1404';
  }, []);

  // Filter helper by date period (including custom from/to Jalali range)
  const matchesPeriod = (dateStr?: string, createdAt?: string): boolean => {
    if (periodFilter === 'all') return true;
    if (periodFilter === 'custom') {
      const targetNorm = normalizeJalaliComparable(dateStr);
      if (!targetNorm) return false;
      const fromNorm = normalizeJalaliComparable(customFromDate);
      const toNorm = normalizeJalaliComparable(customToDate);
      if (fromNorm && targetNorm < fromNorm) return false;
      if (toNorm && targetNorm > toNorm) return false;
      return true;
    }
    const ageDays = getInvoiceDaysAge(dateStr, createdAt);
    if (periodFilter === 'today') return ageDays === 0;
    if (periodFilter === '7days') return ageDays <= 7;
    if (periodFilter === '30days') return ageDays <= 30;
    if (periodFilter === 'year') {
      const cleanDate = toEnglishDigits(dateStr || '').trim();
      if (cleanDate.startsWith(currentJalaliYear)) return true;
      return ageDays <= 365;
    }
    return true;
  };

  // Separate confirmed sales invoices from proforma quotes within the selected period
  const { confirmedInvoices, proformaInvoices, periodPurchaseInvoices } = useMemo(() => {
    const filteredInvs = invoices.filter((inv) => matchesPeriod(inv.date, inv.createdAt));
    const confirmed = filteredInvs.filter((inv) => !inv.isProforma);
    const proformas = filteredInvs.filter((inv) => Boolean(inv.isProforma));
    const purchases = purchaseInvoices.filter(
      (pi) => pi.status !== 'cancelled' && matchesPeriod(pi.date, pi.createdAt)
    );
    return {
      confirmedInvoices: confirmed,
      proformaInvoices: proformas,
      periodPurchaseInvoices: purchases,
    };
  }, [invoices, purchaseInvoices, periodFilter, customFromDate, customToDate, currentJalaliYear]);

  // Comprehensive Financial, COGS, Profit, Item-Level & Product-to-Customer Matrix Analytics
  const financialAnalytics = useMemo(() => {
    let grossSalesTotal = 0; // Sum of finalTotal (includes tax, net of discounts)
    let netSalesExclTax = 0; // Revenue excluding VAT/Tax
    let totalTaxCollected = 0;
    let totalDiscountsGiven = 0;
    let totalCostOfGoodsSold = 0;
    let goodsRevenue = 0;
    let serviceRevenue = 0;
    let goodsCost = 0;
    let serviceCost = 0;

    let totalCollected = 0;
    let totalReceivables = 0;
    let paidInvoicesCount = 0;
    let partialInvoicesCount = 0;
    let unpaidInvoicesCount = 0;

    const paymentMethodTotals: Record<string, { label: string; amount: number; count: number }> = {
      cash: { label: 'نقدی', amount: 0, count: 0 },
      pos: { label: 'دستگاه کارتخوان (POS)', amount: 0, count: 0 },
      transfer: { label: 'واریز به حساب / کارت به کارت', amount: 0, count: 0 },
      cheque: { label: 'چک بانکی', amount: 0, count: 0 },
      credit: { label: 'نسیه / اعتباری', amount: 0, count: 0 },
    };

    const itemStatsMap: Record<
      string,
      {
        key: string;
        code: string;
        name: string;
        unit: string;
        isService: boolean;
        quantity: number;
        netRevenue: number;
        totalCost: number;
        netProfit: number;
        marginPercent: number;
        invoiceCount: number;
        uniqueBuyersCount: number;
      }
    > = {};

    const itemBuyersSetMap: Record<string, Set<string>> = {};

    const customerStatsMap: Record<
      string,
      {
        id: string;
        name: string;
        phone: string;
        invoicesCount: number;
        totalPurchased: number;
        totalPaid: number;
        totalDebt: number;
      }
    > = {};

    const saleRecords: ProductCustomerSaleInvoiceRecord[] = [];

    confirmedInvoices.forEach((inv) => {
      const invFinal = Math.max(0, Number(inv.finalTotal) || 0);
      const invTax = Math.max(0, Number(inv.taxAmount) || 0);
      const invInvoiceDiscount = Math.max(0, Number(inv.totalDiscount) || 0);
      const invNetExclTax = Math.max(0, invFinal - invTax);

      grossSalesTotal += invFinal;
      netSalesExclTax += invNetExclTax;
      totalTaxCollected += invTax;

      // Payment & Receivables breakdown
      const { paid, remaining } = resolveInvoicePaymentBreakdown(inv);
      totalCollected += paid;
      totalReceivables += remaining;

      if (inv.paymentStatus === 'paid') paidInvoicesCount++;
      else if (inv.paymentStatus === 'partial') partialInvoicesCount++;
      else unpaidInvoicesCount++;

      const methodKey = inv.paymentMethod && paymentMethodTotals[inv.paymentMethod] ? inv.paymentMethod : 'cash';
      paymentMethodTotals[methodKey].amount += invFinal;
      paymentMethodTotals[methodKey].count += 1;

      // Customer breakdown
      const custKey = (inv.customerId || inv.customerName || 'unknown').trim();
      const custName = (inv.customerName || 'مشتری عمومی').trim();
      const custPhone = (inv.customerPhone || '').trim();

      if (!customerStatsMap[custKey]) {
        customerStatsMap[custKey] = {
          id: custKey,
          name: custName,
          phone: custPhone,
          invoicesCount: 0,
          totalPurchased: 0,
          totalPaid: 0,
          totalDebt: 0,
        };
      }
      customerStatsMap[custKey].invoicesCount += 1;
      customerStatsMap[custKey].totalPurchased += invFinal;
      customerStatsMap[custKey].totalPaid += paid;
      customerStatsMap[custKey].totalDebt += remaining;

      // Calculate sum of line totals to distribute invoice-level discount proportionally
      const itemsSubtotalAfterRowDiscount = inv.items.reduce((acc, it) => {
        const qty = Math.max(0, Number(it.quantity) || 0);
        const unitPrice = Math.max(0, Number(it.unitPrice ?? it.price) || 0);
        const rowDisc = Math.max(0, Number(it.discount) || 0);
        const rowTotal = Number(it.total) || Math.max(0, qty * unitPrice - rowDisc);
        return acc + rowTotal;
      }, 0);

      let rowDiscountsSum = 0;
      const seenItemsInInvoice = new Set<string>();

      inv.items.forEach((item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        const unitPrice = Math.max(0, Number(item.unitPrice ?? item.price) || 0);
        const rowDiscount = Math.max(0, Number(item.discount) || 0);
        rowDiscountsSum += rowDiscount;

        const rawRowTotal = Number(item.total) || Math.max(0, qty * unitPrice - rowDiscount);
        // Proportionally deduct invoice-level discount from each line item's net revenue
        const discountShare =
          itemsSubtotalAfterRowDiscount > 0
            ? (rawRowTotal / itemsSubtotalAfterRowDiscount) * invInvoiceDiscount
            : 0;
        const itemNetRevenue = Math.max(0, rawRowTotal - discountShare);

        const unitCost = resolveItemUnitCost(item, products);
        const itemTotalCost = qty * unitCost;
        const itemNetProfit = itemNetRevenue - itemTotalCost;
        const serviceFlag = isServiceItem(item, products);

        totalCostOfGoodsSold += itemTotalCost;

        if (serviceFlag) {
          serviceRevenue += itemNetRevenue;
          serviceCost += itemTotalCost;
        } else {
          goodsRevenue += itemNetRevenue;
          goodsCost += itemTotalCost;
        }

        const pid =
          item.productId ||
          item.productCode ||
          item.code ||
          (item.productName || item.name || 'item').trim();
        const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
        const statKey = item.variantId ? `${pid}_${item.variantId}` : pid;
        const displayProductName = `${item.productName || item.name || 'بدون نام'}${variantSuffix}`;
        const displayProductCode = item.productCode || item.code || '-';
        const displayUnit = item.unit || 'عدد';

        if (!itemStatsMap[statKey]) {
          itemStatsMap[statKey] = {
            key: statKey,
            code: displayProductCode,
            name: displayProductName,
            unit: displayUnit,
            isService: serviceFlag,
            quantity: 0,
            netRevenue: 0,
            totalCost: 0,
            netProfit: 0,
            marginPercent: 0,
            invoiceCount: 0,
            uniqueBuyersCount: 0,
          };
          itemBuyersSetMap[statKey] = new Set<string>();
        }

        itemStatsMap[statKey].quantity += qty;
        itemStatsMap[statKey].netRevenue += itemNetRevenue;
        itemStatsMap[statKey].totalCost += itemTotalCost;
        itemBuyersSetMap[statKey].add(custKey);

        if (!seenItemsInInvoice.has(statKey)) {
          itemStatsMap[statKey].invoiceCount += 1;
          seenItemsInInvoice.add(statKey);
        }

        saleRecords.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          customerId: custKey,
          customerName: custName,
          customerPhone: custPhone,
          productKey: statKey,
          productCode: displayProductCode,
          productName: displayProductName,
          unit: displayUnit,
          isService: serviceFlag,
          quantity: qty,
          unitPrice,
          discountShare: rowDiscount + discountShare,
          netRevenue: itemNetRevenue,
          totalCost: itemTotalCost,
          netProfit: itemNetProfit,
          paymentStatus: inv.paymentStatus,
          rawInvoice: inv,
        });
      });

      totalDiscountsGiven += invInvoiceDiscount + rowDiscountsSum;
    });

    // Finalize item profit, margin, and unique buyers count
    const allSoldItems = Object.values(itemStatsMap).map((entry) => {
      const netProfit = entry.netRevenue - entry.totalCost;
      const marginPercent =
        entry.netRevenue > 0 ? Math.round((netProfit / entry.netRevenue) * 100) : 0;
      return {
        ...entry,
        netProfit,
        marginPercent,
        uniqueBuyersCount: itemBuyersSetMap[entry.key]?.size || 0,
      };
    });

    // Net operating profit = Net sales (excl. tax) - COGS
    const netProfit = netSalesExclTax - totalCostOfGoodsSold;
    const profitMargin =
      netSalesExclTax > 0 ? Math.round((netProfit / netSalesExclTax) * 100) : 0;

    const proformaTotalValue = proformaInvoices.reduce(
      (sum, inv) => sum + (Number(inv.finalTotal) || 0),
      0
    );

    const totalPurchaseSpend = periodPurchaseInvoices.reduce(
      (sum, pi) => sum + (Number(pi.finalTotal) || 0),
      0
    );

    const topCustomers = Object.values(customerStatsMap).sort(
      (a, b) => b.totalPurchased - a.totalPurchased
    );

    const debtorCustomers = Object.values(customerStatsMap)
      .filter((c) => c.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return {
      grossSalesTotal,
      netSalesExclTax,
      totalTaxCollected,
      totalDiscountsGiven,
      totalCostOfGoodsSold,
      netProfit,
      profitMargin,
      goodsRevenue,
      serviceRevenue,
      goodsProfit: goodsRevenue - goodsCost,
      serviceProfit: serviceRevenue - serviceCost,
      totalCollected,
      totalReceivables,
      paidInvoicesCount,
      partialInvoicesCount,
      unpaidInvoicesCount,
      paymentMethodList: Object.values(paymentMethodTotals).filter((m) => m.count > 0),
      allSoldItems,
      proformaTotalValue,
      totalPurchaseSpend,
      topCustomers,
      debtorCustomers,
      saleRecords,
    };
  }, [confirmedInvoices, proformaInvoices, periodPurchaseInvoices, products]);

  // Product-to-Customer Matrix Analytics (کدام محصول به چه اشخاصی و به چه مقدار فروخته شده است)
  const productCustomerMatrix = useMemo(() => {
    const prodSearch = matrixProductSearch.trim().toLowerCase();
    const custSearch = matrixCustomerSearch.trim().toLowerCase();

    // Filter saleRecords by selected product, selected customer, and search queries
    const filteredRecords = financialAnalytics.saleRecords.filter((rec) => {
      if (selectedProductKey !== 'ALL' && rec.productKey !== selectedProductKey) return false;
      if (selectedCustomerKey !== 'ALL' && rec.customerId !== selectedCustomerKey) return false;
      if (prodSearch) {
        const matchProd =
          rec.productName.toLowerCase().includes(prodSearch) ||
          rec.productCode.toLowerCase().includes(prodSearch);
        if (!matchProd) return false;
      }
      if (custSearch) {
        const matchCust =
          rec.customerName.toLowerCase().includes(custSearch) ||
          rec.customerPhone.toLowerCase().includes(custSearch);
        if (!matchCust) return false;
      }
      return true;
    });

    // Summary metrics for filtered selection
    let totalQuantity = 0;
    let totalNetRevenue = 0;
    let totalNetProfit = 0;
    let minUnitPrice = Infinity;
    let maxUnitPrice = 0;
    const uniqueCustomersSet = new Set<string>();
    const uniqueProductsSet = new Set<string>();
    const uniqueInvoicesSet = new Set<string>();
    const unitsSet = new Set<string>();

    filteredRecords.forEach((rec) => {
      totalQuantity += rec.quantity;
      totalNetRevenue += rec.netRevenue;
      totalNetProfit += rec.netProfit;
      if (rec.unitPrice > 0) {
        if (rec.unitPrice < minUnitPrice) minUnitPrice = rec.unitPrice;
        if (rec.unitPrice > maxUnitPrice) maxUnitPrice = rec.unitPrice;
      }
      uniqueCustomersSet.add(rec.customerId);
      uniqueProductsSet.add(rec.productKey);
      uniqueInvoicesSet.add(rec.invoiceId);
      unitsSet.add(rec.unit);
    });

    if (minUnitPrice === Infinity) minUnitPrice = 0;
    const avgUnitPrice = totalQuantity > 0 ? Math.round(totalNetRevenue / totalQuantity) : 0;
    const dominantUnit = unitsSet.size === 1 ? Array.from(unitsSet)[0] : 'واحد';

    // Group 1: By Product -> Breakdown of Customers who bought that product (and also direct Customer rows when a product is selected)
    const productCustomerPairMap: Record<
      string,
      {
        pairKey: string;
        productKey: string;
        productCode: string;
        productName: string;
        unit: string;
        isService: boolean;
        customerId: string;
        customerName: string;
        customerPhone: string;
        quantity: number;
        netRevenue: number;
        totalCost: number;
        netProfit: number;
        minUnitPrice: number;
        maxUnitPrice: number;
        avgUnitPrice: number;
        firstDate: string;
        lastDate: string;
        invoicesCount: number;
        invoiceIds: Set<string>;
        records: ProductCustomerSaleInvoiceRecord[];
      }
    > = {};

    // Total quantity per product (to calculate each customer's percentage share of that product)
    const productTotalQtyMap: Record<string, number> = {};
    const customerTotalSpentMap: Record<string, number> = {};

    filteredRecords.forEach((rec) => {
      productTotalQtyMap[rec.productKey] = (productTotalQtyMap[rec.productKey] || 0) + rec.quantity;
      customerTotalSpentMap[rec.customerId] =
        (customerTotalSpentMap[rec.customerId] || 0) + rec.netRevenue;

      const pairKey = `${rec.productKey}__${rec.customerId}`;
      if (!productCustomerPairMap[pairKey]) {
        productCustomerPairMap[pairKey] = {
          pairKey,
          productKey: rec.productKey,
          productCode: rec.productCode,
          productName: rec.productName,
          unit: rec.unit,
          isService: rec.isService,
          customerId: rec.customerId,
          customerName: rec.customerName,
          customerPhone: rec.customerPhone,
          quantity: 0,
          netRevenue: 0,
          totalCost: 0,
          netProfit: 0,
          minUnitPrice: rec.unitPrice > 0 ? rec.unitPrice : Infinity,
          maxUnitPrice: rec.unitPrice > 0 ? rec.unitPrice : 0,
          avgUnitPrice: 0,
          firstDate: rec.date,
          lastDate: rec.date,
          invoicesCount: 0,
          invoiceIds: new Set<string>(),
          records: [],
        };
      }

      const entry = productCustomerPairMap[pairKey];
      entry.quantity += rec.quantity;
      entry.netRevenue += rec.netRevenue;
      entry.totalCost += rec.totalCost;
      entry.netProfit += rec.netProfit;
      if (rec.unitPrice > 0) {
        if (rec.unitPrice < entry.minUnitPrice) entry.minUnitPrice = rec.unitPrice;
        if (rec.unitPrice > entry.maxUnitPrice) entry.maxUnitPrice = rec.unitPrice;
      }

      const recNorm = normalizeJalaliComparable(rec.date);
      if (recNorm < normalizeJalaliComparable(entry.firstDate)) {
        entry.firstDate = rec.date;
      }
      if (recNorm > normalizeJalaliComparable(entry.lastDate)) {
        entry.lastDate = rec.date;
      }

      entry.invoiceIds.add(rec.invoiceId);
      entry.invoicesCount = entry.invoiceIds.size;
      entry.records.push(rec);
    });

    const pairRows = Object.values(productCustomerPairMap)
      .map((entry) => {
        const avg = entry.quantity > 0 ? Math.round(entry.netRevenue / entry.quantity) : 0;
        const prodTotalQty = productTotalQtyMap[entry.productKey] || 1;
        const shareOfProductQtyPercent = Math.round((entry.quantity / prodTotalQty) * 100);
        const custTotalSpent = customerTotalSpentMap[entry.customerId] || 1;
        const shareOfCustomerSpendPercent = Math.round((entry.netRevenue / custTotalSpent) * 100);

        return {
          ...entry,
          minUnitPrice: entry.minUnitPrice === Infinity ? 0 : entry.minUnitPrice,
          avgUnitPrice: avg,
          shareOfProductQtyPercent,
          shareOfCustomerSpendPercent,
        };
      })
      .sort((a, b) => {
        if (matrixSortMode === 'quantity') return b.quantity - a.quantity;
        if (matrixSortMode === 'revenue') return b.netRevenue - a.netRevenue;
        if (matrixSortMode === 'profit') return b.netProfit - a.netProfit;
        return b.invoicesCount - a.invoicesCount;
      });

    return {
      filteredRecords,
      pairRows,
      totalQuantity,
      totalNetRevenue,
      totalNetProfit,
      minUnitPrice,
      maxUnitPrice,
      avgUnitPrice,
      dominantUnit,
      uniqueCustomersCount: uniqueCustomersSet.size,
      uniqueProductsCount: uniqueProductsSet.size,
      uniqueInvoicesCount: uniqueInvoicesSet.size,
    };
  }, [
    financialAnalytics.saleRecords,
    selectedProductKey,
    selectedCustomerKey,
    matrixProductSearch,
    matrixCustomerSearch,
    matrixSortMode,
  ]);

  // Physical Inventory Valuation & Health Analysis (Excludes non-physical Services & handles Variants)
  const warehouseAnalytics = useMemo(() => {
    const physicalProducts = products.filter((p) => !isCatalogProductService(p));

    // Track which product IDs have ever been sold in any confirmed invoice (all-time)
    const everSoldProductIds = new Set<string>();
    const everSoldProductCodes = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.isProforma) return;
      inv.items.forEach((it) => {
        if (it.productId) everSoldProductIds.add(it.productId);
        if (it.productCode) everSoldProductCodes.add(it.productCode.trim());
      });
    });

    let inventoryCostValue = 0;
    let inventorySalesValue = 0;
    let totalPhysicalUnits = 0;

    const categoryMap: Record<
      string,
      {
        category: string;
        skuCount: number;
        totalStock: number;
        costValue: number;
        salesValue: number;
        potentialProfit: number;
      }
    > = {};

    const lowStockList: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
      unit: string;
      stock: number;
      minStockAlert: number;
      buyPrice: number;
    }> = [];

    const stagnantList: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
      unit: string;
      stock: number;
      tiedCapital: number;
    }> = [];

    let healthyCount = 0;
    let lowStockOnlyCount = 0;
    let outOfStockCount = 0;

    physicalProducts.forEach((p) => {
      const catName = (p.category || 'عمومی / دسته‌بندی نشده').trim();
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          category: catName,
          skuCount: 0,
          totalStock: 0,
          costValue: 0,
          salesValue: 0,
          potentialProfit: 0,
        };
      }
      categoryMap[catName].skuCount += 1;

      let prodCostVal = 0;
      let prodSalesVal = 0;
      let prodStock = 0;

      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const vStock = Math.max(0, Number(v.stock) || 0);
          const vBuy = Number(v.buyPrice) > 0 ? Number(v.buyPrice) : Number(p.buyPrice) || 0;
          const vSell = Number(v.sellPrice) > 0 ? Number(v.sellPrice) : Number(p.sellPrice) || 0;
          prodStock += vStock;
          prodCostVal += vStock * vBuy;
          prodSalesVal += vStock * vSell;
        });
      } else {
        prodStock = Math.max(0, Number(p.stock) || 0);
        prodCostVal = prodStock * (Number(p.buyPrice) || 0);
        prodSalesVal = prodStock * (Number(p.sellPrice) || 0);
      }

      inventoryCostValue += prodCostVal;
      inventorySalesValue += prodSalesVal;
      totalPhysicalUnits += prodStock;

      categoryMap[catName].totalStock += prodStock;
      categoryMap[catName].costValue += prodCostVal;
      categoryMap[catName].salesValue += prodSalesVal;
      categoryMap[catName].potentialProfit += Math.max(0, prodSalesVal - prodCostVal);

      const minAlert = Math.max(0, Number(p.minStockAlert) || 0);
      if (prodStock === 0) {
        outOfStockCount++;
        lowStockList.push({
          id: p.id,
          code: p.code,
          name: p.name,
          category: catName,
          unit: p.unit,
          stock: prodStock,
          minStockAlert: minAlert,
          buyPrice: Number(p.buyPrice) || 0,
        });
      } else if (prodStock <= minAlert) {
        lowStockOnlyCount++;
        lowStockList.push({
          id: p.id,
          code: p.code,
          name: p.name,
          category: catName,
          unit: p.unit,
          stock: prodStock,
          minStockAlert: minAlert,
          buyPrice: Number(p.buyPrice) || 0,
        });
      } else {
        healthyCount++;
      }

      // Check stagnant / dead stock (has stock in warehouse, never sold)
      const wasSold =
        everSoldProductIds.has(p.id) || (p.code && everSoldProductCodes.has(p.code.trim()));
      if (prodStock > 0 && !wasSold) {
        stagnantList.push({
          id: p.id,
          code: p.code,
          name: p.name,
          category: catName,
          unit: p.unit,
          stock: prodStock,
          tiedCapital: prodCostVal,
        });
      }
    });

    lowStockList.sort((a, b) => a.stock - b.stock);
    stagnantList.sort((a, b) => b.tiedCapital - a.tiedCapital);

    const categoryBreakdown = Object.values(categoryMap).sort(
      (a, b) => b.costValue - a.costValue
    );

    return {
      physicalProductsCount: physicalProducts.length,
      totalPhysicalUnits,
      inventoryCostValue,
      inventorySalesValue,
      potentialInventoryProfit: Math.max(0, inventorySalesValue - inventoryCostValue),
      healthyCount,
      lowStockOnlyCount,
      outOfStockCount,
      lowStockList,
      stagnantList,
      categoryBreakdown,
    };
  }, [products, invoices]);

  // Filtered & sorted items for Profitability tab and Overview top list
  const sortedItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    return financialAnalytics.allSoldItems
      .filter((it) => {
        if (itemTypeFilter === 'goods' && it.isService) return false;
        if (itemTypeFilter === 'services' && !it.isService) return false;
        if (q) {
          return (
            it.name.toLowerCase().includes(q) ||
            it.code.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (itemSortMode === 'profit') return b.netProfit - a.netProfit;
        if (itemSortMode === 'revenue') return b.netRevenue - a.netRevenue;
        if (itemSortMode === 'margin') return b.marginPercent - a.marginPercent;
        return b.quantity - a.quantity;
      });
  }, [financialAnalytics.allSoldItems, itemTypeFilter, itemSearchQuery, itemSortMode]);

  // Helper to jump from any product row to its buyers report in the Product-Customer Matrix tab
  const handleInspectProductBuyers = (productKey: string) => {
    setSelectedProductKey(productKey);
    setSelectedCustomerKey('ALL');
    setMatrixProductSearch('');
    setMatrixCustomerSearch('');
    setMatrixViewMode('by_product');
    setActiveSubTab('product_customer');
  };

  // Export only the Product-to-Customer Matrix Excel
  const handleExportMatrixExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = productCustomerMatrix.pairRows.map((r, idx) => ({
      'ردیف': idx + 1,
      'کد کالا / خدمت': r.productCode,
      'نام کالا / محصول': r.productName,
      'نام شخص / مشتری': r.customerName,
      'تلفن مشتری': r.customerPhone || '-',
      'مقدار خریداری‌شده': r.quantity,
      'واحد': r.unit,
      'سهم از کل فروش این محصول (%)': `${r.shareOfProductQtyPercent}%`,
      'تعداد دفعات خرید (فاکتور)': r.invoicesCount,
      'میانگین فی فروش': r.avgUnitPrice,
      'کمترین فی': r.minUnitPrice,
      'بیشترین فی': r.maxUnitPrice,
      'مبلغ خالص فروش': Math.round(r.netRevenue),
      'سود خالص': Math.round(r.netProfit),
      'اولین خرید در بازه': r.firstDate,
      'آخرین خرید در بازه': r.lastDate,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'فروش کالا به اشخاص');

    const logRows = productCustomerMatrix.filteredRecords.map((rec, idx) => ({
      'ردیف': idx + 1,
      'تاریخ فاکتور': rec.date,
      'شماره فاکتور': rec.invoiceNumber,
      'نام مشتری / شخص': rec.customerName,
      'کد کالا': rec.productCode,
      'نام کالا / محصول': rec.productName,
      'مقدار': rec.quantity,
      'واحد': rec.unit,
      'فی واحد': rec.unitPrice,
      'مبلغ خالص ردیف': Math.round(rec.netRevenue),
      'سود ردیف': Math.round(rec.netProfit),
    }));
    if (logRows.length > 0) {
      const wsLog = XLSX.utils.json_to_sheet(logRows);
      XLSX.utils.book_append_sheet(wb, wsLog, 'ریز فاکتورهای فروش کالا');
    }

    const dateStamp = toEnglishDigits(getCurrentJalaliDate()).replace(/\//g, '-');
    XLSX.writeFile(wb, `گزارش_فروش_کالا_به_اشخاص_${dateStamp}.xlsx`);
  };

  // Export comprehensive Excel workbook
  const handleExportExcelReport = () => {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryRows = [
      { 'شاخص مالی و انبار': 'فروش قطعی کل (با احتساب مالیات)', 'مقدار / مبلغ': financialAnalytics.grossSalesTotal, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'فروش خالص (بدون مالیات)', 'مقدار / مبلغ': financialAnalytics.netSalesExclTax, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'بهای تمام‌شده کالای فروش‌رفته (COGS)', 'مقدار / مبلغ': financialAnalytics.totalCostOfGoodsSold, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'سود خالص عملیاتی فروش', 'مقدار / مبلغ': financialAnalytics.netProfit, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'درصد حاشیه سود خالص', 'مقدار / مبلغ': `${financialAnalytics.profitMargin}%`, 'واحد': 'درصد' },
      { 'شاخص مالی و انبار': 'مجموع تخفیفات اعطایی در فاکتورها', 'مقدار / مبلغ': financialAnalytics.totalDiscountsGiven, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'مجموع مالیات بر ارزش افزوده', 'مقدار / مبلغ': financialAnalytics.totalTaxCollected, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'مبالغ وصول‌شده (نقدی / تسویه‌شده)', 'مقدار / مبلغ': financialAnalytics.totalCollected, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'مطالبات و مانده حساب‌های دریافتنی (نسیه)', 'مقدار / مبلغ': financialAnalytics.totalReceivables, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'ارزش پیش‌فاکتورهای باز (تبدیل‌نشده)', 'مقدار / مبلغ': financialAnalytics.proformaTotalValue, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'سرمایه موجود در انبار (به قیمت خرید)', 'مقدار / مبلغ': warehouseAnalytics.inventoryCostValue, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'ارزش فروش موجودی انبار', 'مقدار / مبلغ': warehouseAnalytics.inventorySalesValue, 'واحد': settings.currency },
      { 'شاخص مالی و انبار': 'سود بالقوه موجودی انبار', 'مقدار / مبلغ': warehouseAnalytics.potentialInventoryProfit, 'واحد': settings.currency },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'خلاصه مالی و سود');

    // 2. Product-to-Customer Matrix Sheet
    if (productCustomerMatrix.pairRows.length > 0) {
      const matrixRows = productCustomerMatrix.pairRows.map((r, idx) => ({
        'ردیف': idx + 1,
        'کد کالا': r.productCode,
        'نام محصول / خدمت': r.productName,
        'نام مشتری / شخص': r.customerName,
        'تلفن مشتری': r.customerPhone || '-',
        'مقدار خریداری‌شده': r.quantity,
        'واحد': r.unit,
        'سهم از کل فروش کالا (%)': `${r.shareOfProductQtyPercent}%`,
        'تعداد فاکتور': r.invoicesCount,
        'میانگین فی': r.avgUnitPrice,
        'مبلغ خالص فروش': Math.round(r.netRevenue),
        'سود خالص': Math.round(r.netProfit),
        'آخرین خرید': r.lastDate,
      }));
      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'فروش هر کالا به اشخاص');
    }

    // 3. Item Profitability Sheet
    const itemRows = sortedItems.map((it, idx) => ({
      'رتبه': idx + 1,
      'کد کالا / خدمت': it.code,
      'شرح کالا یا خدمات': it.name,
      'نوع': it.isService ? 'خدمات' : 'کالای فیزیکی',
      'تعداد فروش': it.quantity,
      'واحد': it.unit,
      'تعداد خریداران یکتا': it.uniqueBuyersCount,
      'فروش خالص': Math.round(it.netRevenue),
      'بهای تمام‌شده (خرید)': Math.round(it.totalCost),
      'سود خالص': Math.round(it.netProfit),
      'حاشیه سود (%)': `${it.marginPercent}%`,
      'تعداد فاکتور': it.invoiceCount,
    }));
    if (itemRows.length > 0) {
      const wsItems = XLSX.utils.json_to_sheet(itemRows);
      XLSX.utils.book_append_sheet(wb, wsItems, 'سودآوری تفکیکی اقلام');
    }

    // 4. Warehouse Categories & Low Stock Sheet
    const warehouseRows = warehouseAnalytics.categoryBreakdown.map((cat) => ({
      'دسته‌بندی انبار': cat.category,
      'تعداد اقلام (SKU)': cat.skuCount,
      'مجموع موجودی': cat.totalStock,
      'ارزش خرید (سرمایه)': Math.round(cat.costValue),
      'ارزش فروش': Math.round(cat.salesValue),
      'سود بالقوه': Math.round(cat.potentialProfit),
    }));
    if (warehouseRows.length > 0) {
      const wsWarehouse = XLSX.utils.json_to_sheet(warehouseRows);
      XLSX.utils.book_append_sheet(wb, wsWarehouse, 'ارزش‌گذاری دسته‌بندی انبار');
    }

    if (warehouseAnalytics.lowStockList.length > 0) {
      const lowRows = warehouseAnalytics.lowStockList.map((p) => ({
        'کد کالا': p.code,
        'نام کالا': p.name,
        'دسته‌بندی': p.category,
        'موجودی فعلی': p.stock,
        'حداقل مجاز': p.minStockAlert,
        'واحد': p.unit,
        'وضعیت': p.stock === 0 ? 'ناموجود (اتمام)' : 'کمتر از نقطه سفارش',
      }));
      const wsLow = XLSX.utils.json_to_sheet(lowRows);
      XLSX.utils.book_append_sheet(wb, wsLow, 'کسری موجودی انبار');
    }

    const dateStamp = toEnglishDigits(getCurrentJalaliDate()).replace(/\//g, '-');
    XLSX.writeFile(wb, `گزارش_مالی_و_تحلیل_انبار_${dateStamp}.xlsx`);
  };

  const collectionRatePercent =
    financialAnalytics.grossSalesTotal > 0
      ? Math.round((financialAnalytics.totalCollected / financialAnalytics.grossSalesTotal) * 100)
      : 100;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      {/* Top Header & Time Period Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        {/* Top Row: Title & Excel Export Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800">
                مرکز پیشرفته گزارشات مالی، فروش کالا به اشخاص و تحلیل انبار
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                گزارش‌گیری دقیق در بازه زمانی دلخواه، رهگیری فروش هر محصول به تفکیک خریدار، سود خالص و سلامت انبار
              </p>
            </div>
          </div>

          {/* Excel Export Button */}
          <button
            type="button"
            onClick={handleExportExcelReport}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
            title="دریافت فایل اکسل چندبرگی از گزارش مالی، ماتریس فروش کالا به اشخاص و وضعیت انبار"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل جامع</span>
          </button>
        </div>

        {/* Second Row: Period Filter Segmented Control on its own dedicated line */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70 overflow-x-auto max-w-full">
            <span className="text-[11px] font-bold text-slate-500 px-2.5 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              بازه زمانی:
            </span>
            {(
              [
                { id: 'all', label: 'همه زمان‌ها' },
                { id: 'today', label: 'امروز' },
                { id: '7days', label: '۷ روز اخیر' },
                { id: '30days', label: '۳۰ روز اخیر' },
                { id: 'year', label: `سال ${toPersianDigits(currentJalaliYear)}` },
                { id: 'custom', label: 'بازه دلخواه (از / تا تاریخ)' },
              ] as { id: DatePeriodFilter; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodFilter(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                  periodFilter === p.id
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker Bar (Shown when 'custom' is active) */}
        {periodFilter === 'custom' && (
          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                انتخاب دوره زمانی دلخواه:
              </span>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">از تاریخ:</span>
                <div className="w-40">
                  <JalaliDatePicker
                    value={customFromDate}
                    onChange={(val) => setCustomFromDate(val)}
                    placeholder="۱۴۰۳/۰۱/۰۱"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">تا تاریخ:</span>
                <div className="w-40">
                  <JalaliDatePicker
                    value={customToDate}
                    onChange={(val) => setCustomToDate(val)}
                    placeholder="۱۴۰۳/۱۲/۲۹"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-bold tabular-nums">
                {toPersianDigits(confirmedInvoices.length)} فاکتور قطعی در این بازه
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomFromDate(`${currentJalaliYear}/01/01`);
                  setCustomToDate(getCurrentJalaliDate());
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-slate-700 border border-slate-200 font-bold transition-colors cursor-pointer"
              >
                ابتدای سال تا امروز
              </button>
            </div>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'نمای کلی و شاخص‌ها', icon: BarChart3 },
              {
                id: 'product_customer',
                label: 'فروش کالا به اشخاص (محصول ⇄ مشتری)',
                icon: UserCheck,
              },
              {
                id: 'profitability',
                label: `تحلیل سودآوری اقلام (${toPersianDigits(financialAnalytics.allSoldItems.length)})`,
                icon: Award,
              },
              {
                id: 'cashflow',
                label: 'جریان نقدینگی و مطالبات',
                icon: Wallet,
              },
              {
                id: 'warehouse',
                label: `ارزش‌گذاری و سلامت انبار (${toPersianDigits(warehouseAnalytics.physicalProductsCount)})`,
                icon: Boxes,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 4 KPI Cards (Always visible for instant executive context) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Confirmed Sales Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">فروش قطعی (درآمد کل)</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 tabular-nums">
              {formatPrice(financialAnalytics.grossSalesTotal, settings.currency)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
            <span>{toPersianDigits(confirmedInvoices.length)} فاکتور قطعی</span>
            <span>·</span>
            <span>خالص: {formatPrice(financialAnalytics.netSalesExclTax, settings.currency)}</span>
          </div>
        </div>

        {/* 2. Net Operating Profit & Margin */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">سود خالص فروش</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div
              className={`text-lg sm:text-xl font-black tabular-nums ${
                financialAnalytics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatPrice(financialAnalytics.netProfit, settings.currency)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              حاشیه سود: {toPersianDigits(financialAnalytics.profitMargin)}٪
            </span>
            <span className="text-slate-400">
              بهای تمام‌شده: {formatPrice(financialAnalytics.totalCostOfGoodsSold, '')}
            </span>
          </div>
        </div>

        {/* 3. Cash Collected vs. Receivables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">وصولی و مطالبات فاکتورها</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Wallet className="w-4 h-4" />
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 tabular-nums">
              {formatPrice(financialAnalytics.totalCollected, settings.currency)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-slate-500">
              وصولی: <strong className="text-emerald-700">{toPersianDigits(collectionRatePercent)}٪</strong>
            </span>
            <span className="text-rose-600 font-bold">
              مانده طلب: {formatPrice(financialAnalytics.totalReceivables, settings.currency)}
            </span>
          </div>
        </div>

        {/* 4. Physical Stock Capital Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">سرمایه موجودی انبار (خرید)</span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Boxes className="w-4 h-4" />
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-700 tabular-nums">
              {formatPrice(warehouseAnalytics.inventoryCostValue, settings.currency)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
            <span>ارزش فروش: {formatPrice(warehouseAnalytics.inventorySalesValue, '')}</span>
            <span className="text-purple-700 font-bold">
              سود انبار: {formatPrice(warehouseAnalytics.potentialInventoryProfit, '')}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          SUB-TAB 1: OVERVIEW (نمای کلی و شاخص‌ها)
         =================================================================== */}
      {activeSubTab === 'overview' && (
        <div className="space-y-5">
          {/* Secondary Operational Strip */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
            <div className="flex items-center justify-between sm:px-3 pt-2 sm:pt-0">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">تفکیک فروش کالا و خدمات</div>
                <div className="text-xs font-bold text-slate-800 mt-1 tabular-nums">
                  کالا: {formatPrice(financialAnalytics.goodsRevenue, settings.currency)}
                </div>
                <div className="text-[11px] text-indigo-600 font-semibold mt-0.5 tabular-nums">
                  خدمات: {formatPrice(financialAnalytics.serviceRevenue, settings.currency)}
                </div>
              </div>
              <ShoppingBag className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            <div className="flex items-center justify-between sm:px-3 pt-2 sm:pt-0">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">تخفیفات و مالیات دوره</div>
                <div className="text-xs font-bold text-slate-800 mt-1 tabular-nums">
                  تخفیف: {formatPrice(financialAnalytics.totalDiscountsGiven, settings.currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  مالیات: {formatPrice(financialAnalytics.totalTaxCollected, settings.currency)}
                </div>
              </div>
              <PieChart className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            <div className="flex items-center justify-between sm:px-3 pt-2 sm:pt-0">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">پیش‌فاکتورهای باز (تبدیل‌نشده)</div>
                <div className="text-xs font-bold text-amber-700 mt-1 tabular-nums">
                  {formatPrice(financialAnalytics.proformaTotalValue, settings.currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  تعداد: {toPersianDigits(proformaInvoices.length)} پیش‌فاکتور در انتظار
                </div>
              </div>
              <FileText className="w-4 h-4 text-amber-500 shrink-0" />
            </div>

            <div className="flex items-center justify-between sm:px-3 pt-2 sm:pt-0">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">فاکتورهای خرید تامین‌کنندگان</div>
                <div className="text-xs font-bold text-slate-800 mt-1 tabular-nums">
                  {formatPrice(financialAnalytics.totalPurchaseSpend, settings.currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  ثبت‌شده: {toPersianDigits(periodPurchaseInvoices.length)} فاکتور خرید
                </div>
              </div>
              <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* Two Column Section: Top Products & Critical Low Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Selling & Most Profitable Products */}
            <div
              id="reports-top-selling-card"
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-slate-800 text-sm">برترین اقلام فروش‌رفته</h3>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                    {(
                      [
                        { id: 'profit', label: 'بیشترین سود' },
                        { id: 'revenue', label: 'مبلغ فروش' },
                        { id: 'quantity', label: 'تعداد' },
                      ] as { id: ItemSortMode; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setItemSortMode(m.id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          itemSortMode === m.id
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sortedItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    در این بازه زمانی هنوز فاکتور فروش قطعی ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sortedItems.slice(0, 6).map((item, idx) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/70 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-200/80 text-slate-700 font-bold flex items-center justify-center text-[11px] shrink-0 tabular-nums">
                            {toPersianDigits(idx + 1)}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              <span>
                                فروش: <strong className="text-slate-700">{toPersianDigits(item.quantity)}</strong> {item.unit}
                              </span>
                              <span>·</span>
                              <span>به {toPersianDigits(item.uniqueBuyersCount)} شخص</span>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() => handleInspectProductBuyers(item.key)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                              >
                                مشاهده خریداران
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0 mr-2 tabular-nums">
                          <div className="font-bold text-emerald-700">
                            سود: {formatPrice(item.netProfit, settings.currency)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            حاشیه سود: {toPersianDigits(item.marginPercent)}٪
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {sortedItems.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('product_customer')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                  >
                    گزارش فروش هر کالا به اشخاص ←
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('profitability')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    جدول کامل سودآوری ({toPersianDigits(sortedItems.length)} مورد) ←
                  </button>
                </div>
              )}
            </div>

            {/* Low Stock Warning & Replenish List (Physical Goods Only) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">
                        کالاهای نیازمند تامین فوری انبار
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">
                        فقط کالاهای فیزیکی که موجودی آن‌ها به زیر حداقل مجاز رسیده است
                      </span>
                    </div>
                  </div>
                  {(!currentUser || currentUser.permissions.canManageInventory) && (
                    <button
                      type="button"
                      onClick={onOpenInventory}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      مدیریت انبار
                    </button>
                  )}
                </div>

                {warehouseAnalytics.lowStockList.length === 0 ? (
                  <div className="text-center py-10 text-emerald-600 text-xs font-medium">
                    تمامی کالاهای فیزیکی انبار موجودی کافی و بالاتر از نقطه سفارش دارند.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {warehouseAnalytics.lowStockList.slice(0, 6).map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-200/80 text-xs"
                      >
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 truncate">{prod.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 tabular-nums">
                            <span>کد: {prod.code}</span>
                            <span>·</span>
                            <span>
                              حداقل مجاز: {toPersianDigits(prod.minStockAlert)} {prod.unit}
                            </span>
                          </div>
                        </div>

                        <div className="text-left shrink-0 mr-2 tabular-nums">
                          <span
                            className={`font-bold text-xs ${
                              prod.stock === 0 ? 'text-rose-700' : 'text-amber-800'
                            }`}
                          >
                            {prod.stock === 0
                              ? 'ناموجود (۰)'
                              : `مانده: ${toPersianDigits(prod.stock)} ${prod.unit}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {warehouseAnalytics.lowStockList.length > 6 && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('warehouse')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    مشاهده تمام {toPersianDigits(warehouseAnalytics.lowStockList.length)} کالای دارای کسری ←
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 2: PRODUCT-TO-CUSTOMER SALES MATRIX (گزارش فروش کالا به اشخاص)
         =================================================================== */}
      {activeSubTab === 'product_customer' && (
        <div className="space-y-4">
          {/* Filter & Control Deck */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                  <PackageSearch className="w-4 h-4 text-indigo-600" />
                  <span>گزارش تحلیلی فروش هر محصول به اشخاص (در بازه زمانی انتخابی)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مشاهده دقیق اینکه از هر محصول یا خدمت، چه مقداری، با چه قیمتی و طی کدام فاکتورها به چه اشخاصی فروخته شده است
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                  {(
                    [
                      { id: 'by_product', label: 'تفکیک محصول ← خریداران' },
                      { id: 'by_customer', label: 'تفکیک شخص ← کالاهای خریداری‌شده' },
                      { id: 'flat_log', label: 'ریز فاکتور به فاکتور' },
                    ] as { id: MatrixViewMode; label: string }[]
                  ).map((vm) => (
                    <button
                      key={vm.id}
                      type="button"
                      onClick={() => setMatrixViewMode(vm.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        matrixViewMode === vm.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {vm.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExportMatrixExcel}
                  disabled={productCustomerMatrix.pairRows.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>اکسل این گزارش</span>
                </button>
              </div>
            </div>

            {/* Product & Customer Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Select Specific Product */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  انتخاب محصول / کالا:
                </label>
                <select
                  value={selectedProductKey}
                  onChange={(e) => {
                    setSelectedProductKey(e.target.value);
                    setExpandedMatrixRowKey(null);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">
                    همه محصولات فروخته‌شده ({toPersianDigits(financialAnalytics.allSoldItems.length)} قلم)
                  </option>
                  {financialAnalytics.allSoldItems
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
                    .map((prod) => (
                      <option key={prod.key} value={prod.key}>
                        {prod.name} (فروش کل: {toPersianDigits(prod.quantity)} {prod.unit} به{' '}
                        {toPersianDigits(prod.uniqueBuyersCount)} نفر)
                      </option>
                    ))}
                </select>
              </div>

              {/* 2. Select Specific Customer */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  انتخاب شخص / مشتری:
                </label>
                <select
                  value={selectedCustomerKey}
                  onChange={(e) => {
                    setSelectedCustomerKey(e.target.value);
                    setExpandedMatrixRowKey(null);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">
                    همه اشخاص / مشتریان ({toPersianDigits(financialAnalytics.topCustomers.length)} نفر)
                  </option>
                  {financialAnalytics.topCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({toPersianDigits(c.invoicesCount)} فاکتور)
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Live Search Product / Customer */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  جستجوی سریع نام کالا یا شخص:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={matrixProductSearch || matrixCustomerSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (matrixViewMode === 'by_customer') {
                        setMatrixCustomerSearch(val);
                        setMatrixProductSearch('');
                      } else {
                        setMatrixProductSearch(val);
                        setMatrixCustomerSearch('');
                      }
                    }}
                    placeholder={
                      matrixViewMode === 'by_customer'
                        ? 'جستجوی نام مشتری یا تلفن...'
                        : 'جستجوی نام یا کد محصول...'
                    }
                    className="w-full pr-8 pl-7 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                  {(matrixProductSearch || matrixCustomerSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMatrixProductSearch('');
                        setMatrixCustomerSearch('');
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Sort Matrix */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  مرتب‌سازی نتایج:
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={matrixSortMode}
                    onChange={(e) => setMatrixSortMode(e.target.value as MatrixSortMode)}
                    className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="quantity">بیشترین مقدار / تعداد خرید</option>
                    <option value="revenue">بیشترین مبلغ خرید</option>
                    <option value="profit">بیشترین سود خالص</option>
                    <option value="invoices">بیشترین دفعات خرید (فاکتور)</option>
                  </select>

                  {(selectedProductKey !== 'ALL' ||
                    selectedCustomerKey !== 'ALL' ||
                    matrixProductSearch ||
                    matrixCustomerSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductKey('ALL');
                        setSelectedCustomerKey('ALL');
                        setMatrixProductSearch('');
                        setMatrixCustomerSearch('');
                        setExpandedMatrixRowKey(null);
                      }}
                      className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      title="پاک کردن تمام فیلترها"
                    >
                      حذف فیلتر
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Strip for Selected Filter */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 tabular-nums">
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
                <div className="text-[11px] font-bold text-indigo-700">مجموع مقدار فروخته‌شده</div>
                <div className="text-base sm:text-lg font-black text-indigo-950 mt-0.5">
                  {toPersianDigits(productCustomerMatrix.totalQuantity)}{' '}
                  <span className="text-xs font-bold text-indigo-700">
                    {productCustomerMatrix.dominantUnit}
                  </span>
                </div>
                <div className="text-[10px] text-indigo-600 mt-0.5">
                  طی {toPersianDigits(productCustomerMatrix.uniqueInvoicesCount)} فاکتور فروش
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="text-[11px] font-bold text-emerald-700">تعداد اشخاص خریدار</div>
                <div className="text-base sm:text-lg font-black text-emerald-950 mt-0.5">
                  {toPersianDigits(productCustomerMatrix.uniqueCustomersCount)}{' '}
                  <span className="text-xs font-bold text-emerald-700">شخص / مشتری</span>
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5">
                  برای {toPersianDigits(productCustomerMatrix.uniqueProductsCount)} نوع کالا/خدمت
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-600">مجموع مبلغ خالص فروش</div>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {formatPrice(productCustomerMatrix.totalNetRevenue, settings.currency)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  سود خالص: {formatPrice(productCustomerMatrix.totalNetProfit, settings.currency)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                <div className="text-[11px] font-bold text-amber-800">میانگین فی واحد فروش</div>
                <div className="text-base sm:text-lg font-black text-amber-950 mt-0.5">
                  {formatPrice(productCustomerMatrix.avgUnitPrice, settings.currency)}
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  حداقل: {formatPrice(productCustomerMatrix.minUnitPrice, '')} | حداکثر:{' '}
                  {formatPrice(productCustomerMatrix.maxUnitPrice, '')}
                </div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            {productCustomerMatrix.pairRows.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                هیچ سابقه فروشی مطابق با فیلتر محصول، شخص و بازه زمانی انتخابی یافت نشد.
              </div>
            ) : matrixViewMode === 'flat_log' ? (
              /* MODE 3: Flat Invoice-by-Invoice Sales Log */
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                      <th className="py-3 px-3 font-bold w-10">#</th>
                      <th className="py-3 px-3 font-bold">تاریخ</th>
                      <th className="py-3 px-3 font-bold">شماره فاکتور</th>
                      <th className="py-3 px-3 font-bold">نام شخص / مشتری</th>
                      <th className="py-3 px-3 font-bold">نام کالا / محصول</th>
                      <th className="py-3 px-3 font-bold">مقدار</th>
                      <th className="py-3 px-3 font-bold">فی واحد ({settings.currency})</th>
                      <th className="py-3 px-3 font-bold">مبلغ خالص ({settings.currency})</th>
                      <th className="py-3 px-3 font-bold">سود ({settings.currency})</th>
                      <th className="py-3 px-3 font-bold text-center">فاکتور</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productCustomerMatrix.filteredRecords.map((rec, i) => (
                      <tr key={`${rec.invoiceId}_${rec.productKey}_${i}`} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-slate-400 font-bold">{toPersianDigits(i + 1)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {toPersianDigits(rec.date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                          #{toPersianDigits(rec.invoiceNumber)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{rec.customerName}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{rec.productName}</td>
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {toPersianDigits(rec.quantity)} <span className="font-normal text-slate-500">{rec.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{formatPrice(rec.unitPrice, '')}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {formatPrice(rec.netRevenue, '')}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            rec.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {formatPrice(rec.netProfit, '')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {onViewInvoice && (
                            <button
                              type="button"
                              onClick={() => onViewInvoice(rec.rawInvoice)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* MODE 1 & MODE 2: Aggregated Product <-> Customer Matrix with Expandable Invoice Drill-down */
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                      <th className="py-3 px-3 font-bold w-10">#</th>
                      {matrixViewMode === 'by_product' ? (
                        <>
                          <th className="py-3 px-3 font-bold">کالا / محصول</th>
                          <th className="py-3 px-3 font-bold">نام شخص / خریدار</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-3 font-bold">نام شخص / خریدار</th>
                          <th className="py-3 px-3 font-bold">کالا / محصول خریداری‌شده</th>
                        </>
                      )}
                      <th className="py-3 px-3 font-bold">مقدار کل خرید</th>
                      <th className="py-3 px-3 font-bold w-36">
                        {matrixViewMode === 'by_product' ? 'سهم از فروش این کالا' : 'سهم از خرید این شخص'}
                      </th>
                      <th className="py-3 px-3 font-bold">دفعات (فاکتور)</th>
                      <th className="py-3 px-3 font-bold">میانگین فی ({settings.currency})</th>
                      <th className="py-3 px-3 font-bold">مبلغ خالص ({settings.currency})</th>
                      <th className="py-3 px-3 font-bold">سود خالص ({settings.currency})</th>
                      <th className="py-3 px-3 font-bold">آخرین خرید</th>
                      <th className="py-3 px-3 font-bold text-center">ریز فاکتورها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productCustomerMatrix.pairRows.map((row, idx) => {
                      const isExpanded = expandedMatrixRowKey === row.pairKey;
                      const sharePercent =
                        matrixViewMode === 'by_product'
                          ? row.shareOfProductQtyPercent
                          : row.shareOfCustomerSpendPercent;

                      return (
                        <React.Fragment key={row.pairKey}>
                          <tr
                            onClick={() =>
                              setExpandedMatrixRowKey(isExpanded ? null : row.pairKey)
                            }
                            className={`transition-colors cursor-pointer ${
                              isExpanded ? 'bg-indigo-50/60' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-3 font-bold text-slate-400">
                              {toPersianDigits(idx + 1)}
                            </td>

                            {matrixViewMode === 'by_product' ? (
                              <>
                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProductKey(
                                        selectedProductKey === row.productKey ? 'ALL' : row.productKey
                                      );
                                    }}
                                    className="font-bold text-slate-800 hover:text-indigo-700 text-right cursor-pointer"
                                    title="فیلتر بر اساس این محصول"
                                  >
                                    {row.productName}
                                  </button>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    کد: {row.productCode}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomerKey(
                                        selectedCustomerKey === row.customerId ? 'ALL' : row.customerId
                                      );
                                    }}
                                    className="font-black text-indigo-900 hover:text-indigo-600 text-right cursor-pointer"
                                    title="فیلتر بر اساس این شخص"
                                  >
                                    {row.customerName}
                                  </button>
                                  {row.customerPhone && (
                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      {toPersianDigits(row.customerPhone)}
                                    </div>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomerKey(
                                        selectedCustomerKey === row.customerId ? 'ALL' : row.customerId
                                      );
                                    }}
                                    className="font-black text-indigo-900 hover:text-indigo-600 text-right cursor-pointer"
                                  >
                                    {row.customerName}
                                  </button>
                                  {row.customerPhone && (
                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      {toPersianDigits(row.customerPhone)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProductKey(
                                        selectedProductKey === row.productKey ? 'ALL' : row.productKey
                                      );
                                    }}
                                    className="font-bold text-slate-800 hover:text-indigo-700 text-right cursor-pointer"
                                  >
                                    {row.productName}
                                  </button>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    کد: {row.productCode}
                                  </div>
                                </td>
                              </>
                            )}

                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 font-black">
                                {toPersianDigits(row.quantity)}{' '}
                                <span className="font-semibold text-[11px] text-indigo-700">
                                  {row.unit}
                                </span>
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>{toPersianDigits(sharePercent)}٪</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(4, sharePercent))}%` }}
                                />
                              </div>
                            </td>

                            <td className="py-3 px-3 font-bold text-slate-700">
                              {toPersianDigits(row.invoicesCount)} فاکتور
                            </td>

                            <td className="py-3 px-3 text-slate-700">
                              <div className="font-bold">{formatPrice(row.avgUnitPrice, '')}</div>
                              {row.minUnitPrice !== row.maxUnitPrice && (
                                <div className="text-[10px] text-slate-400">
                                  {formatPrice(row.minUnitPrice, '')} تا {formatPrice(row.maxUnitPrice, '')}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 font-bold text-slate-900">
                              {formatPrice(row.netRevenue, '')}
                            </td>

                            <td
                              className={`py-3 px-3 font-black ${
                                row.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {formatPrice(row.netProfit, '')}
                            </td>

                            <td className="py-3 px-3 font-mono text-slate-600">
                              {toPersianDigits(row.lastDate)}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedMatrixRowKey(isExpanded ? null : row.pairKey);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                              >
                                <span>جزئیات</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Drill-down: Exact Invoices where this customer bought this product */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={11} className="p-3 sm:p-4 border-b border-indigo-100">
                                <div className="bg-white rounded-xl border border-indigo-200/80 p-3 space-y-2.5 shadow-2xs">
                                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950 pb-2 border-b border-slate-100">
                                    <span>
                                      ریز فاکتورهای خرید «{row.productName}» توسط «{row.customerName}» (
                                      {toPersianDigits(row.records.length)} ردیف)
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      اولین خرید: {toPersianDigits(row.firstDate)} | آخرین خرید:{' '}
                                      {toPersianDigits(row.lastDate)}
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-right text-[11px] border-collapse">
                                      <thead>
                                        <tr className="text-slate-500 border-b border-slate-100">
                                          <th className="py-1.5 px-2">تاریخ</th>
                                          <th className="py-1.5 px-2">شماره فاکتور</th>
                                          <th className="py-1.5 px-2">مقدار</th>
                                          <th className="py-1.5 px-2">فی واحد ({settings.currency})</th>
                                          <th className="py-1.5 px-2">مبلغ خالص ردیف</th>
                                          <th className="py-1.5 px-2">سود ردیف</th>
                                          <th className="py-1.5 px-2 text-center">مشاهده سند</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {row.records.map((rec, rIdx) => (
                                          <tr key={`${rec.invoiceId}_${rIdx}`} className="hover:bg-slate-50">
                                            <td className="py-1.5 px-2 font-mono font-bold text-slate-700">
                                              {toPersianDigits(rec.date)}
                                            </td>
                                            <td className="py-1.5 px-2 font-mono font-bold text-indigo-700">
                                              #{toPersianDigits(rec.invoiceNumber)}
                                            </td>
                                            <td className="py-1.5 px-2 font-black text-slate-900">
                                              {toPersianDigits(rec.quantity)} {rec.unit}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-700">
                                              {formatPrice(rec.unitPrice, '')}
                                            </td>
                                            <td className="py-1.5 px-2 font-bold text-slate-900">
                                              {formatPrice(rec.netRevenue, '')}
                                            </td>
                                            <td
                                              className={`py-1.5 px-2 font-bold ${
                                                rec.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                              }`}
                                            >
                                              {formatPrice(rec.netProfit, '')}
                                            </td>
                                            <td className="py-1.5 px-2 text-center">
                                              {onViewInvoice && (
                                                <button
                                                  type="button"
                                                  onClick={() => onViewInvoice(rec.rawInvoice)}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer"
                                                >
                                                  <Eye className="w-3 h-3" />
                                                  <span>نمایش فاکتور</span>
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 3: ITEM PROFITABILITY (تحلیل سودآوری اقلام و خدمات)
         =================================================================== */}
      {activeSubTab === 'profitability' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                جدول تحلیل سودآوری تفکیکی کالاها و خدمات فروخته‌شده
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مبالغ فروش پس از کسر تخفیف ردیف و سهم تخفیف کلی فاکتور محاسبه شده‌اند (با کلیک روی «خریداران» لیست اشخاص خریدار هر کالا را ببینید)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="جستجوی نام یا کد کالا..."
                  className="pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none w-48"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    { id: 'all', label: 'همه' },
                    { id: 'goods', label: 'کالاها' },
                    { id: 'services', label: 'خدمات' },
                  ] as { id: ItemTypeFilter; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setItemTypeFilter(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      itemTypeFilter === t.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sort Mode */}
              <select
                value={itemSortMode}
                onChange={(e) => setItemSortMode(e.target.value as ItemSortMode)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none cursor-pointer"
              >
                <option value="profit">مرتب‌سازی: بیشترین سود خالص</option>
                <option value="revenue">مرتب‌سازی: بیشترین مبلغ فروش</option>
                <option value="quantity">مرتب‌سازی: بیشترین تعداد فروش</option>
                <option value="margin">مرتب‌سازی: بالاترین درصد حاشیه سود</option>
              </select>
            </div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              موردی مطابق با فیلتر انتخابی یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/80">
                    <th className="py-3 px-3 font-bold w-10">#</th>
                    <th className="py-3 px-3 font-bold">شرح کالا / خدمت</th>
                    <th className="py-3 px-3 font-bold">تعداد فروش</th>
                    <th className="py-3 px-3 font-bold">فروش خالص ({settings.currency})</th>
                    <th className="py-3 px-3 font-bold">بهای تمام‌شده ({settings.currency})</th>
                    <th className="py-3 px-3 font-bold">سود خالص ({settings.currency})</th>
                    <th className="py-3 px-3 font-bold w-32">حاشیه سود</th>
                    <th className="py-3 px-3 font-bold text-center">خریداران</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {sortedItems.map((item, idx) => (
                    <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>کد: {item.code}</span>
                          <span>·</span>
                          <span>{item.isService ? 'خدمات' : 'کالای فیزیکی'}</span>
                          <span>·</span>
                          <span>در {toPersianDigits(item.invoiceCount)} فاکتور</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">
                        {toPersianDigits(item.quantity)} <span className="font-normal text-slate-500">{item.unit}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {formatPrice(item.netRevenue, '')}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {formatPrice(item.totalCost, '')}
                      </td>
                      <td
                        className={`py-3 px-3 font-black ${
                          item.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatPrice(item.netProfit, '')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className={item.marginPercent >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {toPersianDigits(item.marginPercent)}٪
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.marginPercent >= 25
                                ? 'bg-emerald-500'
                                : item.marginPercent > 0
                                ? 'bg-blue-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(4, Math.abs(item.marginPercent)))}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleInspectProductBuyers(item.key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{toPersianDigits(item.uniqueBuyersCount)} شخص</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 4: CASH FLOW & RECEIVABLES (جریان نقدینگی و مطالبات)
         =================================================================== */}
      {activeSubTab === 'cashflow' && (
        <div className="space-y-5">
          {/* Payment Status Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500">فاکتورهای تسویه کامل</div>
                <div className="text-lg font-black text-emerald-700 mt-1 tabular-nums">
                  {toPersianDigits(financialAnalytics.paidInvoicesCount)} فاکتور
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                  مجموع وصولی کل: {formatPrice(financialAnalytics.totalCollected, settings.currency)}
                </div>
              </div>
              <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500">فاکتورهای دارای پرداخت جزئی</div>
                <div className="text-lg font-black text-amber-600 mt-1 tabular-nums">
                  {toPersianDigits(financialAnalytics.partialInvoicesCount)} فاکتور
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  بخشی نقد و بخشی در حساب بدهکاری
                </div>
              </div>
              <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-5 h-5" />
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500">فاکتورهای نسیه / تسویه‌نشده</div>
                <div className="text-lg font-black text-rose-600 mt-1 tabular-nums">
                  {toPersianDigits(financialAnalytics.unpaidInvoicesCount)} فاکتور
                </div>
                <div className="text-[11px] text-rose-600 font-bold mt-0.5 tabular-nums">
                  مانده مطالبات: {formatPrice(financialAnalytics.totalReceivables, settings.currency)}
                </div>
              </div>
              <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Payment Methods Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">تفکیک روش‌های پرداخت در فاکتورها</h3>
                <span className="text-xs text-slate-400">بر اساس مبلغ فاکتورهای قطعی</span>
              </div>

              {financialAnalytics.paymentMethodList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  فاکتوری در این بازه ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-3 tabular-nums">
                  {financialAnalytics.paymentMethodList.map((pm) => {
                    const share =
                      financialAnalytics.grossSalesTotal > 0
                        ? Math.round((pm.amount / financialAnalytics.grossSalesTotal) * 100)
                        : 0;
                    return (
                      <div key={pm.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-slate-800">
                            {pm.label}{' '}
                            <span className="font-normal text-slate-500">
                              ({toPersianDigits(pm.count)} فاکتور)
                            </span>
                          </span>
                          <span className="font-black text-slate-900">
                            {formatPrice(pm.amount, settings.currency)} ({toPersianDigits(share)}٪)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${Math.max(3, share)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Customers & Debtors */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm">مشتریان برتر و وضعیت بدهی فاکتورها</h3>
                </div>
                <span className="text-xs text-slate-400">بر اساس حجم خرید در دوره</span>
              </div>

              {financialAnalytics.topCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  سابقه‌ای برای مشتریان در این بازه ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2.5 tabular-nums">
                  {financialAnalytics.topCustomers.slice(0, 6).map((cust, i) => (
                    <div
                      key={cust.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">
                          {toPersianDigits(i + 1)}. {cust.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>
                            {toPersianDigits(cust.invoicesCount)} فاکتور · دریافتی:{' '}
                            {formatPrice(cust.totalPaid, settings.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerKey(cust.id);
                              setSelectedProductKey('ALL');
                              setMatrixViewMode('by_customer');
                              setActiveSubTab('product_customer');
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          >
                            اقلام خریداری‌شده
                          </button>
                        </div>
                      </div>
                      <div className="text-left shrink-0 mr-2">
                        <div className="font-bold text-slate-900">
                          خرید: {formatPrice(cust.totalPurchased, settings.currency)}
                        </div>
                        <div
                          className={`text-[11px] font-bold mt-0.5 ${
                            cust.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {cust.totalDebt > 0
                            ? `مانده بدهی: ${formatPrice(cust.totalDebt, settings.currency)}`
                            : 'تسویه کامل'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 5: WAREHOUSE VALUATION & HEALTH (ارزش‌گذاری و سلامت انبار)
         =================================================================== */}
      {activeSubTab === 'warehouse' && (
        <div className="space-y-5">
          {/* Warehouse Health Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 tabular-nums">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs font-bold text-slate-500">کالاهای دارای موجودی کافی</div>
              <div className="text-lg font-black text-emerald-700 mt-1">
                {toPersianDigits(warehouseAnalytics.healthyCount)} قلم کالا
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                مجموع واحد فیزیکی: {toPersianDigits(warehouseAnalytics.totalPhysicalUnits)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs font-bold text-slate-500">کمبود موجودی (زیر نقطه سفارش)</div>
              <div className="text-lg font-black text-amber-600 mt-1">
                {toPersianDigits(warehouseAnalytics.lowStockOnlyCount)} قلم کالا
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">نیازمند سفارش‌گذاری</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs font-bold text-slate-500">کالاهای ناموجود (موجودی صفر)</div>
              <div className="text-lg font-black text-rose-600 mt-1">
                {toPersianDigits(warehouseAnalytics.outOfStockCount)} قلم کالا
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">اتمام موجودی در انبار</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs font-bold text-slate-500">کالاهای راکد (بدون سابقه فروش)</div>
              <div className="text-lg font-black text-purple-700 mt-1">
                {toPersianDigits(warehouseAnalytics.stagnantList.length)} قلم کالا
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">دارای موجودی اما بدون فروش</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Category Valuation Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">
                  ارزش‌گذاری موجودی انبار به تفکیک دسته‌بندی
                </h3>
                <span className="text-xs text-slate-400">بر اساس قیمت خرید و فروش</span>
              </div>

              {warehouseAnalytics.categoryBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  کالای فیزیکی در انبار ثبت نشده است.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                        <th className="py-2.5 px-2.5 font-bold">دسته‌بندی</th>
                        <th className="py-2.5 px-2.5 font-bold">اقلام</th>
                        <th className="py-2.5 px-2.5 font-bold">ارزش خرید</th>
                        <th className="py-2.5 px-2.5 font-bold">ارزش فروش</th>
                        <th className="py-2.5 px-2.5 font-bold">سود بالقوه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {warehouseAnalytics.categoryBreakdown.map((cat) => (
                        <tr key={cat.category} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-2.5 font-bold text-slate-800">{cat.category}</td>
                          <td className="py-2.5 px-2.5 text-slate-600">
                            {toPersianDigits(cat.skuCount)} کالا ({toPersianDigits(cat.totalStock)})
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-slate-800">
                            {formatPrice(cat.costValue, '')}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-600">
                            {formatPrice(cat.salesValue, '')}
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-emerald-700">
                            {formatPrice(cat.potentialProfit, '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Actionable Stock Health List (Low Stock / Out of Stock / Stagnant) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">بررسی وضعیت کالاهای خاص انبار</h3>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setWarehouseHealthFilter('low_stock')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      warehouseHealthFilter === 'low_stock'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    کسری و ناموجود ({toPersianDigits(warehouseAnalytics.lowStockList.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarehouseHealthFilter('stagnant')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      warehouseHealthFilter === 'stagnant'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    راکد بدون فروش ({toPersianDigits(warehouseAnalytics.stagnantList.length)})
                  </button>
                </div>
              </div>

              {warehouseHealthFilter === 'low_stock' ? (
                warehouseAnalytics.lowStockList.length === 0 ? (
                  <div className="text-center py-8 text-emerald-600 text-xs">
                    هیچ کالایی دارای کسری موجودی نیست.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pl-1 tabular-nums">
                    {warehouseAnalytics.lowStockList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            کد: {item.code} · حداقل مجاز: {toPersianDigits(item.minStockAlert)} {item.unit}
                          </div>
                        </div>
                        <span
                          className={`font-bold ${
                            item.stock === 0 ? 'text-rose-600' : 'text-amber-700'
                          }`}
                        >
                          {item.stock === 0
                            ? 'ناموجود (۰)'
                            : `${toPersianDigits(item.stock)} ${item.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : warehouseAnalytics.stagnantList.length === 0 ? (
                <div className="text-center py-8 text-emerald-600 text-xs">
                  تمامی کالاهای موجود در انبار حداقل یک بار سابقه فروش داشته‌اند.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pl-1 tabular-nums">
                  {warehouseAnalytics.stagnantList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          کد: {item.code} · موجودی: {toPersianDigits(item.stock)} {item.unit}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-purple-700">
                          سرمایه: {formatPrice(item.tiedCapital, settings.currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
