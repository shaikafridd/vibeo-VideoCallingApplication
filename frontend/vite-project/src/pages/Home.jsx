/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/Authcontext.jsx";
import { withAuth } from "../utils/withAuth.jsx";
import { BACKEND_URL } from "../utils/config.js";
import { LogOut, Clock, Menu, X } from "lucide-react";
import "../App.css";

function Home() {
    const { token, logout } = useAuth();
    const [meetingCode, setMeetingCode] = useState("");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [error, setError] = useState("");
    
    // Create Meeting Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [customMeetingCode, setCustomMeetingCode] = useState("");
    const [meetingPassword, setMeetingPassword] = useState("");
    const [modalError, setModalError] = useState("");

    // Join Meeting Passcode States
    const [showJoinPassword, setShowJoinPassword] = useState(false);
    const [joinPassword, setJoinPassword] = useState("");
    
    const navigate = useNavigate();

    const handleJoinMeeting = async (e) => {
        e.preventDefault();
        setError("");
        
        const cleanCode = meetingCode.trim().toLowerCase();
        if (!cleanCode) return;

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

            // Step 3: Add to history
            const response = await fetch(`${BACKEND_URL}/api/v1/users/add_to_activity`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ meeting_code: cleanCode })
            });

            if (response.status === 401) {
                logout();
                navigate("/auth");
                return;
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
        navigate(navigateUrl);
    };

    const handleCreateMeeting = () => {
        setError("");
        setModalError("");
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let randomCode = "";
        for (let i = 0; i < 9; i++) {
            randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCustomMeetingCode(randomCode);
        setMeetingPassword("");
        setShowCreateModal(true);
    };

    const handleConfirmCreate = async (e) => {
        e.preventDefault();
        setModalError("");
        
        const cleanCode = customMeetingCode.trim().toLowerCase();
        if (!cleanCode) return;

        // Validate Meeting ID
        const codeRegex = /^[a-z0-9-_]{3,}$/;
        if (!codeRegex.test(cleanCode)) {
            setModalError("Meeting code must be at least 3 characters and contain only letters, numbers, hyphens, or underscores.");
            return;
        }

        // Validate Passcode: at least 6 digits
        if (meetingPassword.trim()) {
            const digitRegex = /^\d{6,}$/;
            if (!digitRegex.test(meetingPassword.trim())) {
                setModalError("Passcode must be at least 6 digits (numbers only).");
                return;
            }
        }

        try {
            const bodyPayload = { meeting_code: cleanCode };
            if (meetingPassword.trim()) {
                bodyPayload.password = meetingPassword.trim();
            }

            const response = await fetch(`${BACKEND_URL}/api/v1/users/add_to_activity`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(bodyPayload)
            });

            if (response.status === 401) {
                logout();
                navigate("/auth");
                return;
            }

            if (!response.ok) {
                const data = await response.json();
                setModalError(data.message || "Failed to create meeting.");
                return;
            }
        } catch (err) {
            console.error("Error creating meeting:", err);
            setModalError("Something went wrong. Please try again.");
            return;
        }

        setShowCreateModal(false);
        navigate(`/room/${cleanCode}`);
    };

    return (
        <div className="home-container LandingPageContainer">
            <nav className="home-nav">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src="/logo3.png" alt="logo" style={{ height: "40px", width: "auto" }} />
                    <h2>Vibeo</h2>
                </div>
                
                {/* Desktop Nav Links */}
                <div className="desktop-nav" style={{ display: "flex", gap: "15px" }}>
                    <button className="history-btn" onClick={() => navigate("/history")}>
                        <Clock size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                        View History
                    </button>
                    <button className="logout-btn" onClick={logout}>
                        <LogOut size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                        Logout
                    </button>
                </div>

                {/* Hamburger Icon for Mobile */}
                <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {/* Mobile Drawer Menu */}
                {isMobileMenuOpen && (
                    <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
                            <button className="mobile-menu-history-btn" onClick={() => { navigate("/history"); setIsMobileMenuOpen(false); }}>
                                <Clock size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                                View History
                            </button>
                            <button className="mobile-menu-logout-btn" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                                <LogOut size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            <div className="home-content centered">
                <div className="home-card glass">
                    <div className="home-logo-container">
                        <img src="/logo3.png" alt="logo" className="home-card-logo" />
                    </div>
                    <h3>Welcome back!</h3>
                    <p>Start a new meeting or enter a code to join an existing one.</p>
                    
                    <div className="home-actions">
                        <button className="create-meeting-btn" onClick={handleCreateMeeting}>
                            Create New Meeting
                        </button>
                        
                        <div className="divider"><span>OR</span></div>
                        
                        <form onSubmit={handleJoinMeeting} className="join-form">
                            <input 
                                type="text" 
                                placeholder="Enter meeting code (e.g. room-abc)" 
                                value={meetingCode} 
                                onChange={(e) => {
                                    setMeetingCode(e.target.value);
                                    setError("");
                                    setShowJoinPassword(false);
                                    setJoinPassword("");
                                }}
                                required
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
                            <button type="submit" className="join-meeting-btn">
                                {showJoinPassword ? "Confirm Passcode & Join" : "Join Meeting"}
                            </button>
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
                        </form>
                    </div>
                </div>
            </div>

            {/* Create Meeting Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setModalError(""); }}>
                    <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
                        <h3>Create New Meeting</h3>
                        <p>Customize your meeting room and set an optional passcode.</p>
                        <form onSubmit={handleConfirmCreate} className="modal-form">
                            <div className="input-group">
                                <label htmlFor="custom-code" style={{ fontSize: "0.8rem", color: "var(--text-sub)", fontWeight: "600", marginBottom: "4px" }}>Meeting Room ID</label>
                                <input
                                    id="custom-code"
                                    type="text"
                                    placeholder="Enter room ID (e.g. my-room)"
                                    value={customMeetingCode}
                                    onChange={(e) => {
                                        setCustomMeetingCode(e.target.value.toLowerCase().replace(/\s/g, ""));
                                        setModalError("");
                                    }}
                                    required
                                />
                            </div>
                            <div className="input-group" style={{ marginTop: "10px" }}>
                                <label htmlFor="meeting-pass" style={{ fontSize: "0.8rem", color: "var(--text-sub)", fontWeight: "600", marginBottom: "4px" }}>Passcode (Optional)</label>
                                <input
                                    id="meeting-pass"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Enter at least 6 digits (numbers only)"
                                    value={meetingPassword}
                                    onChange={(e) => {
                                        setMeetingPassword(e.target.value.replace(/\D/g, ""));
                                        setModalError("");
                                    }}
                                />
                            </div>
                            {modalError && (
                                <div style={{ 
                                    color: "var(--danger)", 
                                    fontSize: "0.85rem", 
                                    fontWeight: "500",
                                    textAlign: "center",
                                    lineHeight: "1.4"
                                }}>
                                    {modalError}
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="modal-cancel-btn" onClick={() => { setShowCreateModal(false); setModalError(""); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="modal-submit-btn">
                                    Create & Join
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAuth(Home);
