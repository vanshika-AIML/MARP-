/**
 * usePresentation Hook
 * Convenience hook exposing the centralized presentation state and business actions.
 */
import { usePresentationContext } from '../store/PresentationContext';

export function usePresentation() {
  return usePresentationContext();
}

export default usePresentation;
