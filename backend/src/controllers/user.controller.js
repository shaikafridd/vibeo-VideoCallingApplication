import httpStatus from "http-status";
import { User } from "../model/user.model.js";
import { Meeting } from "../model/meeting.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Please provide both username and password!" });
    }
    try {
        const foundUser = await User.findOne({ username });
        if (!foundUser) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, foundUser.password);
        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            foundUser.token = token;
            await foundUser.save();
            return res.status(httpStatus.OK).json({ token: token });
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong!!" });
    }
}


const register = async (req, res) => {
    const { name, username, password } = req.body;

    try {
        const existuser = await User.findOne({ username });
        if (existuser) {
            return res.status(httpStatus.FOUND).json({ message: "User already exists" });
        }

        const hashedPass = await bcrypt.hash(password, 10);
        const newUser = new User({
            name: name,
            username: username,
            password: hashedPass
        });

        await newUser.save();
        res.status(httpStatus.CREATED).json({ message: "User registered!!" });
    } catch (e) {
        res.status(500).json({ message: "Something went wrong: " + e.message });
    }

}

const getUserFromRequest = async (req) => {
    let token = null;

    // Check Authorization header first
    if (req.headers && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
            token = parts[1];
        } else {
            token = req.headers.authorization;
        }
    }

    // Check body if not in header
    if (!token && req.body && req.body.token) {
        token = req.body.token;
    }

    // Check query if not in header or body
    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return null;
    }

    try {
        const user = await User.findOne({ token: token });
        return user;
    } catch (e) {
        return null;
    }
};

const add_to_activity = async (req, res) => {
    const { meeting_code, password } = req.body;
    const cleanCode = meeting_code ? meeting_code.trim().toLowerCase() : "";

    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Unauthorized: Invalid or missing token" });
        }

        // Find if there is an existing meeting with this code to copy its password configuration
        const existingMeeting = await Meeting.findOne({ meeting_code: cleanCode }).sort({ date: -1 });
        let hashedPassword = null;
        if (existingMeeting && existingMeeting.password) {
            hashedPassword = existingMeeting.password; // Copy the password hash from the host's meeting
        } else if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const newMeeting = new Meeting({
            user_id: user._id,
            meeting_code: cleanCode,
            date: new Date(),
            participants: [user.name || user.username],
            password: hashedPassword
        });

        await newMeeting.save();
        return res.status(httpStatus.CREATED).json({ message: "Added to activity" });
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong: " + e.message });
    }
}

const get_all_activity = async (req, res) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Unauthorized: Invalid or missing token" });
        }

        const meetings = await Meeting.find({ user_id: user._id }).sort({ date: -1 });
        return res.status(httpStatus.OK).json(meetings);
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong: " + e.message });
    }
}

const update_meeting_participants = async (req, res) => {
    const { meeting_code, participants } = req.body;
    const cleanCode = meeting_code ? meeting_code.trim().toLowerCase() : "";

    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Unauthorized: Invalid or missing token" });
        }

        const latestMeeting = await Meeting.findOne({
            user_id: user._id,
            meeting_code: cleanCode
        }).sort({ date: -1 });

        if (latestMeeting) {
            // Merge existing and new participant names uniquely
            const uniqueParticipants = Array.from(new Set([
                ...(latestMeeting.participants || []),
                ...(participants || [])
            ]));
            latestMeeting.participants = uniqueParticipants;
            await latestMeeting.save();
            return res.status(httpStatus.OK).json({ message: "Meeting participants updated successfully!" });
        } else {
            return res.status(httpStatus.OK).json({ message: "Meeting not found in user history, skipping participant update" });
        }
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong: " + e.message });
    }
}

const get_meeting_status = async (req, res) => {
    const { meeting_code } = req.query;
    if (!meeting_code) {
        return res.status(400).json({ message: "Please provide a meeting code" });
    }
    const cleanCode = meeting_code.trim().toLowerCase();

    try {
        // Find the latest meeting with this code
        const meeting = await Meeting.findOne({ meeting_code: cleanCode }).sort({ date: -1 });
        if (meeting && meeting.password) {
            return res.status(200).json({ required: true });
        }
        return res.status(200).json({ required: false });
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong: " + e.message });
    }
};

const verify_meeting_password = async (req, res) => {
    const { meeting_code, password } = req.body;
    if (!meeting_code) {
        return res.status(400).json({ message: "Please provide a meeting code" });
    }
    const cleanCode = meeting_code.trim().toLowerCase();

    try {
        // Find the latest meeting with this code
        const meeting = await Meeting.findOne({ meeting_code: cleanCode }).sort({ date: -1 });
        if (!meeting) {
            return res.status(404).json({ message: "Meeting not found" });
        }

        if (!meeting.password) {
            // Meeting exists but has no password protection
            return res.status(200).json({ success: true });
        }

        if (!password) {
            return res.status(400).json({ success: false, message: "Password is required for this meeting" });
        }

        const isMatch = await bcrypt.compare(password, meeting.password);
        if (isMatch) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(400).json({ success: false, message: "Incorrect password" });
        }
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong: " + e.message });
    }
};

const get_ice_servers = async (req, res) => {
    try {
        const iceServers = [
            { "urls": "stun:stun.l.google.com:19302" },
            { "urls": "stun:stun1.l.google.com:19302" },
            { "urls": "stun:stun2.l.google.com:19302" }
        ];

        const turnUrl = process.env.TURN_SERVER_URL;
        const turnUsername = process.env.TURN_USERNAME;
        const turnCredential = process.env.TURN_PASSWORD || process.env.TURN_CREDENTIAL;

        if (turnUrl) {
            const urls = turnUrl.split(",").map(u => u.trim());
            const turnServerConfig = { urls };
            if (turnUsername) {
                turnServerConfig.username = turnUsername;
            }
            if (turnCredential) {
                turnServerConfig.credential = turnCredential;
            }
            iceServers.push(turnServerConfig);
        }

        return res.status(200).json({ iceServers });
    } catch (e) {
        return res.status(500).json({ message: "Something went wrong: " + e.message });
    }
};

export { login, register, add_to_activity, get_all_activity, update_meeting_participants, get_meeting_status, verify_meeting_password, get_ice_servers };