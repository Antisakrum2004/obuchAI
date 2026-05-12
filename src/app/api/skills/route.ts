import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user
      ? (session.user as Record<string, unknown>).id as string
      : null;

    // Get all skills with challenge count
    const skillsResult = await query(`
      SELECT s.id, s.name, s.slug, s.description, s.icon, s.category, s."order", s."parentId", s."requiredXp",
        (SELECT COUNT(*) FROM challenges c WHERE c."skillId" = s.id) AS "challengeCount"
      FROM skills s
      ORDER BY s."order" ASC
    `);

    // Get user's skill progress if logged in
    const userSkillsMap = new Map<string, { xp: number; level: number }>();
    if (userId) {
      const usResult = await query(
        `SELECT "skillId", xp, level FROM user_skills WHERE "userId" = $1`,
        [userId],
      );
      for (const row of usResult.rows) {
        userSkillsMap.set(row.skillId, { xp: row.xp, level: row.level });
      }
    }

    const result = skillsResult.rows.map((skill) => {
      const userSkill = userSkillsMap.get(skill.id);
      return {
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        icon: skill.icon,
        category: skill.category,
        order: skill.order,
        parentId: skill.parentId,
        requiredXp: skill.requiredXp,
        challengeCount: Number(skill.challengeCount),
        xp: userSkill?.xp || 0,
        level: userSkill?.level || 0,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Skills error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
