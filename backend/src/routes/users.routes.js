import { Router } from "express";
import { login, register, add_to_activity, get_all_activity, update_meeting_participants, get_meeting_status, verify_meeting_password, get_ice_servers } from "../controllers/user.controller.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/add_to_activity").post(add_to_activity);
router.route("/get_all_activity").get(get_all_activity);
router.route("/update_meeting_participants").post(update_meeting_participants);
router.route("/get_meeting_status").get(get_meeting_status);
router.route("/verify_meeting_password").post(verify_meeting_password);
router.route("/get_ice_servers").get(get_ice_servers);

export default router;