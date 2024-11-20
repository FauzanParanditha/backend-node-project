# Node.js Express MongoDB Paylabs Integration

This project demonstrates integrating **Paylabs** payment gateway into a **Node.js** application using **Express** and **MongoDB**. It provides features for payment handling, such as creating transactions, QRIS payments, and callback handling.

## Features

- Payment gateway integration with **Paylabs**
- Support for **QRIS** , **Virtual Account**, **Credit Card**, **E-Money**, **HTML-5** payments
- MongoDB for storing transaction and order data
- Robust API structure using Express
- Modular code with controllers, services, model, and utilities
- Request validation with **Joi**
- Logging with **Winston**

---

## Project Structure

```
src/
├── controllers/       # Route handler logic
├── services/          # Business logic
├── models/            # MongoDB schemas
├── routes/            # API endpoints
├── utils/             # Utility functions (e.g., helpers)
└── index.js           # Main entry point
```

---

## Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (v16+ recommended)
- **MongoDB**
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
   MONGO_URI=mongodb://localhost:27017/your-database
   PAYLABS_API_URL=https://paylabs-provide
   PAYLABS_MERCHANT_ID=your_merchant_id
   NOTIFY_URL=https://your-domain.com/callback/paylabs
   REDIRECT_URL=https://your-domain.com/
   ```

---

## Usage

1. Run the project:

   ```bash
   npm start
   ```

2. Access the API at `http://localhost:5000`.

---

## Key API Endpoints

| Method | Endpoint                            | Description                             |
| ------ | ----------------------------------- | --------------------------------------- |
| POST   | `/api/order/create`                 | Create a HTML 5 payment transaction     |
| POST   | `/api/order/create/qris`            | Create a QRIS payment transaction       |
| POST   | `/api/order/create/va/snap`         | Create a virtual account SNAP payment   |
| POST   | `/api/order/create/va`              | Create a virtual account payment        |
| POST   | `/api/order/create/va/static`       | Create a virtual account static payment |
| POST   | `/api/order/create/cc`              | Create a credit card payment            |
| POST   | `/api/order/create/ewallet`         | Create a e-wallet payment               |
| POST   | `/api/order/webhook/paylabs`        | Handle payment notifications            |
| POST   | `/api/order/webhook/paylabs/va`     | Handle payment notifications va static  |
| POST   | `/api/order/webhook/paylabs/vaSnap` | Handle payment notifications va SNAP    |
| GET    | `/api/orders`                       | Fetch orders from the database          |

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
