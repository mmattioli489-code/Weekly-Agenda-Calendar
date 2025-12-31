import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Calendar as CalendarIcon, Play, Download, Loader2 } from 'lucide-react';

const WeeklyCalendar = () => {
  const [startDate, setStartDate] = useState('2025-12-29');
  const [endDate, setEndDate] = useState('2027-01-03');
  const [weeks, setWeeks] = useState([]);
  const [showHolidays, setShowHolidays] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Load jsPDF library dynamically
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    // We only need jsPDF now, html2canvas is removed as we are drawing vectors
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      .catch(err => console.error('Failed to load jsPDF', err));
  }, []);

  // --- Dynamic Holiday Logic ---
  const getHolidaysForYear = (year) => {
    const holidays = {};
    const add = (month, day, name) => {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      holidays[key] = name;
    };
    const addNthWeekday = (month, n, weekday, name) => {
      let date = new Date(year, month - 1, 1);
      let count = 0;
      while (date.getMonth() === month - 1) {
        if (date.getDay() === weekday) {
          count++;
          if (count === n) {
            add(month, date.getDate(), name);
            return;
          }
        }
        date.setDate(date.getDate() + 1);
      }
    };
    const addLastWeekday = (month, weekday, name) => {
      let date = new Date(year, month, 0); 
      while (date.getDay() !== weekday) {
        date.setDate(date.getDate() - 1);
      }
      add(month, date.getDate(), name);
    };

    add(1, 1, "New Year's Day");
    add(2, 14, "Valentine's Day");
    add(3, 17, "St. Patrick's Day");
    add(6, 19, "Juneteenth");
    add(7, 4, "Independence Day");
    add(10, 31, "Halloween");
    add(11, 11, "Veterans Day");
    add(12, 25, "Christmas Day");
    add(12, 31, "New Year's Eve");

    addNthWeekday(1, 3, 1, "Martin Luther King, Jr. Day");
    addNthWeekday(2, 3, 1, "Presidents' Day");
    addNthWeekday(5, 2, 0, "Mother's Day");
    addLastWeekday(5, 1, "Memorial Day");
    addNthWeekday(6, 3, 0, "Father's Day");
    addNthWeekday(9, 1, 1, "Labor Day");
    addNthWeekday(10, 2, 1, "Indigenous Peoples' Day");
    addNthWeekday(11, 4, 4, "Thanksgiving Day");

    return holidays;
  };

  const holidayCache = useMemo(() => {
    const cache = {};
    const startYear = parseInt(startDate.split('-')[0]);
    const endYear = parseInt(endDate.split('-')[0]);
    for (let y = startYear; y <= endYear; y++) {
        Object.assign(cache, getHolidaysForYear(y));
    }
    return cache;
  }, [startDate, endDate]);

  const getHoliday = (date) => {
    if (!showHolidays) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    return holidayCache[key] || getHolidaysForYear(year)[key] || null;
  };

  // --- Week Generation ---
  useEffect(() => {
    generateWeeks();
  }, []);

  const generateWeeks = () => {
    if (!startDate || !endDate) return;
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    const weeksData = [];
    const current = new Date(start);
    const dayOfWeek = current.getDay(); 
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    current.setDate(current.getDate() + diff);

    let safetyCounter = 0;
    while (current <= end && safetyCounter < 156) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeksData.push(week);
      safetyCounter++;
    }
    setWeeks(weeksData);
  };

  // --- HELPER FORMATTING FOR DISPLAY ---
  const formatMonth = (date) => date.toLocaleDateString('en-US', { month: 'long' });
  const getWeekRange = (week) => {
    if (!week || week.length === 0) return '';
    const first = week[0];
    const last = week[6];
    const startMonth = first.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = last.toLocaleDateString('en-US', { month: 'short' });
    if (startMonth === endMonth) {
        return `${startMonth} ${first.getDate()} - ${last.getDate()}, ${last.getFullYear()}`;
    }
    return `${startMonth} ${first.getDate()} - ${endMonth} ${last.getDate()}, ${last.getFullYear()}`;
  };
  const getPrimaryMonth = (week) => formatMonth(week[3]);


  // --- VECTOR PDF GENERATION (The Fix) ---
  const handleDownloadPdf = () => {
    if (!window.jspdf) {
      alert("PDF library is loading. Please try again in a few seconds.");
      return;
    }

    setIsGeneratingPdf(true);
    setDownloadProgress(10); // Started

    // Use a timeout to allow UI to update to "generating" state
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'letter'
            });

            // Constants for Layout (Letter is 612pt x 792pt)
            const pageWidth = 612;
            const pageHeight = 792;
            const margin = 36; // 0.5 inch
            const contentWidth = pageWidth - (margin * 2);
            
            // Layout Dimensions
            const headerHeight = 60;
            const gridTop = margin + headerHeight + 20;
            const gridHeight = pageHeight - gridTop - margin - 20; // Bottom margin buffer
            const rowHeight = gridHeight / 3;
            const colWidth = contentWidth / 2;

            // Loop through every week to create pages
            weeks.forEach((week, index) => {
                if (index > 0) {
                    doc.addPage();
                }

                // 1. Draw Header
                // Month (Left)
                doc.setFont("helvetica", "bold");
                doc.setFontSize(24);
                doc.setTextColor(30, 41, 59); // Slate-800
                const monthText = getPrimaryMonth(week).toUpperCase();
                // INDENT: Added + 5 to margin
                doc.text(monthText, margin + 5, margin + 40);

                // Date Range (Right)
                doc.setFontSize(14);
                doc.setTextColor(71, 85, 105); // Slate-600
                const dateRangeText = getWeekRange(week);
                const dateRangeWidth = doc.getTextWidth(dateRangeText);
                // INDENT: Subtracted additional 5 from X
                doc.text(dateRangeText, pageWidth - margin - dateRangeWidth - 5, margin + 40);

                // Heavy Line under header
                doc.setLineWidth(2);
                doc.setDrawColor(30, 41, 59);
                doc.line(margin, margin + 50, pageWidth - margin, margin + 50);

                // 2. Draw Main Grid Lines (The Skeleton)
                doc.setLineWidth(1);
                doc.setDrawColor(30, 41, 59); // Dark border
                doc.setLineDash([], 0); // Solid
                
                // Outer Box
                doc.rect(margin, gridTop, contentWidth, gridHeight);

                // Vertical Middle Line
                doc.line(margin + colWidth, gridTop, margin + colWidth, gridTop + gridHeight);

                // Horizontal Row Lines
                doc.line(margin, gridTop + rowHeight, pageWidth - margin, gridTop + rowHeight);
                doc.line(margin, gridTop + 2 * rowHeight, pageWidth - margin, gridTop + 2 * rowHeight);

                // Saturday/Sunday Splitter (Horizontal line in bottom right cell)
                doc.line(margin + colWidth, gridTop + 2.5 * rowHeight, pageWidth - margin, gridTop + 2.5 * rowHeight);

                // 3. NO WRITING LINES (REMOVED as requested)
                
                // 4. Fill in Day Content
                const daysPositions = [
                    { x: margin, y: gridTop, w: colWidth, h: rowHeight }, // Mon
                    { x: margin + colWidth, y: gridTop, w: colWidth, h: rowHeight }, // Tue
                    { x: margin, y: gridTop + rowHeight, w: colWidth, h: rowHeight }, // Wed
                    { x: margin + colWidth, y: gridTop + rowHeight, w: colWidth, h: rowHeight }, // Thu
                    { x: margin, y: gridTop + 2 * rowHeight, w: colWidth, h: rowHeight }, // Fri
                    { x: margin + colWidth, y: gridTop + 2 * rowHeight, w: colWidth, h: rowHeight / 2 }, // Sat
                    { x: margin + colWidth, y: gridTop + 2.5 * rowHeight, w: colWidth, h: rowHeight / 2 }, // Sun
                ];

                week.forEach((day, dayIdx) => {
                    const pos = daysPositions[dayIdx];
                    const padding = 8;
                    const headerLineY = pos.y + 24;

                    // Day Name (Top Left)
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(9);
                    doc.setTextColor(15, 23, 42); // UPDATED: Slate-900 (Was Slate-600)
                    const dayName = day.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
                    doc.text(dayName, pos.x + padding, pos.y + 16);

                    // Holiday (Next to Day Name, Red)
                    const holiday = getHoliday(day);
                    if (holiday) {
                        doc.setTextColor(220, 38, 38); // Red-600
                        doc.setFontSize(8);
                        // Calculate offset based on day name length
                        const dayNameWidth = doc.getTextWidth(dayName);
                        // Clip text if it's too long
                        const maxHolidayWidth = pos.w - dayNameWidth - 40; 
                        let holidayText = holiday.toUpperCase();
                        if (doc.getTextWidth(holidayText) > maxHolidayWidth) {
                            // Simple truncate approximate
                            holidayText = holidayText.substring(0, 20) + '...';
                        }
                        // INCREASED SPACING: Added + 18 instead of + 8
                        doc.text(holidayText, pos.x + padding + dayNameWidth + 18, pos.y + 16);
                    }

                    // Date Number (Top Right)
                    doc.setTextColor(15, 23, 42); // Slate-900
                    doc.setFontSize(14);
                    const isFirstOfMonth = day.getDate() === 1;
                    const dateStr = isFirstOfMonth 
                        ? day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
                        : String(day.getDate());
                    
                    const dateWidth = doc.getTextWidth(dateStr);
                    doc.text(dateStr, pos.x + pos.w - padding - dateWidth, pos.y + 16);

                    // Header Separator Line
                    doc.setDrawColor(203, 213, 225); // Slate-300
                    doc.setLineWidth(0.5);
                    doc.setLineDash([], 0); // Solid line for header sep
                    doc.line(pos.x, headerLineY, pos.x + pos.w, headerLineY);
                });

                setDownloadProgress(Math.round(((index + 1) / weeks.length) * 100));
            });
            
            // Format filename with dates
            const filename = `Weekly_Agenda_${startDate}_to_${endDate}.pdf`;
            doc.save(filename);
            
        } catch (error) {
            console.error("PDF Vector Generation Error:", error);
            alert("Error generating PDF. Please check console.");
        } finally {
            setIsGeneratingPdf(false);
            setDownloadProgress(0);
        }
    }, 100);
  };

  const renderDayCell = (day, isCompact = false) => {
    if (!day) return null;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const holiday = getHoliday(day);
    const isFirstOfMonth = day.getDate() === 1;
    const dateDisplay = isFirstOfMonth 
        ? day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
        : day.getDate();

    return (
        <div className="h-full flex flex-col relative bg-white overflow-hidden" style={{ minHeight: isCompact ? '160px' : '320px' }}>
            <div className={`flex items-center justify-between px-3 h-10 border-b border-slate-300 ${isWeekend ? 'bg-slate-50' : 'bg-white'}`} style={{ boxSizing: 'border-box' }}>
                {/* Increased gap from 2 to 4 */}
                <div className="flex flex-row items-center gap-4 overflow-hidden">
                    {/* UPDATED: text-slate-900 to match date color */}
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-900 whitespace-nowrap">
                        {day.toLocaleDateString('en-US', { weekday: 'long' })}
                    </span>
                    {holiday && (
                        <span className="text-xs font-bold text-red-600 uppercase tracking-tight truncate max-w-[140px]" title={holiday}>
                            {holiday}
                        </span>
                    )}
                </div>
                <span className={`font-bold text-slate-900 leading-none flex-shrink-0 ${isFirstOfMonth ? 'text-lg' : 'text-xl'}`}>
                    {dateDisplay}
                </span>
            </div>
            {/* Writing Area - EMPTY (White) as requested */}
            <div className="flex-grow relative w-full h-full bg-white" style={{ minHeight: '100px' }}>
                {/* No lines here anymore */}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-slate-800">
      
      {/* Controls Header */}
      <div className="print:hidden bg-white shadow-md border-b sticky top-0 z-50 p-4">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg text-white">
               <CalendarIcon size={24} />
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-900">Blank Weekly Calendar Builder</h1>
             </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-inner">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-500 uppercase">Start</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-1"
              />
            </div>
            <div className="text-slate-400 self-end pb-1">to</div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-500 uppercase">End</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-1"
              />
            </div>
            
            <div className="h-8 w-px bg-slate-200 mx-1"></div>

            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    id="showHolidays"
                    checked={showHolidays}
                    onChange={(e) => setShowHolidays(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="showHolidays" className="text-sm text-slate-700 font-medium cursor-pointer select-none">
                    Holidays
                </label>
            </div>

            <button 
              onClick={generateWeeks}
              className="ml-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-md shadow-sm transition-colors flex items-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              Generate
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Download PDF Button */}
            <button 
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className={`flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 px-5 py-3 rounded-full transition-all shadow-sm font-bold ${isGeneratingPdf ? 'opacity-70 cursor-wait' : ''}`}
            >
                {isGeneratingPdf ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        {downloadProgress}%
                    </>
                ) : (
                    <>
                        <Download size={18} />
                        Download PDF
                    </>
                )}
            </button>
             {/* Print Button */}
            <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-full transition-all shadow-lg font-bold"
            >
                <Printer size={18} />
                Print
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Display Area (PREVIEW ONLY) */}
      <div className="max-w-[8.5in] mx-auto bg-white print:w-full print:max-w-none shadow-xl my-8 print:shadow-none print:my-0">
        {weeks.map((week, index) => (
          // This is just for on-screen preview. The PDF is generated via handleDownloadPdf using pure JS.
          <div key={index} className="page-break-container relative bg-white h-[11in] w-[8.5in] flex flex-col p-8 pt-10 print:p-6 print:pt-6 border-b-8 border-gray-100 print:border-0 mx-auto">
            
            {/* Page Header */}
            <div className="flex justify-between items-end mb-4 border-b-2 border-slate-800 pb-2">
              {/* Added pl-2 and pr-2 to move text in from the line edge */}
              <h2 className="text-4xl font-bold text-slate-900 tracking-tight uppercase pl-2">
                {getPrimaryMonth(week)}
              </h2>
              <div className="text-right pr-2">
                <div className="text-2xl font-bold text-slate-800">{getWeekRange(week)}</div>
              </div>
            </div>

            {/* Days Grid - TABLE Based for better Print/Preview Alignment */}
            <table className="w-full border-collapse border border-slate-800 table-fixed">
                <tbody>
                    {/* Row 1 */}
                    <tr className="h-[320px]">
                        <td className="w-1/2 border-r border-b border-slate-800 p-0 align-top h-full">
                            {renderDayCell(week[0])}
                        </td>
                        <td className="w-1/2 border-b border-slate-800 p-0 align-top h-full">
                            {renderDayCell(week[1])}
                        </td>
                    </tr>
                    {/* Row 2 */}
                    <tr className="h-[320px]">
                        <td className="w-1/2 border-r border-b border-slate-800 p-0 align-top h-full">
                            {renderDayCell(week[2])}
                        </td>
                        <td className="w-1/2 border-b border-slate-800 p-0 align-top h-full">
                            {renderDayCell(week[3])}
                        </td>
                    </tr>
                    {/* Row 3 */}
                    <tr className="h-[320px]">
                         <td className="w-1/2 border-r border-slate-800 p-0 align-top h-full">
                            {renderDayCell(week[4])}
                        </td>
                        {/* Weekend Stack */}
                        <td className="w-1/2 p-0 align-top h-full">
                             <div className="flex flex-col h-full w-full">
                                <div className="h-1/2 w-full border-b border-slate-800">
                                     {renderDayCell(week[5], true)}
                                </div>
                                <div className="h-1/2 w-full">
                                     {renderDayCell(week[6], true)}
                                </div>
                             </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Footer */}
            <div className="mt-4 flex justify-between items-center text-[10px] text-slate-400 font-medium uppercase tracking-widest min-h-[1.5em]"></div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.25in;
          }
          body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-break-container {
            break-after: page;
            min-height: 10.5in; 
            height: 100vh;
            page-break-after: always;
            border: none !important;
            padding: 0.25in !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default WeeklyCalendar;