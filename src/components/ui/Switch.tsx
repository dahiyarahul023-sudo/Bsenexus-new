import React from 'react';
import '../../styles/notification-controls.css';

export function Switch({ checked, onChange, label, disabled = false }: {
  checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean;
}) {
  return <button type="button" className="bse-switch" role="switch" aria-label={label} aria-checked={checked}
    disabled={disabled} onClick={() => onChange(!checked)}>
    <span className="bse-switch-track" aria-hidden="true"><span className="bse-switch-thumb" /></span>
    <span className="sr-only">{checked ? 'On' : 'Off'}</span>
  </button>;
}
