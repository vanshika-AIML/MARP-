/**
 * Main App Component
 * Serves as the primary application root and standalone/embeddable entry point.
 */
import React, { useState } from 'react';
import Providers from './Providers';
import { APP_ROUTES } from './routes';
import Dashboard from '../pages/Dashboard';
import EditorPage from '../pages/EditorPage';
import usePresentation from '../hooks/usePresentation';

function AppContent({ initialRoute = APP_ROUTES.EDITOR }) {
  const [currentRoute, setCurrentRoute] = useState(initialRoute);
  const { loadPresentation, createNewPresentation } = usePresentation();

  const handleOpenDeck = async (deckId) => {
    await loadPresentation(deckId);
    setCurrentRoute(APP_ROUTES.EDITOR);
  };

  const handleNewDeckWithTemplate = async (template) => {
    await createNewPresentation(template);
    setCurrentRoute(APP_ROUTES.EDITOR);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50">
      {currentRoute === APP_ROUTES.DASHBOARD ? (
        <Dashboard
          onOpenDeck={handleOpenDeck}
          onNewDeckWithTemplate={handleNewDeckWithTemplate}
        />
      ) : (
        <EditorPage
          onOpenDashboard={() => setCurrentRoute(APP_ROUTES.DASHBOARD)}
          onNewDeckWithTemplate={handleNewDeckWithTemplate}
        />
      )}
    </div>
  );
}

export function App({ initialPresentation = null, initialRoute = APP_ROUTES.EDITOR }) {
  return (
    <Providers initialPresentation={initialPresentation}>
      <AppContent initialRoute={initialRoute} />
    </Providers>
  );
}

export default App;
