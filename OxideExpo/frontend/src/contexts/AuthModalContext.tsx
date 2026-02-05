'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ModalType = 'login' | 'register' | 'forgot-password' | 'company-login' | 'company-register' | null;

interface AuthModalContextValue {
  modalType: ModalType;
  isOpen: boolean;
  openLogin: () => void;
  openRegister: () => void;
  openForgotPassword: () => void;
  openCompanyLogin: () => void;
  openCompanyRegister: () => void;
  closeModal: () => void;
  switchTo: (modal: Exclude<ModalType, null>) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within AuthModalProvider');
  }
  return context;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [modalType, setModalType] = useState<ModalType>(null);

  const openLogin = useCallback(() => setModalType('login'), []);
  const openRegister = useCallback(() => setModalType('register'), []);
  const openForgotPassword = useCallback(() => setModalType('forgot-password'), []);
  const openCompanyLogin = useCallback(() => setModalType('company-login'), []);
  const openCompanyRegister = useCallback(() => setModalType('company-register'), []);
  const closeModal = useCallback(() => setModalType(null), []);
  const switchTo = useCallback((modal: Exclude<ModalType, null>) => setModalType(modal), []);

  return (
    <AuthModalContext.Provider
      value={{
        modalType,
        isOpen: modalType !== null,
        openLogin,
        openRegister,
        openForgotPassword,
        openCompanyLogin,
        openCompanyRegister,
        closeModal,
        switchTo,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}
