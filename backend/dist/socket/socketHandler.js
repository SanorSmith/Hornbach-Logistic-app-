"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToAll = exports.getConnectedUsers = exports.setupSocketHandlers = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../utils/logger"));
const connectedUsers = new Map();
const setupSocketHandlers = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Ingen token tillhandahållen'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.userId = decoded.userId;
            socket.data.role = decoded.role;
            next();
        }
        catch (error) {
            next(new Error('Ogiltig token'));
        }
    });
    io.on('connection', (socket) => {
        logger_1.default.info(`✅ User connected: ${socket.data.userId}`);
        connectedUsers.set(socket.id, {
            userId: socket.data.userId,
            socketId: socket.id,
            role: socket.data.role
        });
        io.emit('user:online', {
            userId: socket.data.userId,
            role: socket.data.role
        });
        socket.on('point:update', (data) => {
            io.emit('status:updated', data);
        });
        socket.on('disconnect', () => {
            logger_1.default.info(`❌ User disconnected: ${socket.data.userId}`);
            const user = connectedUsers.get(socket.id);
            if (user) {
                io.emit('user:offline', {
                    userId: user.userId,
                    role: user.role
                });
                connectedUsers.delete(socket.id);
            }
        });
    });
    logger_1.default.info('✅ Socket.io handlers configured');
};
exports.setupSocketHandlers = setupSocketHandlers;
const getConnectedUsers = () => {
    return Array.from(connectedUsers.values());
};
exports.getConnectedUsers = getConnectedUsers;
const emitToAll = (event, data, io) => {
    io.emit(event, data);
};
exports.emitToAll = emitToAll;
