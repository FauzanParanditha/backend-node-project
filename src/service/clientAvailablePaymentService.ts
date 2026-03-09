import { ResponseError } from "../error/responseError.js";
import ClientAvailablePayment from "../models/clientAvailablePaymentModel.js";
import Client from "../models/clientModel.js";

const assertClientOwnership = async ({ clientId, userId }: { clientId: string; userId: string }) => {
    const client = await Client.findOne({ clientId, userIds: { $in: [userId] } });
    if (!client) throw new ResponseError(403, "Access forbidden");
    return client;
};

export const getClientAvailablePayments = async ({ clientId, userId }: { clientId: string; userId: string }) => {
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

export const updateClientAvailablePayment = async ({
    clientId,
    userId,
    availablePaymentId,
    active,
}: {
    clientId: string;
    userId: string;
    availablePaymentId: string;
    active: boolean;
}) => {
    await assertClientOwnership({ clientId, userId });

    const existing = await ClientAvailablePayment.findOne({ clientId, availablePaymentId });
    if (!existing) throw new ResponseError(404, "Client available payment not found");

    // Prevent setting the last active method to false
    if (active === false && existing.active === true) {
        const activeCount = await ClientAvailablePayment.countDocuments({ clientId, active: true });
        if (activeCount <= 1) {
            throw new ResponseError(
                400,
                "Cannot deactivate the only active payment method remaining. At least one payment method must remain active.",
            );
        }
    }

    existing.active = Boolean(active);
    await existing.save();
    return existing;
};
