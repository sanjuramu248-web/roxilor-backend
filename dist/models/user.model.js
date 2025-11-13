"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAdmin = exports.adminCreateUserSchema = exports.storeownerSignupSchema = exports.userFilterSchema = exports.userUpdatePasswordSchema = exports.userLoginSchema = exports.userSignupSchema = exports.UserRole = void 0;
const zod_1 = require("zod");
exports.UserRole = zod_1.z.enum(['SYSTEM_ADMIN', 'NORMAL_USER', 'STORE_OWNER']);
exports.userSignupSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(60, 'Name must be at most 60 characters'),
    email: zod_1.z.string().email('Invalid email format'),
    address: zod_1.z
        .string()
        .max(400, 'Address must be at most 400 characters'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(16, 'Password must be at most 16 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
exports.userLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(1, 'Password required')
});
exports.userUpdatePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(8, 'Current password required'),
    newPassword: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(16, 'Password must be at most 16 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
exports.userFilterSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    role: exports.UserRole.optional(),
    sortBy: zod_1.z.enum(['name', 'email', 'createdAt']).optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
    page: zod_1.z.coerce.number().min(1).optional(),
    limit: zod_1.z.coerce.number().min(1).max(100).optional(),
});
exports.storeownerSignupSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(60, 'Name must be at most 60 characters'),
    email: zod_1.z.string().email('Invalid email format'),
    address: zod_1.z
        .string()
        .max(400, 'Address must be at most 400 characters'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(16, 'Password must be at most 16 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
exports.adminCreateUserSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(60, 'Name must be at most 60 characters'),
    email: zod_1.z.string().email('Invalid email format'),
    address: zod_1.z
        .string()
        .max(400, 'Address must be at most 400 characters'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(16, 'Password must be at most 16 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
exports.loginAdmin = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(16, 'Password must be at most 16 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
