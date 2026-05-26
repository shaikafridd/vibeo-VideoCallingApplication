import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/Authcontext.jsx";
import "../App.css";

export default function Authenticate() {
    const { login, register } = useAuth();
    const [searchParams] = useSearchParams();
    const currentMode = searchParams.get("mode");
    const [prevMode, setPrevMode] = useState(currentMode);
    const [isLogin, setIsLogin] = useState(currentMode !== "register");

    if (currentMode !== prevMode) {
        setPrevMode(currentMode);
        setIsLogin(currentMode !== "register");
    }
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        // Validate Full Name (only on Register mode)
        if (!isLogin && !name.trim()) {
            setError("Please enter your full name.");
            setLoading(false);
            return;
        }

        // Validate Username: Alphanumeric and 3+ characters
        const usernameRegex = /^[a-zA-Z0-9]{3,}$/;
        if (!usernameRegex.test(username)) {
            setError("Username must be at least 3 characters long and contain only letters and numbers.");
            setLoading(false);
            return;
        }

        // Validate Password: 6+ characters
        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            setLoading(false);
            return;
        }

        try {
            if (isLogin) {
                await login(username, password);
                localStorage.setItem("username", username);
                setSuccess("Login successful! Redirecting...");
                setTimeout(() => {
                    navigate("/home");
                }, 1500);
            } else {
                await register(name, username, password);
                setSuccess("Registration successful! Please login.");
                setIsLogin(true);
                setPassword("");
            }
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container LandingPageContainer">
            <div className="auth-card">
                <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
                <p className="auth-subtitle">
                    {isLogin ? "Sign in to connect with your friends" : "Register to start your first video call"}
                </p>

                {error && <div className="auth-alert error">{error}</div>}
                {success && <div className="auth-alert success">{success}</div>}

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="input-group">
                            <label htmlFor="name">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? "Please wait..." : isLogin ? "Sign In" : "Register"}
                    </button>
                </form>

                <div className="auth-toggle">
                    <span>{isLogin ? "Don't have an account? " : "Already have an account? "}</span>
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError("");
                            setSuccess("");
                        }}
                    >
                        {isLogin ? "Sign Up" : "Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
}
