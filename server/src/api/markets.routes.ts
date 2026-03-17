import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleCreateMarket, handleListMarkets, handleGetMarket, handlePlaceBet, handleGetProfile, handleGetLeaderboard, handleResolveMarket, handleArchiveMarket, handleGenerateApiKey } from "./handlers";

export const marketRoutes = new Elysia({ prefix: "/api" })
  .use(authMiddleware)
  .get("/markets", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
    }),
  })
  .get("/markets/:id", handleGetMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .get("/profile", handleGetProfile, {
          query: t.Object({
            activePage: t.Optional(t.Numeric()),
            resolvedPage: t.Optional(t.Numeric()),
          }),
        })
        .get("/leaderboard", handleGetLeaderboard, {})
        .post("/generate-api-key", handleGenerateApiKey, {})
        .post("/markets/:id/resolve", handleResolveMarket, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
          }),
        })
        .post("/markets/:id/archive", handleArchiveMarket, {
          params: t.Object({
            id: t.Numeric(),
          }),
        })
        .post("/markets", handleCreateMarket, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/markets/:id/bets", handlePlaceBet, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        }),
  );