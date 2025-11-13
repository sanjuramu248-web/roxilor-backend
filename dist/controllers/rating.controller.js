"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserStoreRating = exports.getStoreRatings = exports.getUserRatings = exports.updateRating = exports.submitRating = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const rating_model_1 = require("../models/rating.model");
const apiError_1 = require("../utils/apiError");
const apiResponse_1 = require("../utils/apiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
exports.submitRating = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new apiError_1.ApiError(401, "Unauthorized");
    }
    if (user.role !== client_1.UserRole.NORMAL_USER) {
        throw new apiError_1.ApiError(403, "Only normal users can submit ratings");
    }
    const userId = user.id;
    const result = rating_model_1.ratingCreateSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: result.error.format()
        });
    }
    const { rating, storeId } = result.data;
    const store = await prisma_1.default.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true }
    });
    if (!store) {
        throw new apiError_1.ApiError(404, "Store not found");
    }
    const existingRating = await prisma_1.default.rating.findUnique({
        where: {
            userId_storeId: {
                userId,
                storeId
            }
        }
    });
    if (existingRating) {
        throw new apiError_1.ApiError(409, "You have already rated this store. Use update instead.");
    }
    const newRating = await prisma_1.default.rating.create({
        data: {
            rating,
            userId,
            storeId
        },
        include: {
            store: {
                select: {
                    name: true
                }
            }
        }
    });
    res.status(201).json(new apiResponse_1.ApiResponse(201, newRating, "Rating submitted successfully"));
});
exports.updateRating = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { ratingId } = req.params;
    if (!user) {
        throw new apiError_1.ApiError(401, "Unauthorized");
    }
    if (user.role !== client_1.UserRole.NORMAL_USER) {
        throw new apiError_1.ApiError(403, "Only normal users can update ratings");
    }
    const userId = user.id;
    if (!ratingId) {
        throw new apiError_1.ApiError(400, "Rating ID is required");
    }
    const result = rating_model_1.ratingUpdateSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: result.error.format()
        });
    }
    const { rating } = result.data;
    const existingRating = await prisma_1.default.rating.findUnique({
        where: { id: ratingId },
        include: {
            store: {
                select: { name: true }
            }
        }
    });
    if (!existingRating) {
        throw new apiError_1.ApiError(404, "Rating not found");
    }
    if (existingRating.userId !== userId) {
        throw new apiError_1.ApiError(403, "You can only update your own ratings");
    }
    const updatedRating = await prisma_1.default.rating.update({
        where: { id: ratingId },
        data: { rating },
        include: {
            store: {
                select: { name: true }
            }
        }
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, updatedRating, "Rating updated successfully"));
});
exports.getUserRatings = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new apiError_1.ApiError(401, "Unauthorized");
    }
    if (user.role !== client_1.UserRole.NORMAL_USER) {
        throw new apiError_1.ApiError(403, "Only normal users can view their ratings");
    }
    const userId = user.id;
    const ratings = await prisma_1.default.rating.findMany({
        where: { userId },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    address: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, ratings, "User ratings retrieved successfully"));
});
exports.getStoreRatings = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new apiError_1.ApiError(401, "Unauthorized");
    }
    if (user.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(403, "Only store owners can view store ratings");
    }
    const userId = user.id;
    const store = await prisma_1.default.store.findUnique({
        where: { ownerId: userId },
        select: { id: true }
    });
    if (!store) {
        throw new apiError_1.ApiError(404, "No store found for this user");
    }
    const ratings = await prisma_1.default.rating.findMany({
        where: { storeId: store.id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        ratings,
        averageRating: Math.round(averageRating * 10) / 10,
        totalRatings: ratings.length
    }, "Store ratings retrieved successfully"));
});
exports.getUserStoreRating = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { storeId } = req.params;
    if (!user) {
        throw new apiError_1.ApiError(401, "Unauthorized");
    }
    if (user.role !== client_1.UserRole.NORMAL_USER) {
        throw new apiError_1.ApiError(403, "Only normal users can check their store ratings");
    }
    const userId = user.id;
    if (!storeId) {
        throw new apiError_1.ApiError(400, "Store ID is required");
    }
    const rating = await prisma_1.default.rating.findUnique({
        where: {
            userId_storeId: {
                userId,
                storeId
            }
        },
        include: {
            store: {
                select: {
                    name: true
                }
            }
        }
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, rating, "User store rating retrieved successfully"));
});
