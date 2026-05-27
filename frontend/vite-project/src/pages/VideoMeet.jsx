import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import io from "socket.io-client";
import { useAuth } from "../contexts/Authcontext.jsx";
import { 
    Video, 
    VideoOff, 
    Mic, 
    MicOff, 
    Monitor, 
    MonitorOff, 
    PhoneOff, 
    Send, 
    MessageSquare, 
    Copy, 
    Check,
    User,
    Maximize2,
    RefreshCw,
    ArrowLeft,
    Lock
} from "lucide-react";
import "../styles/video.css";
import { BACKEND_URL } from "../utils/config.js";

const server_url = BACKEND_URL;

let connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" },
        { "urls": "stun:stun1.l.google.com:19302" },
        { "urls": "stun:stun2.l.google.com:19302" }
    ],
    "sdpSemantics": "unified-plan",
    "bundlePolicy": "max-bundle",
    "iceCandidatePoolSize": 10
};

let stashedCandidates = {};

function optimizeSDPLatency(sdp, videoBitrate = 1200) {
    let lines = sdp.split('\r\n');
    if (lines.length === 1) {
        lines = sdp.split('\n');
    }
    
    let audioIndex = -1;
    let videoIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('m=audio')) {
            audioIndex = i;
        } else if (lines[i].startsWith('m=video')) {
            videoIndex = i;
        }
    }
    
    // Optimize Video Bitrate
    if (videoIndex !== -1) {
        let insertIndex = videoIndex + 1;
        while (insertIndex < lines.length && !lines[insertIndex].startsWith('m=')) {
            if (lines[insertIndex].startsWith('b=AS:') || lines[insertIndex].startsWith('b=TIAS:')) {
                lines.splice(insertIndex, 1);
            } else {
                insertIndex++;
            }
        }
        lines.splice(videoIndex + 1, 0, `b=AS:${videoBitrate}`, `b=TIAS:${videoBitrate * 1000}`);
        
        if (audioIndex > videoIndex) {
            audioIndex += 2;
        }
    }
    
    // Optimize Audio (Opus parameters for low latency)
    let opusPayload = null;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('a=rtpmap:') && lines[i].toLowerCase().includes('opus/48000')) {
            const match = lines[i].match(/a=rtpmap:(\d+)\s+opus/i);
            if (match) {
                opusPayload = match[1];
                break;
            }
        }
    }
    
    if (opusPayload) {
        let fmtpIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`a=fmtp:${opusPayload}`)) {
                fmtpIndex = i;
                break;
            }
        }
        
        if (fmtpIndex !== -1) {
            let original = lines[fmtpIndex];
            original = original.replace(/minptime=\d+;?/, '')
                               .replace(/useinbandfec=\d+;?/, '')
                               .replace(/usedtx=\d+;?/, '')
                               .replace(/stereo=\d+;?/, '')
                               .replace(/sprop-stereo=\d+;?/, '')
                               .replace(/maxaveragebitrate=\d+;?/, '');
            lines[fmtpIndex] = `${original};stereo=0;sprop-stereo=0;minptime=10;useinbandfec=1;usedtx=1;maxaveragebitrate=20000`.replace(/;;/g, ';');
        } else if (audioIndex !== -1) {
            lines.splice(audioIndex + 1, 0, `a=fmtp:${opusPayload} stereo=0;sprop-stereo=0;minptime=10;useinbandfec=1;usedtx=1;maxaveragebitrate=20000`);
        }
    }
    
    return lines.join('\r\n');
}

