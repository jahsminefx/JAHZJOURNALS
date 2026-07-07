import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import AuthContext from './authContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    setUser(data);
    return data;
  };

  const registerUser = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(() => ({
    user,
    isAuthLoading,
    login,
    logout,
    registerUser,
    refreshUser,
    setUser,
  }), [user, isAuthLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
