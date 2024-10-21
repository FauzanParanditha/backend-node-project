import jwt from "jsonwebtoken";

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
      code: 403,
      message: "unauthorized!",
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
      throw new Error("error in the token ");
    }
  } catch (error) {
    console.error("Error jwtMiddleware:", error.message);
    return res.status(500).json({
      success: false,
      code: 500,
      message: error.message,
    });
  }
};
