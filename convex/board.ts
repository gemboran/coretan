import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAllOrThrow } from "convex-helpers/server/relationships";

const images = [
  "/placeholders/1.svg",
  "/placeholders/2.svg",
  "/placeholders/3.svg",
  "/placeholders/4.svg",
  "/placeholders/5.svg",
  "/placeholders/6.svg",
  "/placeholders/7.svg",
  "/placeholders/8.svg",
  "/placeholders/9.svg",
  "/placeholders/10.svg",
];

export const create = mutation({
  args: {
    orgId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const randomImage = images[Math.floor(Math.random() * images.length)];

    const board = await ctx.db.insert("boards", {
      title: args.title,
      orgId: args.orgId,
      authorId: identity.subject,
      authorName: identity.name!,
      imageUrl: randomImage,
    });

    console.log("[CREATE_BOARD] Success");

    return board;
  },
});

export const get = query({
  args: {
    orgId: v.string(),
    search: v.optional(v.string()),
    favorites: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.favorites) {
      const favoriteBoards = await ctx.db
        .query("userFavorites")
        .withIndex("by_user_org", (q) =>
          q.eq("userId", identity.subject).eq("orgId", args.orgId),
        )
        .order("desc")
        .collect();
      const ids = favoriteBoards.map((board) => board.boardId);

      const boards = await getAllOrThrow(ctx.db, ids);

      console.log("[GET_BOARDS] Success");

      return boards.map((board) => ({
        ...board,
        isFavorite: true,
      }));
    }

    const title = args.search as string;
    let boards = [];
    if (title) {
      boards = await ctx.db
        .query("boards")
        .withSearchIndex("search_title", (q) =>
          q.search("title", title).eq("orgId", args.orgId),
        )
        .collect();
    } else {
      boards = await ctx.db
        .query("boards")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .order("desc")
        .collect();
    }

    const boardsWithFavorite = Promise.all(
      boards.map((board) =>
        ctx.db
          .query("userFavorites")
          .withIndex("by_user_board", (q) =>
            q.eq("userId", identity.subject).eq("boardId", board._id),
          )
          .unique()
          .then((favorite) => ({ ...board, isFavorite: !!favorite })),
      ),
    );

    console.log("[GET_BOARDS] Success");

    return boardsWithFavorite;
  },
});

export const remove = mutation({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    // TODO: Check if board created by user
    // TODO: Check if user is admin of organization
    if (!identity) throw new Error("Unauthorized");

    const existingFavorite = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_board", (q) =>
        q.eq("userId", identity.subject).eq("boardId", args.id),
      )
      .unique();
    if (existingFavorite) {
      await ctx.db.delete(existingFavorite._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: { id: v.id("boards"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    // TODO: Check if board created by user
    // TODO: Check if user is admin of organization
    if (!identity) throw new Error("Unauthorized");

    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    if (title.length > 60)
      throw new Error("Title cannot be longer than 60 characters");

    const board = await ctx.db.patch(args.id, {
      title: args.title,
    });

    console.log("[UPDATE_BOARD] Success");

    return board;
  },
});

export const favorite = mutation({
  args: { id: v.id("boards"), orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const board = await ctx.db.get(args.id);
    if (!board) throw new Error("Board not found");

    const existingFavorite = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_board_org", (q) =>
        q
          .eq("userId", identity.subject)
          .eq("boardId", board._id)
          .eq("orgId", args.orgId),
      )
      .unique();
    if (existingFavorite) {
      await ctx.db.delete(existingFavorite._id);
    } else {
      await ctx.db.insert("userFavorites", {
        userId: identity.subject,
        boardId: board._id,
        orgId: args.orgId,
      });
    }

    return board;
  },
});
