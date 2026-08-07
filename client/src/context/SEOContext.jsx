import React, { createContext, useContext } from 'react';
import { HelmetProvider } from 'react-helmet-async';

const SEOContext = createContext({});

export const SEOProvider = ({ children }) => {
  return (
    <HelmetProvider>
      <SEOContext.Provider value={{}}>
        {children}
      </SEOContext.Provider>
    </HelmetProvider>
  );
};

export const useSEO = () => useContext(SEOContext);
