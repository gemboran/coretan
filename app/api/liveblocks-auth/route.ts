import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";
import { auth, currentUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const liveblocks = new Liveblocks({
  secret:
    "sk_dev_JCOO9zw_KGyyYxf5gfYPL8xcNpHhyiGp5pWUuwoyV2NzaYqtJ19XawaOGIVgPRRj",
});

export async function POST(request: Request) {
  const authorization = auth();
  const user = await currentUser();

  if (!authorization || !user)
    return new Response("Unauthorized", { status: 403 });

  const { room } = await request.json();
  const board = await convex.query(api.board.getOne, { id: room });

  if (board?.orgId !== authorization.orgId)
    return new Response("Unauthorized", { status: 403 });

  const userInfo = {
    name: user.firstName || "Teammate",
    picture: user.imageUrl,
  };

  const session = liveblocks.prepareSession(user.id, { userInfo });

  if (room) session.allow(room, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
