import React from 'react';
import { parseReferralInput } from '../../utils/referralInput';

export function ReferralCodeField({ value, onChange, disabled, inputRef }: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={inputRef}
      aria-label="Referral code or link"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      disabled={disabled}
      type="text"
      placeholder="Paste referral link or code"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onPaste={(event) => {
        const code = parseReferralInput(event.clipboardData.getData('text'));
        if (code) {
          event.preventDefault();
          onChange(code.toLowerCase());
        }
      }}
    />
  );
}