function RemoteVideo({ peerVideo, socketNames, peerState }) {
    const videoRef = useRef();

    useEffect(() => {
        if (videoRef.current && peerVideo.stream) {
            videoRef.current.srcObject = peerVideo.stream;
            videoRef.current.play().catch(e => {
                if (e.name !== "AbortError") {
                    console.warn("Remote video play failed:", e);
                }
            });
        }
    }, [peerVideo.stream]);

    return (
        <div className="video-card remote">
            <video 
                ref={videoRef}
                autoPlay 
                playsInline
                style={{ display: peerState.video ? "block" : "none", width: "100%", height: "100%", objectFit: "cover" }}
            ></video>
            
            {!peerState.video && (
                <div className="video-paused-placeholder">
                    <div className="paused-avatar">
                        <User size={48} color="#a0aab3" />
                    </div>
                    <span>Video Off</span>
                </div>
            )}
            
            <div className="remote-status-indicators">
                {!peerState.audio && (
                    <span className="status-icon mic-muted" title="Muted">
                        <MicOff size={12} color="#ffffff" />
                    </span>
                )}
            </div>

            <span className="name-tag">
                <User size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
                {socketNames[peerVideo.socketId] || `User (${peerVideo.socketId.substring(0, 5)})`}
            </span>
        </div>
    );
}

