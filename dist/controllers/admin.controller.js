"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.createUser = exports.getAllUsers = exports.getAdminDashboard = exports.loginAdmin = exports.registerAdmin = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const user_model_1 = require("../models/user.model");
const asyncHandler_1 = require("../utils/asyncHandler");
const apiError_1 = require("../utils/apiError");
const apiResponse_1 = require("../utils/apiResponse");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jwt_1 = require("../utils/jwt");
exports.registerAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = user_model_1.adminCreateUserSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(200).json({
            error: result.error.format()
        });
    }
    const { name, email, password, address } = result.data;
    const existingUser = await prisma_1.default.user.findUnique({
        where: { email }
    });
    if (existingUser) {
        throw new apiError_1.ApiError(409, "User with this email already exists");
    }
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const user = await prisma_1.default.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            address,
            role: "SYSTEM_ADMIN"
        },
        select: {
            id: true,
            name: true,
            email: true,
            address: true,
            role: true,
            createdAt: true
        }
    });
    const accessToken = (0, jwt_1.generateAccessToken)(user.id);
    const refreshToken = (0, jwt_1.generateRefreshToken)(user.id);
    await prisma_1.default.user.update({
        where: { id: user.id },
        data: { refreshToken }
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(201).json(new apiResponse_1.ApiResponse(201, {
        user,
        accessToken,
        refreshToken
    }, "Admin registered successfully"));
});
exports.loginAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = user_model_1.userLoginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(200).json({
            error: result.error.format()
        });
    }
    const { email, password } = result.data;
    const admin = await prisma_1.default.user.findUnique({
        where: { email }
    });
    if (!admin || admin.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(401, "Invalid email or password");
    }
    const isPasswordCorrect = await bcrypt_1.default.compare(password, admin.password);
    if (!isPasswordCorrect) {
        throw new apiError_1.ApiError(401, "Invalid email or password");
    }
    const accessToken = (0, jwt_1.generateAccessToken)(admin.id);
    const refreshToken = (0, jwt_1.generateRefreshToken)(admin.id);
    await prisma_1.default.user.update({
        where: { id: admin.id },
        data: { refreshToken }
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    const userResponse = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        address: admin.address,
        role: admin.role,
        createdAt: admin.createdAt
    };
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        user: userResponse,
        accessToken,
        refreshToken
    }, "Login successful"));
});
exports.getAdminDashboard = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can access dashboard");
    }
    const [totalUsers, totalStores, totalRatings, recentUsers] = await Promise.all([
        prisma_1.default.user.count(),
        prisma_1.default.store.count(),
        prisma_1.default.rating.count(),
        prisma_1.default.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        })
    ]);
    const usersByRole = await prisma_1.default.user.groupBy({
        by: ['role'],
        _count: {
            role: true
        }
    });
    const dashboardData = {
        statistics: {
            totalUsers,
            totalStores,
            totalRatings,
            usersByRole: usersByRole.reduce((acc, item) => {
                acc[item.role] = item._count.role;
                return acc;
            }, {})
        },
        recentUsers
    };
    res.status(200).json(new apiResponse_1.ApiResponse(200, dashboardData, "Admin dashboard data retrieved successfully"));
});
exports.getAllUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can view users");
    }
    const result = user_model_1.userFilterSchema.safeParse(req.query);
    if (!result.success) {
        return res.status(400).json({
            error: result.error.format()
        });
    }
    const { name, email, role, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = result.data;
    const where = {};
    if (name)
        where.name = { contains: name, mode: 'insensitive' };
    if (email)
        where.email = { contains: email, mode: 'insensitive' };
    if (role)
        where.role = role;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                role: true,
                createdAt: true,
                store: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit
        }),
        prisma_1.default.user.count({ where })
    ]);
    const totalPages = Math.ceil(total / limit);
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        users,
        pagination: { page, limit, total, totalPages }
    }, "Users retrieved successfully"));
});
exports.createUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can create users");
    }
    const result = user_model_1.adminCreateUserSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: result.error.format()
        });
    }
    const { name, email, password, address } = result.data;
    const { role = 'NORMAL_USER' } = req.body;
    const existingUser = await prisma_1.default.user.findUnique({
        where: { email }
    });
    if (existingUser) {
        throw new apiError_1.ApiError(409, "User with this email already exists");
    }
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const newUser = await prisma_1.default.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            address,
            role: role
        },
        select: {
            id: true,
            name: true,
            email: true,
            address: true,
            role: true,
            createdAt: true
        }
    });
    res.status(201).json(new apiResponse_1.ApiResponse(201, newUser, "User created successfully"));
});
exports.updateUserRole = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { userId } = req.params;
    const { role } = req.body;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can update user roles");
    }
    if (!userId || !role) {
        throw new apiError_1.ApiError(400, "User ID and role are required");
    }
    if (!Object.values(client_1.UserRole).includes(role)) {
        throw new apiError_1.ApiError(400, "Invalid role specified");
    }
    const existingUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
    });
    if (!existingUser) {
        throw new apiError_1.ApiError(404, "User not found");
    }
    const updatedUser = await prisma_1.default.user.update({
        where: { id: userId },
        data: { role },
        select: {
            id: true,
            name: true,
            email: true,
            address: true,
            role: true,
            createdAt: true
        }
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, updatedUser, "User role updated successfully"));
});
exports.deleteUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { userId } = req.params;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can delete users");
    }
    if (!userId) {
        throw new apiError_1.ApiError(400, "User ID is required");
    }
    if (userId === user.id) {
        throw new apiError_1.ApiError(400, "Cannot delete your own account");
    }
    const existingUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
        include: {
            store: true,
            ratings: true
        }
    });
    if (!existingUser) {
        throw new apiError_1.ApiError(404, "User not found");
    }
    await prisma_1.default.$transaction(async (tx) => {
        if (existingUser.ratings.length > 0) {
            await tx.rating.deleteMany({
                where: { userId }
            });
        }
        if (existingUser.store) {
            await tx.store.delete({
                where: { id: existingUser.store.id }
            });
        }
        await tx.user.delete({
            where: { id: userId }
        });
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, null, "User deleted successfully"));
});
