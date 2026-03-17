import { eq, and } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning();

  const createdUser = newUser[0];
  if (!createdUser) {
    set.status = 500;
    return { error: "Failed to create user" };
  }

  const token = await jwt.sign({ userId: createdUser.id });

  set.status = 201;
  return {
    id: createdUser.id,
    username: createdUser.username,
    email: createdUser.email,
    token,
    balance: createdUser.balance,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    token,
    balance: user.balance,
    isAdmin: user.isAdmin,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  const newMarket = market[0];
  if (!newMarket) {
    set.status = 500;
    return { error: "Failed to create market" };
  }

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: newMarket.id,
        title,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: newMarket.id,
    title: newMarket.title,
    description: newMarket.description,
    status: newMarket.status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string; sortBy?: string; page?: number } }) {
  const statusFilter = (query.status || "active") as "active" | "resolved";
  const page = query.page || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
    orderBy: (markets, { desc }) => desc(markets.createdAt),
  });

  const enrichedMarkets = await Promise.all(
    markets.map(async (market) => {
      const betsPerOutcome = await Promise.all(
        market.outcomes.map(async (outcome) => {
          const totalBets = await db
            .select()
            .from(betsTable)
            .where(eq(betsTable.outcomeId, outcome.id));

          const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
          return { outcomeId: outcome.id, totalBets: totalAmount };
        }),
      );

      const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);
      const allBets = await db.select().from(betsTable).where(eq(betsTable.marketId, market.id));
      const participantsCount = new Set(allBets.map((b) => b.userId)).size;

      return {
        id: market.id,
        title: market.title,
        status: market.status,
        creator: market.creator?.username,
        createdAt: market.createdAt,
        participantsCount,
        outcomes: market.outcomes.map((outcome) => {
          const outcomeBets =
            betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
          const odds =
            totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

          return {
            id: outcome.id,
            title: outcome.title,
            odds,
            totalBets: outcomeBets,
          };
        }),
        totalMarketBets,
      };
    }),
  );

  const sortBy = query.sortBy || "date";
  if (sortBy === "total") {
    enrichedMarkets.sort((a, b) => b.totalMarketBets - a.totalMarketBets);
  } else if (sortBy === "participants") {
    enrichedMarkets.sort((a, b) => b.participantsCount - a.participantsCount);
  }

  const total = enrichedMarkets.length;
  const paginated = enrichedMarkets.slice(offset, offset + limit);

  return {
    markets: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const errors = validateBet(amount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  if (user.balance < amount) {
    set.status = 400;
    return { errors: [{ field: "amount", message: "Insufficient balance" }] };
  }

  await db
    .update(usersTable)
    .set({ balance: user.balance - amount })
    .where(eq(usersTable.id, user.id));

  const bet = await db
    .insert(betsTable)
    .values({
      userId: user.id,
      marketId,
      outcomeId,
      amount: Number(amount),
    })
    .returning();

  const newBet = bet[0];
  if (!newBet) {
    set.status = 500;
    return { error: "Failed to place bet" };
  }

  set.status = 201;
  return {
    id: newBet.id,
    userId: newBet.userId,
    marketId: newBet.marketId,
    outcomeId: newBet.outcomeId,
    amount: newBet.amount,
    newBalance: user.balance - amount,
  };
}

export async function handleGetProfile({
  query,
  user,
}: {
  query: { activePage?: number; resolvedPage?: number };
  user: typeof usersTable.$inferSelect;
}) {
  const activePage = query.activePage || 1;
  const resolvedPage = query.resolvedPage || 1;
  const limit = 20;

  const allBets = await db.query.betsTable.findMany({
    where: eq(betsTable.userId, user.id),
    with: {
      market: true,
      outcome: true,
    },
  });

  const activeBets = allBets.filter((bet) => bet.market.status === "active");
  const resolvedBets = allBets.filter((bet) => bet.market.status === "resolved");

  const enrichedActiveBets = await Promise.all(
    activeBets.map(async (bet) => {
      const allOutcomeBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.marketId, bet.marketId));
      const totalMarket = allOutcomeBets.reduce((sum, b) => sum + b.amount, 0);
      const outcomeBets = allOutcomeBets
        .filter((b) => b.outcomeId === bet.outcomeId)
        .reduce((sum, b) => sum + b.amount, 0);
      const odds = totalMarket > 0 ? Number(((outcomeBets / totalMarket) * 100).toFixed(2)) : 0;

      return {
        id: bet.id,
        marketId: bet.marketId,
        marketTitle: bet.market.title,
        outcomeTitle: bet.outcome.title,
        amount: bet.amount,
        odds,
        createdAt: bet.createdAt,
      };
    }),
  );

  const enrichedResolvedBets = resolvedBets.map((bet) => ({
    id: bet.id,
    marketId: bet.marketId,
    marketTitle: bet.market.title,
    outcomeTitle: bet.outcome.title,
    amount: bet.amount,
    won: bet.market.resolvedOutcomeId === bet.outcomeId,
    createdAt: bet.createdAt,
  }));

  const paginatedActive = enrichedActiveBets.slice((activePage - 1) * limit, activePage * limit);
  const paginatedResolved = enrichedResolvedBets.slice((resolvedPage - 1) * limit, resolvedPage * limit);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: user.balance,
    },
    activeBets: {
      data: paginatedActive,
      total: activeBets.length,
      totalPages: Math.ceil(activeBets.length / limit),
      page: activePage,
    },
    resolvedBets: {
      data: paginatedResolved,
      total: resolvedBets.length,
      totalPages: Math.ceil(resolvedBets.length / limit),
      page: resolvedPage,
    },
  };
}

