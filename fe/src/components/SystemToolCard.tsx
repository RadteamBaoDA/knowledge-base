import { ExternalLink } from 'lucide-react';
import { SystemTool } from '../services/systemToolsService';

interface SystemToolCardProps {
    tool: SystemTool;
}

const SystemToolCard = ({ tool }: SystemToolCardProps) => {
    const handleClick = () => {
        window.open(tool.url, '_blank', 'noopener,noreferrer');
    };

    return (
        <button
            onClick={handleClick}
            className="group relative flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-lg transition-all duration-200 cursor-pointer min-h-[180px]"
            title={tool.description}
        >
            {/* Icon */}
            <div className="w-16 h-16 mb-4 flex items-center justify-center">
                <img
                    src={tool.icon}
                    alt={`${tool.name} icon`}
                    className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110"
                    onError={(e) => {
                        // Fallback to a default icon if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Cpath d="M9 3v18"%3E%3C/path%3E%3Cpath d="M15 3v18"%3E%3C/path%3E%3C/svg%3E';
                    }}
                />
            </div>

            {/* Tool Name */}
            <h3 className="text-base font-semibold text-gray-900 dark:text-white text-center mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {tool.name}
            </h3>

            {/* Description */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center line-clamp-2">
                {tool.description}
            </p>

            {/* External link indicator */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            </div>
        </button>
    );
};

export default SystemToolCard;
