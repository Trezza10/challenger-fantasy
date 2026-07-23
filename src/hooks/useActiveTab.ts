import { useState } from 'react';
import { Tab } from '../types/navigation';

/**
 * Stores the selected bottom-tab destination.
 * This is kept in a hook so a navigation library can replace the implementation later.
 */
export function useActiveTab(initialTab: Tab = 'Home') {
  return useState<Tab>(initialTab);
}
