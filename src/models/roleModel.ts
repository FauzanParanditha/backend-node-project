import type { Document, Types } from "mongoose";
import mongoose from "mongoose";
import type { Permission } from "../constants/permissions.js";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

export interface IRole extends Document {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    permissions: Permission[];
    /** System roles (super_admin, admin, finance) cannot be deleted via API */
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const roleSchema = new mongoose.Schema<IRole>(
    {
        name: {
            type: String,
            required: [true, "Role name is required"],
            trim: true,
            unique: true,
            minlength: [1, "Role name must have at least 1 character"],
            maxlength: [50, "Role name must have at most 50 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [255, "Description must have at most 255 characters"],
        },
        permissions: {
            type: [String],
            default: [],
            validate: {
                validator: (values: string[]) =>
                    values.every((v) => ALL_PERMISSIONS.includes(v as Permission)),
                message: "One or more permissions are invalid",
            },
        },
        isSystem: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    },
);

const Role = mongoose.model<IRole>("Role", roleSchema);
export default Role;
