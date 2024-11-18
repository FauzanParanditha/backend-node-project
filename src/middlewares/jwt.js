import jwt from "jsonwebtoken";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";

export const jwtMiddleware = (req, res, next) => {
  let token;
  if (req.headers.client === "not-browser") {
    token = req.headers.authorization;
  } else {
    token = req.cookies["Authorization"];
  }

  if (!token) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized!",
    });
  }

  try {
    const userToken = token.split(" ")[1];
    const jwtVerified = jwt.verify(
      userToken,
      process.env.ACCESS_TOKEN_PRIVATE_KEY
    );
    if (jwtVerified) {
      req.user = jwtVerified;
      next();
    } else {
      throw new ResponseError(400, "Error in the token ");
    }
  } catch (error) {
    logger.error(`Error jwtMiddleware: ${error.message}`);
    next(error);
  }
};
