import { ResponseError } from "../error/responseError.js";
import ClientAvailablePayment from "../models/clientAvailablePaymentModel.js";
import Client from "../models/clientModel.js";

const assertClientOwnership = async ({ clientId, userId }) => {
    const client = await Client.findOne({ clientId, userId });
    if (!client) throw new ResponseError(403, "Access forbidden");
    return client;
};

export const getClientAvailablePayments = async ({ clientId, userId }) => {
    await assertClientOwnership({ clientId, userId });

    const items = await ClientAvailablePayment.find({ clientId })
        .populate({
            path: "availablePaymentId",
            model: "AvailablePayment",
            select: "name image category active",
        })
        .exec();

    return items.map((item) => ({
        id: item._id,
        clientId: item.clientId,
        active: item.active,
        availablePayment: item.availablePaymentId,
    }));
};

export const updateClientAvailablePayment = async ({ clientId, userId, availablePaymentId, active }) => {
    await assertClientOwnership({ clientId, userId });

    const existing = await ClientAvailablePayment.findOne({ clientId, availablePaymentId });
    if (!existing) throw new ResponseError(404, "Client available payment not found");

    existing.active = Boolean(active);
    await existing.save();
    return existing;
};
