/**
 * Main App Component
 * Serves as the primary application root and standalone/embeddable entry point.
 */
import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import Providers from './Providers';
import Dashboard from '../pages/Dashboard';
import Landing from '../pages/Landing';
import { PresentationLoading } from '../components/ui/ContentLoaders';
import EditorPage from '../pages/EditorPage';
import usePresentation from '../hooks/usePresentation';
import MarpAdminPage from '../pages/MarpAdminPage';
import { canAdmin, getPortalAdminUser } from '../services/adminAuthAdapter';

function PresentationRoute({ previewRoute = false }) {
  const { presentationId } = useParams();
  const { id, loadPresentation, createNewPresentation, isLoading, error } = usePresentation();
  const navigate = useNavigate();

  useEffect(() => {
    loadPresentation(presentationId);
  }, [loadPresentation, presentationId]);

  if (error && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-sm text-rose-700">
        Presentation could not be loaded: {error}
      </div>
    );
  }

  if (isLoading || id !== presentationId) return <PresentationLoading />;

  return (
    <EditorPage
      previewRoute={previewRoute}
      onOpenDashboard={() => navigate('/dashboard')}
      onNewDeckWithTemplate={async (template) => {
        const created = await createNewPresentation(template);
        if (created?.id) navigate(`/editor/${encodeURIComponent(created.id)}`);
      }}
    />
  );
}

function AppContent() {
  const { createNewPresentation } = usePresentation();
  const navigate = useNavigate();
  const adminUser = getPortalAdminUser();

  const handleOpenDeck = (deckId) => navigate(`/editor/${encodeURIComponent(deckId)}`);

  const handleNewDeckWithTemplate = async (template) => {
    const created = await createNewPresentation(template);
    if (!created?.id) throw new Error('Could not create your presentation. Please try again.');
    navigate(`/editor/${encodeURIComponent(created.id)}`);
    return created;
  };

  return (
    <Routes>
      <Route path="/" element={<Landing onCreate={handleNewDeckWithTemplate} />} />
      <Route path="/dashboard" element={<Dashboard onOpenDeck={handleOpenDeck} onNewDeckWithTemplate={handleNewDeckWithTemplate} />} />
      <Route path="/editor/:presentationId" element={<PresentationRoute />} />
      <Route path="/preview/:presentationId" element={<PresentationRoute previewRoute />} />
      <Route path="/admin/marp" element={canAdmin(adminUser, 'admin:read') ? <MarpAdminPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App({ initialPresentation = null }) {
  return (
    <Providers initialPresentation={initialPresentation}>
      <BrowserRouter>
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50">
          <AppContent />
        </div>
      </BrowserRouter>
    </Providers>
  );
}

export default App;
