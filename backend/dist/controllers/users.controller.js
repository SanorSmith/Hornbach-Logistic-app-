"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.getAllUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    fullName: zod_1.z.string().min(2),
    role: zod_1.z.enum(['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'MONITOR', 'DEPARTMENT']),
    departmentId: zod_1.z.string().optional()
});
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            include: { department: true },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                departmentId: true,
                department: true,
                createdAt: true,
                lastLogin: true
            }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid hämtning av användare' });
    }
};
exports.getAllUsers = getAllUsers;
const createUser = async (req, res) => {
    try {
        const data = createUserSchema.parse(req.body);
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'E-postadressen används redan' });
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                fullName: data.fullName,
                role: data.role,
                departmentId: data.departmentId
            },
            include: { department: true }
        });
        res.status(201).json({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            departmentId: user.departmentId,
            department: user.department
        });
    }
    catch (error) {
        console.error('Create user error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Ogiltiga indata', errors: error.errors });
        }
        res.status(500).json({ message: 'Fel vid skapande av användare' });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, role, departmentId, isActive } = req.body;
        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(fullName && { fullName }),
                ...(role && { role }),
                ...(departmentId !== undefined && { departmentId }),
                ...(isActive !== undefined && { isActive })
            },
            include: { department: true }
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid uppdatering av användare' });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({ message: 'Användare borttagen' });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid borttagning av användare' });
    }
};
exports.deleteUser = deleteUser;
