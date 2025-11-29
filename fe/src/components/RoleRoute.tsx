import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Role = 'admin' | 'manager' | 'user';

interface RoleRouteProps {
    children: React.ReactNode;
    allowedRoles: Role[];
}

const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return null; // or a loading spinner
    }

    if (!user || !allowedRoles.includes(user.role as Role)) {
        return <Navigate to="/403" replace />;
    }

    return <>{children}</>;
};

export default RoleRoute;
