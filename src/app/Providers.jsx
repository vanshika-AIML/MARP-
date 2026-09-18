import React from 'react';
import { PresentationProvider } from '../store/PresentationContext';
import { ThemeProvider } from '../context/ThemeContext';
export function Providers({ children, initialPresentation = null }) {
  return <ThemeProvider><PresentationProvider initialData={initialPresentation}>{children}</PresentationProvider></ThemeProvider>;
}
export default Providers;
