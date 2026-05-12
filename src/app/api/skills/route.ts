import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as Record<string, unknown>).id as string : null;

    const skills = await db.skill.findMany({
      orderBy: { order: "asc" },
      include: {
        userSkills: userId
          ? { where: { userId } }
          : false,
        _count: { select: { challenges: true } },
      },
    });

    const result = skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      icon: skill.icon,
      category: skill.category,
      order: skill.order,
      parentId: skill.parentId,
      requiredXp: skill.requiredXp,
      challengeCount: skill._count.challenges,
      xp: skill.userSkills?.[0]?.xp || 0,
      level: skill.userSkills?.[0]?.level || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Skills error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
