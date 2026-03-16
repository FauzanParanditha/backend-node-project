export const isAdminRole = (role?: string): boolean => {
    return role === "admin" || role === "finance" || role === "super_admin";
};
