import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/Authcontext.jsx";

export const withAuth = (WrappedComponent) => {
    return function WithAuthComponent(props) {
        const { token, loading } = useAuth();
        const navigate = useNavigate();

        useEffect(() => {
            if (!loading && !token) {
                navigate("/auth");
            }
        }, [token, loading, navigate]);

        if (loading) {
            return (
                <div style={{ 
                    display: "flex", 
                    justifyContent: "center", 
                    alignItems: "center", 
                    height: "100vh", 
                    background: "radial-gradient(circle at 50% 50%, #17151f, #08060d)", 
                    color: "white",
                    fontFamily: "system-ui, sans-serif"
                }}>
                    <div className="loading-spinner">Loading...</div>
                </div>
            );
        }

        if (!token) {
            return null; // Render nothing while redirecting
        }

        return <WrappedComponent {...props} />;
    };
};
