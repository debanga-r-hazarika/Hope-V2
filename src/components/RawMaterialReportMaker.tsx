import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, FileText, X, Calendar, ChevronDown, PackageOpen, Download, ChevronLeft, ChevronRight } from 'lucide-react';

import { ModernCard } from './ui/ModernCard';
import { useAuth } from '../contexts/AuthContext';
// Import Hatvoni logo
import logoUrl from '../../logo/HATVONI TRANSPARENT LOGO.png';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 'Weekly' | 'Monthly';
type UnitType = 'kg' | 'g' | 'tons' | 'liters' | 'pcs' | 'bags' | 'boxes' | 'Other';
type ConditionType = 'Raw' | 'Ash' | 'Dry' | 'Other';

interface ItemEntry {
    id: string;
    name: string;
    quantity: number | '';
    unit: UnitType;
    customUnit?: string;
    condition: ConditionType;
    customCondition?: string;
}

const StepHeader = ({ num, title, error }: { num: number; title: string, error?: string }) => (
    <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${error ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                {num}
            </div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        {error && <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium border border-red-100">{error}</span>}
    </div>
);

function CustomWeekPicker({ value, onChange, error }: { value: string, onChange: (val: string) => void, error?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (value && !value.includes('W')) {
            const [y, m, d] = value.split('-').map(Number);
            setCurrentMonth(new Date(y, m - 1, d));
        }
    }, [value]);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const renderCalendar = () => {
        const slots = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            slots.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            let isSelected = false;

            if (value && !value.includes('W')) {
                const [y, m, d] = value.split('-').map(Number);
                const selectedDate = new Date(y, m - 1, d); // this is Sunday
                const selectedEnd = new Date(selectedDate);
                selectedEnd.setDate(selectedDate.getDate() + 6); // this is Saturday
                if (dateObj >= selectedDate && dateObj <= selectedEnd) {
                    isSelected = true;
                }
            }

            slots.push(
                <div
                    key={i}
                    className={`w-8 h-8 flex items-center justify-center text-sm font-medium cursor-pointer rounded-full transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700 hover:bg-indigo-100 hover:text-indigo-900'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Find the Sunday of this week
                        const dayOfWeek = dateObj.getDay(); // 0 is Sunday
                        const sunday = new Date(dateObj);
                        sunday.setDate(dateObj.getDate() - dayOfWeek);
                        const sy = sunday.getFullYear();
                        const sm = String(sunday.getMonth() + 1).padStart(2, '0');
                        const sd = String(sunday.getDate()).padStart(2, '0');
                        onChange(`${sy}-${sm}-${sd}`);
                        setIsOpen(false);
                    }}
                >
                    {i}
                </div>
            );
        }
        return slots;
    };

    let displayValue = '';
    if (value && !value.includes('W')) {
        const [y, m, d] = value.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const fmt = { month: 'short', day: 'numeric' } as const;
        const fy = { year: 'numeric' } as const;
        displayValue = `${start.toLocaleDateString('en-US', fmt)} - ${end.toLocaleDateString('en-US', fmt)}, ${end.toLocaleDateString('en-US', fy)}`;
    } else if (value) {
        displayValue = value; // Fallback
    }

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div
                className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium shadow-sm cursor-pointer flex items-center min-h-[48px] ${error ? 'border-red-300 text-red-700 bg-red-50/10' : 'border-gray-200 text-gray-700'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Calendar className={`w-5 h-5 absolute left-4 pointer-events-none transition-colors ${error ? 'text-red-400' : 'text-indigo-400'}`} />
                {displayValue ? <span>{displayValue}</span> : <span className="text-gray-400 font-normal">Select a week...</span>}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-100 shadow-xl rounded-2xl z-[100] w-[290px] animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(year, month - 1, 1)); }} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-indigo-600">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-gray-800 text-sm tracking-wide">
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(year, month + 1, 1)); }} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-indigo-600">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-xs font-bold text-gray-400 uppercase">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 justify-items-center mb-1">
                        {renderCalendar()}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Select any day to highlight week</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function RawMaterialReportMaker({ onClose }: { onClose: () => void }) {
    const { profile } = useAuth();

    const [reportType, setReportType] = useState<ReportType>('Weekly');
    const [periodDate, setPeriodDate] = useState<string>('');
    const [items, setItems] = useState<ItemEntry[]>([
        { id: crypto.randomUUID(), name: '', quantity: '', unit: 'kg', condition: 'Raw' }
    ]);
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);

    const handleAddItem = () => {
        setItems(prev => [...prev, { id: crypto.randomUUID(), name: '', quantity: '', unit: 'kg', condition: 'Raw' }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: keyof ItemEntry, value: string | number) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
        // Clear specific error if field changes
        if (errors[`${id}-${field}`]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[`${id}-${field}`];
                return next;
            });
        }
    };

    const getWeekFormatted = (weekStr: string) => {
        if (!weekStr) return '';

        let startDay: Date, endDay: Date, weekNo: number;

        if (weekStr.includes('-W')) {
            const [yearStr, weekNumStr] = weekStr.split('-W');
            const year = parseInt(yearStr, 10);
            weekNo = parseInt(weekNumStr, 10);

            const date = new Date(year, 0, 4);
            const day = date.getDay() || 7;

            date.setDate(date.getDate() - day + 1);
            date.setDate(date.getDate() + (weekNo - 1) * 7);

            startDay = new Date(date);
            startDay.setDate(startDay.getDate() - 1); // Sunday

            endDay = new Date(startDay);
            endDay.setDate(startDay.getDate() + 6); // Saturday
        } else if (weekStr.includes('-')) {
            const [y, m, d] = weekStr.split('-').map(Number);
            startDay = new Date(y, m - 1, d); // this is our local Sunday passed from CustomWeekPicker

            endDay = new Date(startDay);
            endDay.setDate(startDay.getDate() + 6);

            const dateUTC = new Date(Date.UTC(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()));
            const dayNumIso = dateUTC.getUTCDay() || 7;
            dateUTC.setUTCDate(dateUTC.getUTCDate() + 4 - dayNumIso);
            const yearStart = new Date(Date.UTC(dateUTC.getUTCFullYear(), 0, 1));
            weekNo = Math.ceil((((dateUTC.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        } else {
            return '';
        }

        const formatOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        const yearFormat: Intl.DateTimeFormatOptions = { year: 'numeric' };

        return `Week ${weekNo} — ${startDay.toLocaleDateString('en-US', formatOpts)} to ${endDay.toLocaleDateString('en-US', formatOpts)}, ${endDay.toLocaleDateString('en-US', yearFormat)}`;
    };

    const getMonthFormatted = (monthStr: string) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const periodLabel = reportType === 'Weekly'
        ? (periodDate ? getWeekFormatted(periodDate) : 'Select a week')
        : (periodDate ? getMonthFormatted(periodDate) : 'Select a month');

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!periodDate) newErrors.period = 'Period is required';
        if (items.length === 0) newErrors.items = 'At least one item must be added';

        items.forEach((item) => {
            if (!item.name.trim()) newErrors[`${item.id}-name`] = 'Required';
            if (item.quantity === '' || Number(item.quantity) <= 0) newErrors[`${item.id}-quantity`] = 'Valid number';
            if (item.unit === 'Other' && !item.customUnit?.trim()) newErrors[`${item.id}-customUnit`] = 'Required';
            if (item.condition === 'Other' && !item.customCondition?.trim()) newErrors[`${item.id}-customCondition`] = 'Required';
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const toDataURL = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    };

    const generatePDF = async () => {
        if (!validate()) return;
        setIsGenerating(true);

        try {
            const doc = new jsPDF();
            let logoData: string | null = null;
            try {
                logoData = await toDataURL(logoUrl);
            } catch (e) {
                console.warn('Logo could not be loaded for PDF', e);
            }

            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;

            // Header Design
            // Accent color strip
            doc.setFillColor(79, 70, 229); // primary color (indigo-600)
            doc.rect(0, 0, pageWidth, 5, 'F');

            let startY = margin;

            // Top row: Logo and "Raw Material Report"
            if (logoData) {
                const imgProps = doc.getImageProperties(logoData);
                const logowidth = 30;
                const logoheight = (imgProps.height * logowidth) / imgProps.width;
                doc.addImage(logoData, 'PNG', margin, startY, logowidth, logoheight);
            } else {
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(31, 41, 55);
                doc.text('HATVONI', margin, startY + 8);
            }

            // Right alignment
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(31, 41, 55);
            doc.text('Raw Material Report', pageWidth - margin, startY + 8, { align: 'right' });

            startY += 15;

            // Sub header info
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128); // gray-500
            doc.text(`Period: ${periodLabel}`, pageWidth - margin, startY, { align: 'right' });
            doc.text(`Report Type: ${reportType}`, pageWidth - margin, startY + 6, { align: 'right' });

            doc.setFontSize(11);
            doc.setTextColor(55, 65, 81);
            doc.text(`Prepared by: ${profile?.full_name || 'User'}`, margin, startY + 6);
            doc.text(`Date Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, startY + 12);

            startY += 25;

            // Divider
            doc.setDrawColor(229, 231, 235); // gray-200
            doc.setLineWidth(0.5);
            doc.line(margin, startY, pageWidth - margin, startY);
            startY += 10;

            // Items Table
            const tableHead = [['#', 'Item Name', 'Quantity', 'Condition']];
            const tableBody = items.map((item, index) => {
                const u = item.unit === 'Other' ? item.customUnit || '' : item.unit;
                const qtyStr = `${item.quantity} ${u}`;
                const c = item.condition === 'Other' ? item.customCondition || '' : item.condition;

                return [
                    index + 1,
                    item.name,
                    qtyStr,
                    c
                ];
            });

            autoTable(doc, {
                startY,
                head: tableHead,
                body: tableBody,
                theme: 'plain',
                headStyles: {
                    fillColor: [249, 250, 251],
                    textColor: [31, 41, 55],
                    fontStyle: 'bold',
                    lineColor: [229, 231, 235],
                    lineWidth: 0.1
                },
                bodyStyles: {
                    textColor: [75, 85, 99],
                    lineColor: [229, 231, 235],
                    lineWidth: { bottom: 0.1 }
                },
                alternateRowStyles: {
                    fillColor: [250, 250, 250]
                },
                styles: {
                    font: 'helvetica',
                    cellPadding: 5
                },
                margin: { left: margin, right: margin }
            });

            // Notes Section
            let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

            if (notes.trim()) {
                if (finalY + 40 > pageHeight - margin) {
                    doc.addPage();
                    finalY = margin + 10;
                }

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(31, 41, 55);
                doc.text('Notes / Remarks', margin, finalY);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(75, 85, 99);
                const splitNotes = doc.splitTextToSize(notes, pageWidth - margin * 2);
                doc.text(splitNotes, margin, finalY + 8);
            }

            // Footer every page
            const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(156, 163, 175);
                doc.text(`Hatvoni - Confidential`, margin, pageHeight - 10);
                doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

                // Add divider for footer
                doc.setDrawColor(229, 231, 235);
                doc.setLineWidth(0.5);
                doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
            }

            // Add short delay for UI switch
            setTimeout(() => {
                doc.save(`Raw_Material_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                setIsGenerating(false);
            }, 500);

        } catch (e) {
            console.error('Failed to generate PDF:', e);
            alert('An error occurred while generating the PDF. Please try again.');
            setIsGenerating(false);
        }
    };

    return (
        <div className="animate-fade-in pb-16 max-w-4xl mx-auto px-2">

            {/* Beautiful Header Card */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl p-6 sm:p-8 mb-8 text-white relative overflow-hidden shadow-xl ring-1 ring-black/5">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-xs font-semibold tracking-wider uppercase mb-5 backdrop-blur-md shadow-sm border border-white/20">
                            <FileText className="w-3.5 h-3.5" />
                            Internal Tool
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight">
                            Raw Material Report Maker
                        </h2>
                        <p className="text-indigo-100/90 max-w-lg text-sm sm:text-base leading-relaxed">
                            Generate beautifully formatted, confidential PDF compliance reports instantly. Fully processed offline in your browser.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="self-end sm:self-start shrink-0 p-2.5 bg-black/20 hover:bg-black/40 rounded-full text-white/90 hover:text-white transition-all backdrop-blur-md border border-white/10"
                        title="Close Tool"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Decorative background shapes */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-10 left-10 w-40 h-40 bg-purple-400 opacity-20 rounded-full blur-2xl pointer-events-none"></div>
            </div>

            <div className="space-y-8">

                {/* Configuration Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step 1 */}
                    <ModernCard className="p-6 shadow-sm border-0 ring-1 ring-gray-100 hover:ring-indigo-100 transition-all">
                        <StepHeader num={1} title="Report Type" />
                        <div className="flex bg-gray-100/80 p-1.5 rounded-xl w-full border border-gray-200/60 shadow-inner">
                            {['Weekly', 'Monthly'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setReportType(type as ReportType);
                                        setPeriodDate('');
                                    }}
                                    className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${reportType === type
                                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </ModernCard>

                    {/* Step 2 */}
                    <ModernCard className={`p-6 shadow-sm border-0 ring-1 transition-all ${errors.period ? 'ring-red-200 bg-red-50/10' : 'ring-gray-100 hover:ring-indigo-100'}`}>
                        <StepHeader num={2} title="Period Selection" error={errors.period} />
                        <div className="relative">
                            {reportType === 'Weekly' ? (
                                <CustomWeekPicker
                                    value={periodDate}
                                    onChange={(val) => {
                                        setPeriodDate(val);
                                        if (errors.period) setErrors(p => ({ ...p, period: '' }));
                                    }}
                                    error={errors.period}
                                />
                            ) : (
                                <>
                                    <input
                                        type="month"
                                        value={periodDate}
                                        onChange={(e) => {
                                            setPeriodDate(e.target.value);
                                            if (errors.period) setErrors(p => ({ ...p, period: '' }));
                                        }}
                                        className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-gray-700 shadow-sm ${errors.period ? 'border-red-300' : 'border-gray-200'
                                            }`}
                                    />
                                    <Calendar className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${errors.period ? 'text-red-400' : 'text-indigo-400'}`} />
                                </>
                            )}
                        </div>
                        {periodDate && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-100/50">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                {periodLabel}
                            </div>
                        )}
                    </ModernCard>
                </div>

                {/* Step 3 */}
                <ModernCard className="p-0 shadow-sm border-0 ring-1 ring-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <StepHeader num={3} title="Material Items List" error={errors.items} />
                        <p className="text-sm text-gray-500 -mt-3 ml-11">Add raw materials sequentially. At least one is required.</p>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4 bg-white">
                        {items.map((item, idx) => (
                            <div key={item.id} className="relative bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group overflow-hidden">
                                {/* Side Accent Line */}
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                {items.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                                        title="Remove Item"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}

                                <div className="flex items-center gap-2 mb-4 text-indigo-700 font-semibold text-sm">
                                    <PackageOpen className="w-4 h-4" />
                                    Item #{idx + 1}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                                    {/* Name Input */}
                                    <div className="sm:col-span-5 relative">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Material Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Copper Wire, Organic Banana"
                                            value={item.name}
                                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                            className={`w-full bg-gray-50/50 border py-2.5 px-3 rounded-lg text-gray-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium ${errors[`${item.id}-name`] ? 'border-red-300 ring-red-100' : 'border-gray-200'
                                                }`}
                                        />
                                        {errors[`${item.id}-name`] && <p className="absolute -bottom-5 text-[10px] text-red-500 font-medium">{errors[`${item.id}-name`]}</p>}
                                    </div>

                                    {/* Quantity & Unit Input */}
                                    <div className="sm:col-span-4 relative">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Quantity</label>
                                        <div className={`flex border rounded-lg overflow-hidden bg-gray-50/50 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 focus-within:bg-white transition-all shadow-sm ${errors[`${item.id}-quantity`] ? 'border-red-300' : 'border-gray-200'}`}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                placeholder="0.00"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                className="w-full py-2.5 px-3 text-sm font-semibold text-gray-700 outline-none bg-transparent"
                                            />
                                            <div className="relative border-l border-gray-200 bg-gray-100 flex items-center">
                                                <select
                                                    value={item.unit}
                                                    onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                                    className="appearance-none py-2.5 pl-3 pr-8 text-sm font-bold text-gray-600 bg-transparent outline-none h-full"
                                                >
                                                    <option value="kg">kg</option>
                                                    <option value="g">g</option>
                                                    <option value="tons">tons</option>
                                                    <option value="liters">liters</option>
                                                    <option value="pcs">pcs</option>
                                                    <option value="bags">bags</option>
                                                    <option value="boxes">boxes</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                                <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            </div>
                                        </div>
                                        {errors[`${item.id}-quantity`] && <p className="absolute -bottom-5 text-[10px] text-red-500 font-medium">{errors[`${item.id}-quantity`]}</p>}
                                    </div>

                                    {/* Condition Selection */}
                                    <div className="sm:col-span-3 relative">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Condition</label>
                                        <div className="relative shadow-sm rounded-lg">
                                            <select
                                                value={item.condition}
                                                onChange={(e) => updateItem(item.id, 'condition', e.target.value)}
                                                className="w-full appearance-none py-2.5 pl-3 pr-8 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-gray-50/50 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all"
                                            >
                                                <option value="Raw">Raw</option>
                                                <option value="Ash">Ash</option>
                                                <option value="Dry">Dry</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Fields Row (Animated expansion visually) */}
                                {(item.unit === 'Other' || item.condition === 'Other') && (
                                    <div className="mt-6 pt-5 bg-indigo-50/30 -mx-5 -mb-5 px-5 pb-5 border-t border-indigo-50">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {item.unit === 'Other' ? (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Custom Unit Type</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Specify exactly"
                                                        value={item.customUnit || ''}
                                                        onChange={(e) => updateItem(item.id, 'customUnit', e.target.value)}
                                                        className={`w-full border py-2 px-3 rounded text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${errors[`${item.id}-customUnit`] ? 'border-red-300' : 'border-indigo-100'}`}
                                                    />
                                                    {errors[`${item.id}-customUnit`] && <p className="text-[10px] text-red-500 mt-1">{errors[`${item.id}-customUnit`]}</p>}
                                                </div>
                                            ) : <div className="hidden sm:block" />}

                                            {item.condition === 'Other' ? (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Custom Condition</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Specify condition"
                                                        value={item.customCondition || ''}
                                                        onChange={(e) => updateItem(item.id, 'customCondition', e.target.value)}
                                                        className={`w-full border py-2 px-3 rounded text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${errors[`${item.id}-customCondition`] ? 'border-red-300' : 'border-indigo-100'}`}
                                                    />
                                                    {errors[`${item.id}-customCondition`] && <p className="text-[10px] text-red-500 mt-1">{errors[`${item.id}-customCondition`]}</p>}
                                                </div>
                                            ) : <div className="hidden sm:block" />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-semibold hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/80 transition-all flex items-center justify-center gap-2 group mt-2"
                        >
                            <div className="p-1 bg-gray-100 rounded-full group-hover:bg-indigo-100 transition-colors">
                                <Plus className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                            </div>
                            Append New Material Item
                        </button>
                    </div>
                </ModernCard>

                {/* Step 4 */}
                <ModernCard className="p-6 shadow-sm border-0 ring-1 ring-gray-100 hover:ring-indigo-50 transition-all">
                    <StepHeader num={4} title="Notes & Remarks" />
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none min-h-[120px] resize-y bg-gray-50/50 focus:bg-white transition-all"
                        placeholder="Add optional notes, signatures references, or specific warnings to be printed onto the PDF..."
                    />
                </ModernCard>

                {/* Step 5 */}
                <div className="pt-6 pb-2 border-t border-gray-200">
                    <button
                        onClick={generatePDF}
                        disabled={isGenerating}
                        className="w-full py-5 px-6 rounded-2xl text-lg font-bold shadow-xl shadow-indigo-600/20 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Compiling PDF...
                            </>
                        ) : (
                            <>
                                <Download className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
                                Generate & Download PDF Report
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-400 font-medium mt-4">
                        Data translates locally instantly via JS rendering engine.
                    </p>
                </div>

            </div>
        </div>
    );
}
