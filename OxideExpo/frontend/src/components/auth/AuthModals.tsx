'use client';

import { LoginModal } from './LoginModal';
import { RegisterModal } from './RegisterModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { CompanyRegisterModal } from './CompanyRegisterModal';

export function AuthModals() {
  return (
    <>
      {/* Job Seeker Modals */}
      <LoginModal variant="jobseeker" />
      <RegisterModal />
      <ForgotPasswordModal />

      {/* Company Modals */}
      <LoginModal variant="company" />
      <CompanyRegisterModal />
    </>
  );
}
