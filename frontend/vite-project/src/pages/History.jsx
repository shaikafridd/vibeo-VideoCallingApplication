/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/Authcontext.jsx";
import { withAuth } from "../utils/withAuth.jsx";
import { BACKEND_URL } from "../utils/config.js";
import { ArrowLeft, Clock } from "lucide-react";
import "../App.css";

function History() {
    const { token, logout } = useAuth();
    const [history, setHistory] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/v1/users/get_all_activity`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setHistory(data);
                } else if (response.status === 401) {
                    logout();
                    navigate("/auth");
                }
            } catch (err) {
                console.error("Error fetching history:", err);
            }
        };

        if (token) {
            fetchHistory();
        }
    }, [token, navigate, logout]);

    return (
        <div className="home-container LandingPageContainer">
            <nav className="home-nav">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src="/logo3.png" alt="logo" style={{ height: "40px", width: "auto" }} />
                    <h2>Vibeo</h2>
                </div>
                <button className="back-btn" onClick={() => navigate("/home")}>
                    <ArrowLeft size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                    Back to Dashboard
                </button>
            </nav>

            <div className="history-content-container">
                <div className="history-page-card glass">
                    <div className="history-header">
                        <Clock size={24} color="var(--primary)" />
                        <h3>Your Meeting History</h3>
                    </div>
                    <p className="subtitle">Review the list of video calls you have created or joined recently</p>
                    
                    <div className="history-list-expanded">
                        {history.length === 0 ? (
                            <p className="no-history">No meetings logged yet. Start a call to log history!</p>
                        ) : (
                            history.map((meeting) => (
                                <div key={meeting._id} className="history-item-expanded">
                                    <div className="code-info">
                                        <span className="label">Meeting Code</span>
                                        <span className="code">{meeting.meeting_code}</span>
                                    </div>
                                    <div className="participants-info" title={meeting.participants && meeting.participants.length > 0 ? meeting.participants.join(", ") : "Just You"}>
                                        <span className="label">Participants</span>
                                        <span className="participants">
                                            {meeting.participants && meeting.participants.length > 0 
                                                ? meeting.participants.join(", ") 
                                                : "Just You"}
                                        </span>
                                    </div>
                                    <div className="date-info">
                                        <span className="label">Date Attended</span>
                                        <span className="date">{new Date(meeting.date).toLocaleString()}</span>
                                    </div>
                                    <button 
                                        className="rejoin-btn" 
                                        onClick={() => navigate(`/room/${meeting.meeting_code}`)}
                                    >
                                        Rejoin Room
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withAuth(History);
