"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const departments_routes_1 = __importDefault(require("./routes/departments.routes"));
const redPoints_routes_1 = __importDefault(require("./routes/redPoints.routes"));
const qr_routes_1 = __importDefault(require("./routes/qr.routes"));
const history_routes_1 = __importDefault(require("./routes/history.routes"));
const notifications_routes_1 = __importDefault(require("./routes/notifications.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const socketHandler_1 = require("./socket/socketHandler");
const logger_1 = __importDefault(require("./utils/logger"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true
    }
});
exports.io = io;
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/departments', departments_routes_1.default);
app.use('/api/red-points', redPoints_routes_1.default);
app.use('/api/qr', qr_routes_1.default);
app.use('/api/history', history_routes_1.default);
app.use('/api/notifications', notifications_routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use(errorHandler_1.errorHandler);
(0, socketHandler_1.setupSocketHandlers)(io);
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    logger_1.default.info(`🚀 Server running on port ${PORT}`);
    logger_1.default.info(`📊 Environment: ${process.env.NODE_ENV}`);
});
