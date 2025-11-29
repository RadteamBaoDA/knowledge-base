import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
    id: string;
    name: string;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    icon?: React.ReactNode;
    className?: string;
}

export function Select({ value, onChange, options, icon, className = '' }: SelectProps) {
    const selectedOption = options.find(opt => opt.id === value);

    return (
        <Listbox value={value} onChange={onChange}>
            {({ open }) => (
                <div className={`relative inline-block min-w-[200px] ${className}`}>
                    <Listbox.Button className="relative flex items-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-slate-800 dark:to-slate-800 dark:bg-slate-800 rounded-lg border border-primary/20 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow text-left">
                        {icon && <span className="text-primary flex-shrink-0">{icon}</span>}
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {selectedOption?.name || 'Select...'}
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-primary flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''
                                }`}
                        />
                    </Listbox.Button>

                    <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <Listbox.Options className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                            {options.map((option) => (
                                <Listbox.Option
                                    key={option.id}
                                    value={option.id}
                                    className={({ active, selected }) =>
                                        `relative cursor-pointer select-none py-2.5 pl-10 pr-4 ${active
                                            ? 'bg-gradient-to-r from-primary/10 to-primary/5 dark:bg-slate-600 text-primary dark:text-white'
                                            : 'text-slate-700 dark:text-slate-200'
                                        } ${selected ? 'font-medium' : 'font-normal'}`
                                    }
                                >
                                    {({ selected }) => (
                                        <>
                                            <span className="block truncate">{option.name}</span>
                                            {selected && (
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                                                    <Check size={16} />
                                                </span>
                                            )}
                                        </>
                                    )}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </Transition>
                </div>
            )}
        </Listbox>
    );
}
