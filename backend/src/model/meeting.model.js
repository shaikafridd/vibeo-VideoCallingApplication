import mongoose, { Schema } from "mongoose"

const meetingSchema = new Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    meeting_code: { type: String, required: true },
    date: { type: Date, default: Date.now, required: true },
    participants: [{ type: String }],
    password: { type: String }
})

const Meeting = mongoose.model("Meeting", meetingSchema);
export { Meeting };