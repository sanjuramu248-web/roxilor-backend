"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchStores = exports.deleteStore = exports.getStoreOwnerDashboard = exports.getStoreById = exports.getAllStores = exports.updateStore = exports.createStore = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const store_model_1 = require("../models/store.model");
const apiError_1 = require("../utils/apiError");
const apiResponse_1 = require("../utils/apiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
const database_1 = require("../utils/database");
const calculateAverageRating = (ratings) => {
    if (!ratings || ratings.length === 0)
        return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
};
exports.createStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can create stores");
    }
    const result = store_model_1.storeCreateSchema.safeParse(req.body);
    if (!result.success) {
        console.log('Store creation validation failed:', result.error);
        return res.status(400).json({
            error: result.error.format()
        });
    }
    const { name, email, address, ownerId } = result.data;
    console.log('Creating store with data:', { name, email, address, ownerId });
    const [existingStore, ownerExists] = await Promise.all([
        prisma_1.default.store.findUnique({
            where: { email },
            select: { id: true, name: true }
        }),
        prisma_1.default.user.findUnique({
            where: { id: ownerId },
            select: { id: true, name: true, email: true, role: true, store: { select: { id: true, name: true } } }
        })
    ]);
    console.log('Existing store check:', existingStore);
    console.log('Owner exists check:', ownerExists);
    if (existingStore) {
        console.log('Conflict: Store email already exists');
        throw new apiError_1.ApiError(409, `A store with email "${email}" already exists (Store: ${existingStore.name})`);
    }
    if (!ownerExists) {
        console.log('Error: Owner not found');
        throw new apiError_1.ApiError(404, "Selected owner not found in database");
    }
    if (ownerExists.store) {
        console.log('Conflict: User already owns a store');
        throw new apiError_1.ApiError(409, `User "${ownerExists.name}" already owns a store: "${ownerExists.store.name}"`);
    }
    const store = await prisma_1.default.$transaction(async (tx) => {
        const newStore = await tx.store.create({
            data: { name, email, address, ownerId },
            include: {
                owner: {
                    select: { id: true, name: true, email: true }
                }
            }
        });
        if (ownerExists.role !== client_1.UserRole.STORE_OWNER) {
            await tx.user.update({
                where: { id: ownerId },
                data: { role: client_1.UserRole.STORE_OWNER }
            });
        }
        return newStore;
    });
    res.status(201).json(new apiResponse_1.ApiResponse(201, store, "Store created successfully"));
});
exports.updateStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can update stores");
    }
    if (!id) {
        throw new apiError_1.ApiError(400, "Store ID is required");
    }
    const result = store_model_1.storeUpdateSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(200).json({
            error: result.error.format()
        });
    }
    const updateData = result.data;
    const existingStore = await prisma_1.default.store.findUnique({
        where: { id },
        select: { id: true, email: true }
    });
    if (!existingStore) {
        throw new apiError_1.ApiError(404, "Store not found");
    }
    if (updateData.email && updateData.email !== existingStore.email) {
        const emailConflict = await prisma_1.default.store.findUnique({
            where: { email: updateData.email },
            select: { id: true }
        });
        if (emailConflict) {
            throw new apiError_1.ApiError(409, "Store with this email already exists");
        }
    }
    const updatedStore = await prisma_1.default.store.update({
        where: { id },
        data: updateData,
        include: {
            owner: {
                select: { id: true, name: true, email: true }
            }
        }
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, updatedStore, "Store updated successfully"));
});
exports.getAllStores = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = store_model_1.storeFilterSchema.safeParse(req.query);
    if (!result.success) {
        return res.status(200).json({
            error: result.error.format()
        });
    }
    const { name, address, email, sortBy, sortOrder, page = 1, limit = 10 } = result.data;
    const where = (0, database_1.buildStoreWhereClause)({ name, address, email });
    const pagination = (0, database_1.buildPaginationQuery)(page, limit);
    const queryOptions = {
        where,
        include: {
            owner: {
                select: { id: true, name: true, email: true }
            },
            ratings: {
                select: { rating: true }
            }
        },
        skip: pagination.skip,
        take: pagination.take
    };
    if (sortBy && sortBy !== 'rating') {
        queryOptions.orderBy = { [sortBy]: sortOrder || 'asc' };
    }
    const [stores, total] = await Promise.all([
        prisma_1.default.store.findMany(queryOptions),
        prisma_1.default.store.count({ where })
    ]);
    const formattedStores = stores.map((store) => {
        const { ratings, ...storeData } = store;
        return {
            ...storeData,
            averageRating: calculateAverageRating(ratings || []),
            totalRatings: ratings ? ratings.length : 0
        };
    });
    if (sortBy === 'rating') {
        formattedStores.sort((a, b) => {
            return sortOrder === 'desc'
                ? b.averageRating - a.averageRating
                : a.averageRating - b.averageRating;
        });
    }
    const totalPages = Math.ceil(total / limit);
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        stores: formattedStores,
        pagination: { page, limit, total, totalPages }
    }, "Stores retrieved successfully"));
});
exports.getStoreById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new apiError_1.ApiError(400, "Store ID is required");
    }
    const store = await prisma_1.default.store.findUnique({
        where: { id },
        include: {
            owner: {
                select: { id: true, name: true, email: true }
            },
            ratings: {
                select: {
                    id: true,
                    rating: true,
                    createdAt: true,
                    user: {
                        select: { id: true, name: true }
                    }
                }
            }
        }
    });
    if (!store) {
        throw new apiError_1.ApiError(404, "Store not found");
    }
    const formattedStore = {
        ...store,
        averageRating: calculateAverageRating(store.ratings),
        totalRatings: store.ratings.length
    };
    res.status(200).json(new apiResponse_1.ApiResponse(200, formattedStore, "Store retrieved successfully"));
});
exports.getStoreOwnerDashboard = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user || user.role !== client_1.UserRole.STORE_OWNER) {
        throw new apiError_1.ApiError(403, "Only store owners can access dashboard");
    }
    const store = await prisma_1.default.store.findUnique({
        where: { ownerId: user.id },
        include: {
            ratings: {
                select: {
                    id: true,
                    rating: true,
                    createdAt: true,
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    });
    if (!store) {
        throw new apiError_1.ApiError(404, "No store found for this user");
    }
    const averageRating = calculateAverageRating(store.ratings);
    const totalRatings = store.ratings.length;
    const ratingDistribution = {
        5: store.ratings.filter(r => r.rating === 5).length,
        4: store.ratings.filter(r => r.rating === 4).length,
        3: store.ratings.filter(r => r.rating === 3).length,
        2: store.ratings.filter(r => r.rating === 2).length,
        1: store.ratings.filter(r => r.rating === 1).length
    };
    const dashboardData = {
        store: {
            id: store.id,
            name: store.name,
            email: store.email,
            address: store.address,
            createdAt: store.createdAt
        },
        statistics: {
            averageRating,
            totalRatings,
            ratingDistribution
        },
        recentRatings: store.ratings.slice(0, 10),
        customers: store.ratings.map(r => r.user)
    };
    res.status(200).json(new apiResponse_1.ApiResponse(200, dashboardData, "Store dashboard data retrieved successfully"));
});
exports.deleteStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!user || user.role !== client_1.UserRole.SYSTEM_ADMIN) {
        throw new apiError_1.ApiError(403, "Only system administrators can delete stores");
    }
    if (!id) {
        throw new apiError_1.ApiError(400, "Store ID is required");
    }
    const store = await prisma_1.default.store.findUnique({
        where: { id },
        select: { id: true, ownerId: true }
    });
    if (!store) {
        throw new apiError_1.ApiError(404, "Store not found");
    }
    await prisma_1.default.$transaction(async (tx) => {
        await tx.store.delete({ where: { id } });
        await tx.user.update({
            where: { id: store.ownerId },
            data: { role: client_1.UserRole.NORMAL_USER }
        });
    });
    res.status(200).json(new apiResponse_1.ApiResponse(200, null, "Store deleted successfully"));
});
exports.searchStores = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { query, page = 1, limit = 10 } = req.query;
    if (!query || typeof query !== 'string') {
        throw new apiError_1.ApiError(400, "Search query is required");
    }
    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
        throw new apiError_1.ApiError(400, "Search query must be at least 2 characters");
    }
    const where = {
        OR: [
            {
                name: {
                    contains: searchQuery,
                    mode: 'insensitive'
                }
            },
            {
                address: {
                    contains: searchQuery,
                    mode: 'insensitive'
                }
            }
        ]
    };
    const pagination = (0, database_1.buildPaginationQuery)(Number(page), Number(limit));
    const [stores, total] = await Promise.all([
        prisma_1.default.store.findMany({
            where,
            include: {
                owner: {
                    select: { id: true, name: true, email: true }
                },
                ratings: {
                    select: { rating: true }
                }
            },
            ...pagination,
            orderBy: { name: 'asc' }
        }),
        prisma_1.default.store.count({ where })
    ]);
    const formattedStores = stores.map((store) => {
        const { ratings, ...storeData } = store;
        return {
            ...storeData,
            averageRating: calculateAverageRating(ratings || []),
            totalRatings: ratings ? ratings.length : 0
        };
    });
    const totalPages = Math.ceil(total / Number(limit));
    res.status(200).json(new apiResponse_1.ApiResponse(200, {
        stores: formattedStores,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages
        },
        searchQuery
    }, "Store search completed successfully"));
});
