import { Fragment, ReactNode } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({
    open,
    onClose,
    title,
    children,
    footer,
    maxWidth = 'md'
}: DialogProps) {
    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70" />
                </Transition.Child>

                {/* Dialog Container */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <HeadlessDialog.Panel
                                className={`w-full ${maxWidthClasses[maxWidth]} transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl transition-all`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <HeadlessDialog.Title className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                                        {title}
                                    </HeadlessDialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="text-slate-600 dark:text-slate-400">
                                    {children}
                                </div>

                                {/* Footer */}
                                {footer && (
                                    <div className="mt-6 flex justify-end gap-2">
                                        {footer}
                                    </div>
                                )}
                            </HeadlessDialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    );
}
