"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Ingen åtkomsttoken tillhandahållen' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Användare hittades inte eller är inaktiv' });
        }
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId || undefined
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ message: 'Ogiltig eller utgången token' });
    }
};
exports.requireAuth = requireAuth;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Obehörig' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Otillräckliga behörigheter' });
        }
        next();
    };
};
exports.requireRole = requireRole;
