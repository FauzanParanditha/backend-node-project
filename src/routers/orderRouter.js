import express from "express";
import { ccOrderStatus, createCreditCard } from "../controllers/ccController.js";
import { createEMoney, createEMoneyRefund, eMoneyOrderStatus } from "../controllers/eMoneyController.js";
import {
    createOrder,
    createOrderLink,
    editOrder,
    order,
    orderNoLimit,
    orders,
} from "../controllers/orderController.js";
import { paylabsCallback, paylabsVaStaticCallback } from "../controllers/paymentController.js";
import { cancleQris, createQris, qrisOrderStatus } from "../controllers/qrisController.js";
import { createStaticVa, createVA, vaOrderStatus } from "../controllers/vaController.js";
import {
    createVASNAP,
    deleteVASNAP,
    updateVASNAP,
    VaSnapCallback,
    vaSNAPOrderStatus,
} from "../controllers/vaSnapController.js";
import { balance, xenditCallback } from "../controllers/xenditController.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { jwtMiddlewareVerify } from "../middlewares/verifyMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management
 */

/**
 * @swagger
 * components:
 *   headers:
 *     X-Signature:
 *       description: |
 *         Signature for request validation. The signature is created using the following steps:
 *         1. **Minify the JSON body**: Remove null values while retaining the original formatting of the `payer` field.
 *         2. **Hash the minified body**: Use SHA-256 to hash the minified JSON body.
 *         3. **Create a string**: Format the string as `HTTP_METHOD:ENDPOINT_URL:HASHED_BODY:TIMESTAMP`.
 *         4. **Sign the string**: Use HMAC with SHA-256 and a secret key to sign the string.
 *         5. **Encode the signature**: The final signature is encoded in Base64.
 */

router.get("/orders", jwtMiddlewareAdmin, orders);
router.get("/order", jwtMiddlewareAdmin, orderNoLimit);

