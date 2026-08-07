import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { PAGE_SEO } from '../seo/pages';

const Breadcrumbs = ({ customItems }) => {
  const location = useLocation();
  const pageConfig = PAGE_SEO[location.pathname] || {};
  const items = customItems || pageConfig.breadcrumbs || [];

  if (items.length <= 1) return null;

  return (
    <nav 
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs text-gray-400 py-3 mb-4 border-b border-gray-800/60"
    >
      <ol className="flex items-center gap-2 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li 
              key={item.path || index}
              className="flex items-center gap-2"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && <ChevronRight size={12} className="text-gray-600 shrink-0" />}
              
              {isLast ? (
                <span className="font-semibold text-gray-200" itemProp="name">
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1 font-medium"
                  itemProp="item"
                >
                  {index === 0 && <Home size={13} className="shrink-0 text-gray-400" />}
                  <span itemProp="name">{item.name}</span>
                </Link>
              )}

              <meta itemProp="position" content={String(index + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
