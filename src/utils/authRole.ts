export const isAdminRole = (role?: string): boolean => {
    return role === "admin" || role === "finance" || role === "super_admin";
};

export const normalizeAdminActivityRole = (role?: string): "admin" | "finance" => {
    return role === "finance" ? "finance" : "admin";
};
