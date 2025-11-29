import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * Wrapper component that restricts access to admin users only
 * Redirects to /403 if user is not an admin
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return null; // Let ProtectedRoute handle the loading state
    }

    if (!user || user.role !== 'admin') {
        return <Navigate to="/403" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
