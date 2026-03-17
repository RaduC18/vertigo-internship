import { Elysia } from "elysia";
import { getUserById } from "../lib/auth";
import { getDb } from "../db";
import { usersTable } from "../db/schema";
import { eq } from "drizzle-orm";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .derive(async ({ headers, jwt }) => {
    const authHeader = headers["authorization"];

    if (!authHeader) {
      return { user: null };
    }

    // API Key authentication
    if (authHeader.startsWith("ApiKey ")) {
      const apiKey = authHeader.substring(7);
      const db = getDb();
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.apiKey, apiKey),
      });
      return { user: user ?? null };
    }

    // JWT authentication
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = await jwt.verify(token);
      if (!payload) {
        return { user: null };
      }
      const user = await getUserById(payload.userId);
      return { user };
    }

    return { user: null };
  })
  .as("plugin");