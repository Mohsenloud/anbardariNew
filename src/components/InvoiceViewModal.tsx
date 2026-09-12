import React, { useState } from 'react';
import { Invoice, StoreSettings } from '../types';
import { formatPrice, toPersianDigits } from '../utils/jalali';
import { exportElementToPdf, printElementDirectly, printElementInNewWindow } from '../utils/pdfHelper';
import { Printer, X, FileText, CheckCircle, Receipt, Building2, Share2, MessageCircle, Copy, Check, FileDown, Loader2, Globe, ArrowRightLeft, Pencil } from 'lucide-react';

interface InvoiceViewModalProps {
  invoice: Invoice | null;
  settings: StoreSettings;
  onClose: () => void;
  onConvertProforma?: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({
  invoice,
  settings,
  onClose,
  onConvertProforma,
  onEditInvoice,
}) => {
  const defaultTpl = invoice.type || settings.defaultTemplate || 'standard';
  const [template, setTemplate] = useState<'standard' | 'official' | 'thermal'>(defaultTpl);
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!invoice) return null;

  const currentTemplate = template;

  const handlePrint = () => {
    const docTitle = invoice.isProforma
      ? `پیش‌فاکتور فروش شماره ${invoice.invoiceNumber}`
      : `فاکتور فروش شماره ${invoice.invoiceNumber}`;
    const opened = printElementInNewWindow('printable-invoice', docTitle);
    if (!opened) {
      printElementDirectly('printable-invoice');
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const filename = invoice.isProforma
        ? `پیش_فاکتور_${invoice.invoiceNumber}`
        : `فاکتور_فروش_${invoice.invoiceNumber}`;
      await exportElementToPdf('printable-invoice', filename);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getInvoiceShareText = () => {
    const titleText = invoice.isProforma
      ? `🧾 *پیش‌فاکتور فروش ${settings.storeName || 'فروشگاه'}*`
      : `🧾 *فاکتور فروش ${settings.storeName || 'فروشگاه'}*`;
    const numLabel = invoice.isProforma ? 'شماره پیش‌فاکتور' : 'شماره فاکتور';
    const lines = [
      titleText,
      `${numLabel}: ${toPersianDigits(invoice.invoiceNumber)}`,
      `تاریخ صدور: ${invoice.date}`,
      `خریدار: ${invoice.customerName}`,
      `---------------------------------`,
      ...invoice.items.map(
        (it, idx) =>
          `${toPersianDigits(idx + 1)}. ${it.productName} (${toPersianDigits(it.quantity)} ${it.unit || 'عدد'}) - ${formatPrice(it.total, settings.currency)}`
      ),
      `---------------------------------`,
      `جمع کل: *${formatPrice(invoice.finalTotal, settings.currency)}*`,
      `وضعیت پرداخت: ${
        invoice.paymentStatus === 'paid'
          ? 'تسویه کامل'
          : invoice.paymentStatus === 'partial'
          ? `بیعانه (پرداختی: ${formatPrice(invoice.paidAmount || 0, settings.currency)})`
          : 'نسیه'
      }`,
      settings.phone ? `تلفن فروشگاه: ${toPersianDigits(settings.phone)}` : '',
      `با تشکر از حسن انتخاب شما`
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = getInvoiceShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `فاکتور فروش شماره ${invoice.invoiceNumber}`,
          text: text,
        });
      } catch (err) {
        // user cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(getInvoiceShareText());
    const phone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : '';
    // If iranian phone starts with 09..., convert to 989...
    const intlPhone = phone.startsWith('09') ? `98${phone.slice(1)}` : phone;
    const url = intlPhone ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Modal Dialog Card */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="no-print bg-slate-900 text-white p-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2">
              <Receipt className={`w-5 h-5 ${invoice.isProforma ? 'text-indigo-400' : 'text-emerald-400'} shrink-0`} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs sm:text-sm">
                    {invoice.isProforma ? 'پیش‌فاکتور شماره' : 'فاکتور شماره'} {toPersianDigits(invoice.invoiceNumber)}
                  </h3>
                  {invoice.isProforma && (
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-400/40">
                      غیرقطعی - بدون کسر انبار
                    </span>
                  )}
                  {invoice.convertedFromProforma && (
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-400/40">
                      تبدیل‌شده از پیش‌فاکتور
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile close button on top right */}
            <button
              id="modal-close-mobile-btn"
              onClick={onClose}
              className="sm:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            {/* Convert Proforma to Official Invoice button */}
            {invoice.isProforma && onConvertProforma && (
              <button
                type="button"
                id="modal-convert-proforma-btn"
                onClick={() => onConvertProforma(invoice)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>تبدیل به فاکتور اصلی</span>
              </button>
            )}

            {/* Template Selector */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs">
              {settings.enableStandardTemplate !== false && (
                <button
                  id="modal-tpl-standard"
                  onClick={() => setTemplate('standard')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                    currentTemplate === 'standard' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  فروشگاهی
                </button>
              )}
              {settings.enableOfficialTemplate !== false && (
                <button
                  id="modal-tpl-official"
                  onClick={() => setTemplate('official')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                    currentTemplate === 'official' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  رسمی
                </button>
              )}
              {settings.enableThermalTemplate !== false && (
                <button
                  id="modal-tpl-thermal"
                  onClick={() => setTemplate('thermal')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                    currentTemplate === 'thermal' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  حرارتی
                </button>
              )}
            </div>

            {/* Action Buttons: Share, WhatsApp, Print */}
            <div className="flex items-center gap-1.5">
              {/* WhatsApp Quick Share */}
              <button
                type="button"
                onClick={handleWhatsApp}
                title="ارسال فاکتور در واتساپ"
                className="flex items-center gap-1 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">واتساپ</span>
              </button>

              {/* Native / Copy Share */}
              <button
                type="button"
                onClick={handleShare}
                title="اشتراک‌گذاری فاکتور"
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden xs:inline">{copied ? 'کپی شد' : 'ارسال'}</span>
              </button>

              {/* PDF Export Button */}
              <button
                type="button"
                id="modal-pdf-btn"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                title="دانلود نسخه PDF فاکتور"
                className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span className="hidden xs:inline">{isExportingPdf ? 'تولید PDF...' : 'PDF'}</span>
              </button>

              {/* Edit Invoice Button */}
              {onEditInvoice && (
                <button
                  type="button"
                  id="modal-edit-invoice-btn"
                  onClick={() => {
                    onClose();
                    onEditInvoice(invoice);
                  }}
                  title={invoice.isProforma ? 'ویرایش پیش‌فاکتور' : 'ویرایش فاکتور فروش'}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{invoice.isProforma ? 'ویرایش پیش‌فاکتور' : 'ویرایش فاکتور'}</span>
                </button>
              )}

              {/* Print Button */}
              <button
                id="modal-print-btn"
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ</span>
              </button>

              {/* Desktop Close Button */}
              <button
                id="modal-close-btn"
                onClick={onClose}
                className="hidden sm:block p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="overflow-x-auto overflow-y-auto p-2 sm:p-8 bg-slate-100/60 print:p-0 print:bg-white flex justify-center">
          {/* Paper Container */}
          <div
            id="printable-invoice"
            className={`bg-white shadow-md print:shadow-none print:border-none border border-slate-200 transition-all ${
              currentTemplate === 'thermal'
                ? 'w-full max-w-[340px] p-4 text-[12px]'
                : 'w-full max-w-[800px] p-6 sm:p-8 text-[13px]'
            }`}
          >
            {/* TEMPLATE 1 & 2: STANDARD OR OFFICIAL */}
            {currentTemplate !== 'thermal' ? (
              <div className="space-y-5">
                {/* Header: Seller Brand + Invoice Title & Meta */}
                <div className="border-b-2 border-slate-900 pb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">
                        {settings.storeName || 'فروشگاه سپهر'}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {settings.tagline || 'عرضه انواع کالا و خدمات معتبر'}
                      </p>
                    </div>

                    {/* Badge / Title */}
                    <div className="text-center sm:text-left self-center sm:self-auto">
                      <h1 className="text-lg font-black text-slate-900 tracking-wide border-b-2 border-slate-800 pb-1">
                        {invoice.isProforma
                          ? currentTemplate === 'official'
                            ? 'پیش‌فاکتور فروش کالا و خدمات'
                            : 'پیش‌فاکتور فروش کالا'
                          : currentTemplate === 'official'
                          ? 'صورتحساب فروش کالا و خدمات'
                          : 'فاکتور فروش کالا'}
                      </h1>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-600">
                        <span>
                          {invoice.isProforma ? 'شماره پیش‌فاکتور:' : 'شماره فاکتور:'}{' '}
                          <strong className="text-slate-900">{toPersianDigits(invoice.invoiceNumber)}</strong>
                        </span>
                        <span>تاریخ: <strong className="text-slate-900">{invoice.date}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {invoice.isProforma && (
                  <div className="bg-indigo-50/90 border border-indigo-200 text-indigo-900 rounded-xl p-3 text-center text-xs font-semibold">
                    این سند صرفاً «پیش‌فاکتور» است و فاقد اثر مالیاتی یا کسر قطعی از انبار می‌باشد. (برای نهایی شدن باید به فاکتور اصلی تبدیل شود)
                  </div>
                )}
                {invoice.convertedFromProforma && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-2.5 text-center text-xs font-medium">
                    این فاکتور رسمی بر اساس پیش‌فاکتور شماره <strong>{toPersianDigits(invoice.convertedFromProforma)}</strong> صادر و نهایی شده است.
                  </div>
                )}

                {/* Seller & Buyer Info Blocks */}
                {currentTemplate === 'official' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Seller Box */}
                    <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                      <div className="font-bold text-slate-800 pb-1.5 mb-1.5 border-b border-slate-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-700" />
                        <span>مشخصات فروشنده:</span>
                      </div>
                      <div className="space-y-1 text-slate-700">
                        <p><strong>نام فروشگاه / شخص:</strong> {settings.storeName} ({settings.sellerName})</p>
                        <p><strong>شناسه ملی / کد اقتصادی:</strong> {toPersianDigits(settings.economicCode || settings.nationalCode || '---')}</p>
                        <p><strong>نشانی:</strong> {settings.address}</p>
                        <p><strong>تلفن تماس:</strong> {toPersianDigits(settings.phone || settings.mobile)}</p>
                      </div>
                    </div>

                    {/* Buyer Box */}
                    <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                      <div className="font-bold text-slate-800 pb-1.5 mb-1.5 border-b border-slate-200">
                        مشخصات خریدار:
                      </div>
                      <div className="space-y-1 text-slate-700">
                        <p><strong>نام خریدار / شرکت:</strong> {invoice.customerName || 'مشتری محترم'}</p>
                        <p><strong>شناسه ملی / کد اقتصادی:</strong> {toPersianDigits(invoice.customerNationalId || '---')}</p>
                        <p><strong>نشانی خریدار:</strong> {invoice.customerAddress || '---'}</p>
                        <p><strong>تلفن همراه:</strong> {toPersianDigits(invoice.customerPhone || '---')}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard customer info bar */
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex flex-wrap justify-between gap-3 text-slate-700">
                    <div><strong>خریدار:</strong> {invoice.customerName || 'مشتری محترم'}</div>
                    {invoice.customerPhone && <div><strong>تلفن:</strong> {toPersianDigits(invoice.customerPhone)}</div>}
                    {invoice.customerAddress && <div><strong>آدرس:</strong> {invoice.customerAddress}</div>}
                    <div>
                      <strong>وضعیت پرداخت:</strong>{' '}
                      <span className="font-semibold text-slate-900">
                        {invoice.paymentStatus === 'paid'
                          ? 'تسویه کامل'
                          : invoice.paymentStatus === 'partial'
                          ? 'بیعانه'
                          : 'نسیه / بدهکار'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                        <th className="p-2 border-l border-slate-300 w-8 text-center">ردیف</th>
                        <th className="p-2 border-l border-slate-300">کد کالا</th>
                        <th className="p-2 border-l border-slate-300">شرح کالا یا خدمات</th>
                        <th className="p-2 border-l border-slate-300 text-center">تعداد</th>
                        <th className="p-2 border-l border-slate-300 text-center">واحد</th>
                        <th className="p-2 border-l border-slate-300 text-left">قیمت واحد ({settings.currency})</th>
                        <th className="p-2 border-l border-slate-300 text-left">تخفیف</th>
                        <th className="p-2 text-left">مبلغ کل ({settings.currency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-slate-200">
                          <td className="p-2 border-l border-slate-200 text-center">{toPersianDigits(idx + 1)}</td>
                          <td className="p-2 border-l border-slate-200 text-slate-600">{toPersianDigits(item.productCode || '---')}</td>
                          <td className="p-2 border-l border-slate-200 font-medium text-slate-900">{item.productName}</td>
                          <td className="p-2 border-l border-slate-200 text-center font-bold">{toPersianDigits(item.quantity)}</td>
                          <td className="p-2 border-l border-slate-200 text-center text-slate-600">{item.unit || 'عدد'}</td>
                          <td className="p-2 border-l border-slate-200 text-left">{formatPrice(item.unitPrice, '', false)}</td>
                          <td className="p-2 border-l border-slate-200 text-left text-slate-600">
                            {item.discount > 0 ? formatPrice(item.discount, '', false) : '۰'}
                          </td>
                          <td className="p-2 text-left font-bold text-slate-900">
                            {formatPrice(item.total, '', false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals and Payment Summary Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
                  {/* Notes, Payment Details & Cheque/Transfer Info */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 text-xs text-slate-700 space-y-2.5">
                    {/* مشخصات و روش دریافت وجه */}
                    <div className="space-y-1.5 pb-2 border-b border-slate-200">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>روش دریافت وجه:</span>
                        <span className="text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded text-[11px]">
                          {invoice.paymentMethod === 'cheque' 
                            ? 'چک بانکی' 
                            : invoice.paymentMethod === 'cash' 
                            ? 'نقدی' 
                            : invoice.paymentMethod === 'transfer' 
                            ? 'واریز به حساب' 
                            : invoice.paymentMethod === 'pos' 
                            ? 'کارتخوان (POS)' 
                            : 'حساب دفتری / نسیه'}
                        </span>
                      </div>

                      {/* اطلاعات چک در صورت وجود */}
                      {invoice.paymentMethod === 'cheque' && (
                        <div className="bg-sky-50/80 border border-sky-200/80 rounded-lg p-2 text-[11px] space-y-1 text-slate-800">
                          <div className="font-bold text-sky-900 flex items-center gap-1">
                            <span>📑 مشخصات چک:</span>
                          </div>
                          {invoice.chequeNumber && (
                            <div>شماره چک / صیادی: <strong>{toPersianDigits(invoice.chequeNumber)}</strong></div>
                          )}
                          {invoice.chequeDueDate && (
                            <div>تاریخ سررسید چک: <strong>{toPersianDigits(invoice.chequeDueDate)}</strong></div>
                          )}
                          {invoice.chequeName && (
                            <div>نام چک (صاحب حساب/بانک): <strong>{invoice.chequeName}</strong></div>
                          )}
                        </div>
                      )}

                      {/* اطلاعات واریز به حساب در صورت وجود */}
                      {invoice.paymentMethod === 'transfer' && (
                        <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-lg p-2 text-[11px] space-y-1 text-slate-800">
                          <div className="font-bold text-indigo-900 flex items-center gap-1">
                            <span>🏦 مشخصات واریز به حساب:</span>
                          </div>
                          {invoice.transferDescription ? (
                            <div className="leading-relaxed">{invoice.transferDescription}</div>
                          ) : (
                            <div className="text-slate-500 italic">واریز به حساب بانکی فروشگاه</div>
                          )}
                        </div>
                      )}

                      {/* اطلاعات نقدی */}
                      {invoice.paymentMethod === 'cash' && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-1.5">
                          ✓ دریافت کامل وجه به صورت نقدی در صندوق
                        </div>
                      )}
                    </div>

                    {invoice.notes && (
                      <p><strong>توضیحات فاکتور:</strong> {invoice.notes}</p>
                    )}
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {settings.invoiceFooterText || 'از اعتماد و همکاری شما صمیمانه متشکریم.'}
                    </p>
                  </div>

                  {/* Calculations Table */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                    <div className="p-2.5 flex justify-between border-b border-slate-200 bg-slate-50">
                      <span className="text-slate-600">جمع ناخالص اقلام:</span>
                      <span className="font-semibold text-slate-800">{formatPrice(invoice.subtotal, settings.currency)}</span>
                    </div>
                    {invoice.totalDiscount > 0 && (
                      <div className="p-2.5 flex justify-between border-b border-slate-200 text-rose-700 bg-white">
                        <span>مجموع تخفیفات:</span>
                        <span>-{formatPrice(invoice.totalDiscount, settings.currency)}</span>
                      </div>
                    )}
                    {invoice.taxAmount > 0 && (
                      <div className="p-2.5 flex justify-between border-b border-slate-200 bg-slate-50">
                        <span className="text-slate-600">مالیات و ارزش افزوده ({toPersianDigits(invoice.taxRate)}٪):</span>
                        <span className="font-semibold text-slate-800">{formatPrice(invoice.taxAmount, settings.currency)}</span>
                      </div>
                    )}
                    <div className="p-3 flex justify-between bg-slate-900 text-white font-bold text-sm">
                      <span>مبلغ نهایی قابل پرداخت:</span>
                      <span className="text-emerald-400 font-extrabold">{formatPrice(invoice.finalTotal, settings.currency)}</span>
                    </div>
                    {invoice.paymentStatus === 'partial' && (
                      <div className="p-2.5 flex justify-between border-t border-slate-200 bg-amber-50 text-amber-900 font-medium">
                        <span>مبلغ پرداختی: {formatPrice(invoice.paidAmount, settings.currency)}</span>
                        <span>مانده بدهی: {formatPrice(invoice.finalTotal - invoice.paidAmount, settings.currency)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signatures & Stamps */}
                <div className="grid grid-cols-2 pt-8 pb-4 text-center text-xs text-slate-600 border-t border-slate-200">
                  <div className="space-y-12">
                    <span className="font-bold text-slate-700">مهر و امضای خریدار</span>
                    <div className="text-[11px] text-slate-400">کالا صحیح و سالم تحویل گردید</div>
                  </div>
                  <div className="space-y-12">
                    <span className="font-bold text-slate-700">مهر و امضای فروشنده</span>
                    <div className="text-[11px] text-slate-400">{settings.storeName}</div>
                  </div>
                </div>
              </div>
            ) : (
              /* TEMPLATE 3: THERMAL RECEIPT (فیش پرینتر) */
              <div className="font-mono text-center space-y-3">
                <div className="border-b-2 border-dashed border-slate-400 pb-2">
                  <h2 className="font-bold text-sm text-slate-900">{settings.storeName}</h2>
                  <p className="text-[11px] text-slate-500">{settings.phone}</p>
                  <p className="text-[11px] font-bold text-slate-800 mt-1">
                    {invoice.isProforma ? 'پیش‌فاکتور فروش کالا (غیرقطعی)' : 'رسید فروش کالا'}
                  </p>
                </div>

                <div className="text-right text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                  <div>
                    {invoice.isProforma ? 'پیش‌فاکتور:' : 'فاکتور:'}{' '}
                    <strong>{toPersianDigits(invoice.invoiceNumber)}</strong>
                  </div>
                  <div>تاریخ: {invoice.date}</div>
                  <div>مشتری: {invoice.customerName}</div>
                </div>

                {/* Items */}
                <div className="text-right text-[11px] space-y-2 border-b-2 border-dashed border-slate-400 pb-2">
                  {invoice.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800">{item.productName}</div>
                        <div className="text-[10px] text-slate-500">
                          {toPersianDigits(item.quantity)} × {formatPrice(item.unitPrice, '', false)}
                        </div>
                      </div>
                      <span className="font-bold">{formatPrice(item.total, '', false)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="text-right text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span>جمع اقلام:</span>
                    <span>{formatPrice(invoice.subtotal, settings.currency)}</span>
                  </div>
                  {invoice.totalDiscount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>تخفیف:</span>
                      <span>-{formatPrice(invoice.totalDiscount, settings.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                    <span>قابل پرداخت:</span>
                    <span>{formatPrice(invoice.finalTotal, settings.currency)}</span>
                  </div>
                  {/* روش پرداخت فیش */}
                  <div className="pt-1.5 border-t border-dotted border-slate-300 text-[10px] text-slate-700">
                    <div>
                      روش پرداخت: <strong>
                        {invoice.paymentMethod === 'cheque' 
                          ? 'چک' 
                          : invoice.paymentMethod === 'cash' 
                          ? 'نقدی' 
                          : invoice.paymentMethod === 'transfer' 
                          ? 'واریز به حساب' 
                          : invoice.paymentMethod === 'pos' 
                          ? 'کارتخوان' 
                          : 'دفتری'}
                      </strong>
                    </div>
                    {invoice.paymentMethod === 'cheque' && invoice.chequeNumber && (
                      <div className="text-[9px] text-slate-600">
                        چک: {invoice.chequeNumber} {invoice.chequeDueDate ? `(سررسید: ${invoice.chequeDueDate})` : ''}
                      </div>
                    )}
                    {invoice.paymentMethod === 'transfer' && invoice.transferDescription && (
                      <div className="text-[9px] text-slate-600">
                        پیگیری: {invoice.transferDescription}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-1">
                  {settings.invoiceFooterText || 'از خرید شما متشکریم'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden on Print) */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            برای ذخیره فایل PDF، در پنجره چاپگر مقصد را بر روی <strong>Save as PDF</strong> قرار دهید.
          </span>
          <div className="flex items-center gap-2">
            <button
              id="modal-bottom-cancel-btn"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              بستن
            </button>
            <button
              id="modal-bottom-print-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
