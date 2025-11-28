import { Switch } from '@headlessui/react';
import { Check } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    className?: string;
}

export function Checkbox({ checked, onChange, label, className = '' }: CheckboxProps) {
    return (
        <Switch.Group>
            <div className={`flex items-center gap-2 ${className}`}>
                <Switch
                    checked={checked}
                    onChange={onChange}
                    className={`relative inline-flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${checked
                            ? 'bg-primary border-primary'
                            : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                        }`}
                >
                    {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                </Switch>
                {label && (
                    <Switch.Label className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                        {label}
                    </Switch.Label>
                )}
            </div>
        </Switch.Group>
    );
}
