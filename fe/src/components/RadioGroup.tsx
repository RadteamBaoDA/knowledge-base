import { RadioGroup as HeadlessRadioGroup } from '@headlessui/react';
import { Check } from 'lucide-react';

interface RadioOption {
    value: string;
    label: string;
    icon?: string | React.ReactNode;
    description?: string;
}

interface RadioGroupProps {
    value: string;
    onChange: (value: string) => void;
    options: RadioOption[];
    columns?: number;
    className?: string;
}

export function RadioGroup({
    value,
    onChange,
    options,
    columns = 3,
    className = ''
}: RadioGroupProps) {
    const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
    }[columns] || 'grid-cols-3';

    return (
        <HeadlessRadioGroup value={value} onChange={onChange} className={className}>
            <div className={`grid ${gridCols} gap-2`}>
                {options.map((option) => (
                    <HeadlessRadioGroup.Option
                        key={option.value}
                        value={option.value}
                        className={({ checked }) =>
                            `relative flex flex-col items-center p-3 rounded-lg border-2 transition-all cursor-pointer ${checked
                                ? 'border-primary bg-primary/10 dark:bg-primary/20'
                                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                            }`
                        }
                    >
                        {({ checked }) => (
                            <>
                                {option.icon && (
                                    <span className="text-2xl mb-1">
                                        {typeof option.icon === 'string' ? option.icon : option.icon}
                                    </span>
                                )}
                                <HeadlessRadioGroup.Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {option.label}
                                </HeadlessRadioGroup.Label>
                                {option.description && (
                                    <HeadlessRadioGroup.Description className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {option.description}
                                    </HeadlessRadioGroup.Description>
                                )}
                                {checked && (
                                    <div className="absolute top-2 right-2">
                                        <Check size={16} className="text-primary" />
                                    </div>
                                )}
                            </>
                        )}
                    </HeadlessRadioGroup.Option>
                ))}
            </div>
        </HeadlessRadioGroup>
    );
}
