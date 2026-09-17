/**
 * Main App Component
 * Serves as the primary application root and standalone/embeddable entry point.
 */
import React, { useEffect, useState } from 'react';
import Providers from './Providers';
import { APP_ROUTES, getRoute, navigateTo } from './routes';
import Dashboard from '../pages/Dashboard';
import EditorPage from '../pages/EditorPage';
import usePresentation from '../hooks/usePresentation';

function AppContent() {
  const [route, setRoute] = useState(getRoute);
  const { loadPresentation, createNewPresentation } = usePresentation();

  useEffect(() => {
    const handleRoute = () => setRoute(getRoute());
    window.addEventListener('popstate', handleRoute);
    return () => window.removeEventListener('popstate', handleRoute);
  }, []);

  useEffect(() => {
    if (route.id && (route.name === APP_ROUTES.EDITOR || route.name === APP_ROUTES.PREVIEW)) {
      loadPresentation(route.id);
    }
  }, [route.id, route.name, loadPresentation]);

  const handleOpenDeck = async (deckId) => {
    navigateTo(APP_ROUTES.EDITOR, deckId);
  };

  const handleNewDeckWithTemplate = async (template) => {
    const created = await createNewPresentation(template);
    if (created?.id) navigateTo(APP_ROUTES.EDITOR, created.id);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50">
      {route.name === APP_ROUTES.DASHBOARD ? (
        <Dashboard
          onOpenDeck={handleOpenDeck}
          onNewDeckWithTemplate={handleNewDeckWithTemplate}
        />
      ) : (
        <EditorPage
          previewRoute={route.name === APP_ROUTES.PREVIEW}
          onOpenDashboard={() => navigateTo(APP_ROUTES.DASHBOARD)}
          onNewDeckWithTemplate={handleNewDeckWithTemplate}
        />
      )}
    </div>
  );
}

export function App({ initialPresentation = null }) {
  return (
    <Providers initialPresentation={initialPresentation}>
      <AppContent />
    </Providers>
  );
}

export default App;
