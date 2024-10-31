import jwt from "jsonwebtoken";
import IPWhitelist from "../models/ipWhitelistModel.js";

export const jwtMiddlewareAdmin = async (req, res, next) => {
  let token;
  const clientIP = req.ip;
  // console.log(clientIP)

  if (req.headers.client === "not-browser") {
    token = req.headers.authorization;
  } else {
    token = req.cookies["Authorization"];
  }

  if (!token) {
    return res.status(403).json({
      success: false,

      message: "unauthorized!",
    });
  }

  const whitelistedIP = await IPWhitelist.findOne({ ipAddress: clientIP });

  if (!whitelistedIP) {
    return res.status(403).json({
      success: false,
      message: "access forbidden: Your IP address is not whitelisted.",
    });
  }

  try {
    const userToken = token.split(" ")[1];
    const jwtVerified = jwt.verify(
      userToken,
      process.env.ACCESS_TOKEN_ADMIN_PRIVATE_KEY
    );
    if (jwtVerified) {
      req.admin = jwtVerified;
      next();
    } else {
      throw new Error("error in the token ");
    }
  } catch (error) {
    console.error("Error jwtMiddleware:", error.message);
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};
