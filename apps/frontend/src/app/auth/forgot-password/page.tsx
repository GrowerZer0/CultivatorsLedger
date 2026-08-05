//apps/frontend/src/app/auth/forgot-password/page.tsx
import { Suspense } from 'react';
import ForgotPasswordContent from './ForgotPasswordContent';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}