export async function handleGetLeaderboard() {
  const users = await db.query.usersTable.findMany();

  const leaderboard = await Promise.all(
    users.map(async (user) => {
      const userBets = await db.query.betsTable.findMany({
        where: eq(betsTable.userId, user.id),
        with: {
          market: true,
        },
      });

      const totalWinnings = userBets
        .filter(
          (bet) =>
            bet.market.status === "resolved" &&
            bet.market.resolvedOutcomeId === bet.outcomeId,
        )
        .reduce((sum, bet) => sum + bet.amount, 0);

      return {
        id: user.id,
        username: user.username,
        totalWinnings,
        balance: user.balance,
      };
    }),
  );

  leaderboard.sort((a, b) => b.totalWinnings - a.totalWinnings);

  return { leaderboard };
}

export async function handleResolveMarket({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (!user.isAdmin) {
    set.status = 403;
    return { error: "Forbidden" };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: { outcomes: true },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = market.outcomes.find((o) => o.id === body.outcomeId);
  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  await db
    .update(marketsTable)
    .set({ status: "resolved", resolvedOutcomeId: body.outcomeId })
    .where(eq(marketsTable.id, params.id));

  const allBets = await db.select().from(betsTable).where(eq(betsTable.marketId, params.id));
  const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);

  const winningBets = allBets.filter((bet) => bet.outcomeId === body.outcomeId);
  const totalWinningAmount = winningBets.reduce((sum, bet) => sum + bet.amount, 0);

  for (const bet of winningBets) {
    const winnerShare = totalWinningAmount > 0 ? bet.amount / totalWinningAmount : 0;
    const payout = totalPool * winnerShare;

    const winner = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, bet.userId),
    });

    if (winner) {
      await db
        .update(usersTable)
        .set({ balance: winner.balance + payout })
        .where(eq(usersTable.id, bet.userId));
    }
  }

  return { success: true, message: "Market resolved and payouts distributed" };
}

export async function handleArchiveMarket({
  params,
  set,
  user,
}: {
  params: { id: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (!user.isAdmin) {
    set.status = 403;
    return { error: "Forbidden" };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const allBets = await db.select().from(betsTable).where(eq(betsTable.marketId, params.id));

  for (const bet of allBets) {
    const bettor = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, bet.userId),
    });

    if (bettor) {
      await db
        .update(usersTable)
        .set({ balance: bettor.balance + bet.amount })
        .where(eq(usersTable.id, bet.userId));
    }
  }

  await db
    .update(marketsTable)
    .set({ status: "resolved" })
    .where(eq(marketsTable.id, params.id));

  return { success: true, message: "Market archived and funds returned" };
}

export async function handleGenerateApiKey({
  set,
  user,
}: {
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const apiKey = crypto.randomUUID().replace(/-/g, "");

  await db
    .update(usersTable)
    .set({ apiKey })
    .where(eq(usersTable.id, user.id));

  return { apiKey };
}