/**
 * @swagger
 * /api/v1/order/create:
 *   post:
 *     summary: Create a new order paylabs link
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: integer
 *                       example: 10000
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: integer
 *                 example: 10000
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 enum: ["paylabs", "other_method"]
 *                 example: "paylabs"
 *     responses:
 *       200:
 *         description: Order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create", jwtMiddlewareVerify, createOrder);

/**
 * @swagger
 * /api/v1/order/create/link:
 *   post:
 *     summary: Create a new order link
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: integer
 *                       example: 10000
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: integer
 *                 example: 10000
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 enum: ["paylabs", "other_method"]
 *                 example: "paylabs"
 *     responses:
 *       200:
 *         description: Order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/link", jwtMiddlewareVerify, createOrderLink);

router.post("/order/webhook/xendit", xenditCallback);

/**
 * @swagger
 * /api/v1/order/{id}:
 *   get:
 *     summary: Get an order by ID
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get("/order/:id", jwtMiddlewareVerify, order);
router.get("/order/status/:id", jwtMiddlewareAdmin, order);

router.put("/order/:id", jwtMiddlewareAdmin, editOrder);
router.get("/xendit/balance", jwtMiddlewareAdmin, balance);

// Paylabs
router.post("/order/webhook/paylabs", express.raw({ type: "application/json" }), paylabsCallback);

/**
 * @swagger
 * /api/v1/order/create/qris:
 *   post:
 *     summary: Create a QRIS order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: string
 *                       example: "10000"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: string
 *                 example: "10000"
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "QRIS"
 *     responses:
 *       200:
 *         description: QRIS order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/qris", jwtMiddlewareVerify, createQris);

/**
 * @swagger
 * /api/v1/order/status/qris/{id}:
 *   get:
 *     summary: Get QRIS order status
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the QRIS order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: QRIS order status
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get("/order/status/qris/:id", jwtMiddlewareVerify, qrisOrderStatus);

/**
 * @swagger
 * /api/v1/order/cancel/qris/{id}:
 *   post:
 *     summary: Cancel a QRIS order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the QRIS order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: QRIS order canceled successfully
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.post("/order/cancel/qris/:id", jwtMiddlewareVerify, cancleQris);

/**
 * @swagger
 * /api/v1/order/create/va/snap:
 *   post:
 *     summary: Create a VA Snap order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: string
 *                       example: "10000"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: string
 *                 example: "10000"
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "MandiriVA"
 *     responses:
 *       200:
 *         description: VA Snap order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/va/snap", jwtMiddlewareVerify, createVASNAP);

/**
 * @swagger
 * /api/v1/order/status/va/snap/{id}:
 *   get:
 *     summary: Get VA Snap order status
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the VA Snap order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: VA Snap order status
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get("/order/status/va/snap/:id", jwtMiddlewareVerify, vaSNAPOrderStatus);

router.post("/order/webhook/paylabs/vaSnap", VaSnapCallback);

/**
 * @swagger
 * /api/v1/order/update/va/snap/{id}:
 *   post:
 *     summary: Update a VA Snap order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the VA Snap order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: string
 *                       example: "10000"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: string
 *                 example: "10000"
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "MandiriVA"
 *     responses:
 *       200:
 *         description: VA Snap order updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.post("/order/update/va/snap/:id", jwtMiddlewareVerify, updateVASNAP);

router.delete("/order/delete/va/snap/:id", jwtMiddlewareVerify, deleteVASNAP);

/**
 * @swagger
 * /api/v1/order/create/va:
 *   post:
 *     summary: Create a VA order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: string
 *                       example: "10000"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: string
 *                 example: "10000"
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "BNIVA"
 *     responses:
 *       200:
 *         description: VA order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/va", jwtMiddlewareVerify, createVA);

/**
 * @swagger
 * /api/v1/order/status/va/{id}:
 *   get:
 *     summary: Get VA order status
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the VA order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: VA order status
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get("/order/status/va/:id", jwtMiddlewareVerify, vaOrderStatus);

/**
 * @swagger
 * /api/v1/order/create/va/static:
 *   post:
 *     summary: Create a static VA order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "StaticMandiriVA"
 *     responses:
 *       200:
 *         description: Static VA order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/va/static", jwtMiddlewareVerify, createStaticVa);

router.post("/order/webhook/paylabs/va", paylabsVaStaticCallback);

/**
 * @swagger
 * /api/v1/order/create/cc:
 *   post:
 *     summary: Create a credit card order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: string
 *                       example: "10000"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: string
 *                 example: "10000"
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "CreditCard"
 *     responses:
 *       200:
 *         description: Credit card order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/cc", jwtMiddlewareVerify, createCreditCard);

/**
 * @swagger
 * /api/v1/order/status/cc/{id}:
 *   get:
 *     summary: Get credit card order status
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the credit card order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: Credit card order status
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get("/order/status/cc/:id", jwtMiddlewareVerify, ccOrderStatus);

/**
 * @swagger
 * /api/v1/order/create/ewallet:
 *   post:
 *     summary: Create an e-wallet order
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "671f3ac"
 *                     price:
 *                       type: string
 *                       example: "10000"
 *                     quantity:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "sample"
 *                     type:
 *                       type: string
 *                       example: "sample"
 *               totalAmount:
 *                 type: string
 *                 example: "10000"
 *               phoneNumber:
 *                 type: string
 *                 example: "1234567890"
 *               paymentMethod:
 *                 type: string
 *                 example: "paylabs"
 *               paymentType:
 *                 type: string
 *                 example: "SHOPEEBALANCE"
 *     responses:
 *       200:
 *         description: E-wallet order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/order/create/ewallet", jwtMiddlewareVerify, createEMoney);

/**
 * @swagger
 * /api/v1/order/status/ewallet/{id}:
 *   get:
 *     summary: Get e-wallet order status
 *     tags: [Orders]
 *     security:
 *       - xSignature: []
 *       - xTimestamp: []
 *       - xPartnerId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the e-wallet order
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: Request signature for authentication
 *       - in: header
 *         name: x-timestamp
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp of the request
 *       - in: header
 *         name: x-partner-id
 *         schema:
 *           type: string
 *         required: true
 *         description: Partner ID for authentication
 *     responses:
 *       200:
 *         description: E-wallet order status
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 */
router.get("/order/status/ewallet/:id", jwtMiddlewareVerify, eMoneyOrderStatus);

router.post("/order/refund/ewallet/:id", jwtMiddlewareVerify, createEMoneyRefund);

export default router;
