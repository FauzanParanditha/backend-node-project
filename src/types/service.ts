/** Shared params interface for paginated list queries */
export interface ListQueryParams {
    query?: string;
    limit?: number | string;
    page?: number | string;
    sort_by?: string;
    sort?: number | string;
    countOnly?: boolean;
}

/** Headers returned by Paylabs/internal services for res.set() */
export interface PaylabsResponseHeaders {
    "Content-Type": string;
    "X-TIMESTAMP": string;
    [key: string]: string;
}

/**
 * Error shape from Axios or Paylabs API calls.
 * Used in catch blocks that access error.response.data or error.status.
 */
export interface AxiosLikeError extends Error {
    status?: number;
    response?: {
        data: {
            responseMessage?: string;
            responseCode?: string;
            [key: string]: unknown;
        };
    };
}
