import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  xpForDifficulty,
  streakBonus,
  calculateLevel,
  isStreakBroken,
  timeXpMultiplier,
  noHeartsXpMultiplier,
} from "@/lib/gamification";

// Generate a CUID-like ID
function genId(): string {
  return (
    "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
  );
}

// 4-hour cooldown for wrong answers
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const { id } = await params;
    const body = await request.json();
    const { answer, timeSpent } = body;

    // Get challenge
    const challengeResult = await query(
      `SELECT * FROM challenges WHERE id = $1`,
      [id],
    );

    if (challengeResult.rows.length === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    const challenge = challengeResult.rows[0];

    // CHECK 1: Already solved correctly → block
    const solvedResult = await query(
      `SELECT id FROM challenge_attempts WHERE "userId" = $1 AND "challengeId" = $2 AND "isCorrect" = true LIMIT 1`,
      [userId, id],
    );
    if (solvedResult.rows.length > 0) {
      return NextResponse.json(
        { error: "Вы уже решили эту задачу. Повторная отправка невозможна.", alreadySolved: true },
        { status: 400 },
      );
    }

    // CHECK 2: Wrong answer cooldown (4 hours)
    const lastWrongResult = await query(
      `SELECT "createdAt" FROM challenge_attempts WHERE "userId" = $1 AND "challengeId" = $2 AND "isCorrect" = false ORDER BY "createdAt" DESC LIMIT 1`,
      [userId, id],
    );
    if (lastWrongResult.rows.length > 0) {
      const lastWrongAt = new Date(lastWrongResult.rows[0].createdAt);
      const cooldownEnd = new Date(lastWrongAt.getTime() + COOLDOWN_MS);
      const now = new Date();

      if (now < cooldownEnd) {
        const remainingMs = cooldownEnd.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return NextResponse.json(
          {
            error: `Повторная попытка будет доступна через ${remainingMinutes} мин.`,
            cooldownUntil: cooldownEnd.toISOString(),
            cooldownRemainingMinutes: remainingMinutes,
          },
          { status: 429 },
        );
      }
    }

    // Validate answer
    let isCorrect = false;

    if (challenge.validationType === "static") {
      const correctAnswer = JSON.parse(challenge.correctAnswer);
      if (challenge.type === "multiple_choice") {
        // Normalize both sides to string for comparison (correctAnswer may be number or string)
        isCorrect = String(answer) === String(correctAnswer);
      } else if (
        challenge.type === "ordering" ||
        challenge.type === "workflow_build"
      ) {
        const userAnswer = Array.isArray(answer) ? answer : JSON.parse(answer);
        isCorrect =
          JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
      } else {
        // Unsupported type — always wrong
        isCorrect = false;
      }
    } else if (challenge.validationType === "pattern") {
      const config = challenge.validationConfig
        ? JSON.parse(challenge.validationConfig)
        : {};
      const keywords: string[] = config.keywords || [];
      if (keywords.length > 0) {
        const answerLower = answer.toLowerCase();
        isCorrect = keywords.every((kw: string) =>
          answerLower.includes(kw.toLowerCase()),
        );
      }
    }

    // Calculate XP
    const baseXp = xpForDifficulty(challenge.difficulty);

    // Time-based XP multiplier: full XP in ≤30s, -10% per additional 30s
    const timeMultiplier = isCorrect ? timeXpMultiplier(timeSpent || 0) : 0;

    // Check if user has hearts (computed dynamically: 3 - wrong answers in last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const wrongCountResult = await query(
      `SELECT COUNT(*) as count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = false AND "createdAt" >= $2`,
      [userId, thirtyMinAgo]
    );
    const currentHearts = Math.max(0, 3 - Number(wrongCountResult.rows[0]?.count || 0));
    const heartsMultiplier = isCorrect ? noHeartsXpMultiplier(currentHearts > 0) : 0;

    // Final XP = base * timeMultiplier * heartsMultiplier
    const xpEarned = isCorrect ? Math.max(Math.round(baseXp * timeMultiplier * heartsMultiplier), 1) : 0;

    // Create attempt
    const attemptId = genId();
    try {
      await query(
        `INSERT INTO challenge_attempts (id, "userId", "challengeId", answer, "isCorrect", "xpEarned", "timeSpent")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          attemptId,
          userId,
          id,
          JSON.stringify(answer),
          isCorrect,
          xpEarned,
          timeSpent || null,
        ],
      );
    } catch (insertErr) {
      // Fallback: try without timeSpent column (if migration not yet run)
      console.warn('Insert with timeSpent failed, trying without:', insertErr);
      await query(
        `INSERT INTO challenge_attempts (id, "userId", "challengeId", answer, "isCorrect", "xpEarned")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          attemptId,
          userId,
          id,
          JSON.stringify(answer),
          isCorrect,
          xpEarned,
        ],
      );
    }

    // If correct, award XP and update user
    if (isCorrect) {
      const userResult = await query(
        `SELECT xp, level, streak, "maxStreak", "lastActiveAt" FROM users WHERE id = $1`,
        [userId],
      );
      const user = userResult.rows[0];

      if (user) {
        const newXp = user.xp + xpEarned;
        const newLevel = calculateLevel(newXp);

        // Check streak
        let newStreak = user.streak;
        const broken = isStreakBroken(user.lastActiveAt);
        if (broken) {
          newStreak = 1;
        } else {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayAttemptsResult = await query(
            `SELECT COUNT(*) AS count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true AND "createdAt" >= $2`,
            [userId, todayStart],
          );
          const todayAttempts = Number(todayAttemptsResult.rows[0].count);
          if (todayAttempts <= 1) {
            newStreak = user.streak + 1;
          }
        }

        const bonusXp = streakBonus(newStreak);
        const totalXpEarned = xpEarned + bonusXp;
        const finalXp = newXp + bonusXp;
        const finalLevel = calculateLevel(finalXp);
        const maxStreak = Math.max(user.maxStreak, newStreak);

        // ★ Adaptive difficulty: increment consecutiveCorrect, reset consecutiveWrong
        await query(
          `UPDATE users SET xp = $1, level = $2, streak = $3, "maxStreak" = $4, "lastActiveAt" = $5, "consecutiveCorrect" = "consecutiveCorrect" + 1, "consecutiveWrong" = 0 WHERE id = $6`,
          [finalXp, finalLevel, newStreak, maxStreak, new Date(), userId],
        );

        // XP log for challenge
        const xpLogId1 = genId();
        await query(
          `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId") VALUES ($1, $2, $3, $4, $5)`,
          [xpLogId1, userId, xpEarned, "challenge", id],
        );

        if (bonusXp > 0) {
          const xpLogId2 = genId();
          await query(
            `INSERT INTO xp_logs (id, "userId", amount, reason) VALUES ($1, $2, $3, $4)`,
            [xpLogId2, userId, bonusXp, "streak_bonus"],
          );
        }

        // Mark daily challenge as completed if applicable
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        await query(
          `UPDATE daily_challenge_assignments
           SET completed = true, "completedAt" = $1
           WHERE "userId" = $2 AND "challengeId" = $3 AND date >= $4 AND date < $5 AND completed = false`,
          [new Date(), userId, id, today, tomorrow],
        );

        // Update user skill XP if challenge has a skill
        if (challenge.skillId) {
          const existingSkillResult = await query(
            `SELECT id, xp FROM user_skills WHERE "userId" = $1 AND "skillId" = $2`,
            [userId, challenge.skillId],
          );

          if (existingSkillResult.rows.length > 0) {
            const existingSkill = existingSkillResult.rows[0];
            await query(
              `UPDATE user_skills SET xp = $1 WHERE id = $2`,
              [existingSkill.xp + xpEarned, existingSkill.id],
            );
          } else {
            const userSkillId = genId();
            await query(
              `INSERT INTO user_skills (id, "userId", "skillId", xp, level) VALUES ($1, $2, $3, $4, 0)`,
              [userSkillId, userId, challenge.skillId, xpEarned],
            );
          }
        }

        // Check achievements
        const totalCorrectResult = await query(
          `SELECT COUNT(*) AS count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true`,
          [userId],
        );
        const totalCorrect = Number(totalCorrectResult.rows[0].count);

        const achievementConditions = [
          { slug: "first-challenge", check: totalCorrect >= 1 },
          { slug: "10-challenges", check: totalCorrect >= 10 },
          { slug: "50-challenges", check: totalCorrect >= 50 },
          { slug: "7-day-streak", check: newStreak >= 7 },
          { slug: "30-day-streak", check: newStreak >= 30 },
        ];

        const newAchievements: { name: string; description: string; icon: string; xpReward: number; slug: string }[] = [];

        for (const cond of achievementConditions) {
          if (cond.check) {
            const achievementResult = await query(
              `SELECT id, name, slug, description, icon, "xpReward" FROM achievements WHERE slug = $1`,
              [cond.slug],
            );
            if (achievementResult.rows.length > 0) {
              const achievement = achievementResult.rows[0];
              const existingResult = await query(
                `SELECT id FROM user_achievements WHERE "userId" = $1 AND "achievementId" = $2`,
                [userId, achievement.id],
              );
              if (existingResult.rows.length === 0) {
                const uaId = genId();
                await query(
                  `INSERT INTO user_achievements (id, "userId", "achievementId") VALUES ($1, $2, $3)`,
                  [uaId, userId, achievement.id],
                );
                if (achievement.xpReward > 0) {
                  await query(
                    `UPDATE users SET xp = xp + $1 WHERE id = $2`,
                    [achievement.xpReward, userId],
                  );
                  const achXpLogId = genId();
                  await query(
                    `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId") VALUES ($1, $2, $3, $4, $5)`,
                    [achXpLogId, userId, achievement.xpReward, "achievement", achievement.id],
                  );
                }
                // Track newly earned achievement for the response
                newAchievements.push({
                  name: achievement.name,
                  description: achievement.description,
                  icon: achievement.icon,
                  xpReward: achievement.xpReward || 0,
                  slug: achievement.slug,
                });
              }
            }
          }
        }

        return NextResponse.json({
          isCorrect,
          xpEarned: totalXpEarned,
          baseXp,
          bonusXp,
          explanation: challenge.explanation,
          newLevel: finalLevel,
          newStreak,
          leveledUp: finalLevel > user.level,
          timeMultiplier,
          heartsMultiplier,
          newAchievements,
        });
      }

      // Edge case: user not found in DB — return success with safe defaults
      return NextResponse.json({
        isCorrect,
        xpEarned: xpEarned,
        baseXp,
        bonusXp: 0,
        explanation: challenge.explanation,
        newLevel: 1,
        newStreak: 1,
        leveledUp: false,
      });
    }

    // ★ Adaptive difficulty: increment consecutiveWrong, reset consecutiveCorrect
    try {
      await query(
        `UPDATE users SET "consecutiveWrong" = "consecutiveWrong" + 1, "consecutiveCorrect" = 0 WHERE id = $1`,
        [userId],
      );
    } catch (adaptiveErr) {
      console.warn('Adaptive difficulty update failed:', adaptiveErr);
    }

    // Wrong answer response
    return NextResponse.json({
      isCorrect,
      xpEarned: 0,
      baseXp,
      bonusXp: 0,
      explanation: challenge.explanation,
      newLevel: ((session.user as Record<string, unknown>).level as number) || 1,
      newStreak: ((session.user as Record<string, unknown>).streak as number) || 0,
      leveledUp: false,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
