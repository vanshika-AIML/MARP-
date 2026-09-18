import { useEffect, useRef, useState } from 'react';

export function useInView(options = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const { root = null, rootMargin = '0px', threshold = 0.2 } = options;

  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { root, rootMargin, threshold });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [root, rootMargin, threshold]);

  return [ref, isVisible];
}

export default useInView;
