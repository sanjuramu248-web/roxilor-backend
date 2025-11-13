"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfile = exports.getUserProfile = exports.loginUser = exports.registerUser = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const user_model_1 = require("../models/user.model");
const apiError_1 = require("../utils/apiError");
const apiResponse_1 = require("../utils/apiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jwt_1 = require("../utils/jwt");
exports.registerUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = user_model_1.userSignupSchema.safeParse(req.body);
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
            role: "NORMAL_USER"
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
    res.status(201).json(new apiResponse_1.ApiResponse(201, {
        user,
    }, "User registered successfully"));
});
exports.loginUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = user_model_1.userLoginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(200).json({
            error: result.error.format()
        });
    }
    const { email, password } = result.data;
    const user = await prisma_1.default.user.findUnique({
        where: { email }
    });
    if (!user) {
        throw new apiError_1.ApiError(401, "Invalid email or password");
    }
    const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        throw new apiError_1.ApiError(401, "Invalid email or password");
    }
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
    const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        address: user.address,
        role: user.role,
        createdAt: user.createdAt
    };
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        user: userResponse,
        accessToken,
        refreshToken
    }, "Login successful"));
});
exports.getUserProfile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new apiError_1.ApiError(401, "User not authenticated");
    }
    res.status(200).json(new apiResponse_1.ApiResponse(200, { user }, "Profile retrieved successfully"));
});
exports.updateUserProfile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { name, address } = req.body;
    if (!user) {
        throw new apiError_1.ApiError(401, "User not authenticated");
    }
    const updatedUser = await prisma_1.default.user.update({
        where: { id: user.id },
        data: {
            ...(name && { name }),
            ...(address && { address })
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
    res.status(200).json(new apiResponse_1.ApiResponse(200, { user: updatedUser }, "Profile updated successfully"));
});
