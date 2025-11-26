import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await fetch('/api/auth/logout');
      } catch (error) {
        console.error('Logout failed:', error);
      }
      // Redirect to login page after logout
      navigate('/login');
    };

    performLogout();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">Signing out...</p>
      </div>
    </div>
  );
}

export default LogoutPage;
