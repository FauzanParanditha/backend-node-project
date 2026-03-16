# Node.js Express MongoDB Paylabs Integration

This project demonstrates integrating **Paylabs** payment gateway into a **Node.js** application using **Express** and **MongoDB**. It provides features for payment handling, such as creating transactions, QRIS payments, and callback handling.

## Features

- Payment gateway integration with **Paylabs** (QRIS, VA, E-Wallet, CC)
- Fully typed using **TypeScript** for strict compile-time safety
- Robust testing ecosystem utilizing **Vitest** (Unit Tests & Mocks)
- Multi-stage **Docker** pipeline for lightweight production builds
- Request validation with **Joi** paired with self-documenting **Swagger** integrations
- Real-time Activity Monitoring via **Discord Webhooks** (Crash Logs, Revenue, Security, API Health)
- Scheduled 07:00 AM Cron reporting for executive revenue summaries

---

## Project Structure

```
src/
├── application/       # Core app configuration (DB, Logger, Web, Socket)
├── controllers/       # Route handler logic
├── service/           # Business logic
├── models/            # MongoDB schemas
├── routes/            # API endpoints
├── validators/        # Joi validation schemas
├── cron/              # Automated scheduled jobs
├── scripts/           # Standalone utilities
├── types/             # Shared TypeScript type definitions
└── index.ts           # Main entry point
```

---

## Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (v20+ recommended)
- **MongoDB**
- **Docker** (optional, for containerized deployments)
- **npm** or **yarn**

---

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/FauzanParanditha/backend-node-project.git
    cd your-repo
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file and configure the environment variables:

    ```env
    PORT=5000
    MONGODB_URI=mongodb://localhost:27017/your-database
    PAYLABS_API_URL=https://paylabs-provide
    PAYLABS_MERCHANT_ID=your_merchant_id
    NOTIFY_URL=https://your-domain.com/callback/paylabs
    REDIRECT_URL=https://your-domain.com/
    ```

4. Seed database:
    ```bash
    npm run seed:all  #for all seed
    ```

---

## Usage (Local)

1. Build the TypeScript codebase and start the server:

    ```bash
    npm run build
    npm start
    ```

2. Alternatively, run the development server with Hot-Reload:

    ```bash
    npm run dev
    ```

3. Run the Vitest testing suite:

    ```bash
    npm run test
    ```

---

## Usage (Docker Production)

Build and deploy the highly optimized multi-stage container:

```bash
docker build -t pg-backend .
docker run -p 5000:5000 --env-file .env pg-backend
```

2. Access the API at `http://localhost:5000`.

---

## Key API Endpoints

| Method | Endpoint                               | Description                             |
| ------ | -------------------------------------- | --------------------------------------- |
| POST   | `/api/v1/order/create`                 | Create a HTML 5 payment transaction     |
| POST   | `/api/v1/order/create/qris`            | Create a QRIS payment transaction       |
| POST   | `/api/v1/order/create/va/snap`         | Create a virtual account SNAP payment   |
| POST   | `/api/v1/order/create/va`              | Create a virtual account payment        |
| POST   | `/api/v1/order/create/va/static`       | Create a virtual account static payment |
| POST   | `/api/v1/order/create/cc`              | Create a credit card payment            |
| POST   | `/api/v1/order/create/ewallet`         | Create a e-wallet payment               |
| POST   | `/api/v1/order/webhook/paylabs`        | Handle payment notifications            |
| POST   | `/api/v1/order/webhook/paylabs/va`     | Handle payment notifications va static  |
| POST   | `/api/v1/order/webhook/paylabs/vaSnap` | Handle payment notifications va SNAP    |
| GET    | `/api/v1/orders`                       | Fetch orders from the database          |

---

## Example Payloads

### QRIS Payment

```json
{
  "products": [
    {
      "productId": "xxxx",
      "quantity": xxxx,
      "colors": xxxx,
      "sizes": xxxx
    }
  ],
  "userId": "xxxx",
  "phoneNumber": "xxxx",
  // "storeId": "xxxx", // optional for paylabs sub merchant
  "paymentMethod": "xxxx",
  "paymentType": "xxxx"
}
```

### Callback Notification

```json
{
    "merchantId": "xxxx",
    "requestId": "xxxx",
    "errCode": "xxxx",
    "paymentType": "xxxx",
    "amount": "xxx",
    "createTime": "xxxx",
    "successTime": "xxxx",
    "merchantTradeNo": "xxxx",
    "platformTradeNo": "xxxx",
    "status": "xxxx",
    "paymentMethodInfo": {
        "vaCode": "xxxx"
    },
    "productName": "xxxx",
    "transFeeRate": "xxxx",
    "transFeeAmount": "xxxx",
    "totalTransFee": "xxxx"
}
```

---

## Logging

This project uses **Winston** for structured logging. Logs are stored in the `/src/logs/` directory.

---

## Notes

- Refer to the [Paylabs API Documentation](https://paylabs.com/docs) for detailed API specifications.
- Make sure the `notifyUrl` in your `.env` matches the endpoint for handling callbacks.

---
