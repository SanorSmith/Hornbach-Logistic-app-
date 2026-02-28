"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getAllDepartments = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getAllDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            where: { isActive: true },
            include: {
                _count: {
                    select: { users: true, redPoints: true }
                }
            }
        });
        res.json(departments);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid hämtning av avdelningar' });
    }
};
exports.getAllDepartments = getAllDepartments;
const createDepartment = async (req, res) => {
    try {
        const { name, location } = req.body;
        const department = await prisma.department.create({
            data: { name, location }
        });
        res.status(201).json(department);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Avdelningsnamn finns redan' });
        }
        res.status(500).json({ message: 'Fel vid skapande av avdelning' });
    }
};
exports.createDepartment = createDepartment;
const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, isActive } = req.body;
        const department = await prisma.department.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(location !== undefined && { location }),
                ...(isActive !== undefined && { isActive })
            }
        });
        res.json(department);
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid uppdatering av avdelning' });
    }
};
exports.updateDepartment = updateDepartment;
const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.department.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({ message: 'Avdelning borttagen' });
    }
    catch (error) {
        res.status(500).json({ message: 'Fel vid borttagning av avdelning' });
    }
};
exports.deleteDepartment = deleteDepartment;
