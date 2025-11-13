import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors"

const app = express();

app.use(
  cors({
    origin: [
      "https://roxiler-rate-my-store-project-full.vercel.app", // Production frontend
      "http://localhost:5173", // Vite frontend (HTTP)
      "http://localhost:3000", // Next.js/React local (HTTP)
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ limit: '16kb', extended: true }));
app.use(cookieParser())

app.get('/health', (_req, res) => {
    res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

import userRoutes from "./routes/user.Routes";
import storeOwner from "./routes/storeowner.routes"
import adminRoutes from './routes/admin.routes'
import storeRoutes from './routes/store.routes'
import ratingRoutes from './routes/rating.routes'

app.use("/v1/api/users", userRoutes);
app.use("/v1/api/storeowner", storeOwner)
app.use("/v1/api/admin", adminRoutes)
app.use("/v1/api/stores", storeRoutes)
app.use("/v1/api/ratings", ratingRoutes)

export { app }
