import React from 'react';
import { PresentationProvider } from '../store/PresentationContext';
import { ThemeProvider } from '../context/ThemeContext';
import { MarpConfigProvider } from '../context/MarpConfigContext';
export function Providers({ children, initialPresentation = null }) {
  return <ThemeProvider><MarpConfigProvider><PresentationProvider initialData={initialPresentation}>{children}</PresentationProvider></MarpConfigProvider></ThemeProvider>;
}
export default Providers;
