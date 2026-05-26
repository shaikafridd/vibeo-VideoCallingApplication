import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../utils/config.js";
import { Menu, X } from "lucide-react";
import "../App.css";

export default function LandingPage() {
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestRoomId, setGuestRoomId] = useState("");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [error, setError] = useState("");
    
    // Join Meeting Passcode States
    const [showJoinPassword, setShowJoinPassword] = useState(false);
    const [joinPassword, setJoinPassword] = useState("");
    
    const navigate = useNavigate();

    const handleGuestJoin = async (e) => {
        e.preventDefault();
        setError("");
        const cleanCode = guestRoomId.trim().toLowerCase();

        // Validate Meeting ID: Alphanumeric plus hyphens/underscores, no spaces, 3+ characters
        const codeRegex = /^[a-z0-9-_]{3,}$/;
        if (!codeRegex.test(cleanCode)) {
            setError("Meeting code must be at least 3 characters and contain only letters, numbers, hyphens, or underscores.");
            return;
        }

        try {
            // Step 1: If password input is not shown, check status
            if (!showJoinPassword) {
                const statusRes = await fetch(`${BACKEND_URL}/api/v1/users/get_meeting_status?meeting_code=${cleanCode}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData.required) {
                        setShowJoinPassword(true);
                        return;
                    }
                }
            }

            // Step 2: If passcode is required, verify it
            if (showJoinPassword) {
                const verifyRes = await fetch(`${BACKEND_URL}/api/v1/users/verify_meeting_password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ meeting_code: cleanCode, password: joinPassword })
                });

                if (!verifyRes.ok) {
                    const verifyData = await verifyRes.json();
                    setError(verifyData.message || "Incorrect passcode. Please try again.");
                    return;
                }
            }
        } catch (err) {
            console.error("Error joining meeting:", err);
            setError("Something went wrong. Please try again.");
            return;
        }

        const navigateUrl = showJoinPassword 
            ? `/room/${cleanCode}?passcode=${encodeURIComponent(joinPassword)}` 
            : `/room/${cleanCode}`;

        setShowJoinPassword(false);
        setJoinPassword("");
        setShowGuestModal(false);
        navigate(navigateUrl);
    };

    return (
        <div className="LandingPageContainer">
            <nav>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="navhead">
                    <img src="/logo3.png" alt="logo" style={{ height: "40px", width: "auto" }} />
                    <h2>Vibeo</h2>
                </div>
                
                {/* Desktop Menu links */}
                <div className="navlist desktop-nav">
                    <button className="nav-link-btn" onClick={() => { setShowGuestModal(true); setError(""); }}>Join As Guest</button>
                    <Link to="/auth?mode=register" className="nav-link-btn">Register</Link>
                    <Link to="/auth?mode=login" className="nav-login-btn">Login</Link>
                </div>

                {/* Hamburger Icon for Mobile View */}
                <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {/* Mobile Drawer Menu */}
                {isMobileMenuOpen && (
                    <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
                            <button className="mobile-menu-link-btn" onClick={() => { setShowGuestModal(true); setError(""); setIsMobileMenuOpen(false); }}>
                                Join As Guest
                            </button>
                            <Link to="/auth?mode=register" className="mobile-menu-link-btn" onClick={() => setIsMobileMenuOpen(false)}>
                                Register
                            </Link>
                            <Link to="/auth?mode=login" className="mobile-menu-login-btn" onClick={() => setIsMobileMenuOpen(false)}>
                                Login
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            <div className="landingmaincontainer">
                <div>
                    <h1><span style={{ color: "var(--primary)" }}>Connect</span> With Loved Ones!!</h1>
                    <p>Cover A Distance By Vibeo Video Call</p>
                    <Link to="/auth?mode=register" className="get-started-btn">
                        Get Started
                    </Link>
                </div>
                <div>
                    <img src="/mobile.png" alt="imagemobile"></img>
                </div>
            </div>

            {showGuestModal && (
                <div className="modal-overlay" onClick={() => { setShowGuestModal(false); setError(""); setShowJoinPassword(false); setJoinPassword(""); }}>
                    <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
                        <h3>Join as Guest</h3>
                        <p>Enter the meeting code and passcode to join the video call directly.</p>
                        <form onSubmit={handleGuestJoin} className="modal-form">
                            <input
                                type="text"
                                placeholder="Enter meeting code (e.g. room-abc)"
                                value={guestRoomId}
                                onChange={(e) => {
                                    setGuestRoomId(e.target.value);
                                    setError("");
                                    setShowJoinPassword(false);
                                    setJoinPassword("");
                                }}
                                required
                                autoFocus
                                disabled={showJoinPassword}
                            />
                            {showJoinPassword && (
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    placeholder="Enter meeting passcode"
                                    value={joinPassword}
                                    onChange={(e) => {
                                        setJoinPassword(e.target.value.replace(/\D/g, ""));
                                        setError("");
                                    }}
                                    required
                                    autoFocus
                                />
                            )}
                            {error && (
                                <div style={{ 
                                    color: "var(--danger)", 
                                    fontSize: "0.85rem", 
                                    fontWeight: "500",
                                    marginTop: "4px",
                                    textAlign: "center",
                                    lineHeight: "1.4"
                                }}>
                                    {error}
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="modal-cancel-btn" onClick={() => { setShowGuestModal(false); setError(""); setShowJoinPassword(false); setJoinPassword(""); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="modal-submit-btn">
                                    {showJoinPassword ? "Confirm & Join" : "Join"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}