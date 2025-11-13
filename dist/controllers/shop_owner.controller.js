"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOwnStore = exports.createOwnStore = exports.updateStoreOwnerProfile = exports.getStoreOwnerProfile = exports.loginStoreOwner = exports.registerStoreOwner = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const asyncHandler_1 = require("../utils/asyncHandler");
const apiError_1 = require("../utils/apiError");
const apiResponse_1 = require("../utils/apiResponse");
const user_model_1 = require("../models/user.model");
const prisma_1 = __importDefault(require("../lib/prisma"));
const jwt_1 = require("../utils/jwt");
exports.registerStoreOwner = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = user_model_1.storeownerSignupSchema.safeParse(req.body);
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
            role: "STORE_OWNER"
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
    }, "Store owner registered successfully"));
});
exports.loginStoreOwner = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = user_model_1.userLoginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(200).json({
            error: result.error.format()
        });
    }
    const { email, password } = result.data;
    const storeOwner = await prisma_1.default.user.findUnique({
        where: { email }
    });
    if (!storeOwner || storeOwner.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(401, "Invalid email or password");
    }
    const isPasswordCorrect = await bcrypt_1.default.compare(password, storeOwner.password);
    if (!isPasswordCorrect) {
        throw new apiError_1.ApiError(401, "Invalid email or password");
    }
    const accessToken = (0, jwt_1.generateAccessToken)(storeOwner.id);
    const refreshToken = (0, jwt_1.generateRefreshToken)(storeOwner.id);
    await prisma_1.default.user.update({
        where: { id: storeOwner.id },
        data: { refreshToken }
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    const userResponse = {
        id: storeOwner.id,
        name: storeOwner.name,
        email: storeOwner.email,
        address: storeOwner.address,
        role: storeOwner.role,
        createdAt: storeOwner.createdAt
    };
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        user: userResponse,
        accessToken,
        refreshToken
    }, "Login successful"));
});
exports.getStoreOwnerProfile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(403, "Only store owners can access this endpoint");
    }
    const storeOwner = await prisma_1.default.user.findUnique({
        where: { id: user.id },
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
                    name: true,
                    email: true,
                    address: true,
                    createdAt: true
                }
            }
        }
    });
    if (!storeOwner) {
        throw new apiError_1.ApiError(404, "Store owner not found");
    }
    res.status(200).json(new apiResponse_1.ApiResponse(200, storeOwner, "Store owner profile retrieved successfully"));
});
exports.updateStoreOwnerProfile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { name, address } = req.body;
    if (!user || user.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(403, "Only store owners can update their profile");
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
    res.status(200).json(new apiResponse_1.ApiResponse(200, updatedUser, "Profile updated successfully"));
});
exports.createOwnStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(403, "Only store owners can create their own store");
    }
    const existingStore = await prisma_1.default.store.findUnique({
        where: { ownerId: user.id },
        select: { id: true }
    });
    if (existingStore) {
        throw new apiError_1.ApiError(409, "You already have a store. Each store owner can only have one store.");
    }
    const { name, email, address } = req.body;
    if (!name || !email || !address) {
        throw new apiError_1.ApiError(400, "Store name, email, and address are required");
    }
    const emailExists = await prisma_1.default.store.findUnique({
        where: { email },
        select: { id: true }
    });
    if (emailExists) {
        throw new apiError_1.ApiError(409, "A store with this email already exists");
    }
    const store = await prisma_1.default.store.create({
        data: {
            name,
            email,
            address,
            ownerId: user.id
        },
        include: {
            owner: {
                select: { id: true, name: true, email: true }
            }
        }
    });
    res.status(201).json(new apiResponse_1.ApiResponse(201, store, "Store created successfully"));
});
exports.updateOwnStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(403, "Only store owners can update their store");
    }
    const existingStore = await prisma_1.default.store.findUnique({
        where: { ownerId: user.id },
        select: { id: true, email: true }
    });
    if (!existingStore) {
        throw new apiError_1.ApiError(404, "You don't have a store to update");
    }
    const { name, email, address } = req.body;
    if (email && email !== existingStore.email) {
        const emailConflict = await prisma_1.default.store.findUnique({
            where: { email },
            select: { id: true }
        });
        if (emailConflict) {
            throw new apiError_1.ApiError(409, "A store with this email already exists");
        }
    }
    const updatedStore = await prisma_1.default.store.update({
        where: { id: existingStore.id },
        data: {
            ...(name && { name }),
            ...(email && { email }),
            ...(address && { address })
        },
        include: {
            owner: {
                select: { id: true, name: true, email: true }
            }
        }
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, updatedStore, "Store updated successfully"));
});
