import swaggerJSDoc from "swagger-jsdoc";

// Swagger configuration options
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Documentation",
            version: "1.0.0",
            description:
                "Comprehensive documentation for our API, including endpoints, request/response formats, and security requirements.",
            contact: {
                name: "Teknis Support",
                email: "teknis@pandi.id",
            },
            "x-logo": {
                url: "../public/images/logo.png",
                backgroundColor: "#FFFFFF",
                altText: "API Logo",
                size: "10x10",
            },
        },
        servers: [
            {
                url: "http://localhost:5000",
                description: "Development server",
            },
        ],
        components: {
            securitySchemes: {
                xSignature: {
                    type: "apiKey",
                    in: "header",
                    name: "x-signature",
                    description: `  
                        Signature for request validation. This header is used to ensure the integrity and authenticity of the request.   
                        The signature is generated using the following steps:  
                        1. Minify the JSON body: Remove null values while retaining the original formatting of the \`payer\` field.  
                        2. Hash the minified body: Use SHA-256 to hash the minified JSON body.  
                        3. Create a string: Format the string as \`HTTP_METHOD:ENDPOINT_URL:HASHED_BODY:TIMESTAMP\`.  
                        4. Sign the string: Use HMAC with SHA-256 and a secret key to sign the string.  
                        5. Encode the signature: The final signature is encoded in Base64.  
                          
                        This signature must be included in all requests to secure endpoints. Ensure that the timestamp is current to prevent replay attacks.  
                    `,
                },
                xTimestamp: {
                    type: "apiKey",
                    in: "header",
                    name: "x-timestamp",
                    description: `  
                        Timestamp for authorization. This header should contain the current time in ISO 8601 format.   
                        Example: \`2025-01-13T08:10:31.778+07:00\`  
                        - Format: \`YYYY-MM-DDTHH:mm:ss.sss±hh:mm\` 
                    `,
                },
                xPartnerId: {
                    type: "apiKey",
                    in: "header",
                    name: "x-partner-id",
                    description: "Partner ID for authorization. This identifies the partner making the request.",
                },
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description:
                        "JWT Bearer token for authorization. Include this token in the Authorization header as 'Bearer {token}'.",
                },
            },
        },
        security: [
            {
                xSignature: [],
                xTimestamp: [],
                xPartnerId: [],
            },
        ],
    },
    apis: ["./src/routers/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
