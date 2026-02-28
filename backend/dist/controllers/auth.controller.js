"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.refreshToken = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8)
});
const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { email },
            include: { department: true }
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Ogiltiga inloggningsuppgifter' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Ogiltiga inloggningsuppgifter' });
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                departmentId: user.departmentId,
                department: user.department
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Ogiltiga indata', errors: error.errors });
        }
        res.status(500).json({ message: 'Serverfel vid inloggning' });
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Ingen refresh token tillhandahållen' });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Användare hittades inte' });
        }
        const newAccessToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        res.json({ accessToken: newAccessToken });
    }
    catch (error) {
        res.status(401).json({ message: 'Ogiltig refresh token' });
    }
};
exports.refreshToken = refreshToken;
const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { department: true }
        });
        if (!user) {
            return res.status(404).json({ message: 'Användare hittades inte' });
        }
        res.json({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            departmentId: user.departmentId,
            department: user.department
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Serverfel' });
    }
};
exports.getMe = getMe;
