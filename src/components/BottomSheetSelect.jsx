import React, { useState } from 'react';
import BottomSheet from './BottomSheet';
import { ChevronRight } from 'lucide-react';

/**
 * BottomSheetSelect - Replacement for standard HTML select/dropdown
 * Uses BottomSheet for mobile-native experience
 */
export default function BottomSheetSelect({
  value,
  onChange,
  options = [],
  label = 'Select an option',
  placeholder = 'Choose...',
  disabled = false,
  className = '',
  error = '',
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full h-10 px-3 rounded-xl border border-input bg-background text-left flex items-center justify-between text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary/20 ${className} ${
          error ? 'border-destructive' : ''
        }`}
      >
        <span className={selectedLabel === placeholder ? 'text-muted-foreground' : 'text-foreground'}>
          {selectedLabel}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={label}
        options={options}
        value={value}
        onChange={(newValue) => {
          onChange(newValue);
          setIsOpen(false);
        }}
      />
    </>
  );
}