export default function VideoMeet() {
    const { room_id } = useParams();
    const cleanRoomId = room_id ? room_id.trim().toLowerCase() : "";
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { token, logout } = useAuth();

    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoRef = useRef();
    const localStreamRef = useRef();

    const [videoAvailable, setVideoAvailable] = useState(false);
    const [audioAvailable, setAudioAvailable] = useState(false);
    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);
    const [screen, setScreen] = useState(false);
    const [screenShareSupported, setScreenShareSupported] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState(localStorage.getItem("username") || "");
    const [socketNames, setSocketNames] = useState({});
    const [mySocketId, setMySocketId] = useState("");
    const [videos, setVideos] = useState([]);

    const [peerStates, setPeerStates] = useState({});
    const [facingMode, setFacingMode] = useState("user");

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

    // Passcode Protection States
    const [isPasswordRequired, setIsPasswordRequired] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [checkingRoom, setCheckingRoom] = useState(true);

    const iceServersRef = useRef(peerConfigConnections);

    const queryPasscode = searchParams.get("passcode") || "";

    useEffect(() => {
        const fetchIceServers = async () => {
            try {
                const response = await fetch(`${server_url}/api/v1/users/get_ice_servers`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.iceServers) {
                        iceServersRef.current = {
                            ...peerConfigConnections,
                            iceServers: data.iceServers
                        };
                    }
                }
            } catch (err) {
                console.warn("Could not fetch ICE servers, using defaults:", err);
            }
        };
        fetchIceServers();
    }, []);

    useEffect(() => {
        const checkRoomStatus = async () => {
            try {
                let isVerified = false;
                if (queryPasscode) {
                    const verifyResponse = await fetch(`${server_url}/api/v1/users/verify_meeting_password`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ meeting_code: cleanRoomId, password: queryPasscode })
                    });
                    if (verifyResponse.ok) {
                        setPasswordInput(queryPasscode);
                        setPasswordVerified(true);
                        isVerified = true;
                    }
                }

                const response = await fetch(`${server_url}/api/v1/users/get_meeting_status?meeting_code=${cleanRoomId}`);
                if (response.ok) {
                    const data = await response.json();
                    setIsPasswordRequired(data.required);
                    if (isVerified) {
                        setPasswordVerified(true);
                    }
                }
            } catch (err) {
                console.error("Error checking room status:", err);
            } finally {
                setCheckingRoom(false);
            }
        };

        if (cleanRoomId) {
            checkRoomStatus();
        }
    }, [cleanRoomId, queryPasscode]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 900);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Sync unique participants list using useMemo to avoid cascading renders
    const participantsList = useMemo(() => {
        if (!username.trim()) return [];
        const uniqueNames = new Set([username.trim()]);
        Object.values(socketNames).forEach((name) => {
            if (name && name.trim()) {
                uniqueNames.add(name.trim());
            }
        });
        return Array.from(uniqueNames);
    }, [socketNames, username]);

    // Send updated participants list to the backend
    useEffect(() => {
        const updateBackendParticipants = async () => {
            if (token && cleanRoomId && participantsList.length > 0) {
                try {
                    const response = await fetch(`${server_url}/api/v1/users/update_meeting_participants`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            meeting_code: cleanRoomId,
                            participants: participantsList
                        }),
                    });
                    if (response.status === 401) {
                        logout();
                    }
                } catch (err) {
                    console.error("Error updating participants:", err);
                }
            }
        };

        if (token && cleanRoomId && participantsList.length > 0) {
            updateBackendParticipants();
        }
    }, [participantsList, token, cleanRoomId, logout]);
    
    // Copy meeting link state
    const [copied, setCopied] = useState(false);
    // Collapsible chat drawer state
    const [showChat, setShowChat] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-hide controls states
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 4000); // 4 seconds of inactivity
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Attach local stream once the username modal is dismissed and local video element mounts
    useEffect(() => {
        if (!askForUsername && localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [askForUsername]);

    // Monitor inactivity inside active call
    useEffect(() => {
        if (!askForUsername) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 4000);
        }
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [askForUsername]);

    // Check media devices availability on mount
    useEffect(() => {
        const checkPermissions = async () => {
            if (!navigator.mediaDevices) {
                console.warn("navigator.mediaDevices is not supported (likely insecure HTTP context)");
                setVideoAvailable(false);
                setAudioAvailable(false);
                setScreenShareSupported(false);
                return;
            }

            // Check if screen sharing is supported
            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenShareSupported(true);
            } else {
                setScreenShareSupported(false);
            }

            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setVideoAvailable(true);
                videoStream.getTracks().forEach(track => track.stop());
            } catch {
                setVideoAvailable(false);
            }

            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setAudioAvailable(true);
                audioStream.getTracks().forEach(track => track.stop());
            } catch {
                setAudioAvailable(false);
            }
        };

        checkPermissions();
    }, []);

    // Get User Media Stream (High-Quality constraints)
    const getUserMedia = async () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: video && videoAvailable ? {
                        facingMode: facingMode,
                        width: { min: 640, ideal: 1280, max: 1920 },
                        height: { min: 360, ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    } : false,
                    audio: audio && audioAvailable ? {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        latency: 0,
                        channelCount: 1
                    } : false
                });
                
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                return stream;
            } catch (err) {
                console.error("Error getting user media:", err);
            }
        }
        return null;
    };

    // Initialize Video & Audio when joining meeting
    const handleJoin = async () => {
        if (!username.trim()) return;

        // If passcode is required and not verified, verify it first
        if (isPasswordRequired && !passwordVerified) {
            setPasswordError("");
            try {
                const response = await fetch(`${server_url}/api/v1/users/verify_meeting_password`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ meeting_code: cleanRoomId, password: passwordInput })
                });

                const data = await response.json();
                if (!response.ok) {
                    setPasswordError(data.message || "Incorrect passcode. Please try again.");
                    return;
                }
                
                setPasswordVerified(true);
            } catch (err) {
                console.error("Error verifying passcode:", err);
                setPasswordError("Something went wrong. Please try again.");
                return;
            }
        }

        setAskForUsername(false);

        if (token) {
            try {
                const response = await fetch(`${server_url}/api/v1/users/add_to_activity`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ meeting_code: cleanRoomId }),
                });
                if (response.status === 401) {
                    logout();
                }
            } catch (err) {
                console.error("Error logging meeting to history:", err);
            }
        }

        await initMeeting();
    };

    const initMeeting = async () => {
        await getUserMedia();

        // Connect to Socket.io Server
        socketRef.current = io(server_url);

        // Bind chat message listener first to prevent race condition with connection sync
        socketRef.current.on("chat-message", (data, sender, senderSocketId) => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            setMessages((prev) => [...prev, { data, sender, socketIdSender: senderSocketId, timestamp: time }]);
        });

        // When a user left the room
        socketRef.current.on("user-left", (id) => {
            console.log("User left:", id);
            if (connections[id]) {
                connections[id].close();
                delete connections[id];
            }
            setVideos((prev) => prev.filter((v) => v.socketId !== id));
        });

        socketRef.current.on("connect", () => {
            console.log("Connected to signaling server with id:", socketRef.current.id);
            socketIdRef.current = socketRef.current.id;
            setMySocketId(socketRef.current.id);

            // Emit join-call to notify room
            socketRef.current.emit("join-call", cleanRoomId, username);
        });

        // When another user joins the room
        socketRef.current.on("user-joined", async (id, clientsList, socketToUsernameMap) => {
            console.log("User joined:", id, "Total clients:", clientsList);
            if (socketToUsernameMap) {
                setSocketNames(socketToUsernameMap);
            }
            
            if (id === socketIdRef.current) return;
            
            // Create PeerConnection for the newly joined user
            const pc = new RTCPeerConnection(iceServersRef.current);
            connections[id] = pc;

            // Add local stream tracks to PC
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    const sender = pc.addTrack(track, localStreamRef.current);
                    if (track.kind === "video") {
                        try {
                            const params = sender.getParameters();
                            if (!params.encodings) params.encodings = [{}];
                            params.encodings[0].maxBitrate = 1200000; // 1.2 Mbps
                            params.encodings[0].degradationPreference = "maintain-resolution";
                            sender.setParameters(params);
                        } catch (e) {
                            console.warn("Could not set sender parameters:", e);
                        }
                    }
                });
            }

            // Send local candidates to the peer
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socketRef.current.emit("signal", id, { candidate: event.candidate });
                }
            };

            // Receive remote stream
            pc.ontrack = (event) => {
                if (event.receiver) {
                    try {
                        if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
                        if ('jitterBufferDelayHint' in event.receiver) event.receiver.jitterBufferDelayHint = 0;
                    } catch (e) {
                        console.warn("Could not set delay hints:", e);
                    }
                }
                setVideos((prev) => {
                    // Avoid adding duplicate video items
                    const exists = prev.find((v) => v.socketId === id);
                    if (exists) return prev;
                    return [...prev, { socketId: id, stream: event.streams[0] }];
                });
            };

            // Initiate offer
            const offer = await pc.createOffer();
            const desc = {
                type: offer.type,
                sdp: optimizeSDPLatency(offer.sdp, 1200)
            };
            await pc.setLocalDescription(desc);
            socketRef.current.emit("signal", id, { sdp: pc.localDescription });

            // Broadcast our state to them
            socketRef.current.emit("signal", id, {
                type: "state-change",
                video: video,
                audio: audio
            });
        });

        // Handle incoming WebRTC signals (Offers, Answers, and Candidates)
        socketRef.current.on("signal", async (senderId, signalData) => {
            if (signalData.type === "state-change") {
                setPeerStates((prev) => ({
                    ...prev,
                    [senderId]: { video: signalData.video, audio: signalData.audio }
                }));
                return;
            }

            let pc = connections[senderId];

            if (!pc) {
                pc = new RTCPeerConnection(iceServersRef.current);
                connections[senderId] = pc;

                // Add local stream tracks
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((track) => {
                        const sender = pc.addTrack(track, localStreamRef.current);
                        if (track.kind === "video") {
                            try {
                                const params = sender.getParameters();
                                if (!params.encodings) params.encodings = [{}];
                                params.encodings[0].maxBitrate = 1200000; // 1.2 Mbps
                                params.encodings[0].degradationPreference = "maintain-resolution";
                                sender.setParameters(params);
                            } catch (e) {
                                console.warn("Could not set sender parameters:", e);
                            }
                        }
                    });
                }

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socketRef.current.emit("signal", senderId, { candidate: event.candidate });
                    }
                };

                pc.ontrack = (event) => {
                    if (event.receiver) {
                        try {
                            if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
                            if ('jitterBufferDelayHint' in event.receiver) event.receiver.jitterBufferDelayHint = 0;
                        } catch (e) {
                            console.warn("Could not set delay hints:", e);
                        }
                    }
                    setVideos((prev) => {
                        const exists = prev.find((v) => v.socketId === senderId);
                        if (exists) return prev;
                        return [...prev, { socketId: senderId, stream: event.streams[0] }];
                    });
                };
            }

            if (signalData.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));

                // Process stashed candidates once remote description is applied
                if (stashedCandidates[senderId]) {
                    stashedCandidates[senderId].forEach(async (candidate) => {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error("Error adding stashed candidate:", e);
                        }
                    });
                    delete stashedCandidates[senderId];
                }

                if (signalData.sdp.type === "offer") {
                    const answer = await pc.createAnswer();
                    const desc = {
                        type: answer.type,
                        sdp: optimizeSDPLatency(answer.sdp, 1200)
                    };
                    await pc.setLocalDescription(desc);
                    socketRef.current.emit("signal", senderId, { sdp: pc.localDescription });

                    // Broadcast our state back to the offering peer
                    socketRef.current.emit("signal", senderId, {
                        type: "state-change",
                        video: video,
                        audio: audio
                    });
                }
            } else if (signalData.candidate) {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
                    } catch (err) {
                        console.error("Error adding ice candidate:", err);
                    }
                } else {
                    if (!stashedCandidates[senderId]) {
                        stashedCandidates[senderId] = [];
                    }
                    stashedCandidates[senderId].push(signalData.candidate);
                }
            }
        });
    };

    // Clean up connections on unmount
    useEffect(() => {
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            Object.keys(connections).forEach((id) => {
                connections[id].close();
            });
            connections = {};
        };
    }, []);

    // Broadcast local state changes to all peers
    const broadcastStateChange = (videoState, audioState) => {
        if (socketRef.current) {
            Object.keys(connections).forEach((peerId) => {
                socketRef.current.emit("signal", peerId, {
                    type: "state-change",
                    video: videoState,
                    audio: audioState
                });
            });
        }
    };

    // Swap between Front and Back camera (Mobile/Tablet facing mode toggle)
    const handleCameraSwitch = async () => {
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);
        
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => track.stop());
            
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: newMode,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 }
                    },
                    audio: audio && audioAvailable ? {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    } : false
                });
                
                const newVideoTrack = newStream.getVideoTracks()[0];
                
                Object.keys(connections).forEach((id) => {
                    const senders = connections[id].getSenders();
                    const videoSender = senders.find(sender => sender.track && sender.track.kind === "video");
                    if (videoSender) {
                        videoSender.replaceTrack(newVideoTrack);
                    }
                });
                
                const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
                if (oldVideoTrack) {
                    localStreamRef.current.removeTrack(oldVideoTrack);
                }
                localStreamRef.current.addTrack(newVideoTrack);
                
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
                
                if (!video) {
                    newVideoTrack.enabled = false;
                }
            } catch (err) {
                console.error("Error switching camera:", err);
            }
        }
    };

    // Toggle Camera (Video)
    const handleVideoToggle = () => {
        const val = !video;
        setVideo(val);
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = val;
            }
        }
        broadcastStateChange(val, audio);
    };

    // Toggle Microphone (Audio)
    const handleAudioToggle = () => {
        const val = !audio;
        setAudio(val);
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = val;
            }
        }
        broadcastStateChange(video, val);
    };

    // Toggle Screen Share
    const handleScreenShareToggle = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("Screen sharing is not supported on this browser or device, or requires a secure (HTTPS) connection.");
            return;
        }
        if (!screen) {
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreen(true);
                
                // Replace video tracks on all peer connections
                const newVideoTrack = displayStream.getVideoTracks()[0];
                Object.keys(connections).forEach((id) => {
                    const senders = connections[id].getSenders();
                    const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video");
                    if (videoSender) {
                        videoSender.replaceTrack(newVideoTrack);
                    }
                });

                // Listen for user stopping screen share via browser UI
                newVideoTrack.onended = () => {
                    stopScreenShare();
                };

                // Update local stream and display
                const localVideoTrack = localStreamRef.current.getVideoTracks()[0];
                if (localVideoTrack) {
                    localVideoTrack.enabled = false;
                }
                
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = displayStream;
                }
            } catch (err) {
                console.error("Error screen sharing:", err);
            }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = () => {
        setScreen(false);
        // Switch back to camera tracks on all peer connections
        const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (cameraVideoTrack) {
            cameraVideoTrack.enabled = video;
            Object.keys(connections).forEach((id) => {
                const senders = connections[id].getSenders();
                const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video");
                if (videoSender) {
                    videoSender.replaceTrack(cameraVideoTrack);
                }
            });
        }
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    };

    // Send Chat Message
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!message.trim() || !socketRef.current) return;
        socketRef.current.emit("chat-message", message, username);
        setMessage("");
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLeaveCall = () => {
        navigate("/home");
    };

    return (
        <div className="meet-container">
            {checkingRoom ? (
                <div style={{
                    display: "flex", 
                    justifyContent: "center", 
                    alignItems: "center", 
                    height: "100vh", 
                    background: "radial-gradient(circle at 50% 50%, #17151f, #08060d)", 
                    color: "white",
                    fontFamily: "system-ui, sans-serif"
                }}>
                    <div className="loading-spinner">Loading meeting details...</div>
                </div>
            ) : askForUsername ? (
                <div className="join-modal">
                    <h2>Enter Room: {room_id}</h2>
                    {isPasswordRequired && (
                        <p style={{ color: "#a0aab3", fontSize: "0.9rem", margin: "-10px 0 15px 0" }}>
                            🔒 This meeting is passcode protected
                        </p>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "320px", marginBottom: "15px" }}>
                        <input 
                            type="text" 
                            placeholder="Enter your name" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                        />
                        {isPasswordRequired && (
                            <input 
                                type="password" 
                                inputMode="numeric"
                                placeholder="Enter meeting passcode"
                                value={passwordInput}
                                onChange={(e) => {
                                    setPasswordInput(e.target.value.replace(/\D/g, ""));
                                    setPasswordError("");
                                }} 
                            />
                        )}
                    </div>
                    {passwordError && (
                        <div style={{ color: "#e53e3e", fontSize: "0.85rem", marginBottom: "15px", textAlign: "center" }}>
                            {passwordError}
                        </div>
                    )}
                    <button 
                        onClick={handleJoin} 
                        disabled={!username.trim() || (isPasswordRequired && !passwordInput.trim())}
                    >
                        Join Call
                    </button>
                </div>
            ) : (
                <div 
                    className={`meet-layout ${showChat ? "chat-open" : "chat-closed"} ${showControls ? "controls-visible" : "controls-hidden"}`}
                    onClick={resetControlsTimeout}
                    onMouseMove={resetControlsTimeout}
                    onTouchStart={resetControlsTimeout}
                >
                    {/* Videos Canvas Area (Left side container) */}
                    <div className="videos-canvas-container">
                        {/* WhatsApp-Style Top Header Bar */}
                        <div className="meet-header-bar">
                            <div className="meet-header-left">
                                <span className="meet-room-badge">Room: {room_id}</span>
                            </div>
                            <div className="meet-header-center">
                                <span className="meet-encryption-badge">
                                    <Lock size={12} color="#00a884" style={{ marginRight: "5px" }} />
                                    End-to-end encrypted
                                </span>
                            </div>
                            <div className="meet-header-right">
                                <span className="meet-participants-badge">
                                    {participantsList.length} Active
                                </span>
                            </div>
                        </div>

                        {/* Conditional grid rendering based on crash safety rules */}
                        {showChat && isMobile && (videos.length >= 2) ? (
                            <div className="mobile-chat-group-placeholder">
                                <div className="placeholder-circle">
                                    <User size={32} color="#ffffff" />
                                </div>
                                <span>Group Call Active</span>
                                <span className="participant-count">{videos.length + 1} participants online</span>
                            </div>
                        ) : (
                            <>
                                {/* Remote Videos Grid */}
                                <div className="videos-grid">
                                    {videos.length === 0 ? (
                                        <div className="waiting-container">
                                            <div className="whatsapp-avatar">
                                                <User size={48} color="#a0aab3" />
                                            </div>
                                            <h4>Waiting for others to join...</h4>
                                            <p>Share this room URL to invite participants to your call</p>
                                        </div>
                                    ) : (
                                        videos.map((peerVideo) => {
                                            const peerState = peerStates[peerVideo.socketId] || { video: true, audio: true };
                                            return (
                                                <RemoteVideo 
                                                    key={peerVideo.socketId} 
                                                    peerVideo={peerVideo} 
                                                    socketNames={socketNames} 
                                                    peerState={peerState}
                                                />
                                            );
                                        })
                                    )}
                                </div>

                                {/* Local Video Card (Floating PiP or Full Screen) */}
                                <div className={`video-card local ${videos.length === 0 ? "full-screen-local" : ""}`}>
                                    <video ref={localVideoRef} autoPlay muted playsInline></video>
                                    <span className="name-tag">
                                        <User size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                                        {username} (You)
                                    </span>
                                </div>
                            </>
                        )}

                        {/* Full Screen Button for Mobile PiP */}
                        <button 
                            className="mobile-expand-btn" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowChat(false);
                            }}
                        >
                            <Maximize2 size={16} />
                        </button>
                    </div>

                    {/* Chat Drawer */}
                    {showChat && (
                        <div className="chat-drawer">
                            <div className="chat-header">
                                <button className="chat-back-btn" onClick={() => setShowChat(false)}>
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="chat-header-avatar">
                                    <User size={18} color="#ffffff" />
                                </div>
                                <div className="chat-header-info">
                                    <h3>Meeting Chat</h3>
                                    <span>{room_id} • {participantsList.length} participant{participantsList.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            <div className="chat-messages">
                                {messages.map((msg, index) => {
                                    const isSelf = msg.socketIdSender === mySocketId;
                                    return (
                                        <div key={index} className={`chat-msg ${isSelf ? "self" : "other"}`}>
                                            {!isSelf && (
                                                <span className="chat-msg-sender">
                                                    {msg.sender || "Participant"}
                                                </span>
                                            )}
                                            <span className="chat-msg-text">{msg.data}</span>
                                            <span className="chat-msg-time">
                                                {msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSendMessage} className="chat-input-form">
                                <input 
                                    type="text" 
                                    placeholder="Send message..." 
                                    value={message} 
                                    onChange={(e) => setMessage(e.target.value)} 
                                />
                                <button type="submit">
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Floating Mobile Chat Toggle Button */}
                    <button 
                        onClick={() => setShowChat(!showChat)} 
                        className={`control-btn chat-toggle-btn-mobile ${showChat ? "btn-active" : "btn-on"}`}
                    >
                        <MessageSquare size={20} />
                    </button>

                    {/* Controls Bar */}
                    <div className="controls-bar">
                        <button onClick={handleVideoToggle} className={`control-btn ${!video ? "btn-off" : "btn-on"}`}>
                            {video ? <Video size={20} /> : <VideoOff size={20} />}
                            <span className="tooltip">{video ? "Mute Camera" : "Unmute Camera"}</span>
                        </button>
                        
                        <button onClick={handleAudioToggle} className={`control-btn ${!audio ? "btn-off" : "btn-on"}`}>
                            {audio ? <Mic size={20} /> : <MicOff size={20} />}
                            <span className="tooltip">{audio ? "Mute Mic" : "Unmute Mic"}</span>
                        </button>

                        <button onClick={handleCameraSwitch} className="control-btn btn-on">
                            <RefreshCw size={20} />
                            <span className="tooltip">Switch Camera</span>
                        </button>
                        
                        {screenShareSupported && (
                            <button onClick={handleScreenShareToggle} className={`control-btn ${screen ? "btn-active" : "btn-on"}`}>
                                {screen ? <MonitorOff size={20} /> : <Monitor size={20} />}
                                <span className="tooltip">{screen ? "Stop Presenting" : "Present Screen"}</span>
                            </button>
                        )}

                        <button onClick={handleCopyLink} className="control-btn btn-on">
                            {copied ? <Check size={20} color="#86efac" /> : <Copy size={20} />}
                            <span className="tooltip">{copied ? "Copied!" : "Copy Join Link"}</span>
                        </button>

                        <button onClick={() => setShowChat(!showChat)} className={`control-btn chat-toggle-btn-desktop ${showChat ? "btn-active" : "btn-on"}`}>
                            <MessageSquare size={20} />
                            <span className="tooltip">{showChat ? "Hide Chat" : "Show Chat"}</span>
                        </button>

                        <button className="control-btn leave-btn" onClick={handleLeaveCall}>
                            <PhoneOff size={20} />
                            <span className="tooltip">Leave Call</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}