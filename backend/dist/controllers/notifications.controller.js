"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.markAsRead = exports.getUserNotifications = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await prisma.notification.findMany({
            where: { userId },
            include: {
                point: {
                    select: {
                        pointNumber: true,
                        department: {
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: [
                { isRead: 'asc' },
                { priority: 'desc' },
                { createdAt: 'desc' }
            ],
            take: 50
        });
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid hämtning av notifieringar' });
    }
};
exports.getUserNotifications = getUserNotifications;
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const notification = await prisma.notification.findFirst({
            where: { id, userId }
        });
        if (!notification) {
            return res.status(404).json({ message: 'Notifiering hittades inte' });
        }
        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid uppdatering av notifiering' });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: 'Alla notifieringar markerade som lästa' });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid uppdatering av notifieringar' });
    }
};
exports.markAllAsRead = markAllAsRead;
