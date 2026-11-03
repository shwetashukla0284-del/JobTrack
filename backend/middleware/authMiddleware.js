const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    try {
        // Get Authorization header
        const authHeader = req.headers.authorization;

        // Check if token exists
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Not authorized, no token"
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        // Verify token
        // Only accept the algorithm we sign with
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        // Store user ID in request
        req.userId = decoded.userId;

        // Continue to the next middleware/controller
        next();

    } catch (error) {
        return res.status(401).json({
            message: "Not authorized, invalid token"
        });
    }
};

module.exports = protect;