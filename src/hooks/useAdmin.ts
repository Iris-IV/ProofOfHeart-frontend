'use client';

import { useState, useEffect } from 'react';
import { getAdmin } from '../lib/contractClient';

export function useAdmin() {
  const [admin, setAdmin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAdmin()
      .then(setAdmin)
      .catch((err) => console.error('Failed to fetch admin:', err))
      .finally(() => setIsLoading(false));
  }, []);

  return { admin, isLoading };
}
