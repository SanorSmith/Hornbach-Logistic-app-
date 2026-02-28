"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllHistory = exports.getPointHistory = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getPointHistory = async (req, res) => {
    try {
        const { pointId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const history = await prisma.statusHistory.findMany({
            where: { pointId },
            include: {
                user: {
                    select: { fullName: true, email: true }
                },
                point: {
                    select: { pointNumber: true }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: limit
        });
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid hämtning av historik' });
    }
};
exports.getPointHistory = getPointHistory;
const getAllHistory = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const history = await prisma.statusHistory.findMany({
            include: {
                user: {
                    select: { fullName: true, email: true }
                },
                point: {
                    select: { pointNumber: true, department: { select: { name: true } } }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset
        });
        const total = await prisma.statusHistory.count();
        res.json({ history, total, limit, offset });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid hämtning av historik' });
    }
};
exports.getAllHistory = getAllHistory;
