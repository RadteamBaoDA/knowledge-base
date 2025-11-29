/**
 * @fileoverview Generic error page component.
 * 
 * Displays error pages for HTTP status codes:
 * - 403: Access Denied (Forbidden)
 * - 404: Page Not Found
 * - 500: Internal Server Error
 * - 503: Service Unavailable
 * 
 * Provides navigation options to go back or go home.
 * 
 * @module pages/ErrorPage
 */

import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Ban, FileQuestion, ServerCrash, ArrowLeft } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Props for ErrorPage component */
interface ErrorPageProps {
    /** HTTP status code for the error */
    code: 403 | 404 | 500 | 503;
    /** Optional custom title (overrides default) */
    title?: string;
    /** Optional custom message (overrides default) */
    message?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Generic error page for displaying HTTP error status codes.
 * 
 * Features:
 * - Icon and styling based on error type
 * - Default titles and messages for each error code
 * - Optional custom title and message overrides
 * - Navigation buttons (back and home)
 * 
 * @param code - HTTP status code (403, 404, 500, 503)
 * @param title - Optional custom title
 * @param message - Optional custom message
 */
const ErrorPage = ({ code, title, message }: ErrorPageProps) => {
    const navigate = useNavigate();

    /**
     * Get error content configuration based on status code.
     * Returns icon, title, and message for each error type.
     */
    const getErrorContent = (code: number) => {
        switch (code) {
            case 403:
                return {
                    icon: <Ban className="w-24 h-24 text-red-500 mb-6" />,
                    defaultTitle: 'Access Denied',
                    defaultMessage: "You don't have permission to access this page.",
                };
            case 404:
                return {
                    icon: <FileQuestion className="w-24 h-24 text-blue-500 mb-6" />,
                    defaultTitle: 'Page Not Found',
                    defaultMessage: "The page you are looking for doesn't exist or has been moved.",
                };
            case 503:
                return {
                    icon: <ServerCrash className="w-24 h-24 text-orange-500 mb-6" />,
                    defaultTitle: 'Service Unavailable',
                    defaultMessage: 'The service is temporarily unavailable. Please try again later.',
                };
            case 500:
            default:
                return {
                    icon: <AlertTriangle className="w-24 h-24 text-yellow-500 mb-6" />,
                    defaultTitle: 'Internal Server Error',
                    defaultMessage: 'Something went wrong on our end. Please try again later.',
                };
        }
    };

    const content = getErrorContent(code);

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
            <div className="animate-in fade-in zoom-in duration-500">
                {content.icon}
            </div>

            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {title || content.defaultTitle}
            </h1>

            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                {message || content.defaultMessage}
            </p>

            <div className="flex gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Go Back
                </button>

                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
                >
                    Go Home
                </button>
            </div>
        </div>
    );
};

export default ErrorPage;
