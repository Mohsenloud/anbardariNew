import React, { useEffect, useRef, useState } from 'react';
import { toEnglishDigits, formatThousands, parseThousands, numberToPersianWords } from '../utils/jalali';

export interface NumericInputProps {
  value: number | string | undefined | null;
  onChange: (value: number, rawString: string) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  id?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  allowDecimals?: boolean;
  allowEmpty?: boolean;
  currency?: string;
  showWords?: boolean;
  title?: string;
  textAlign?: 'left' | 'center' | 'right';
  onBlur?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  placeholder = '۰',
  className = '',
  min,
  max,
  id,
  name,
  disabled = false,
  readOnly = false,
  required = false,
  autoFocus = false,
  allowDecimals = false,
  allowEmpty = true,
  currency,
  showWords = false,
  title,
  textAlign = 'left',
  onBlur,
  onFocus,
  onKeyDown,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to format number with commas (using English digits in input for standard typing/keyboard compatibility)
  const formatForDisplay = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') {
      return allowEmpty ? '' : '0';
    }
    const num = typeof val === 'number' ? val : parseThousands(val);
    if (isNaN(num)) return '';
    if (num === 0 && allowEmpty && val === '') return '';
    
    // Format using formatThousands with English digits in the input box so cursor & keys work reliably
    return formatThousands(num, false);
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatForDisplay(value));

  // Keep displayValue in sync when value prop changes from outside
  useEffect(() => {
    const currentNum = parseThousands(displayValue);
    const propNum = typeof value === 'number' ? value : parseThousands(value);
    if (currentNum !== propNum || (value === '' && displayValue !== '')) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const inputElement = inputRef.current;
    const oldCursor = inputElement?.selectionStart ?? raw.length;

    // Count how many non-comma/non-whitespace characters were before the cursor
    const rawBeforeCursor = raw.slice(0, oldCursor);
    const digitsBeforeCursor = rawBeforeCursor.replace(/[^\d.]/g, '').length;

    // Convert Persian digits to English
    const engStr = toEnglishDigits(raw);
    
    // Clean string: keep only digits and optionally decimal point
    let cleaned = allowDecimals
      ? engStr.replace(/[^\d.]/g, '')
      : engStr.replace(/\D/g, '');

    // Prevent multiple decimal points
    if (allowDecimals) {
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
      }
    }

    if (cleaned === '' || cleaned === '.') {
      setDisplayValue(cleaned);
      onChange(0, cleaned);
      return;
    }

    let numericVal = parseFloat(cleaned) || 0;
    if (min !== undefined && numericVal < min) {
      // Don't cap while user is typing 0, but enforce min on blur
    }
    if (max !== undefined && numericVal > max) {
      numericVal = max;
      cleaned = String(max);
    }

    // Format integer part with commas
    const parts = cleaned.split('.');
    const formattedInt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;

    setDisplayValue(formatted);
    onChange(numericVal, formatted);

    // Restore cursor position based on digit count
    requestAnimationFrame(() => {
      if (!inputElement) return;
      let newCursor = 0;
      let seenDigits = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[\d.]/.test(formatted[i])) {
          seenDigits++;
        }
        if (seenDigits >= digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }
      if (seenDigits < digitsBeforeCursor) {
        newCursor = formatted.length;
      }
      inputElement.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let num = parseThousands(displayValue);
    if (min !== undefined && num < min) {
      num = min;
    }
    if (max !== undefined && num > max) {
      num = max;
    }
    if (displayValue === '' && !allowEmpty) {
      num = 0;
      setDisplayValue('0');
      onChange(0, '0');
    } else if (displayValue !== '') {
      setDisplayValue(formatForDisplay(num));
      onChange(num, formatForDisplay(num));
    }
    if (onBlur) onBlur();
  };

  const currentNumericValue = parseThousands(displayValue);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          inputMode={allowDecimals ? 'decimal' : 'numeric'}
          autoComplete="off"
          id={id}
          name={name}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          autoFocus={autoFocus}
          title={title}
          value={displayValue}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          dir="ltr"
          style={{ textAlign }}
          className={`${className} ${currency ? 'pl-14' : ''}`}
        />
        {currency && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none select-none bg-slate-100/90 px-1.5 py-0.5 rounded-md border border-slate-200/60">
            {currency}
          </span>
        )}
      </div>

      {showWords && currentNumericValue > 0 && (
        <div className="text-[10px] text-purple-700 font-bold mt-1 px-1 flex items-center gap-1 animate-in fade-in duration-100">
          <span>به حروف:</span>
          <span>{numberToPersianWords(currentNumericValue)} {currency || ''}</span>
        </div>
      )}
    </div>
  );
};
