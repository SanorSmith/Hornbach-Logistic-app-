"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRCode = exports.scanQRCode = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const scanQRCode = async (req, res) => {
    try {
        const { qrCode } = req.body;
        if (!qrCode) {
            return res.status(400).json({ message: 'QR-kod krävs' });
        }
        const point = await prisma.redPoint.findUnique({
            where: { qrCode },
            include: {
                department: true,
                currentUser: {
                    select: { id: true, fullName: true }
                }
            }
        });
        if (!point) {
            return res.status(404).json({ message: 'Ogiltig QR-kod' });
        }
        res.json({ point });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid skanning av QR-kod' });
    }
};
exports.scanQRCode = scanQRCode;
const generateQRCode = async (req, res) => {
    try {
        const { pointId } = req.params;
        const point = await prisma.redPoint.findUnique({
            where: { id: pointId },
            include: { department: true }
        });
        if (!point) {
            return res.status(404).json({ message: 'Punkt hittades inte' });
        }
        res.json({
            qrCode: point.qrCode,
            pointNumber: point.pointNumber,
            department: point.department.name
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid generering av QR-kod' });
    }
};
exports.generateQRCode = generateQRCode;
