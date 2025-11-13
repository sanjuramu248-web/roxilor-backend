"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post("/register", admin_controller_1.registerAdmin);
router.post("/login", admin_controller_1.loginAdmin);
router.get("/dashboard", auth_middleware_1.authMiddleware, admin_controller_1.getAdminDashboard);
router.get("/test", auth_middleware_1.authMiddleware, (req, res) => {
    const user = req.user;
    res.json({ message: "Auth working", user });
});
router.get("/users", auth_middleware_1.authMiddleware, admin_controller_1.getAllUsers);
router.post("/users", auth_middleware_1.authMiddleware, admin_controller_1.createUser);
router.put("/users/:userId/role", auth_middleware_1.authMiddleware, admin_controller_1.updateUserRole);
router.delete("/users/:userId", auth_middleware_1.authMiddleware, admin_controller_1.deleteUser);
exports.default = router;
