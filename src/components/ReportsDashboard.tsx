import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Product, Invoice, InvoiceItem, PurchaseInvoice, Customer, StoreSettings, AppUser } from '../types';
import {
  formatPrice,
  toPersianDigits,
  toEnglishDigits,
  getCurrentJalaliDate,
  getInvoiceDaysAge,
} from '../utils/jalali';
import { isServiceItem } from '../utils/serviceHelper';
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
  PackageX,
  Wrench,
  FileText,
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

type DatePeriodFilter = 'all' | 'today' | '7days' | '30days' | 'year';
type ReportSubTab = 'overview' | 'profitability' | 'cashflow' | 'warehouse';
type ItemSortMode = 'profit' | 'revenue' | 'quantity' | 'margin';
type ItemTypeFilter = 'all' | 'goods' | 'services';
type WarehouseHealthFilter = 'low_stock' | 'out_of_stock' | 'stagnant';

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

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  products,
  invoices,
  purchaseInvoices = [],
  settings,
  currentUser,
  onOpenInventory,
}) => {
  const [periodFilter, setPeriodFilter] = useState<DatePeriodFilter>('all');
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('overview');
  const [itemSortMode, setItemSortMode] = useState<ItemSortMode>('profit');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [warehouseHealthFilter, setWarehouseHealthFilter] = useState<WarehouseHealthFilter>('low_stock');

  const currentJalaliYear = useMemo(() => {
    const today = toEnglishDigits(getCurrentJalaliDate());
    return today.split('/')[0] || '1404';
  }, []);

  // Filter helper by date period
  const matchesPeriod = (dateStr?: string, createdAt?: string): boolean => {
    if (periodFilter === 'all') return true;
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
  }, [invoices, purchaseInvoices, periodFilter, currentJalaliYear]);

  // Comprehensive Financial, COGS, Profit & Item-Level Analytics
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
      }
    > = {};

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
      const custKey = inv.customerId || inv.customerName || 'unknown';
      if (!customerStatsMap[custKey]) {
        customerStatsMap[custKey] = {
          id: custKey,
          name: inv.customerName || 'مشتری عمومی',
          phone: inv.customerPhone || '',
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

        if (!itemStatsMap[statKey]) {
          itemStatsMap[statKey] = {
            key: statKey,
            code: item.productCode || item.code || '-',
            name: `${item.productName || item.name || 'بدون نام'}${variantSuffix}`,
            unit: item.unit || 'عدد',
            isService: serviceFlag,
            quantity: 0,
            netRevenue: 0,
            totalCost: 0,
            netProfit: 0,
            marginPercent: 0,
            invoiceCount: 0,
          };
        }

        itemStatsMap[statKey].quantity += qty;
        itemStatsMap[statKey].netRevenue += itemNetRevenue;
        itemStatsMap[statKey].totalCost += itemTotalCost;
        if (!seenItemsInInvoice.has(statKey)) {
          itemStatsMap[statKey].invoiceCount += 1;
          seenItemsInInvoice.add(statKey);
        }
      });

      totalDiscountsGiven += invInvoiceDiscount + rowDiscountsSum;
    });

    // Finalize item profit and margin
    const allSoldItems = Object.values(itemStatsMap).map((entry) => {
      const netProfit = entry.netRevenue - entry.totalCost;
      const marginPercent =
        entry.netRevenue > 0 ? Math.round((netProfit / entry.netRevenue) * 100) : 0;
      return {
        ...entry,
        netProfit,
        marginPercent,
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
    };
  }, [confirmedInvoices, proformaInvoices, periodPurchaseInvoices, products]);

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

    // 2. Item Profitability Sheet
    const itemRows = sortedItems.map((it, idx) => ({
      'رتبه': idx + 1,
      'کد کالا / خدمت': it.code,
      'شرح کالا یا خدمات': it.name,
      'نوع': it.isService ? 'خدمات' : 'کالای فیزیکی',
      'تعداد فروش': it.quantity,
      'واحد': it.unit,
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

    // 3. Warehouse Categories & Low Stock Sheet
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
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-800">
                  گزارشات مالی، سود و تحلیل انبار
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  محاسبه دقیق سود خالص فاکتورهای قطعی (بدون پیش‌فاکتورها)، جریان نقدینگی و سلامت موجودی انبار
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                بازه:
              </span>
              {(
                [
                  { id: 'all', label: 'همه زمان‌ها' },
                  { id: 'today', label: 'امروز' },
                  { id: '7days', label: '۷ روز اخیر' },
                  { id: '30days', label: '۳۰ روز اخیر' },
                  { id: 'year', label: `سال ${toPersianDigits(currentJalaliYear)}` },
                ] as { id: DatePeriodFilter; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodFilter(p.id)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                    periodFilter === p.id
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={handleExportExcelReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0"
              title="دریافت فایل اکسل چندبرگی از گزارش مالی، سود کالاها و وضعیت انبار"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>خروجی اکسل جامع</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'نمای کلی و شاخص‌ها', icon: BarChart3 },
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
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              <span>
                                فروش: <strong className="text-slate-700">{toPersianDigits(item.quantity)}</strong> {item.unit}
                              </span>
                              <span>·</span>
                              <span>مبلغ: {formatPrice(item.netRevenue, settings.currency)}</span>
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
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('profitability')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    مشاهده جدول کامل سودآوری اقلام ({toPersianDigits(sortedItems.length)} مورد) ←
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
          SUB-TAB 2: ITEM PROFITABILITY (تحلیل سودآوری اقلام و خدمات)
         =================================================================== */}
      {activeSubTab === 'profitability' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                جدول تحلیل سودآوری تفکیکی کالاها و خدمات فروخته‌شده
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مبالغ فروش پس از کسر تخفیف ردیف و سهم تخفیف کلی فاکتور محاسبه شده‌اند
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
                    <th className="py-3 px-3 font-bold w-36">حاشیه سود</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          SUB-TAB 3: CASH FLOW & RECEIVABLES (جریان نقدینگی و مطالبات)
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
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {toPersianDigits(cust.invoicesCount)} فاکتور · دریافتی:{' '}
                          {formatPrice(cust.totalPaid, settings.currency)}
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
          SUB-TAB 4: WAREHOUSE VALUATION & HEALTH (ارزش‌گذاری و سلامت انبار)
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
