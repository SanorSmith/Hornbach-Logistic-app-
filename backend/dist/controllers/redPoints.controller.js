"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRedPoint = exports.createRedPoint = exports.updateRedPointStatus = exports.getRedPointById = exports.getAllRedPoints = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER']),
    notes: zod_1.z.string().optional()
});
const getAllRedPoints = async (req, res) => {
    try {
        const points = await prisma.redPoint.findMany({
            where: { isActive: true },
            include: {
                department: true,
                currentUser: {
                    select: { id: true, fullName: true }
                }
            },
            orderBy: { pointNumber: 'asc' }
        });
        res.json(points);
    }
    catch (error) {
        console.error('Get red points error:', error);
        res.status(500).json({ message: 'Fel vid hämtning av röda punkter' });
    }
};
exports.getAllRedPoints = getAllRedPoints;
const getRedPointById = async (req, res) => {
    try {
        const { id } = req.params;
        const point = await prisma.redPoint.findUnique({
            where: { id },
            include: {
                department: true,
                currentUser: {
                    select: { id: true, fullName: true, email: true }
                }
            }
        });
        if (!point) {
            return res.status(404).json({ message: 'Röd punkt hittades inte' });
        }
        res.json(point);
    }
    catch (error) {
        res.status(500).json({ message: 'Serverfel' });
    }
};
exports.getRedPointById = getRedPointById;
const updateRedPointStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = updateStatusSchema.parse(req.body);
        const userId = req.user.id;
        const point = await prisma.redPoint.findUnique({
            where: { id }
        });
        if (!point) {
            return res.status(404).json({ message: 'Röd punkt hittades inte' });
        }
        const updatedPoint = await prisma.redPoint.update({
            where: { id },
            data: {
                status: status,
                currentUserId: status === 'UPPTAGEN' ? userId : null,
                lastUpdated: new Date()
            },
            include: {
                department: true,
                currentUser: {
                    select: { id: true, fullName: true }
                }
            }
        });
        await prisma.statusHistory.create({
            data: {
                pointId: id,
                userId: userId,
                oldStatus: point.status,
                newStatus: status,
                actionType: 'STATUS_CHANGE',
                notes
            }
        });
        if (status === 'KUNDORDER') {
            const linefeeders = await prisma.user.findMany({
                where: {
                    role: 'LINEFEEDER',
                    isActive: true
                }
            });
            for (const linefeeder of linefeeders) {
                await prisma.notification.create({
                    data: {
                        userId: linefeeder.id,
                        pointId: id,
                        type: 'KUNDORDER',
                        message: `Kundorder redo vid punkt ${point.pointNumber}`,
                        priority: 5
                    }
                });
            }
        }
        res.json(updatedPoint);
    }
    catch (error) {
        console.error('Update status error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: 'Ogiltiga indata', errors: error.errors });
        }
        res.status(500).json({ message: 'Fel vid uppdatering av status' });
    }
};
exports.updateRedPointStatus = updateRedPointStatus;
const createRedPoint = async (req, res) => {
    try {
        const { pointNumber, departmentId, locationX, locationY } = req.body;
        const qrCode = `RP-${pointNumber}-${Date.now()}`;
        const point = await prisma.redPoint.create({
            data: {
                pointNumber: parseInt(pointNumber),
                departmentId,
                qrCode,
                locationX: locationX ? parseFloat(locationX) : null,
                locationY: locationY ? parseFloat(locationY) : null
            },
            include: { department: true }
        });
        res.status(201).json(point);
    }
    catch (error) {
        console.error('Create red point error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Punktnummer finns redan' });
        }
        res.status(500).json({ message: 'Fel vid skapande av röd punkt' });
    }
};
exports.createRedPoint = createRedPoint;
const deleteRedPoint = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.redPoint.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({ message: 'Röd punkt borttagen' });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid borttagning' });
    }
};
exports.deleteRedPoint = deleteRedPoint;
