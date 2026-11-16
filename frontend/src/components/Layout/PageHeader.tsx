import React from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon
} from '@heroicons/react/24/outline';
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  action?: {
    label: string;
    href: string;
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  };
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  action 
}) => {

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="flex min-w-0 items-center">
        {Icon && <Icon className="mr-3 h-7 w-7 shrink-0 text-gray-600 dark:text-gray-400 sm:mr-4 sm:h-8 sm:w-8" />}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      
      {action && (
        <Link
          to={action.href}
          className="btn-primary shrink-0"
        >
          {action.icon ? (
            <action.icon className="-ml-1 mr-2 h-5 w-5" />
          ) : (
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          )}
          {action.label}
        </Link>
      )}
    </div>
  );
};

export default PageHeader;
