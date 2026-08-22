/**
 * Root Providers
 * Combines PresentationProvider and any external context wrappers.
 */
import React from 'react';
import { PresentationProvider } from '../store/PresentationContext';

export function Providers({ children, initialPresentation = null }) {
  return (
    <PresentationProvider initialData={initialPresentation}>
      {children}
    </PresentationProvider>
  );
}

export default Providers;
