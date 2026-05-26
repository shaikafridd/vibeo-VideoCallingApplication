import { useNavigate } from "react-router-dom";
import { AlertOctagon, Home } from "lucide-react";
import "../App.css";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="home-container LandingPageContainer">
            <nav className="home-nav">
                <div 
                    onClick={() => navigate("/")} 
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}
                >
                    <img src="/logo3.png" alt="logo" style={{ height: "40px", width: "auto" }} />
                    <h2 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>Vibeo</h2>
                </div>
            </nav>

            <div className="home-content centered">
                <div className="home-card glass" style={{ textAlign: "center", maxWidth: "500px" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                        <div style={{
                            background: "rgba(11, 92, 255, 0.08)",
                            borderRadius: "50%",
                            padding: "1.5rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            <AlertOctagon size={48} color="var(--primary)" />
                        </div>
                    </div>
                    <h3 style={{ fontSize: "3rem", color: "var(--text-main)", margin: "0 0 0.5rem 0", fontWeight: 800 }}>404</h3>
                    <h4 style={{ fontSize: "1.4rem", fontWeight: "600", color: "var(--text-sub)", margin: "0 0 1rem 0" }}>Page Not Found</h4>
                    <p style={{ color: "var(--text-muted)", fontSize: "1rem", lineHeight: "1.5", margin: "0 0 2rem 0" }}>
                        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                    </p>
                    
                    <button 
                        className="create-meeting-btn" 
                        onClick={() => navigate("/")}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px"
                        }}
                    >
                        <Home size={18} />
                        Back to Landing Page
                    </button>
                </div>
            </div>
        </div>
    );
}
