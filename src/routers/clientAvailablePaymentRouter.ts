import express from "express";
import {
    getClientAvailablePayments,
    updateClientAvailablePayment,
} from "../controllers/clientAvailablePaymentController.js";
import { jwtMiddleware } from "../middlewares/jwt.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/client-available-payments:
 *   get:
 *     summary: Get available payments for a client (user only)
 *     tags:
 *       - ClientAvailablePayment
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client available payments list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access forbidden
 */
router.get("/client-available-payments", jwtMiddleware, getClientAvailablePayments);

/**
 * @swagger
 * /api/v1/client-available-payments:
 *   patch:
 *     summary: Update active status for a client payment (user only)
 *     tags:
 *       - ClientAvailablePayment
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - availablePaymentId
 *               - active
 *             properties:
 *               clientId:
 *                 type: string
 *               availablePaymentId:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access forbidden
 */
router.patch("/client-available-payments", jwtMiddleware, updateClientAvailablePayment);

export default router;
