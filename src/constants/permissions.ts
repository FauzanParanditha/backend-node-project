/**
 * Permission constants — single source of truth for the RBAC system.
 * Format: "resource:action"
 */
export const PERMISSIONS = {
    // ── Admin management ────────────────────────────────────────────
    ADMIN_LIST: "admin:list",
    ADMIN_READ: "admin:read",
    ADMIN_CREATE: "admin:create",
    ADMIN_UPDATE: "admin:update",
    ADMIN_DELETE: "admin:delete",

    // ── User management ─────────────────────────────────────────────
    USER_LIST: "user:list",
    USER_READ: "user:read",
    USER_CREATE: "user:create",
    USER_UPDATE: "user:update",
    USER_DELETE: "user:delete",

    // ── Client management ───────────────────────────────────────────
    CLIENT_LIST: "client:list",
    CLIENT_READ: "client:read",
    CLIENT_CREATE: "client:create",
    CLIENT_UPDATE: "client:update",
    CLIENT_DELETE: "client:delete",

    // ── Client keys ─────────────────────────────────────────────────
    CLIENT_KEY_LIST: "client_key:list",
    CLIENT_KEY_READ: "client_key:read",
    CLIENT_KEY_CREATE: "client_key:create",
    CLIENT_KEY_UPDATE: "client_key:update",
    CLIENT_KEY_DELETE: "client_key:delete",

    // ── Orders ──────────────────────────────────────────────────────
    ORDER_LIST: "order:list",
    ORDER_READ: "order:read",
    ORDER_UPDATE: "order:update",
    ORDER_EXPORT: "order:export",

    // ── Categories ──────────────────────────────────────────────────
    CATEGORY_CREATE: "category:create",
    CATEGORY_UPDATE: "category:update",
    CATEGORY_DELETE: "category:delete",

    // ── Available payments ──────────────────────────────────────────
    PAYMENT_CREATE: "available_payment:create",
    PAYMENT_UPDATE: "available_payment:update",
    PAYMENT_DELETE: "available_payment:delete",

    // ── IP Whitelist ────────────────────────────────────────────────
    WHITELIST_LIST: "whitelist:list",
    WHITELIST_READ: "whitelist:read",
    WHITELIST_CREATE: "whitelist:create",
    WHITELIST_UPDATE: "whitelist:update",
    WHITELIST_DELETE: "whitelist:delete",

    // ── Dashboard ───────────────────────────────────────────────────
    DASHBOARD_VIEW: "dashboard:view",
    DASHBOARD_VIEW_REAL_AMOUNT: "dashboard:view_real_amount",

    // ── Logs ────────────────────────────────────────────────────────
    LOG_API: "log:api",
    LOG_EMAIL: "log:email",
    LOG_CALLBACK: "log:callback",
    LOG_ACTIVITY: "log:activity",
    LOG_RETRY: "log:retry",

    // ── Role management ─────────────────────────────────────────────
    ROLE_LIST: "role:list",
    ROLE_READ: "role:read",
    ROLE_CREATE: "role:create",
    ROLE_UPDATE: "role:update",
    ROLE_DELETE: "role:delete",

    // ── Developers ─────────────────────────────────────────────
    DEVELOPER_DOCS_READ: "developer_docs:read",
} as const;

/** Union type of all permission string values */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Flat array of every permission — useful for "super_admin" seeding */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * Pre-built permission sets for the default system roles.
 * Used by the role seeder and as documentation.
 */
export const DEFAULT_ROLE_PERMISSIONS = {
    super_admin: ALL_PERMISSIONS,

    admin: ALL_PERMISSIONS.filter((p) => !["role:create", "role:update", "role:delete"].includes(p)),

    finance: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.ORDER_LIST,
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.ORDER_EXPORT,
        PERMISSIONS.LOG_API,
        PERMISSIONS.LOG_EMAIL,
        PERMISSIONS.LOG_CALLBACK,
        PERMISSIONS.LOG_ACTIVITY,
        PERMISSIONS.CLIENT_LIST,
        PERMISSIONS.CLIENT_READ,
    ] as Permission[],

    user: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.ORDER_LIST,
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.ORDER_EXPORT,
        PERMISSIONS.CLIENT_LIST,
        PERMISSIONS.CLIENT_READ,
        PERMISSIONS.CLIENT_UPDATE,
        PERMISSIONS.CLIENT_KEY_LIST,
        PERMISSIONS.CLIENT_KEY_READ,
        PERMISSIONS.CLIENT_KEY_UPDATE,
    ] as Permission[],

    client: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.ORDER_LIST,
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.CLIENT_READ,
        PERMISSIONS.CLIENT_KEY_READ,
    ] as Permission[],
} as const;
