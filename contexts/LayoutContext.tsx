import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LayoutType = 'vertical' | 'tabs';

interface LayoutContextType {
  layout: LayoutType;
  setLayout: (layout: LayoutType) => Promise<void>;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const LAYOUT_STORAGE_KEY = '@cryptohub_layout_preference';

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [layout, setLayoutState] = useState<LayoutType>('tabs');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved layout preference on mount
  useEffect(() => {
    loadLayoutPreference();
  }, []);

  const loadLayoutPreference = async () => {
    try {
      const savedLayout = await AsyncStorage.getItem(LAYOUT_STORAGE_KEY);
      if (savedLayout && ['vertical', 'tabs'].includes(savedLayout)) {
        setLayoutState(savedLayout as LayoutType);
      }
    } catch (error) {
      console.error('Error loading layout preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLayout = async (newLayout: LayoutType) => {
    try {
      await AsyncStorage.setItem(LAYOUT_STORAGE_KEY, newLayout);
      setLayoutState(newLayout);
    } catch (error) {
      console.error('Error saving layout preference:', error);
    }
  };

  // Don't render children until layout is loaded
  if (isLoading) {
    return null;
  }

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
